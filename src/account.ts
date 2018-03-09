import * as bip32path from 'bip32-path';

/**
 * Class to specify An account used to query the ledger.
 */
export class LedgerAccount {
  private _account: number   = 0;
  private _index: number     = 1;
  private _coinIndex: number = 134; // LISK

  /**
   * Specify the index (last path in bip32)
   * @param {number} newIndex
   * @returns {this}
   */
  public index(newIndex: number): this {
    if (!Number.isInteger(newIndex)) {
      throw new Error('Index must be an integer');
    }
    this._index = newIndex;
    return this;
  }

  /**
   * Specify the account number
   * @param {number} newAccount
   * @returns {this}
   */
  public account(newAccount: number): this {
    if (!Number.isInteger(newAccount)) {
      throw new Error('Account must be an integer');
    }
    this._account = newAccount;
    return this;
  }

  /**
   * Specify the coin index.
   * @see https://github.com/satoshilabs/slips/blob/master/slip-0044.md
   * @param {number} newIndex
   * @returns {this}
   */
  public coinIndex(newIndex: number): this {
    if (!Number.isInteger(newIndex)) {
      throw new Error('Coin index must be an integer');
    }
    this._coinIndex = newIndex;
    return this;
  }

  /**
   * Derive the path using hardened entries.
   * @returns {Buffer} defines the path in buffer form.
   */
  public derivePath(): Buffer {
    const pathArray:number[] = bip32path.fromString(`41'/${this._coinIndex}'/0'/${this._account}'/${this._index}'`)
      .toPathArray();

    const retBuf = Buffer.alloc(pathArray.length*4);
    pathArray.forEach((r, idx) => retBuf.writeUInt32BE(r, idx * 4));
    return retBuf;
  }

}