import * as ledger from 'ledgerco';
import { dposOffline } from 'dpos-offline';
import { rise } from 'risejs';

type Ledger = {
  close_async(): Promise<any>
  exchange(data: string, statuses: number[]): Promise<string>
}

/**
 * Derive bip32Path in an encoded buffer.
 * @param {string | string[]} path
 * @returns {Buffer}
 */
export function derivePath(path: string | string[]): Buffer {
  const result: number[]     = [];
  const components: string[] = typeof(path) === 'string' ? path.split('/') : path;
  components.forEach(function (element) {
    let number = parseInt(element, 10);
    if (isNaN(number)) {
      return;
    }
    if ((element.length > 1) && (element[element.length - 1] == "'")) {
      number += 0x80000000;
    }
    result.push(number);
  });
  const retBuf = Buffer.alloc(result.length * 4);
  result.forEach((r, idx) => retBuf.writeUInt32BE(r, idx * 4));

  return retBuf;
}

export class DposLedger {
  private comm: Ledger = null;

  constructor() {
  }

  public async getPubKeyAt(index: number): Promise<string> {
    const pathBuf     = derivePath(`41'/144'/0'/0'/${index}'`);
    const [publicKey] = await this.exchange([
      'e0',
      '04',
      (pathBuf.length / 4),
      pathBuf
    ]);
    return publicKey.toString('hex');
  }

  public signTX(index: number, buff: Buffer, hasRequesterPKey: boolean = false) {
    return this.sign('05', index, buff, hasRequesterPKey);
  }

  public signMSG(index: number, what: string | Buffer) {
    return this.sign('06', index, typeof(what) === 'string' ? new Buffer(what, 'utf8') : what);
  }

  private async sign(signType: string, index: number, buff: Buffer, hasRequesterPKey: boolean = false): Promise<Buffer> {
    const pathBuf    = derivePath(`41'/144'/0'/0'/${index}'`);
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

    // console.log(inputBuffer.toString('hex'));

    const resBuf = new Buffer(await this.comm.exchange(inputBuffer.toString('hex'), [0x9000]), 'hex');

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

  async init() {
    this.comm = await ledger.comm_node.create_async();
  }

  tearDown() {
    return this.comm.close_async();
  }
}


const sodium = require('sodium').api;


async function test() {
  rise.nodeAddress = 'https://twallet.oxycoin.io';
  const transport  = rise.transport({
    nethash: '0daee950841005a3f56f6588b4b084695f0d74aaa38b21edab73446064638552',
    version: '0.1.1',
    port   : 1234
  });
  const dl         = new DposLedger();

  let pubKey = await dl.getPubKeyAt(1);
  const tx   = new dposOffline.transactions.SendTx()
    .set('amount', 10)
    .set('fee', 10000000)
    .set('senderPublicKey', pubKey)
    .set('timestamp', 10)
    .set('recipientId', '4628314282301468484X');


  const address = dposOffline.utils.deriveDPOSAddress(pubKey, 'X');

  let bytes = tx.getBytes();
  bytes     = new Buffer(0);
  for (let i = 0; i < 1024; i++) {
    const tmpBuff = new Buffer(1);
    tmpBuff.writeUInt8(i % 256, 0);
    bytes           = Buffer.concat([bytes, tmpBuff]);
    const signature = await dl.signTX(1, bytes);
    // console.log(await transport.postTransaction(txObj));
    const res       = sodium.crypto_sign_verify_detached(
      signature,
      bytes,
      new Buffer(pubKey, 'hex')
    );
    if (!res) {
      console.log('fail', i);
      console.log(bytes.toString('hex'));
    }
  }

}

// test();

// new DposLedger().getPubKeyAt(2111).then(console.log);