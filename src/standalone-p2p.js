
export class StandaloneP2P {
  constructor() {
    this.peers = []
  }

  async connect() {
    console.log("[StandaloneP2P] Local transport active")
    return true
  }

  async broadcast(message) {
    console.log("[StandaloneP2P] Broadcast:", message)
  }
}
