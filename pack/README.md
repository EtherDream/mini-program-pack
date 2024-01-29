# Mini Program Pack

## 简介

小程序静态资源打包和压缩方案：https://github.com/EtherDream/mini-program-pack

## 命令行

安装工具：

```bash
npm i -g mini-program-pack
```

用法参考：

```bash
mini-program-pack \
  -b *.bin \
  -t *.txt \
  -p assets \
  -o ~/WeChatProjects/test-project/res.wasm.br 
```

参数说明：

* -b, --binary: 输入的二进制文件列表。

* -t, --text：输入的文本文件列表。如果和二进制文件重复，则优先使用文本文件。

* -o, --output：输出的包文件，以 `.wasm.br` 结尾。

* -p, --path：指定输入文件所在的目录，默认为当前目录。该部分不会被记录到包中。

输入文件必须使用相对路径（基于 `--path` 参数），不能以 `/` 开头。目录分隔符可使用 `/` 或 `\`，程序会统一转换成 `/`。

## API 调用

```javascript
import zlib from 'node:zlib'
import pack from 'mini-program-pack'

const txtFileMap = {
  '1.txt': 'Hello World',
  '2.txt': '你好😁',
}
const binFileMap = {
  'foo/bar.txt': Buffer.from([10, 11, 12, 13, 14, 15]),
}

const wasmBuf = pack(binFileMap, txtFileMap)
const brBuf = zlib.brotliCompressSync(wasmBuf)
// ...
```

## 包文件结构

```c
struct {
  // 文件数量
  u32 fileNum

  // 文件属性
  struct {
    u2 type { BINARY = 0, ISO_8859_1 = 1, UTF_16 = 2 }
    u30 size
  } attrs[fileNum + 1]

  // 第 1 个文件数据
  u8 data0[ attrs[0].size ]

  // 第 2 个文件数据
  u8 data1[ attrs[1].size ]
  ...
  // 第 fileNum 个文件数据
  u8 dataN[ attrs[fileNum - 1].size ]

  // 存储文件名的虚拟文件
  u8 fileNameText[ attrs[fileNum].size ]
}
```

每个文件数据在底层内存块（ArrayBuffer）中的偏移都对齐到 8 的整数倍，方便开发者可用各种类型的 TypedArray 直接映射到数据上：

```js
bytes = pkg.read('u16-array.bin') 
arr16 = new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.length / 2)

bytes = pkg.read('u32-array.bin') 
arr32 = new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.length / 4)

bytes = pkg.read('u64-array.bin') 
arr64 = new BigUint64Array(bytes.buffer, bytes.byteOffset, bytes.length / 8)
```

如果文件数据是固定类型的数组，那么映射后即可直接访问，而无需复制内存或通过 DataView，从而提升性能。
