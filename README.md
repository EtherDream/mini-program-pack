# 小程序静态资源打包和压缩

## 原理

小程序支持加载 brotli 压缩后的 WebAssembly 文件，因此开发者可将静态资源打包成一个只有数据段的 WebAssembly 文件，并进行压缩；运行时直接加载 `.wasm.br` 文件，即可读取原始数据。

使用该方案，可减少静态资源空间占用，优化包体积。并且解压由系统原生提供，避免了额外的代码，性能也更高。

## 打包

```bash
cat 原始文件 | ./minipack > 输出文件
```

例如：

```bash
cat test.txt | ./minipack > test.txt.wasm.br
```

## 读取

例如微信小程序：

```javascript
WXWebAssembly.instantiate('test.txt.wasm.br').then(r => {
  const [[keyAsLen, {buffer}]] = Object.entries(r.instance.exports)
  const fileBin = new Uint8Array(buffer, 0, keyAsLen)

  console.log(fileBin)    // test.txt 的二进制数据
})
```

其他小程序使用相应的 WebAssembly 对象，例如 TTWebAssembly、MYWebAssembly。

> 注意 buffer 长度为 65536 的整数倍，剩余部分用 0 填充。因为 WebAssembly 以页为单位分配内存，每页 64kB。

如需一次打包多个文件，可在本程序基础上进一步封装，例如通过文件头或其他配置，记录每个文件的路径和长度；使用时根据相应的偏移和长度截取即可。

当然还可尝试现成的打包方案：例如将多个文件打包成 tar，然后生成 .tar.wasm.br 文件；使用时通过 JS 版的 tar 库从中提取。

## 兼容性

* 微信小程序 v2.14.0

  https://developers.weixin.qq.com/miniprogram/dev/framework/performance/wasm.html

* 抖音小程序 v2.92.0.0

  https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/guide/experience-optimization/list/wasm

* 支付宝小程序

  https://opendocs.alipay.com/mini/0b2bz8
