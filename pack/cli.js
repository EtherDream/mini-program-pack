import fs from 'node:fs'
import zlib from 'node:zlib'
import {resolve} from 'node:path'
import {Command} from 'commander'
import pack from './lib.js'
import ver from './ver.js'


function formatNum(num) {
  return num.toLocaleString()
}

function main(args) {
  const baseDir = resolve(args.path)

  const toAbsolutePath = (path) => {
    return resolve(baseDir, path)
  }
  const binFilePathArr = (args.binary || []).map(toAbsolutePath)
  const txtFilePathArr = (args.text || []).map(toAbsolutePath)

  const binFilePathSet = new Set(binFilePathArr)
  const txtFilePathSet = new Set(txtFilePathArr)

  for (const path of txtFilePathSet) {
    if (binFilePathSet.delete(path)) {
      console.warn(path, '已切换到文本模式')
    }
  }
  const fileNum = binFilePathSet.size + txtFilePathSet.size
  if (fileNum === 0) {
    console.error('未指定输入文件')
    return
  }
  if (!args.output) {
    console.error('未指定输出文件')
    return
  }
  if (!/.wasm.br$/.test(args.output)) {
    console.warn('目标文件扩展名不是 .wasm.br')
  }

  console.log('根目录:', baseDir)

  const addFiles = (filePathSet, isBin) => {
    const map = {}

    for (const absPath of filePathSet) {
      if (!absPath.startsWith(baseDir)) {
        throw Error('文件 ' + absPath + ' 不在根目录下')
      }
      const relPath = absPath
        .replace(baseDir, '') // 去除根目录前缀
        .substring(1)         // 去除斜杠前缀
        .replace(/\\/g, '/')  // 目录分隔符统一使用 `/`

      const binData = fs.readFileSync(absPath)
      map[relPath] = isBin ? binData : binData.toString()

      console.log(isBin ? '[bin]' : '[txt]',
        relPath, '(' + formatNum(binData.length) + ' 字节)'
      )
    }
    return map
  }

  const binFileMap = addFiles(binFilePathSet, true)
  const txtFileMap = addFiles(txtFilePathSet, false)

  const wasmBuf = pack(binFileMap, txtFileMap)

  console.log('压缩中... (' + formatNum(wasmBuf.length) + ' 字节)')

  const brBuf = zlib.brotliCompressSync(wasmBuf, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY,
    }
  })
  fs.writeFileSync(args.output, brBuf)

  const ratioNum = brBuf.length / wasmBuf.length
  const ratioStr = (ratioNum * 100).toFixed(2) + '%'

  console.log('保存到', args.output,
    '(' + formatNum(brBuf.length) + ' 字节, 压缩率: ' + ratioStr + ')'
  )
}


new Command()
  .option('-b, --binary <files...>', '二进制文件')
  .option('-t, --text <files...>', '文本文件')
  .option('-o, --output <file>', '生成的包文件')
  .option('-p, --path <dir>', '原文件所在的目录', '.')
  .action(args => {
    try {
      main(args)
    } catch (err) {
      console.error(err.message)
    }
  })
  .version(ver)
  .parse(process.argv)
