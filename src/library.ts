import * as crc16 from 'crc/lib/crc16_ccitt';
import { LedgerAccount } from './account';
import { createAsync, ILedger } from './ledger';

/**
 * Communication Protocol class
 */
export class DposLedger {
  private comm: ILedger = null;

  /**
   * @param {number} chunkSize lets you specify the chunkSize for each communication
   * DO Not change if you don't know what you're doing.
   */
  constructor(private chunkSize: number = 240) {
    if (chunkSize > 240) {
      throw new Error('Chunk Size cannot exceed 240');
    }
    if (chunkSize < 1) {
      throw new Error('Chunk Size cannot go below 1');
    }
  }

  /**
   * Retrieves a publicKey associated to an account
   * @param {LedgerAccount} account
   * @returns {Promise<string>}
   */
  public async getPubKey(account: LedgerAccount): Promise<string> {
    const pathBuf = account.derivePath();
    const resp    = await this.exchange([
      'e0',
      '04',
      (pathBuf.length / 4),
      pathBuf,
    ]);

    const [publicKey] = resp;

    return publicKey.toString('hex');
  }

  /**
   * Signs a transaction. Transaction must be provided as a buffer using getBytes.
   * @see https://github.com/vekexasia/dpos-offline/blob/master/src/trxTypes/BaseTx.ts#L52
   * @param {LedgerAccount} account the account to use when signing the tx.
   * @param {Buffer} buff buffer containing the bytes of a transaction
   * @param {boolean} hasRequesterPKey use true if the tx also includes a requesterPublicKey.
   * This cannot be derived using static analysis of the content included in the bytes.
   * @returns {Promise<Buffer>} signature.
   */
  public signTX(account: LedgerAccount, buff: Buffer, hasRequesterPKey: boolean = false) {
    return this.sign('05', account, buff, hasRequesterPKey);
  }

  /**
   * Signs a message. The message can be passed as a string or buffer.
   * Note that if buffer contains "non-printable" characters, then the ledger will probably have some issues
   * Displaying the message to the user.
   * @param {LedgerAccount} account
   * @param {string | Buffer} what the message to sign
   * @returns {Promise<Buffer>} the "non-detached" signature.
   * Signature goodness can be verified using sodium. See tests.
   */
  public async signMSG(account: LedgerAccount, what: string | Buffer) {
    const buffer: Buffer = typeof(what) === 'string' ? new Buffer(what, 'utf8') : what;
    const signature      = await this.sign('06', account, buffer);
    return Buffer.concat([signature, buffer]);
  }

  /**
   * Simple ping utility. It won't throw if ping suceeded.
   * @returns {Promise<void>}
   */
  public async ping(): Promise<void> {
    const [res] = await this.exchange('e008');
    if (res.toString('utf8') !== 'PONG') {
      throw new Error('Didnt receive PONG');
    }
  }

  /**
   * Raw exchange protocol handling
   * @param {string | Buffer} hexData
   * @returns {Promise<Buffer[]>} Raw response buffers.
   */
  public async exchange(hexData: string | Buffer | Array<(string | Buffer | number)>): Promise<Buffer[]> {
    await this.ensureInitialized();

    let inputBuffer: Buffer;
    if (Array.isArray(hexData)) {
      inputBuffer = Buffer.concat(hexData.map((item) => {
        if (typeof(item) === 'string') {
          return new Buffer(item, 'hex');
        } else if (typeof(item) === 'number') {
          const b = new Buffer(1);
          b.writeUInt8(item, 0);
          return b;
        } else if (item instanceof Buffer) {
          return item;
        }
      }));
    } else if (typeof(hexData) === 'string') {
      inputBuffer = new Buffer(hexData, 'hex');
    } else {
      inputBuffer = hexData;
    }

    // Send start comm packet
    const startCommBuffer = Buffer.alloc(2);
    startCommBuffer.writeUInt16BE(inputBuffer.length, 0);

    await this.comm.send(0xe0, 0x59, 0, 0, startCommBuffer);

    // Calculate number of chunks to send.
    const chunkDataSize = this.chunkSize;
    const nChunks       = Math.ceil(inputBuffer.length / chunkDataSize);

    // APDU Command for ledger to let him know we're in a multi-send-command
    for (let i = 0; i < nChunks; i++) {
      const dataSize = Math.min(inputBuffer.length, (i + 1) * chunkDataSize) - i * chunkDataSize;

      // copy chunk data
      const dataBuffer = inputBuffer.slice(i * chunkDataSize, i * chunkDataSize + dataSize);

      const [ledgerCRC16] = this.decomposeResponse(
        await this.comm.send(
          0xe0,
          90,
          0,
          0,
          dataBuffer
        )
      );
      const crc           = crc16(inputBuffer.slice(0, i * chunkDataSize + dataSize));
      const receivedCRC   = ledgerCRC16.readUInt16LE(0);

      if (crc !== receivedCRC) {
        throw new Error('Something went wrong during CRC validation');
      }

    }
    // Close comm flow.
    const closingBuffer = new Buffer(1);
    closingBuffer.writeUInt8(91, 0);
    const resBuf = await this.comm.send(0xe0, 91, 0, 0);
    return this.decomposeResponse(resBuf);
  }

  /**
   * Public utility to initialize the ledger.
   * @returns {Promise<void>}
   */
  public async init() {
    console.log('preinit');
    this.comm = await createAsync();
    console.log('postinit');
  }

  /**
   * Closes the comm channel.
   * @returns {Promise<any>}
   */
  public tearDown() {
    return this.comm.close();
  }

  /**
   * Raw sign protocol utility. It will handle signature of both msg and txs.
   * @param {string} signType type of signature. 05 for txs, 06 for messages.
   * @param {LedgerAccount} account account
   * @param {Buffer} buff buffer to sign
   * @param {boolean} hasRequesterPKey if it has a requesterpublickey (used only in tx signing mode)
   * @returns {Promise<Buffer>} the signature
   */
  private async sign(
    signType: string,
    account: LedgerAccount,
    buff: Buffer,
    hasRequesterPKey: boolean = false): Promise<Buffer> {

    const pathBuf    = account.derivePath();
    const buffLength = new Buffer(2);
    buffLength.writeUInt16BE(buff.length, 0);
    const args        = await this.exchange([
      'e0',
      signType, // sign
      // Bip32
      (pathBuf.length / 4),
      pathBuf,
      // headers
      buffLength,
      hasRequesterPKey ? '01' : '00',
      // data
      buff,
    ]);
    const [signature] = args;
    return signature;
  }

  /**
   * Utility to ensure ledger comm. is initialized
   * @returns {Promise<void>}
   */
  private async ensureInitialized() {
    if (this.comm === null) {
      await this.init();
    }
  }

  /**
   * Internal utility to decompose the ledger response as protocol definition.
   * @param {Buffer} resBuf response from ledger
   * @returns {Array<Buffer>} decomposed response.
   */
  private decomposeResponse(resBuf: Buffer): Buffer[] {
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
