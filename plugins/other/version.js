let App, Common, Version
try {
  App = (await import("#miao")).App
  Common = (await import("#miao")).Common
  Version = (await import("#miao")).Version
} catch {}

export let version = {}
if (App) {
  let app = App.init({
    id: "version",
    name: "版本",
    desc: "版本"
  })

  app.reg({
    version: {
      rule: /^#版本$/,
      desc: "【#帮助】 版本介绍",
      fn: async function (e) {
        let { changelogs, currentVersion } = Version.readLogFile("root")
        return await Common.render("help/version-info", {
          currentVersion,
          changelogs,
          name: "TRSS-Yunzai",
          elem: "cryo",
          pluginName: false,
          pluginVersion: false,
        }, { e, scale: 1.2 })
      }
    }
  })

  version = app.v3App()
}