import { expect } from 'chai';
import * as sinon from 'sinon';
import { SinonSpy, SinonStub } from 'sinon';
import { DposLedger } from '../src/library';
import { LedgerAccount } from '../src/account';

describe('library', () => {
  let instance: DposLedger;
  let commExchangeStub: SinonStub;
  let closeAsyncStub: SinonStub;
  beforeEach(() => {
    instance         = new DposLedger();
    commExchangeStub = sinon.stub();
    closeAsyncStub   = sinon.stub();
    instance['comm'] = {
      exchange   : commExchangeStub,
      close_async: closeAsyncStub
    }
  });

  describe('exchange', () => {
    it('should send one chunk of data and call .comm.exchange twice with proper data', async () => {
      commExchangeStub.resolves('aa');
      await instance.exchange('abcdef');
      expect(commExchangeStub.callCount).is.eq(2);
      expect(commExchangeStub.firstCall.args[0]).to.be.eq(
        (90).toString(16) +
        '03' +
        'abcdef'
      );

      // Second call
      expect(commExchangeStub.secondCall.args[0]).to.be.eq((91).toString(16));
    });

    it('should send multiple chunks of data (properly splitted)', async () => {
      commExchangeStub.resolves('aa');
      const buffer = new Buffer(1024);
      for (let i = 0; i < buffer.length; i++) {
        buffer.writeUInt8(i % 256, i);
      }
      await instance.exchange(buffer);

      expect(commExchangeStub.callCount).to.be.gt(2);
      let read = 0;
      for (let i = 0; i < commExchangeStub.callCount - 1; i++) {
        const call = commExchangeStub.getCall(i);
        expect(call.args[0].substr(0, 2)).to.be.eq((90).toString(16));
        const sent     = Number.parseInt(call.args[0].substr(2, 2), 16);
        const dataSent = buffer.toString('hex', read, sent + read);
        expect(call.args[0].substr(4, sent * 2)).to.be.eq(dataSent);
        read += sent;
      }
      expect(read).to.be.eq(buffer.length);
      expect(commExchangeStub.lastCall.args[0]).to.be.eq((91).toString(16));
    });

    it('should treat string param as hexEncoded string', async () => {
      commExchangeStub.resolves('aa');
      await instance.exchange('aabb');
      expect(commExchangeStub.firstCall.args[0]).to.be.deep.eq('5a02aabb');
    });
    it('should treat array param as mixed string, buffer, number and reconstruct it', async () => {
      const buf = new Buffer('0001', 'hex');
      commExchangeStub.resolves('aa');
      await instance.exchange(['aa', 187 /*bb*/, buf]);
      expect(commExchangeStub.firstCall.args[0]).to.be.deep.eq('5a04aabb0001');
    });
  });

  describe('getPubKey', () => {
    let account: LedgerAccount;
    let derivePathSpy: SinonSpy;
    let instanceExchangeStub: SinonStub;
    beforeEach(() => {
      account              = new LedgerAccount();
      derivePathSpy        = sinon.spy(account, 'derivePath');
      instanceExchangeStub = sinon.stub(instance, 'exchange');
      instanceExchangeStub.resolves([new Buffer('aa', 'hex')]);
    });

    it('should call account derivePath', async () => {
      await instance.getPubKey(account);
      expect(derivePathSpy.calledOnce).is.true;
    });
    it('should call instance.exchange with proper data', async () => {
      await instance.getPubKey(account);
      expect(instanceExchangeStub.calledOnce).is.true;
      expect(instanceExchangeStub.firstCall.args[0]).to.be.deep.eq([
        'e0',
        '04',
        account.derivePath().length / 4,
        account.derivePath()
      ]);
    })
  });

  describe('signTX', () => {
    let account: LedgerAccount;
    let derivePathSpy: SinonSpy;
    let instanceExchangeStub: SinonStub;
    beforeEach(() => {
      account              = new LedgerAccount();
      derivePathSpy        = sinon.spy(account, 'derivePath');
      instanceExchangeStub = sinon.stub(instance, 'exchange');
      instanceExchangeStub.resolves([new Buffer('aa', 'hex')]);
    });

    it('should call account derivePath', async () => {
      await instance.signTX(account, Buffer.alloc(2));
      expect(derivePathSpy.calledOnce).is.true;
    });
    it('should call instance.exchange with signType 05', async () => {
      await instance.signTX(account, Buffer.alloc(2));
      expect(instanceExchangeStub.calledOnce).is.true;
      expect(instanceExchangeStub.firstCall.args[0][1]).to.be.deep.eq('05');
    });
    it('should default hasRequesterPKey to false', async () => {
      await instance.signTX(account, Buffer.alloc(2));
      expect(instanceExchangeStub.calledOnce).is.true;
      expect(instanceExchangeStub.firstCall.args[0][5]).to.be.deep.eq('00');
    });
    it('should allow hasRequesterPKey to true', async () => {
      await instance.signTX(account, Buffer.alloc(2), true);
      expect(instanceExchangeStub.calledOnce).is.true;
      expect(instanceExchangeStub.firstCall.args[0][5]).to.be.deep.eq('01');
    });
    it('should propagate correct data derived from inputbuffer and account', async () => {
      const buff = Buffer.alloc(2);
      await instance.signTX(account, buff, false);
      expect(instanceExchangeStub.calledOnce).is.true;
      const lengthBuff = Buffer.alloc(2);
      lengthBuff.writeUInt16BE(2, 0);
      expect(instanceExchangeStub.firstCall.args[0]).to.be.deep.eq([
        'e0', //cmd,
        '05', // sign type
        account.derivePath().length/4,
        account.derivePath(),
        lengthBuff, // buffer length
        '00',
        buff
      ]);
    });
  });

});