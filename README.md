# 小程序静态资源打包方案

## 解决问题

小程序/小游戏由于受到包体积限制，因此一些体积较大的本地资源可考虑以压缩的格式进行存储，尤其是压缩率高、解压快的 brotli 格式。

微信小程序现已提供原生解压 brotli 压缩文件的能力，但其他小程序目前不支持该 API，因此需要一个兼容方案。

此外，开发者有时希望将多个文件打包成一个资源包，方便使用并能提升压缩率，因此需要记录额外的文件信息。

本工具主要解决上述问题。

## 兼容方案

目前大部分小程序都支持加载 brotli 压缩后的 wasm 文件，因此开发者可将静态资源打包成一个只有数据段的 wasm 文件，并进行压缩；运行时直接加载 `.wasm.br` 文件，即可从导出对象的内存中读取原始数据。

## 文件打包

安装 [mini-program-pack](pack) 工具：

```bash
npm i -g mini-program-pack
```

演示：

```bash
echo "Hello" > t1.txt
echo "abc123" > t2.txt

mini-program-pack --binary t1.txt t2.txt -o res.wasm.br
```

将 `t1.txt` 和 `t2.txt` 以二进制格式打包压缩，生成 `res.wasm.br`。

该 wasm 文件不包含任何指令，仅用作数据载体而已。

## 文件读取

小程序项目中安装 [mini-program-unpack](unpack) 库：

```bash
npm i mini-program-unpack
```

运行：

```javascript
import unpack from 'mini-program-unpack'

unpack('res.wasm.br').then(pkg => {
  console.log(pkg.files)          // ["t1.txt", "t2.txt"]
  console.log(pkg.read('t1.txt')) // Uint8Array(6) [72, 101, 108, 108, 111, 10]
  console.log(pkg.read('t2.txt')) // Uint8Array(7) [97, 98, 99, 49, 50, 51, 10]
})
```

解压过程是后台异步执行的，不会阻塞主线程。

在支持原生 brotli 解压的环境中，程序不会调用 wasm 接口，而是直接解压 .wasm.br 文件，然后跳过 wasm 文件头，因此可快 10% 左右。

## 文本优化

由于小程序不支持 `TextDecoder` 等二进制转文本的 API，因此开发者只能自己实现 UTF-8 解码，这不仅需要额外的代码，而且性能很低。

为此本工具提供了文本模式，可大幅提升文本读取性能。打包时通过 `--text` 指定使用文本模式的文件：

```bash
echo "Hello" > t1.txt
echo "abc123" > t2.txt
echo "你好😁" > t3.txt

mini-program-pack --binary t1.txt --text t2.txt t3.txt -o res.wasm.br
```

读取文本文件，返回的是 `string` 类型：

```javascript
unpack('res.wasm.br').then(pkg => {
  console.log(pkg.files)          // ["t1.txt", "t2.txt", "t3.txt"]
  console.log(pkg.read('t1.txt')) // Uint8Array(6) [72, 101, 108, 108, 111, 10]
  console.log(pkg.read('t2.txt')) // "abc123\n"
  console.log(pkg.read('t3.txt')) // "你好😁\n"
})
```

对于单字节文本，例如 `ASCII`、`ISO-8859-1` 格式，使用文本模式不会降低压缩率。

对于多字节文本，例如含有汉字的内容，使用文本模式通常会损失 10%-20% 的压缩率，具体取决于汉字数量，汉字越多损失越少。

原因是单字节文本的字符以 u8[] 存储，而多字节文本的字符以 u16[] 存储，由于每个字符都占用 2 字节，导致体积膨胀，尽管压缩可去除冗余，但相比二进制模式仍有损失。

之所以直接存储字码，是因为读取时可通过 `String.fromCharCode.apply` 批量解码，相比逐字处理可以快几十倍。

<details>
<summary>性能测试：批量解码 vs 逐字处理</summary>

```javascript
const testData = new Uint16Array(1024 * 1024 * 8)
for (let i = 0; i < testData.length; i++) {
  testData[i] = i
}
const chr = String.fromCharCode
let strApply = ''
let strLoop = ''

const t0 = Date.now()

for (let i = 0; i < testData.length; i += 32768) {
  const part = testData.subarray(i, i + 32768)
  strApply += chr.apply(0, part)
}
const t1 = Date.now()

for (let i = 0; i < testData.length; i++) {
  strLoop += chr(testData[i])
}
const t2 = Date.now()

console.log('apply time:', t1 - t0)
console.log('loop time:', t2 - t1)
console.log(strLoop === strApply)
```
</details>

https://jsbin.com/mofapad/edit?html,console

## 兼容性

* 微信小程序 v2.14.0

  https://developers.weixin.qq.com/miniprogram/dev/framework/performance/wasm.html

  微信小程序 v2.21.1 支持原生 br 解压

  https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.readCompressedFile.html

* 抖音小程序 v2.92.0.0

  https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/guide/experience-optimization/list/wasm

* 支付宝小程序

  https://opendocs.alipay.com/mini/0b2bz8
