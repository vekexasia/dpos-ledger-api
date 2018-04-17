import { expect } from 'chai';
import { LedgerAccount } from '../../src';

describe('LedgerAccount', () => {
  it('should initialize with correct default values', () => {
    const acc = new LedgerAccount();
    expect(acc.derivePath().toString('hex')).to.be.eq(
      '8000002c8000008680000000'
    ); // 44/134/0/ (all hardened)
  });

  it('should allow customization of account', () => {
    const acc = new LedgerAccount();

    expect(acc.account(2).derivePath().toString('hex')).to.be.eq(
      '8000002c8000008680000002'
    ); // 44/134/2 (all hardened)
  });
  it('should allow customization of coinIndex', () => {
    const acc = new LedgerAccount();

    expect(acc.coinIndex(2).derivePath().toString('hex')).to.be.eq(
      '8000002c8000000280000000'
    );
  });

  it('should allow chaining of all customizations', () => {
    const acc = new LedgerAccount();

    expect(
      acc
        .account(3)
        .coinIndex(4)
        .derivePath()
        .toString('hex')
    ).to.be.eq(
      '8000002c8000000480000003'
    );

  });

  describe('failures', () => {
    const intFails = ['account', 'coinIndex'];

    for (const intFail of intFails) {
      describe(intFail, () => {
        const acc = new LedgerAccount();
        it('should fail if NaN', () => {
          expect(() => acc[intFail](NaN)).to.throw(/must be an integer/);
        });
        it('should fail if string', () => {
          expect(() => acc[intFail]('1')).to.throw(/must be an integer/);
        });
        it('should fail if <0', () => {
          expect(() => acc[intFail](-1)).to.throw(/must be greater than zero/);
        });
      });
    }

    it('.account should fail for NaN', () => {
      const acc = new LedgerAccount();
      expect(acc)
    });
  });
});
