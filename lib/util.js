import fs from "node:fs/promises"
import path from "node:path"
import util from "node:util"
import { exec, execFile } from "node:child_process"
import { fileTypeFromBuffer } from "file-type"
import md5 from "md5"
import { ulid } from "ulid"
import cfg from "./config/config.js"

export default new class {
  makeLogID(id) {
    if (!id) return cfg.bot.log_align || "TRSSYz"
    if (!cfg.bot.log_align) return id
    if (typeof id !== "string") id = this.String(id)
    const length = (cfg.bot.log_align.length-id.length)/2
    if (length > 0)
      id = `${" ".repeat(Math.floor(length))}${id}${" ".repeat(Math.ceil(length))}`
    else if (length < 0)
      id = id.slice(0, cfg.bot.log_align.length-1)+"."
    return id
  }

  makeLog(level, msg, id, force) {
    const log = []
    if (id !== false)
      log.push(logger.blue(`[${force ? id : this.makeLogID(id)}]`))
    for (const i of Array.isArray(msg) ? msg : [msg])
      log.push(this.Loging(i))
    logger.logger[level](...log)
  }

  async fsStat(path, opts) { try {
    return await fs.stat(path, opts)
  } catch (err) {
    this.makeLog("trace", ["获取", path, "状态错误", err])
    return false
  }}

  async mkdir(dir, opts) { try {
    await fs.mkdir(dir, { recursive: true, ...opts })
    return true
  } catch (err) {
    this.makeLog("error", ["创建", dir, "错误", err])
    return false
  }}

  async rm(file, opts) { try {
    await fs.rm(file, { force: true, recursive: true, ...opts })
    return true
  } catch (err) {
    this.makeLog("error", ["删除", file, "错误", err])
    return false
  }}

  async glob(path, opts = {}) {
    if (!opts.force && await this.fsStat(path))
      return [path]
    if (!fs.glob) return []
    const array = []
    try {
      for await (const i of fs.glob(path, opts))
        array.push(i)
    } catch (err) {
      this.makeLog("error", ["匹配", path, "错误", err])
    }
    return array
  }

  async download(url, file, opts) {
    let buffer
    if (!file || (await this.fsStat(file))?.isDirectory?.()) {
      const type = await this.fileType({ file: url }, opts)
      file = file ? path.join(file, type.name) : type.name
      buffer = type.buffer
    } else {
      await this.mkdir(path.dirname(file))
      buffer = await this.Buffer(url, opts)
    }
    await fs.writeFile(file, buffer)
    return { url, file, buffer }
  }

  makeMap(parent_map, parent_key, map) {
    const save = async () => { try {
      await parent_map.db.put(parent_key, { map_array: Array.from(map) })
    } catch (err) {
      this.makeLog("error", ["写入", parent_map.db.location, parent_key, "错误", map, err])
    }}

    const set = map.set.bind(map)
    Object.defineProperty(map, "set", {
      value: async (key, value) => {
        if (JSON.stringify(map.get(key)) !== JSON.stringify(value)) {
          set(key, value)
          await save()
        }
        return map
      },
    })
    const del = map.delete.bind(map)
    Object.defineProperty(map, "delete", {
      value: async key => {
        if (!del(key)) return false
        await save()
        return true
      },
    })
    return map
  }

  async setMap(map, set, key, value) {
    try {
      if (value instanceof Map) {
        set(key, this.makeMap(map, key, value))
        await map.db.put(key, { map_array: Array.from(value) })
      } else if (JSON.stringify(map.get(key)) !== JSON.stringify(value)) {
        set(key, value)
        await map.db.put(key, value)
      }
    } catch (err) {
      this.makeLog("error", ["写入", map.db.location, key, "错误", value, err])
    }
    return map
  }

  async delMap(map, del, key) {
    if (!del(key)) return false
    try {
      await map.db.del(key)
    } catch (err) {
      this.makeLog("error", ["删除", map.db.location, key, "错误", err])
    }
    return true
  }

  async importMap(dir, map) {
    for (const i of await fs.readdir(dir)) {
      const path = `${dir}/${i}`
      try {
        await map.set(i, (await this.fsStat(path)).isDirectory() ?
          await this.importMap(path, new Map) :
          JSON.parse(await fs.readFile(path, "utf8")))
      } catch (err) {
        this.makeLog("error", ["读取", path, "错误", err])
      }
      await this.rm(path)
    }
    await this.rm(dir)
    return map
  }

  async getMap(dir) {
    const map = new Map
    const db = new (await import("level"))
      .Level(`${dir}-leveldb`, { valueEncoding: "json" })
    try {
      await db.open()
      for await (let [key, value] of db.iterator()) {
        if (typeof value === "object" && value.map_array)
          value = this.makeMap(map, key, new Map(value.map_array))
        map.set(key, value)
      }
    } catch (err) {
      this.makeLog("error", ["打开", dir, "数据库错误", err])
      return map
    }

    Object.defineProperty(map, "db", { value: db })
    const set = map.set.bind(map)
    Object.defineProperty(map, "set", {
      value: (key, value) => this.setMap(map, set, key, value),
    })
    const del = map.delete.bind(map)
    Object.defineProperty(map, "delete", {
      value: key => this.delMap(map, del, key),
    })

    if (await this.fsStat(dir))
      await this.importMap(dir, map)
    return map
  }

  StringOrNull(data) {
    if (typeof data === "object" && typeof data.toString !== "function")
      return "[object null]"
    return String(data)
  }

  StringOrBuffer(data, base64) {
    const string = String(data)
    return (string.includes("\ufffd") || string.includes("\u0000")) ? (base64 ? `base64://${data.toString("base64")}` : data) : string
  }

  getCircularReplacer() {
    const _this_ = this, ancestors = []
    return function (key, value) {
      switch (typeof value) {
        case "function":
        case "bigint":
          return String(value)
        case "object":
          if (value === null)
            return null
          if (value instanceof Map || value instanceof Set)
            return Array.from(value)
          if (value instanceof Error)
            return value.stack
          if (value.type === "Buffer" && Array.isArray(value.data)) try {
            return _this_.StringOrBuffer(Buffer.from(value), true)
          } catch {}
          break
        default:
          return value
      }
      while (ancestors.length > 0 && ancestors.at(-1) !== this)
        ancestors.pop()
      if (ancestors.includes(value))
        return `[Circular ${_this_.StringOrNull(value)}]`
      ancestors.push(value)
      return value
    }
  }

  String(data, opts) {
    switch (typeof data) {
      case "string":
        return data
      case "function":
        return String(data)
      case "object":
        if (data instanceof Error)
          return data.stack
        if (Buffer.isBuffer(data))
          return this.StringOrBuffer(data, true)
    }

    try {
      return JSON.stringify(data, this.getCircularReplacer(), opts) || this.StringOrNull(data)
    } catch (err) {
      return this.StringOrNull(data)
    }
  }

  Loging(data, opts = cfg.bot.log_object) {
    if (typeof data === "string") {}
    else if (!opts)
      data = this.StringOrNull(data)
    else data = util.inspect(data, {
      depth: 10,
      colors: true,
      showHidden: true,
      showProxy: true,
      getters: true,
      breakLength: 100,
      maxArrayLength: 100,
      maxStringLength: 1000,
      ...opts,
    })

    const length = opts.length || cfg.bot.log_length
    if (data.length > length)
      data = `${data.slice(0, length)}${logger.gray(`... ${data.length-length} more characters`)}`
    return data
  }

  async Buffer(data, opts = {}) {
    if (!Buffer.isBuffer(data)) {
      data = this.String(data)
      if (data.startsWith("base64://")) {
        data = Buffer.from(data.replace("base64://", ""), "base64")
      } else if (data.match(/^https?:\/\//)) {
        if (opts.http) return data
        data = Buffer.from(await (await fetch(data, opts)).arrayBuffer())
      } else {
        const file = data.replace(/^file:\/\//, "")
        if (await this.fsStat(file)) {
          if (opts.file) return `file://${path.resolve(file)}`
          const buffer = await fs.readFile(file)
          if (typeof opts.size === "number" && buffer.length > opts.size)
            return `file://${path.resolve(file)}`
          return buffer
        }
      }
    }

    if (typeof opts.size === "number" && data.length > opts.size) {
      const file = path.join("temp", ulid())
      await fs.writeFile(file, data)
      data = `file://${path.resolve(file)}`
    }
    return data
  }

  async fileType(data, opts = {}) {
    const file = { name: data.name }
    try {
      if (Buffer.isBuffer(data.file)) {
        file.url = data.name || "Buffer"
        file.buffer = data.file
      } else {
        file.url = data.file.replace(/^base64:\/\/.*/, "base64://...")
        file.buffer = await this.Buffer(data.file, {
          ...opts, size: undefined,
        })
      }
      if (Buffer.isBuffer(file.buffer)) {
        file.type = await fileTypeFromBuffer(file.buffer) || {}
        file.md5 = md5(file.buffer)
        file.name ??= `${Date.now().toString(36)}.${file.md5.slice(0,8)}.${file.type.ext}`
        if (typeof opts.size === "number" && file.buffer.length > opts.size)
          file.buffer = await this.Buffer(data.file, opts)
      }
    } catch (err) {
      this.makeLog("error", ["文件类型检测错误", file, err])
    }
    file.name ??= `${Date.now().toString(36)}-${path.basename(file.url)}`
    return file
  }

  async exec(cmd, opts = {}) { return new Promise(resolve => {
    const name = logger.cyan(this.String(cmd))
    this.makeLog(opts.quiet?"debug":"mark", name, "Command")
    opts.encoding ??= "buffer"
    const callback = (error, stdout, stderr) => {
      const raw = { stdout, stderr }
      stdout = String(stdout).trim()
      stderr = String(stderr).trim()
      resolve({ error, stdout, stderr, raw })
      this.makeLog(opts.quiet?"debug":"mark", `${name} ${logger.green(`[完成${this.getTimeDiff(start_time)}]`)} ${stdout?`\n${stdout}`:""}${stderr?logger.red(`\n${stderr}`):""}`, "Command")
      if (error) this.makeLog(opts.quiet?"debug":"error", error, "Command")
    }
    const start_time = Date.now()
    if (Array.isArray(cmd))
      execFile(cmd.shift(), cmd, opts, callback)
    else
      exec(cmd, opts, callback)
  })}

  async cmdPath(cmd, opts = {}) {
    const ret = await this.exec(`${process.platform === "win32" ? "where" : "command -v"} "${cmd}"`, { quiet: true, ...opts })
    return ret.error ? false : ret.stdout
  }

  getTimeDiff(time1 = this.stat?.start_time*1000, time2 = Date.now()) {
    const time = (time2-time1)/1000
    let ret = ""
    const day = Math.floor(time/3600/24)
    if (day) ret += `${day}天`
    const hour = Math.floor((time/3600)%24)
    if (hour) ret += `${hour}时`
    const min = Math.floor((time/60)%60)
    if (min) ret += `${min}分`
    const sec = (time%60).toFixed(3)
    if (sec) ret += `${sec}秒`
    return ret || "0秒"
  }

  promiseEvent(event, resolve, reject, timeout) {
    let listener
    return new Promise((...args) => {
      listener = { resolve: args[0], reject: args[1] }
      event.once(resolve, listener.resolve)
      if (reject)
        event.once(reject, listener.reject)
      if (timeout)
        listener.timeout = setTimeout(() => listener.reject(
          Object.assign(Error("等待事件超时"), { event, resolve, reject, timeout })
        ), timeout)
    }).finally(() => {
      event.off(resolve, listener.resolve)
      if (reject)
        event.off(reject, listener.reject)
      if (timeout)
        clearTimeout(listener.timeout)
    })
  }

  sleepTimeout = Symbol("timeout")
  sleep(time, promise) {
    if (promise) return Promise.race([promise, this.sleep(time)])
    return new Promise(resolve => setTimeout(() => resolve(this.sleepTimeout), time))
  }

  debounceTime = Symbol("debounceTime")
  debounce(func, time = 5000) {
    const debounceTime = this.debounceTime
    let promise = false
    function ret(...args) {
      if (promise) {
        if (promise.start)
          return (async () => {
            try {
              await promise.promise
            } finally {
              return ret.apply(Object.assign({ [debounceTime]: time }, this), args)
            }
          })()
        else
          clearTimeout(promise.timeout)
      } else {
        promise = {}
        promise.promise = new Promise((...args) => {
          promise.resolve = args[0]
          promise.reject = args[1]
        })
      }

      promise.timeout = setTimeout(async () => { try {
        promise.start = true
        promise.resolve(await func.apply(this, args))
      } catch (err) {
        promise.reject(err)
      } finally {
        promise = false
      }}, this?.[debounceTime] ?? 0)
      return promise.promise
    }
    return ret
  }
}