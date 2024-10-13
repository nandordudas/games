export class DataFramePreparator {
  #encoder: TextEncoder

  constructor() {
    this.#encoder = new TextEncoder()
  }

  createFrame(data: Uint8Array | string | object, opcode: number): Uint8Array {
    let binaryData: Uint8Array

    if (typeof data === 'object' && !(data instanceof Uint8Array)) {
      binaryData = this.#createJsonFrame(data)
    }
    else if (typeof data === 'string') {
      binaryData = this.#encoder.encode(data)
    }
    else {
      binaryData = data
    }

    return this.#prependOpcode(binaryData, opcode)
  }

  #createJsonFrame(value: object): Uint8Array {
    const jsonString = JSON.stringify(value)
    return this.#encoder.encode(jsonString)
  }

  #prependOpcode(data: Uint8Array, opcode: number): Uint8Array {
    const frame = new Uint8Array(data.length + 1)
    frame[0] = opcode
    frame.set(data, 1)
    return frame
  }
}
