import TransportU2F from '@ledgerhq/hw-transport-u2f'
import TransportNodeHid from '@ledgerhq/hw-transport-node-hid'
import { isBrowser, isNode } from 'browser-or-node';

import * as ledgerco from 'ledgerco';

export interface ILedger {
  close(): Promise<any>;

  // exchange(data: Buffer, statuses: number[]): Promise<string>;
  send(cla:number, ins: number, p1: number, p2:number, data?:Buffer, statusList?: number[]): Promise<Buffer>;
}

export async function createAsync(): Promise<ILedger> {
  if (isBrowser) {
    const toRet = await TransportU2F.open(null);
    toRet.setScrambleKey('mRB');
    toRet.setDebugMode(true);
    return toRet;
  }
  const nodeTransport = await TransportNodeHid.create();
  // nodeTransport.ledgerTransport = false;
  // nodeTransport.debug = true;
  // console.log(nodeTransport);
  // console.log(nodeTransport.device.getDeviceInfo());
  //
  // if (Math.random() <1000) {
  //   const bit = await ledgerco.comm_node.create_async();
  //   bit.send = async function (cla:number, ins: number, p1: number, p2:number, data:Buffer = Buffer.alloc(0), statusList: number[] = [ 0x9000 ]) {
  //     console.log('sending');
  //     const res = await this.exchange(Buffer.concat([Buffer.from([cla, ins, p1, p2]), Buffer.from([data.length]), data]).toString('hex'), statusList);
  //     console.log('received response', res);
  //     return new Buffer(res, 'hex');
  //   };
  //   return bit;
  // }
  return nodeTransport;
}