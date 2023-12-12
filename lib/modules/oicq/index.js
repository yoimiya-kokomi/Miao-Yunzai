import fs from "node:fs"
import path from "node:path"

function toSegment(type, data) {
  for (const i in data)
    if (typeof data[i] == "string" && (i == "file" || data[i].match(/^file:\/\//)) && fs.existsSync(data[i].replace(/^file:\/\//, ""))) {
      if (i == "file" && !data.name)
        data.name = path.basename(data[i])
      data[i] = fs.readFileSync(data[i].replace(/^file:\/\//, ""))
    }
  return { type, ...data }
}

const segment = new class segment {
  custom(type, data) {
    return toSegment(type, data)
  }
  raw(data) {
    return toSegment("raw", { data })
  }
  image(file, name) {
    return toSegment("image", { file, name })
  }
  at(qq, name) {
    return toSegment("at", { qq, name })
  }
  record(file, name) {
    return toSegment("record", { file, name })
  }
  video(file, name) {
    return toSegment("video", { file, name })
  }
  file(file, name) {
    return toSegment("file", { file, name })
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
  cardimage(file, name, minwidth, minheight, maxwidth, maxheight, source, icon) {
    return toSegment("cardimage", { file, name, minwidth, minheight, maxwidth, maxheight, source, icon })
  }
  tts(text) {
    return toSegment("tts", { text })
  }
}

export { segment }