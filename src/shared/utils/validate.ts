/**
 * 【原型说明】跨模块通用的格式校验工具。
 */

export function isEmail(value: string): boolean {
  return /^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test((value ?? '').trim())
}
