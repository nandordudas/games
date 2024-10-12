import type { EventMap, EventPayload } from '~~/types'

import type { Peer } from 'crossws'
import { Buffer } from 'node:buffer'
import { consola } from 'consola'
import { parse } from 'cookie-es'

const logger = consola.withTag('ws')

/**
 * @see https://www.rfc-editor.org/rfc/rfc6455.html#section-7.4.1
 */
const statusCodes = {
  1001: 'Going Away',
} as const

const encoder = new TextEncoder()
const encode = encoder.encode.bind(encoder)

/**
 * @see https://www.rfc-editor.org/rfc/rfc6455.html#section-5.2
 */
const OPCODE_TEXT = 0x01
const OPCODE_BINARY = 0x02
const OPCODE_PING = 0x09
const OPCODE_CONNECTION_CLOSE = 0x08

const PONG_FRAME = new Uint8Array([0x8A, 0x00])

const opcodeMap = {
  [OPCODE_PING]: pong,
  [OPCODE_CONNECTION_CLOSE]: (peer: Peer) => peer.close(),
  [OPCODE_TEXT]: (_peer: Peer, data: Uint8Array) => {
    const message = Buffer.from(data).toString()

    if (!message.startsWith('{'))
      return logger.log('text:', message)

    try {
      logger.log('json:', JSON.parse(message))
    }
    catch (error) {
      logger.error('failed to parse message:', error)
    }
  },
  [OPCODE_BINARY]: (_peer: Peer, data: Uint8Array) => {
    return logger.log('binary:', Buffer.from(data).toString())
  },
  unknown: (_peer: Peer, data: Uint8Array) => {
    logger.error('unknown opcode:', data)
  },
} as const

export default defineWebSocketHandler({
  upgrade(request) {
    logger.info('upgrade request', { requestUrl: request.url })
    const cookie = parse(request.headers.get('cookie') ?? '')
    logger.log('cookie:', cookie)
  },
  open(peer) {
    logger.info('open', peer.id)
    send<{ connected: void }>(peer, { type: 'connected' })
  },
  error(peer, error) {
    logger.error('error', { peerId: peer.id, error })
  },
  close(peer, reason) {
    logger.info('close', {
      peerId: peer.id,
      reason: statusCodes[reason.code as keyof typeof statusCodes] ?? reason,
    })
  },
  message(peer, message) {
    try {
      const data = message.uint8Array()
      const opcode = data[0] as (keyof typeof opcodeMap & number)
      // [INFO] Remove the first byte which is the opcode
      opcodeMap[opcode ?? opcodeMap.unknown](peer, data.slice(1))
    }
    catch (error) {
      logger.error('failed to send message', { peerId: peer.id, error })
    }
  },
})

function send<SendEvents extends EventMap>(
  peer: Peer,
  message: EventPayload<SendEvents>,
  options?: { compress?: boolean },
): void {
  if (typeof message !== 'object' || message instanceof Uint8Array) {
    logger.error('message must be an object')
    return
  }

  peer.send(encode(JSON.stringify(message)), options)
}

function pong(peer: Peer): void {
  logger.debug('✋')
  peer.send(PONG_FRAME)
}
