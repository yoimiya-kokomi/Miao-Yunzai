const segment = new class segment {
  custom(type, data) {
    return { type, ...data }
  }
  raw(data) {
    return { type: "raw", data }
  }
  button(...data) {
    return { type: "button", data }
  }
  markdown(data) {
    return { type: "markdown", data }
  }
  image(file, name) {
    return { type: "image", file, name }
  }
  at(qq, name) {
    return { type: "at", qq, name }
  }
  record(file, name) {
    return { type: "record", file, name }
  }
  video(file, name) {
    return { type: "video", file, name }
  }
  file(file, name) {
    return { type: "file", file, name }
  }
  reply(id, text, qq, time, seq) {
    return { type: "reply", id, text, qq, time, seq }
  }
}

export { segment }