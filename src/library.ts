import * as ledger from 'ledgerco';
import { LedgerAccount } from './account';

type Ledger = {
  close_async(): Promise<any>
  exchange(data: string, statuses: number[]): Promise<string>
}


export class DposLedger {
  private comm: Ledger = null;

  constructor() {
  }

  public async getPubKey(account: LedgerAccount): Promise<string> {
    const pathBuf     = account.derivePath();
    const resp        = await this.exchange([
      'e0',
      '04',
      (pathBuf.length / 4),
      pathBuf
    ]);
    // console.log(resp.map((i) => i.toString('hex')));
    const [publicKey] = resp;

    return publicKey.toString('hex');
  }

  public signTX(account: LedgerAccount, buff: Buffer, hasRequesterPKey: boolean = false) {
    return this.sign('05', account, buff, hasRequesterPKey);
  }

  public async signMSG(account: LedgerAccount, what: string | Buffer) {
    const buffer: Buffer = typeof(what) === 'string' ? new Buffer(what, 'utf8') : what;
    const signature      = await this.sign('06', account, buffer);
    return Buffer.concat([signature, buffer]);
  }

  private async sign(signType: string, account: LedgerAccount, buff: Buffer, hasRequesterPKey: boolean = false): Promise<Buffer> {
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
      buff
    ]);
    const [signature] = args;
    return signature;
  }

  public async ping(): Promise<void> {
    const [res] = await this.exchange('e008');
    if (res.toString('utf8') !== 'PONG') {
      throw new Error('Didnt receive PONG');
    }
  }
  /**
   * Raw exchange protocol handling
   * @param {string | Buffer} hexData
   * @returns {Promise<Buffer[]>}
   */
  public async exchange(hexData: string | Buffer | (string | Buffer | number)[]): Promise<Buffer[]> {
    await this.assertInit();

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

    // Calculate number of chunks to send.
    const chunkDataSize = 200;
    const nChunks       = Math.ceil(hexData.length / chunkDataSize);

    const tempBuffer = new Buffer(chunkDataSize + 1 /*howManyBytes This time*/ + 1 /*commcode*/);
    // APDU Command for ledger to let him know we're in a multi-send-command
    tempBuffer.writeUInt8(90, 0);
    console.log(nChunks);
    for (let i = 0; i < nChunks; i++) {
      const dataSize = Math.min(inputBuffer.length, (i + 1) * chunkDataSize) - i * chunkDataSize;
      tempBuffer.writeUInt8(dataSize, 1);

      // copy chunk data
      inputBuffer.copy(tempBuffer, 2, i * chunkDataSize, i * chunkDataSize + dataSize);
      const resBuf = new Buffer(await this.comm.exchange(
        tempBuffer
          .slice(0, dataSize + 2)
          .toString('hex'),
        [0x9000]
        ),
        'hex'
      );
      console.log(tempBuffer
        .slice(0, dataSize + 2)
        .toString('hex'));
      console.log(this.decomposeResponse(resBuf).map((buf) => buf.toString('hex')));
      // console.log('DataSize', dataSize.toString(16));
      // if (resBuf.toString('hex') !== dataSize.toString(16)) {
      //   // TODO: Assess feasibility of sha256
      //   throw new Error(`Communication went wrong. Expected ${dataSize.toString(16)} - received ${resBuf.toString('hex')} - Size: ${dataSize}`)
      // }
    }

    // Close comm flow.
    const closingBuffer = new Buffer(1);
    closingBuffer.writeUInt8(91, 0);
    console.log('pre');
    const resBuf = new Buffer(await this.comm.exchange(closingBuffer.toString('hex'), [0x9000]), 'hex');
    return this.decomposeResponse(resBuf);
  }

  private decomposeResponse(resBuf: Buffer): Array<Buffer> {
    const totalElements        = resBuf.readInt8(0);
    const toRet: Array<Buffer> = [];
    let index                  = 1; // 1 read uint8_t
    for (let i = 0; i < totalElements; i++) {
      const elLength = resBuf.readInt16LE(index);
      index += 2;
      toRet.push(resBuf.slice(index, index + elLength));
      index += elLength;
    }

    return toRet;
  }

  private async assertInit() {
    if (this.comm === null) {
      await this.init();
    }
  }

  public async init() {
    this.comm = await ledger.comm_node.create_async();
  }

  public tearDown() {
    return this.comm.close_async();
  }
}

