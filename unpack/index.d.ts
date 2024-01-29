declare class MiniPackage {
  /**
   * 读取文件数据
   */
  read(fileName: string) : Uint8Array | string | undefined

  /**
   * 获取文件名列表
   */
  get files() : string[]

  /**
   * 判断文件是否存在
   */
  has(fileName: string) : boolean
}

/**
 * 小程序中只能传入 wasm 文件路径
 * 浏览器或 Node.js 中可传入 wasm 文件内容
 */
export default function(wasmBr: string | BufferSource) : Promise<MiniPackage>
