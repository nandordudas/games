export interface ReceiveEvents {
  ping: void
  init: void
}

type ConnectEvent = 'webSocket' | 'worker'

export interface SendEvents {
  pong: void
  connected: ConnectEvent
  error: void
}
