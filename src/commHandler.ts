import * as crc16 from 'crc/lib/crc16_ccitt';
import { IProgressListener } from './IProgressListener';
import { ITransport } from './ledger';

/**
 * Communication Handler.
 */
export class CommHandler {
  public progressListener: IProgressListener = null;
  /**
   * @param {ITransport} transport transport class.
   * @param {number} chunkSize lets you specify the chunkSize for each communication.<br/>
   * <strong>DO not</strong> change if you don't know what you're doing.
   */
  constructor(private transport: ITransport, private chunkSize: number = 240) {
    if (chunkSize > 240) {
      throw new Error('Chunk size cannot exceed 240');
    }
    if (chunkSize < 1) {
      throw new Error('Chunk size cannot be less than 1');
    }
    if (transport === null || typeof(transport) === 'undefined') {
      throw new Error('Transport cannot be empty');
    }
    transport.setScrambleKey('vekexasia');
  }
  /**
   * Raw exchange protocol handling. It's exposed but it is meant for internal usage only.
   * @param {string | Buffer} hexData
   * @returns {Promise<Buffer[]>} Raw response buffers.
   */
  public async exchange(hexData: string | Buffer | number | Array<(string | Buffer | number)>): Promise<Buffer[]> {
    let inputBuffer: Buffer;
    if (Array.isArray(hexData)) {
      inputBuffer = Buffer.concat(hexData.map((item) => {
        if (typeof(item) === 'string') {
          return new Buffer(item, 'hex');
        } else if (typeof(item) === 'number') {
          return Buffer.alloc(1).fill(item);
        }
        return item;
      }));
    } else if (typeof(hexData) === 'string') {
      inputBuffer = new Buffer(hexData, 'hex');
    } else if (typeof(hexData) === 'number') {
      inputBuffer = Buffer.alloc(1).fill(hexData);
    } else {
      inputBuffer = hexData;
    }

    // Send start comm packet
    const startCommBuffer = Buffer.alloc(2);
    startCommBuffer.writeUInt16BE(inputBuffer.length, 0);

    if (this.progressListener) {
      this.progressListener.onStart();
    }

    await this.transport.send(0xe0, 89, 0, 0, startCommBuffer);

    // Calculate number of chunks to send.
    const chunkDataSize = this.chunkSize;
    const nChunks       = Math.ceil(inputBuffer.length / chunkDataSize);

    let prevCRC = 0;
    for (let i = 0; i < nChunks; i++) {
      const dataSize = Math.min(inputBuffer.length, (i + 1) * chunkDataSize) - i * chunkDataSize;

      // copy chunk data
      const dataBuffer = inputBuffer.slice(i * chunkDataSize, i * chunkDataSize + dataSize);

      const [curCRC, prevCRCLedger] = this.decomposeResponse(
        await this.transport.send(
          0xe0,
          90,
          0,
          0,
          dataBuffer
        )
      );
      const crc           = crc16(dataBuffer);
      const receivedCRC   = curCRC.readUInt16LE(0);

      if (crc !== receivedCRC) {
        throw new Error('Something went wrong during CRC validation');
      }

      if (prevCRCLedger.readUInt16LE(0) !== prevCRC) {
        throw new Error('Prev CRC is not valid');
      }

      prevCRC = crc;

      if (this.progressListener) {
        this.progressListener.onChunkProcessed(dataBuffer);
      }
    }
    // Close comm flow.
    const resBuf = await this.transport.send(0xe0, 91, 0, 0);

    if (this.progressListener) {
      this.progressListener.onEnd();
    }

    return this.decomposeResponse(resBuf);
  }

  /**
   * Internal utility to decompose the ledger response as protocol definition.
   * @param {Buffer} resBuf response from ledger
   * @returns {Array<Buffer>} decomposed response.
   */
  protected decomposeResponse(resBuf: Buffer): Buffer[] {
    const totalElements   = resBuf.readInt8(0);
    const toRet: Buffer[] = [];
    let index             = 1; // 1 read uint8_t

    for (let i = 0; i < totalElements; i++) {
      const elLength = resBuf.readInt16LE(index);
      index += 2;
      toRet.push(resBuf.slice(index, index + elLength));
      index += elLength;
    }

    return toRet;
  }
}
