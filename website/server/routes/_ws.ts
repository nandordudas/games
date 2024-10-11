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

export default defineWebSocketHandler({
  upgrade(request) {
    logger.info('upgrade request', { requestUrl: request.url })
    const cookie = request.headers.get('cookie') ?? ''
    logger.log('cookie:', parse(cookie))
  },
  open(peer) {
    logger.info('open', peer.id)
    peer.send(encode(JSON.stringify({ type: 'connected' })))
  },
  error(peer, error) {
    logger.error('error', { peerId: peer.id, error })
  },
  close(peer, reason) {
    logger.info('close', { peerId: peer.id, reason: statusCodes[reason.code as keyof typeof statusCodes] ?? reason })
  },
  message(peer, message) {
    const payload = message.text()

    logger.info('message', { peerId: peer.id, payload })

    try {
      const parsedData = JSON.parse(payload)

      if (parsedData.type === 'ping') {
        peer.send(encode(JSON.stringify({ type: 'pong' })))
      }
      else {
        // echo message
        peer.send(encode(JSON.stringify(parsedData)))
      }
    }
    catch (error) {
      logger.error('failed to send message', { peerId: peer.id, error })
    }
  },
})
