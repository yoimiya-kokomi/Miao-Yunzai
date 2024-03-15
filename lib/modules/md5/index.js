import { createHash } from "node:crypto"
export default function md5(data) {
  return createHash("md5").update(data).digest("hex")
}