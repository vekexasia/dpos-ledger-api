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
  let commSendStub: SinonStub;
  let closeStub: SinonStub;
  let setScrambleKeyStub: SinonStub;
  beforeEach(() => {
    commSendStub       = sinon.stub();
    closeStub          = sinon.stub();
    setScrambleKeyStub = sinon.stub();
    const transport    = {
      send          : commSendStub,
      close         : closeStub,
      setScrambleKey: setScrambleKeyStub
    };
    instance           = new DposLedger(transport);
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
    }

    function buildCommProtocol(data: Buffer, finalResp: Buffer[] = [new Buffer('aa', 'hex')], chunkSize: number = 240) {
      const chunks  = Math.ceil(data.length / chunkSize);
      const crcBuff = new Buffer('0102000000', 'hex');
      for (let i = 0; i < chunks; i++) {
        crcBuff.writeUInt16LE(crc16(data.slice(0, (i + 1) * chunkSize)), 3);
        commSendStub.onCall(i + 1).resolves(new Buffer(crcBuff));
      }

      // Final response result
      const finalResultResponse = buildResponseFromLedger(finalResp);
      commSendStub.onCall(chunks + 1)
        .resolves(finalResultResponse)
    }

    describe('all good', () => {
      it('should send one chunk of data and call .comm.exchange twice with proper data', async () => {
        buildCommProtocol(
          new Buffer('abcdef', 'hex')
        );
        await instance.exchange('abcdef');
        expect(commSendStub.callCount).is.eq(3);
        expect(commSendStub.firstCall.args).to.be.deep.eq(
          [0xe0, 0x59, 0, 0, new Buffer('0003', 'hex')]
        );

        // Second call - Communication continuation
        expect(commSendStub.secondCall.args).to.be.deep.eq(
          [0xe0, 90, 0, 0, new Buffer('abcdef', 'hex')]
        );

        // Third call - Communication closure.
        expect(commSendStub.thirdCall.args).to.be.deep.eq(
          [0xe0, 91, 0, 0]
        );
      });

      it('should send multiple chunks of data (properly splitted)', async () => {
        const buffer = new Buffer(1024);
        for (let i = 0; i < buffer.length; i++) {
          buffer.writeUInt8(i % 256, i);
        }
        buildCommProtocol(buffer);
        await instance.exchange(buffer);

        expect(commSendStub.callCount).to.be.gt(2);
        let read = 0;
        for (let i = 0; i < commSendStub.callCount - 2; i++) {
          const call = commSendStub.getCall(i + 1);

          const sent = call.args[4].length;

          expect(call.args[4]).to.be.deep.eq(new Buffer(buffer.slice(read, sent + read)));
          read += sent;
        }
        expect(read).to.be.eq(buffer.length);
      });

      it('should treat string param as hexEncoded string', async () => {
        buildCommProtocol(new Buffer('aabb', 'hex'));
        await instance.exchange('aabb');
        expect(commSendStub.secondCall.args[4]).to.be.deep.eq(new Buffer('aabb', 'hex'));
      });
      it('should treat array param as mixed string, buffer, number and reconstruct it', async () => {
        const buf = new Buffer('0001', 'hex');
        buildCommProtocol(new Buffer('aabb0001', 'hex'));
        await instance.exchange(['aa', 187 /*bb*/, buf]);
        expect(commSendStub.secondCall.args[4]).to.be.deep.eq(new Buffer('aabb0001', 'hex'));
      });
      it('should work even for 1 chunksize with proper data sent and # of comm with ledger', async () => {
        instance['chunkSize'] = 1;
        const buffer          = new Buffer(1024);
        for (let i = 0; i < buffer.length; i++) {
          buffer.writeUInt8(i % 256, i);
        }
        buildCommProtocol(buffer, [new Buffer('aa', 'hex')], 1);
        await instance.exchange(buffer);

        expect(commSendStub.callCount).eq(buffer.length + 2);
      });
    });
    it('should fail if one of the CRC fails', () => {
      let buffer = new Buffer('aabb', 'hex');
      buildCommProtocol(buffer);
      commSendStub.onCall(1).resolves(new Buffer('0102000000', 'hex'));
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