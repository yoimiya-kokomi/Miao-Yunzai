import fs from "node:fs"

function toSegment(type, data) {
  for (const i in data) {
    switch (typeof data[i]) {
      case "string":
        if ((i == "file" || data[i].match(/^file:\/\//)) && fs.existsSync(data[i].replace(/^file:\/\//, "")))
          data[i] = `base64://${fs.readFileSync(data[i].replace(/^file:\/\//, "")).toString("base64")}`
        break
      case "object":
        if (Buffer.isBuffer(data[i]))
          data[i] = `base64://${data[i].toString("base64")}`
    }
  }
  return { type, ...data }
}

const segment = new class segment {
  custom(type, data) {
    return toSegment(type, data)
  }
  image(file) {
    return toSegment("image", { file })
  }
  at(qq, name) {
    return toSegment("at", { qq, name })
  }
  record(file) {
    return toSegment("record", { file })
  }
  video(file) {
    return toSegment("video", { file })
  }
  reply(id, text, qq, time, seq) {
    return toSegment("reply", { id, text, qq, time, seq })
  }
  face(id) {
    return toSegment("face", { id })
  }
  share(url, title, content, image) {
    return toSegment("share", { url, title, content, image })
  }
  music(type, id, url, audio, title) {
    return toSegment("music", { type, id, url, audio, title })
  }
  poke(qq) {
    return toSegment("poke", { qq })
  }
  gift(qq, id) {
    return toSegment("gift", { qq, id })
  }
  cardimage(file, minwidth, minheight, maxwidth, maxheight, source, icon) {
    return toSegment("cardimage", { file, minwidth, minheight, maxwidth, maxheight, source, icon })
  }
  tts(text) {
    return toSegment("tts", { text })
  }
}

export { segment }