import * as chai from 'chai';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { SinonSpy, SinonStub } from 'sinon';
import { DposLedger } from '../../src/library';
import { LedgerAccount } from '../../src/account';
import { crc16ccitt as crc16 } from 'crc';
import * as chaiAsPromised from 'chai-as-promised';
chai.use(chaiAsPromised);

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

  describe('exchange comm protocol', () => {
    function buildResponseFromLedger(resps: Buffer[]) {
      return Buffer
        .concat(
          [
            new Buffer([resps.length]),
          ].concat(
            resps.map((b) => {
              const outBuf = Buffer.alloc(2 + b.length);
              outBuf.writeUInt16LE(b.length, 0);
              b.copy(outBuf, 2, 0, b.length);
              return outBuf
            }))
        )
        .toString('hex')
    }

    function buildCommProtocol(data: Buffer, finalResp: Buffer[] = [new Buffer('aa', 'hex')], chunkSize: number = 240) {
      const chunks  = Math.ceil(data.length / chunkSize);
      const crcBuff = new Buffer('0102000000', 'hex');
      for (let i = 0; i < chunks; i++) {
        crcBuff.writeUInt16LE(crc16(data.slice(0, (i + 1) * chunkSize)), 3);
        console.log('toresp', i + 1, crcBuff.toString('hex'))
        commExchangeStub.onCall(i + 1).resolves(crcBuff.toString('hex'));
      }

      // Final response result
      const finalResultResponse = buildResponseFromLedger(finalResp);
      commExchangeStub.onCall(chunks + 1)
        .resolves(finalResultResponse)
    }

    describe('all good', () => {
      it('should send one chunk of data and call .comm.exchange twice with proper data', async () => {
        buildCommProtocol(
          new Buffer('abcdef', 'hex')
        );
        await instance.exchange('abcdef');
        expect(commExchangeStub.callCount).is.eq(3);
        expect(commExchangeStub.firstCall.args[0]).to.be.eq(
          '59' + // init comm
          '0003' // buffer length
        );

        // Second call - Communication continuation
        expect(commExchangeStub.secondCall.args[0]).to.be.eq(
          '5a' + // communication continuation
          '03' + // 'number of bytes',
          'abcdef'
        );

        // Third call - Communication closure.
        expect(commExchangeStub.thirdCall.args[0]).to.be.eq(
          '5b'
        );
      });

      it('should send multiple chunks of data (properly splitted)', async () => {
        const buffer = new Buffer(1024);
        for (let i = 0; i < buffer.length; i++) {
          buffer.writeUInt8(i % 256, i);
        }
        buildCommProtocol(buffer);
        await instance.exchange(buffer);

        expect(commExchangeStub.callCount).to.be.gt(2);
        let read = 0;
        for (let i = 0; i < commExchangeStub.callCount - 2; i++) {
          const call = commExchangeStub.getCall(i + 1);
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
        buildCommProtocol(new Buffer('aabb', 'hex'));
        await instance.exchange('aabb');
        expect(commExchangeStub.secondCall.args[0]).to.be.deep.eq('5a02aabb');
      });
      it('should treat array param as mixed string, buffer, number and reconstruct it', async () => {
        const buf = new Buffer('0001', 'hex');
        buildCommProtocol(new Buffer('aabb0001', 'hex'));
        await instance.exchange(['aa', 187 /*bb*/, buf]);
        expect(commExchangeStub.secondCall.args[0]).to.be.deep.eq('5a04aabb0001');
      });
      it('should work even for 1 chunksize with proper data sent and # of comm with ledger', async () => {
        instance['chunkSize'] = 1;
        const buffer          = new Buffer(1024);
        for (let i = 0; i < buffer.length; i++) {
          buffer.writeUInt8(i % 256, i);
        }
        buildCommProtocol(buffer, [new Buffer('aa', 'hex')], 1);
        await instance.exchange(buffer);

        expect(commExchangeStub.callCount).eq(buffer.length + 2);
      });
    });
    it('should fail if one of the CRC fails', () => {
      let buffer = new Buffer('aabb', 'hex');
      buildCommProtocol(buffer);
      commExchangeStub.onCall(1).resolves('0102000000');
      return expect(instance.exchange(buffer)).to.be.rejectedWith('Something went wrong during CRC validation');
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
    });
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
        account.derivePath().length / 4,
        account.derivePath(),
        lengthBuff, // buffer length
        '00',
        buff
      ]);
    });
  });

});