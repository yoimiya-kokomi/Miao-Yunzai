const segment = {
  custom(type, data) {
    return { type, ...data }
  },
  raw(data) {
    return { type: "raw", data }
  },
  button(...data) {
    return { type: "button", data }
  },
  markdown(data) {
    return { type: "markdown", data }
  },
  image(file, name) {
    return { type: "image", file, name }
  },
  at(qq, name) {
    return { type: "at", qq, name }
  },
  record(file, name) {
    return { type: "record", file, name }
  },
  video(file, name) {
    return { type: "video", file, name }
  },
  file(file, name) {
    return { type: "file", file, name }
  },
  reply(id, text, qq, time, seq) {
    return { type: "reply", id, text, qq, time, seq }
  },
}

try {
  const { segment: icqq_segment } = await import(`file://${process.cwd()}/plugins/ICQQ-Plugin/node_modules/icqq/lib/message/elements.js`)
  const { deprecate } = await import("node:util")
  for (const i in icqq_segment) if (!segment[i])
    segment[i] = deprecate(icqq_segment[i], `segment.${i} 仅在 icqq 上可用`)
} catch {}

export { segment }