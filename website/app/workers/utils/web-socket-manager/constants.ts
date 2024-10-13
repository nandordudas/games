/**
 * @see {@link https://www.rfc-editor.org/rfc/rfc6455.html#section-5.2|Base Framing Protocol}
 */
export const enum WebSocketMessageType {
  OPCODE_TEXT = 0x01,
  OPCODE_BINARY = 0x02,
  OPCODE_CONNECTION_CLOSE = 0x08,
  OPCODE_PING = 0x09,
  OPCODE_PONG = 0x0A,
  OPCODE_MASK = 0x0F,
}

/**
 * These codes are reserved for internal use. They are not defined in the RFC.
 */
export const enum WebSocketCloseCode {
  Min = 3_000,
  Max = 3_999,
  PingTimeout = 3_010,
}

/**
 * Status codes in the range 3000-3999 are reserved for use by
 * libraries, frameworks, and applications. These status codes are
 * registered directly with IANA.  The interpretation of these codes
 * is undefined by this protocol.
 */
export const CloseMap = {
  PingTimeout: [WebSocketCloseCode.PingTimeout, 'Ping timeout'],
} as const satisfies Record<string, [WebSocketCloseCode, string]>
