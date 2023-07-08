import fs from "node:fs"

const segment = new class segment {
  custom(type, data) {
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
  image(file) {
    return this.custom("image", { file })
  }
  at(qq, name) {
    return this.custom("at", { qq, name })
  }
  record(file) {
    return this.custom("record", { file })
  }
  video(file) {
    return this.custom("video", { file })
  }
  reply(id, text, qq, time, seq) {
    return this.custom("reply", { id, text, qq, time, seq })
  }
  face(id) {
    return this.custom("face", { id })
  }
  share(url, title, content, image) {
    return this.custom("share", { url, title, content, image })
  }
  music(type, id, url, audio, title) {
    return this.custom("music", { type, id, url, audio, title })
  }
  poke(qq) {
    return this.custom("poke", { qq })
  }
  gift(qq, id) {
    return this.custom("gift", { qq, id })
  }
  cardimage(file, minwidth, minheight, maxwidth, maxheight, source, icon) {
    return this.custom("cardimage", { file, minwidth, minheight, maxwidth, maxheight, source, icon })
  }
  tts(text) {
    return this.custom("tts", { text })
  }
}

export { segment }