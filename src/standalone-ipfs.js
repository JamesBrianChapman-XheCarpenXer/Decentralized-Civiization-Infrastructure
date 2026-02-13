
export class StandaloneIPFS {
  constructor() {
    this.store = new Map()
  }

  async add(content) {
    const hash = await this.hash(content)
    this.store.set(hash, content)
    return { cid: hash }
  }

  async cat(cid) {
    return this.store.get(cid)
  }

  async hash(content) {
    const encoder = new TextEncoder()
    const data = encoder.encode(
      typeof content === 'string' ? content : JSON.stringify(content)
    )
    const digest = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(digest))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }
}
