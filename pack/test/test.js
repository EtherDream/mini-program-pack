import crypto from 'node:crypto'
import pack from '../lib.js'
import unpack from '../../unpack/index.js'


function assert(exp, ...msg) {
  if (!exp) {
    console.error('assert:', ...msg)
    debugger
    process.exit(1)
  }
}

//
// 生成数据
//
const txtFileMap = {
  '': '',
  'empty.txt': '',
  'big.txt': '\x01'.repeat(1024 * 1024 * 4),
  ['long-key-txt'.repeat(1024 * 128)]: '\xFF',
}

let str = ''
for (let i = 0; i < 655360; i++) {
  str += String.fromCodePoint(i)
}
txtFileMap['unicode.txt'] = str

for (let i = 0; i < 65536; i++) {
  if (i !== 10) {
    const ch = String.fromCharCode(i)
    txtFileMap[ch + '.txt'] = i + ': ' + ch
  }
}

const binFileMap = {
  'empty-bin': Buffer.alloc(0),
  'big-bin': Buffer.alloc(1024 * 1024 * 4),
  ['long-key-bin'.repeat(1024)]: Buffer.from([0, 1, 2, 3]),
}

for (let i = 0; i < 65536; i++) {
  if (i !== 10) {
    const ch = String.fromCharCode(i)
    binFileMap[ch + '.bin'] = crypto.randomBytes(Math.random() * 16)
  }
}

//
// 验证数据
//
const wasmBrBuf = pack(binFileMap, txtFileMap)
const pkg = await unpack(wasmBrBuf)
const {files} = pkg

for (const [k, v] of Object.entries(txtFileMap)) {
  assert(files.includes(k), '[txt] pkg.files')
  assert(pkg.has(k), '[txt] pkg.has')

  assert(pkg.read(k) === v, '[txt] pkg.read')
}

for (const [k, v] of Object.entries(binFileMap)) {
  assert(files.includes(k), '[bin] pkg.files')
  assert(pkg.has(k), '[bin] pkg.has')

  const got = pkg.read(k)
  assert(v.equals(got))
  assert(got.byteOffset % 8 === 0)
}

assert(pkg.has('no-such-file') === false, 'no-such-file')

console.log('done')