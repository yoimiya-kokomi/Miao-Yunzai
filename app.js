switch (process.env.app_type || process.argv[2]) {
  case "pm2":
  case "start": {
    const bot = new (await import("./lib/bot.js")).default
    global.Bot = new Proxy({}, {
      get: (target, prop, receiver) => {
        const value = bot[prop] ?? target[prop]
        if (value !== undefined)
          return value
        for (const i of bot.uin)
          if (target[i]?.[prop] !== undefined) {
            bot.makeLog("trace", `因不存在 Bot.${prop} 而重定向到 Bot.${i}.${prop}`)
            if (typeof target[i][prop]?.bind == "function")
              return target[i][prop].bind(target[i])
            return target[i][prop]
          }
        bot.makeLog("trace", `不存在 Bot.${prop}`)
      }
    })
    Bot.run()
    break
  } case "stop": {
    const cfg = (await import("./lib/config/config.js")).default
    const fetch = (await import("node-fetch")).default
    try {
      await fetch(`http://localhost:${cfg.bot.port}/exit`)
    } catch {}
    process.exit()
  } default: {
    const { spawnSync } = await import("node:child_process")
    while (!spawnSync(process.argv[0],
      [process.argv[1], "start"],
      { stdio: "inherit" },
    ).status) {}
    process.exit()
  }
}