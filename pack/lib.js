function uleb128(num) {
  const bytes = []
  let pos = 0

  for (;;) {
    const value = num & 0x7F
    num >>>= 7
    if (num === 0) {
      bytes[pos] = value
      return bytes
    }
    bytes[pos++] = value | 0x80
  }
}

function section(code, bytes, remainLen = 0) {
  return [
    code,
    ...uleb128(bytes.length + remainLen),
    ...bytes,
  ]
}

function genWasmHead(dataLen) {
  // WebAssembly 以页为单位分配内存，每页 64kB
  const pageNum = Math.ceil(dataLen / 65536)

  // 通过调整导出名的长度，可将 wasm 文件头长度凑到 8 的整数倍
  let nameLen = 0

  for (;;) {
    const nameBuf = Buffer.alloc(nameLen, 'a')

    const wasmHead = Buffer.from([
      0x00, 0x61, 0x73, 0x6D, // magic
      0x01, 0x00, 0x00, 0x00, // version
  
      ...section(0x05, [      // [Linear-Memory Section]
        0x01,                 // num memories
        0x00,                 // limits: flags (initial only)
        ...uleb128(pageNum),  // limits: initial
      ]),
  
      ...section(0x07, [      // [Export Section]
        0x01,                 // num exports
        nameLen,              // string length
        ...nameBuf,           // export name
        0x02,                 // export kind (Memory)
        0x00,                 // export memory index
      ]),
  
      ...section(0x0B, [      // [Data Section]
        0x01,                 // num data segments
        0x00,                 // segment flags
        0x41,                 // i32.const
        0x00,                 // i32 literal
        0x0B,                 // end
        ...uleb128(dataLen),  // data segment size
      ], dataLen),
    ])

    if (wasmHead.length % 8 === 0) {
      return wasmHead
    }
    nameLen++
  }
}

function genWasmFile(data) {
  // 末尾追加 4 字节用于存储数据长度，方便原生解压 br 的场合读取
  //（直接从尾部读取长度和数据，无需解析 wasm 头）
  const dataLen = data.length + 4
  const wasmHead = genWasmHead(dataLen)

  const wasmFile = Buffer.concat([
    wasmHead,
    data,
    Buffer.from(new Uint32Array([dataLen]).buffer),
  ])
  return wasmFile
}


const TYPE_BINARY = 0
const TYPE_ISO_8859_1 = 1
const TPYE_UTF_16 = 2


export default function(binFileMap, txtFileMap) {
  const fileNames = [
    ...Object.keys(binFileMap),
    ...Object.keys(txtFileMap),
  ]
  const fileNum = fileNames.length

  // 末尾添加一个虚拟文件，用于存储文件名（该文件没有名字，也不算在 fileNum 中）
  const head = new Uint32Array(1 + fileNum + 1)
  let headPos = 0

  // 文件个数
  head[headPos++] = fileNum

  // 文件数据
  const body = []


  let fileLen = head.byteLength

  const align = (n) => {
    if (fileLen % n) {
      const padding = Buffer.alloc(n - fileLen % n)
      body.push(padding)
      fileLen += padding.length
    }
  }

  const addFile = (type, buf) => {
    // 数据起始位置对齐到 8 的整数倍
    align(8)
    body.push(buf)
    fileLen += buf.length

    const attr = type << 30 | buf.length
    head[headPos++] = attr
  }


  for (const bin of Object.values(binFileMap)) {
    if (!(bin instanceof Uint8Array)) {
      throw TypeError('invalid binary type')
    }
    addFile(TYPE_BINARY, bin)
  }

  fileNames.forEach(s => {
    if (s.includes('\n')) {
      throw Error('invalid file name:' + s)
    }
  })
  const fileNameText = fileNames.join('\n')
  const texts = Object.values(txtFileMap).concat(fileNameText)

  for (const txt of texts) {
    if (typeof txt !== 'string') {
      throw TypeError('invalid string type')
    }
    const codes = new Uint16Array(txt.length)
    let singleByte = true

    for (let i = 0; i < txt.length; i++) {
      codes[i] = txt.charCodeAt(i)
      if (codes[i] > 255) {
        singleByte = false
      }
    }
    if (singleByte) {
      addFile(TYPE_ISO_8859_1, Buffer.from(codes))
    } else {
      addFile(TPYE_UTF_16, Buffer.from(codes.buffer))
    }
  }

  // 数据末尾对齐到 4 的整数倍
  align(4)

  const pkgBuf = Buffer.concat([
    Buffer.from(head.buffer),
    ...body,
  ], fileLen)

  return genWasmFile(pkgBuf)
}