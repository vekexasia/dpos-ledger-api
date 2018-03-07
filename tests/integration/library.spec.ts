import { expect } from 'chai';
import { GenericWallet } from 'dpos-offline';
import {DposLedger} from '../../src/library';
import { LedgerAccount } from '../../src/account';

describe('Integration tests', function () {
  this.timeout(15000);
  let dl: DposLedger;
  let account: LedgerAccount;
  let pubKey: string;
  before(() => {
    dl = new DposLedger();
    return dl.init();
  });
  after(() => dl.tearDown());

  beforeEach(async () => {
    account = new LedgerAccount();
    pubKey = await dl.getPubKey(account);
    expect(pubKey).to.match(/^[a-z0-9]{64}$/);
  });

  describe('Messages', () => {
    it('it should generate valid signature', async () => {
      const msg = 'hey brothaaaar! There\'s an endless road to rediscover';
      const signature = await dl.signMSG(account, msg);
      const res = GenericWallet.verifyMessage(msg, signature, pubKey);
      expect(res).is.true;
    });
    it('should gen valid signature for short message with newline', async () => {
      const msg = 'hey\nhi';
      const signature = await dl.signMSG(account, msg);
      const res = GenericWallet.verifyMessage(msg, signature, pubKey);
      expect(res).is.true;
    });
    it('should gen valid signature for 500bytes message', async () => {
      const msg = new Array(174).fill('a').join('');
      const signature = await dl.signMSG(account, msg);
      const res = GenericWallet.verifyMessage(msg, signature, pubKey);
      expect(res).is.true;
    });

  });

  describe('ping', () => {
    it('should ping', async () => {
      await dl.ping();
    })
  });
});