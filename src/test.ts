import { derivePath, DposLedger } from './library';
import {api as sodium} from 'sodium';
import {deriveDPOSAddress} from 'dpos-offline/dist/es5/utils/dposUtils';
import { dposOffline } from 'dpos-offline';
import { BaseTransaction } from 'risejs';
import { BaseTx } from 'dpos-offline/dist/es5/trxTypes';
import {dposAPI} from 'dpos-api-wrapper';
import * as crypto from 'crypto';
const dl = new DposLedger();

async function brocca(msg:Buffer) {
  const pk = await dl.getPubKeyAt(1);
  const signature = await dl.signMSG(1, msg);
  const hash = crypto.createHash('sha256').update(msg).digest();
  console.log('Signature Received', signature.toString('hex'));
  console.log('PublicKey: ', pk);
  console.log('Address: ', deriveDPOSAddress(pk, 'L'));
  console.log('hash: ', hash.toString('hex'));
    const verified= sodium.crypto_sign_verify_detached(
    signature,
    hash,
    new Buffer(pk, 'hex')
  );

  console.log('isVerified', verified);
  return signature;
}

async function broccaTX(msg:Buffer) {
  const pk = await dl.getPubKeyAt(1);
  const signature = await dl.signTX(1, msg);
  const hash = crypto.createHash('sha256').update(msg).digest();
  console.log('Signature Received', signature.toString('hex'));
  console.log('PublicKey: ', pk);
  console.log('Address: ', deriveDPOSAddress(pk, 'L'));
  const verified= sodium.crypto_sign_verify_detached(
    signature,
    hash,
    new Buffer(pk, 'hex')
  );

  console.log('isVerified', verified);
  return signature;
}
// async function testTx() {
//
//   const sendTx = new dposOffline.transactions.CreateSignatureTx({
//     signature: {
//       publicKey: '8a334c68c8be0efa449190c921bfa5e94fd2b8dec9b8a3727299e39add71b351'
//     }
//   });
//   let pk = '7a334c68c8be0efa449190c921bfa5e94fd2b8dec9b8a3727299e39add71b353';
//   console.log(deriveDPOSAddress(pk, 'L'));
//   const tx = sendTx
//     .set('senderPublicKey', pk)
//     .set('fee', 10)
//     .set('amount', 155000000)
//     .set('timestamp', 0)
//     .set('recipientId', '10140375640255463899L');
//
//   console.log(tx);
//   const bytes = tx.getBytes();
//   console.log(bytes.toString('hex'))
//   const brocca = await dl.signTX(1, bytes, false);
//   console.log(brocca.toString('hex'));
//
// }
let tx: BaseTx;
// SEND
tx = new dposOffline.transactions.SendTx();
tx.amount = 100000000*2;
tx.recipientId = '16470624531434014871L';
tx.fee = 10000000;

// VOTE
// tx = new dposOffline.transactions.VoteTx({
//   votes: [
//     '+fddcf8ef84aa5545da06e0ca38f1a716f0dbfdb51947a9af4ec1edd259a4f0dd',
//   ]
// });
// tx.amount = 0;
// tx.fee = 100000000;

tx.senderPublicKey = 'c5629020dae55c4cb1fe90449f14192ff4713ec56ce54b5bb453c06410ca033f';
tx.recipientId = tx.recipientId || '13077120277149237052L';
tx.timestamp = 1000001;


const bytes = tx.getBytes();

async function testHirish() {
  console.log(bytes.length);
  const signature = await broccaTX(bytes);
  tx.signature = signature.toString('hex');
  const txOBJ = tx.toObj();

  dposAPI.nodeAddress = 'https://testnet.lisk.io';

  const transport = await dposAPI.buildTransport();
  const resp = await transport.postTransaction(txOBJ);
  console.log(resp);

}
testHirish();

// brocca('ciao');
// broccaRaw(1, new Array(220).fill(null).map(() => 'a').join(''))
//   .then(console.log);

// brocca([
//   'certo che si!'
// ].join(''))
//
//   .catch (console.log);