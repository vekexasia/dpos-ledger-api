import * as ledger from 'ledgerco';

export interface ILedger {
  close_async(): Promise<any>;

  exchange(data: string, statuses: number[]): Promise<string>;
}

export async function createAsync(): Promise<ILedger> {
  if (typeof(ledger.comm_node) === 'undefined') {
    const toRet = await ledger.comm_u2f.create_async();
    toRet.setScrambleKey(new Buffer('00', 'hex'));
    return toRet;
  }
  return ledger.comm_node.create_async();
}