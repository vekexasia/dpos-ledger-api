import * as bip32path from 'bip32-path';

export class LedgerAccount {
  private _account: number   = 0;
  private _index: number     = 1;
  private _coinIndex: number = 144;

  public index(newIndex: number): this {
    if (!Number.isInteger(newIndex)) {
      throw new Error('Index must be an integer');
    }
    this._index = newIndex;
    return this;
  }

  public account(newAccount: number): this {
    if (!Number.isInteger(newAccount)) {
      throw new Error('Account must be an integer');
    }
    this._account = newAccount;
    return this;
  }

  public coinIndex(newIndex: number): this {
    if (!Number.isInteger(newIndex)) {
      throw new Error('Coin index must be an integer');
    }
    this._coinIndex = newIndex;
    return this;
  }

  public derivePath(): Buffer {
    const pathArray:number[] = bip32path.fromString(`41'/${this._coinIndex}'/0'/${this._account}'/${this._index}'`)
      .toPathArray();

    const retBuf = Buffer.alloc(pathArray.length*4);
    pathArray.forEach((r, idx) => retBuf.writeUInt32BE(r, idx * 4));
    return retBuf;

    // const result: number[]     = [];
    // const components: string[] = [
    //   '41\'',
    //   `${this._coinIndex}'`,
    //   `${0}'`,
    //   `${this._account}'`,
    //   `${this._index}'`,
    // ];
    // components.forEach(function (element) {
    //   let number = parseInt(element, 10);
    //   if (isNaN(number)) {
    //     return;
    //   }
    //   if ((element.length > 1) && (element[element.length - 1] == "'")) {
    //     number += 0x80000000;
    //   }
    //   result.push(number);
    // });
    // const retBuf = Buffer.alloc(result.length * 4);
    // result.forEach((r, idx) => retBuf.writeUInt32BE(r, idx * 4));
    //
    // return retBuf;
  }

}