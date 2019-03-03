import { LedgerAccount } from './account';
import { CommHandler } from './commHandler';

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
   * @param {CommHandler} commHandler communication handler
   */
  constructor(private commHandler: CommHandler) {
  }

  /**
   * Retrieves a publicKey associated to an account
   * @param {LedgerAccount|Buffer} account or bip32 buffer
   * @param {boolean} showOnLedger ask ledger to show the address.
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
  // tslint:disable-next-line max-line-length
  public async getPubKey(account: LedgerAccount | Buffer, showOnLedger: boolean = false): Promise<{ publicKey: string, address: string }> {
    const pathBuf = Buffer.isBuffer(account) ? account : account.derivePath();
    const resp    = await this.commHandler.exchange([
      0x04,
      showOnLedger ? 0x1 : 0x0,
      (pathBuf.length / 4),
      pathBuf,
    ]);

    const [publicKey, address] = resp;

    return {
      address  : address.toString('utf8'),
      publicKey: publicKey.toString('hex'),
    };
  }

  /**
   * Signs a transaction. Transaction must be provided as a buffer using getBytes.
   * @see https://github.com/vekexasia/dpos-offline/blob/master/src/trxTypes/BaseTx.ts#L52
   * @param {LedgerAccount | Buffer} account or raw bip32 buffer
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
  public signTX(account: LedgerAccount | Buffer, buff: Buffer) {
    return this.sign(0x05, account, buff);
  }

  /**
   * Signs a message. The message can be passed as a string or buffer.
   * Note that if buffer contains "non-printable" characters, then the ledger will probably have some issues
   * Displaying the message to the user.
   * @param {LedgerAccount | Buffer} account or raw bip32 buffer
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
  public async signMSG(account: LedgerAccount | Buffer, what: string | Buffer) {
    const buffer: Buffer = typeof(what) === 'string' ? new Buffer(what, 'utf8') : what;
    return this.sign(0x06, account, buffer);
  }

  /**
   * Gets Ledger App Version
   * @returns {Promise<object>} see example
   * @example
   * ```javascript
   *
   * instance.version()
   *   .then((resp) => {
   *     console.log('CoinID is: ', resp.coinID);
   *     console.log('Version is: ', resp.version);
   *   });
   * ```
   */
  public async version(): Promise<{ version: string, coinID: string }> {
    const [version, coinID] = await this.commHandler.exchange(0x09);
    return {
      coinID : coinID.toString('ascii'),
      version: version.toString('ascii'),
    };
  }

  /**
   * Simple ping utility. It won't throw if ping suceeded.
   * @returns {Promise<void>}
   */
  public async ping(): Promise<void> {
    const [res] = await this.commHandler.exchange(0x08);
    if (res.toString('ascii') !== 'PONG') {
      throw new Error('Didnt receive PONG');
    }
  }

  /**
   * Raw sign protocol utility. It will handle signature of both msg and txs.
   * @param {number} signType type of signature. 0x05 for txs, 0x06 for messages.
   * @param {LedgerAccount|Buffer} account acount or bip32 buffer
   * @param {Buffer} buff buffer to sign
   * @param {boolean} hasRequesterPKey if it has a requesterpublickey (used only in tx signing mode)
   * @returns {Promise<Buffer>} the signature
   */
  protected async sign(
    signType: number,
    account: LedgerAccount | Buffer,
    buff: Buffer): Promise<Buffer> {

    const pathBuf    = Buffer.isBuffer(account) ? account : account.derivePath();
    const buffLength = new Buffer(2);
    buffLength.writeUInt16BE(buff.length, 0);
    const args        = await this.commHandler.exchange([
      signType, // sign
      // Bip32
      (pathBuf.length / 4),
      pathBuf,
      // headers
      buffLength,
      0x00, // Old hasRequesterPubKey
      // data
      buff,
    ]);
    const [signature] = args;
    return signature;
  }

}
