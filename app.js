switch (process.env.app_type || process.argv[2]) {
  case "pm2":
  case "start": {
    global.Bot = new Proxy(new (await import("./lib/bot.js")).default, {
      get: (target, prop, receiver) => {
        if (target[prop] !== undefined)
          return target[prop]
        for (const i of target.uin)
          if (target[i]?.[prop] !== undefined) {
            target.makeLog("trace", `因不存在 Bot.${prop} 而重定向到 Bot.${i}.${prop}`)
            return target[i][prop]
          }
        target.makeLog("trace", `不存在 Bot.${prop}`)
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