/**
 *
 */
export class BaseConfig<D> {
  #data: D = null
  constructor(val: D) {
    this.#data = val
  }
  /**
   * 设置配置
   * @param key
   * @param val
   */
  set<T extends keyof D>(key: T, val: D[T]) {
    if (this.#data) this.#data[key] = val
    return this
  }
  /**
   * 读取配置
   * @param key
   * @returns
   */
  all(): D {
    return this.#data
  }
  /**
   * 读取配置
   * @param key
   * @returns
   */
  get<T extends keyof D>(key: T): D[T] | undefined {
    return this.#data[key]
  }
}
