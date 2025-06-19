let events = {}
let Handler = {
  add(cfg) {
    let { ns, fn, self, priority = 500 } = cfg
    let key = cfg.key || cfg.event
    if (!key || !fn) {
      return
    }
    Handler.del(ns, key)
    logger.mark(`[Handler][Reg]: [${ns}][${key}]`)
    events[key] = events[key] || []
    events[key].push({
      priority,
      fn,
      ns,
      self,
      key,
    })
    events[key] = events[key].sort((a, b) => a.priority - b.priority)
  },
  del(ns, key = "") {
    if (!key) {
      for (let key in events) {
        Handler.del(ns, key)
      }
      return
    }
    if (!events[key]) {
      return
    }
    for (let idx = 0; idx < events[key].length; idx++) {
      let handler = events[key][idx]
      if (handler.ns === ns) {
        events[key].splice(idx, 1)
        events[key] = events[key].sort((a, b) => a.priority - b.priority)
      }
    }
  },
  async callAll(key, e, args) {
    // 暂时屏蔽调用
    // return Handler.call(key, e, args, true)
  },
  async call(key, e, args, allHandler = false) {
    let ret
    for (let obj of events[key]) {
      let fn = obj.fn
      let done = true
      let reject = (msg = "") => {
        if (msg) {
          logger.mark(`[Handler][Reject]: [${obj.ns}][${key}] ${msg}`)
        }
        done = false
      }
      ret = await fn.call(obj.self, e, args, reject)
      if (done && !allHandler) {
        logger.mark(`[Handler][Done]: [${obj.ns}][${key}]`)
        return ret
      }
    }
    return ret
  },
  has(key) {
    return !!events[key]
  },
}
export default Handler
