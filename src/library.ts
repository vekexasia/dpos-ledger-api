import * as crc16 from 'crc/lib/crc16_ccitt';
import { LedgerAccount } from './account';
import { ITransport } from './ledger';

/**
 * Communication Protocol class.
 * @example
 * ```javascript
 *
 * import TransportNodeHid from '@ledgerhq/hw-transport-node-hid';
 * import { DposLedger, LedgerAccount } from 'dpos-ledger-ts';
 *
 * const account = new LedgerAccount();
 * TransportNodeHid.create()
 *   .then((transport) => new DposLedger(transport))
 *   .then((instance) => instance.getPubKey(account));
 *   .then(({publicKey}) => console.log(`pubKey: ${publicKey}`);
 * ```
 */
export class DposLedger {

  /**
   * @param {ITransport} transport transport class.
   * @param {number} chunkSize lets you specify the chunkSize for each communication.<br/>
   * <strong>DO not</strong> change if you don't know what you're doing.
   */
  constructor(private transport: ITransport,  private chunkSize: number = 240) {
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
   * Retrieves a publicKey associated to an account
   * @param {LedgerAccount} account
   * @returns {Promise<{publicKey: string, account:string}>}
   * @example
   * ```javascript
   *
   * instance.getPubKey(account)
   *   .then((resp) => {
   *     console.log(resp.publicKey);
   *     console.log(resp.address);
   *   });
   * ```
   */
  public async getPubKey(account: LedgerAccount): Promise<{publicKey: string, address: string}> {
    const pathBuf = account.derivePath();
    const resp    = await this.exchange([
      '04',
      (pathBuf.length / 4),
      pathBuf,
    ]);

    const [publicKey, address] = resp;

    return {
      address: address.toString('utf8'),
      publicKey: publicKey.toString('hex'),
    };
  }

  /**
   * Signs a transaction. Transaction must be provided as a buffer using getBytes.
   * @see https://github.com/vekexasia/dpos-offline/blob/master/src/trxTypes/BaseTx.ts#L52
   * @param {LedgerAccount} account the account to use when signing the tx.
   * @param {Buffer} buff buffer containing the bytes of a transaction
   * @param {boolean} hasRequesterPKey use true if the tx also includes a requesterPublicKey.
   * This cannot be derived using static analysis of the content included in the bytes.
   * @returns {Promise<Buffer>} signature.
   * @example
   * ```javascript
   *
   * instance.signTX(account, transaction.getBytes(), false)
   *   .then((signature) => {
   *     console.log('Signature is: ', signature.toString('hex'));
   *   });
   * ```
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
   * @example
   * ```javascript
   *
   * instance.signMSG(account, 'vekexasia rules', false)
   *   .then((signature) => {
   *     console.log('Signature is: ', signature.toString('hex'));
   *   });
   * ```
   */
  public async signMSG(account: LedgerAccount, what: string | Buffer) {
    const buffer: Buffer = typeof(what) === 'string' ? new Buffer(what, 'utf8') : what;
    const signature      = await this.sign('06', account, buffer);
    return Buffer.concat([signature, buffer]);
  }

  /**
   * Gets Ledger App Version
   * @returns {Promise<string>} version string Ex: 1.0.0
   * @example
   * ```javascript
   *
   * instance.version()
   *   .then((version) => {
   *     console.log('Version is: ', version);
   *   });
   * ```
   */
  public async version(): Promise<string> {
    const [res] = await this.exchange('09');
    return res.toString('utf8');
  }

  /**
   * Simple ping utility. It won't throw if ping suceeded.
   * @returns {Promise<void>}
   */
  public async ping(): Promise<void> {
    const [res] = await this.exchange('08');
    if (res.toString('utf8') !== 'PONG') {
      throw new Error('Didnt receive PONG');
    }
  }

  /**
   * Raw exchange protocol handling. It's exposed but it is meant for internal usage only.
   * @param {string | Buffer} hexData
   * @returns {Promise<Buffer[]>} Raw response buffers.
   */
  public async exchange(hexData: string | Buffer | Array<(string | Buffer | number)>): Promise<Buffer[]> {
    let inputBuffer: Buffer;
    if (Array.isArray(hexData)) {
      inputBuffer = Buffer.concat(hexData.map((item) => {
        if (typeof(item) === 'string') {
          return new Buffer(item, 'hex');
        } else if (typeof(item) === 'number') {
          const b = new Buffer(1);
          b.writeUInt8(item, 0);
          return b;
        }
        return item;
      }));
    } else if (typeof(hexData) === 'string') {
      inputBuffer = new Buffer(hexData, 'hex');
    } else {
      inputBuffer = hexData;
    }

    // Send start comm packet
    const startCommBuffer = Buffer.alloc(2);
    startCommBuffer.writeUInt16BE(inputBuffer.length, 0);

    await this.transport.send(0xe0, 89, 0, 0, startCommBuffer);

    // Calculate number of chunks to send.
    const chunkDataSize = this.chunkSize;
    const nChunks       = Math.ceil(inputBuffer.length / chunkDataSize);

    for (let i = 0; i < nChunks; i++) {
      const dataSize = Math.min(inputBuffer.length, (i + 1) * chunkDataSize) - i * chunkDataSize;

      // copy chunk data
      const dataBuffer = inputBuffer.slice(i * chunkDataSize, i * chunkDataSize + dataSize);

      const [ledgerCRC16] = this.decomposeResponse(
        await this.transport.send(
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
    const resBuf = await this.transport.send(0xe0, 91, 0, 0);
    return this.decomposeResponse(resBuf);
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
