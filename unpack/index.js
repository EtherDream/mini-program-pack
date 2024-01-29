const TYPE_BINARY = 0
const TYPE_ISO_8859_1 = 1
const TPYE_UTF_16 = 2

let maxStackLen = 32768


function readText(bin, type, offset, size) {
  const codes = (type === TYPE_ISO_8859_1)
    ? bin.subarray(offset, offset + size)
    : new Uint16Array(bin.buffer, bin.byteOffset + offset, size / 2)

  do {
    try {
      let str = ''
      for (let i = 0; i < size; i += maxStackLen) {
        const part = codes.subarray(i, i + maxStackLen)
        str += String.fromCharCode.apply(0, part)
      }
      return str
    } catch (err) {
      maxStackLen = (maxStackLen * 0.8) | 0
    }
  } while (maxStackLen)
}


class MiniPackage {
  constructor(map, bin) {
    this._map = map
    this._bin = bin
  }

  read(fileName) {
    const fileInfo = this._map.get(fileName)
    if (!fileInfo) {
      return
    }
    const [type, size, offset] = fileInfo
    if (type === TYPE_BINARY) {
      return this._bin.subarray(offset, offset + size)
    }
    return readText(this._bin, type, offset, size)
  }

  get files() {
    return Array.from(this._map.keys())
  }

  has(fileName) {
    return this._map.has(fileName)
  }
}


function unpack(ptrU32, ptrU8) {
  const fileNum = ptrU32[0]
  let offset = (1 + fileNum + 1) * 4

  const fileInfos = []
  let fileNames

  for (let i = 0;;) {
    const attr = ptrU32[1 + i]
    const type = attr >>> 30
    const size = attr << 2 >>> 2

    // 对齐到 8 的整数倍
    offset = (offset + 7) & -8

    // 最后一个为虚拟文件，用于存储文件名
    if (i === fileNum) {
      const fileNameText = readText(ptrU8, type, offset, size)
      fileNames = fileNameText.split('\n')
      break
    }
    fileInfos[i] = [type, size, offset]
    offset += size
    i++
  }

  const entries = fileNames.map((fileName, i) => {
    return [fileName, fileInfos[i]]
  })
  const map = new Map(entries)
  return new MiniPackage(map, ptrU8)
}


function getNativeDecoder() {
  const native =
    typeof wx === 'object' ? wx :
    typeof my === 'object' ? my :
    typeof tt === 'object' ? tt :
    0
  if (!native) {
    return
  }
  const fs = native.getFileSystemManager() || {}
  const {readCompressedFile} = fs
  if (!readCompressedFile) {
    return
  }
  return (wasmBrPath) => new Promise((resolve, reject) => {
    readCompressedFile({
      filePath: wasmBrPath,
      compressionAlgorithm: 'br',
      success(res) {
        const buffer = res.data
        const u32 = new Uint32Array(buffer)
        const dataLen = u32[u32.length - 1]

        const offset = buffer.byteLength - dataLen
        const ptrU32 = new Uint32Array(buffer, offset, dataLen / 4)
        const ptrU8 = new Uint8Array(buffer, offset, dataLen)
        const pkg = unpack(ptrU32, ptrU8)
        resolve(pkg)
      },
      fail(res) {
        reject(res.errMsg)
      }
    })
  })
}

function getMiniWasmDecoder() {
  const wasm =
    typeof WXWebAssembly === 'object' ? WXWebAssembly :
    typeof TTWebAssembly === 'object' ? TTWebAssembly :
    typeof MYWebAssembly === 'object' ? MYWebAssembly :
    typeof   WebAssembly === 'object' ?   WebAssembly :
    0
  if (!wasm) {
    throw Error('WebAssembly is not supported')
  }
  return (wasmBr) => wasm.instantiate(wasmBr).then(r => {
    const {buffer} = Object.values(r.instance.exports)[0]
    const ptrU32 = new Uint32Array(buffer)
    const ptrU8 = new Uint8Array(buffer)
    return unpack(ptrU32, ptrU8)
  })
}

export default getNativeDecoder() || getMiniWasmDecoder()
