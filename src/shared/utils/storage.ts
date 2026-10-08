/**
 * 【原型说明】localStorage 读写封装，仅用于原型演示数据的持久化，非生产存储方案。
 */

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function writeJSON(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function removeKeys(keys: readonly string[]) {
  keys.forEach((key) => localStorage.removeItem(key))
}
