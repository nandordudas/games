import type { EventMap } from '~~/types'
import { WebSocketMessageType } from '~/workers/utils/web-socket-manager/constants'
import { WebSocketManagerError } from '~/workers/utils/web-socket-manager/errors/web-socket-manager.error'
import type { LoggerContract } from '~/workers/utils/web-socket-manager/types'

export class PayloadHandler<Events extends EventMap> {
  #logger?: LoggerContract
  #decoder: TextDecoder

  constructor(logger?: LoggerContract) {
    this.#logger = logger
    this.#decoder = new TextDecoder()
  }

  // eslint-disable-next-line complexity
  handlePayload(opcode: number, payload: Uint8Array): Events | void {
    try {
      const data = this.#decoder.decode(payload)

      switch (opcode) {
        case WebSocketMessageType.OPCODE_TEXT: {
          const parsedData = this.#parseData<Events>(data)
          return parsedData
        }
        case WebSocketMessageType.OPCODE_BINARY:
          this.#logger?.log('Binary message:', data)
          break
        default:
          this.#logger?.error('Unknown opcode:', opcode)
          break
      }
    }
    catch (error) {
      this.#logger?.error('Failed to parse message:', error)
    }
  }

  /**
   * @throws If the data is invalid
   */
  #parseData<T extends object = any>(text: string): never | T {
    const data = JSON.parse(text)

    if (typeof data !== 'object') {
      throw new WebSocketManagerError('Invalid data')
    }

    if (!('type' in data) || typeof data.type !== 'string') {
      throw new WebSocketManagerError('Invalid data type')
    }

    if (!('data' in data)) {
      throw new WebSocketManagerError('Invalid data payload')
    }

    return data
  }
}
