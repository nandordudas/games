export class WebSocketManagerError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WebSocketManagerError'
  }
}
