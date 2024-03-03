switch (process.env.app_type || process.argv[2]) {
  case "pm2":
  case "start": {
    global.Bot = new (await import("./lib/bot.js")).default
    Bot.run()
    break
  } case "stop": {
    const cfg = (await import("./lib/config/config.js")).default
    const fetch = (await "node-fetch").default
    try {
      await fetch(`http://localhost:${cfg.bot.port}/exit`)
    } catch (err) {}
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