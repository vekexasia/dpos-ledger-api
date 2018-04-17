import * as bip32path from 'bip32-path';

/**
 * Class to specify An account used to query the ledger.
 */
export enum SupportedCoin {
  /**
   * @see https://lisk.io
   */
  LISK = 134,
  /**
   * @see https://rise.vision
   */
  RISE = 1120,
}

/**
 * Defines an Account to be used when communicating with ledger
 */
export class LedgerAccount {
  // tslint:disable variable-name
  private _account: number   = 0;
  private _coinIndex: SupportedCoin = SupportedCoin.LISK; // LISK

  // tslint:enable variable-name

  /**
   * Specify the account number
   * @param {number} newAccount
   * @returns {this}
   */
  public account(newAccount: number): this {
    this.assertValidPath(newAccount);
    this._account = newAccount;
    return this;
  }

  /**
   * Specify the coin index.
   * @see https://github.com/satoshilabs/slips/blob/master/slip-0044.md
   * @param {number} newIndex
   * @returns {this}
   */
  public coinIndex(newIndex: SupportedCoin): this {
    this.assertValidPath(newIndex);
    this._coinIndex = newIndex;
    return this;
  }

  /**
   * Derive the path using hardened entries.
   * @returns {Buffer} defines the path in buffer form.
   */
  public derivePath(): Buffer {
    const pathArray: number[] = bip32path.fromString(`44'/${this._coinIndex}'/${this._account}'`)
      .toPathArray();

    const retBuf = Buffer.alloc(pathArray.length * 4);
    pathArray.forEach((r, idx) => retBuf.writeUInt32BE(r, idx * 4));
    return retBuf;
  }

  /**
   * Asserts that the given param is a valid path (integer > 0)
   */
  private assertValidPath(n: number) {
    if (!Number.isInteger(n)) {
      throw new Error('Param must be an integer');
    }
    if (n < 0) {
      throw new Error('Param must be greater than zero');
    }
  }
}
