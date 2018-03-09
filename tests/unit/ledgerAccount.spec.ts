import { expect } from 'chai';
import { LedgerAccount } from '../../src';

describe('LedgerAccount', () => {
  it('should initialize with correct default values', () => {
    const acc = new LedgerAccount();
    expect(acc.derivePath().toString('hex')).to.be.eq(
      '8000002980000086800000008000000080000001'
    ); // 41/134/0/0/1 (all hardened)
  });

  it('should allow customization of account', () => {
    const acc = new LedgerAccount();

    expect(acc.account(2).derivePath().toString('hex')).to.be.eq(
      '8000002980000086800000008000000280000001'
    ); // 41/134/0/2/1 (all hardened)
    // console.log(derivePath("41'/134'/0'/2'/1'").toString('hex'));
  });
  it('should allow customization of coinIndex', () => {
    const acc = new LedgerAccount();

    expect(acc.coinIndex(2).derivePath().toString('hex')).to.be.eq(
      '8000002980000002800000008000000080000001'
    );
  });
  it('should allow customization of index', () => {
    const acc = new LedgerAccount();

    expect(acc.index(2).derivePath().toString('hex')).to.be.eq(
      '8000002980000086800000008000000080000002'
    );
  });

  it('should allow chaining of all customizations', () => {
    const acc = new LedgerAccount();

    expect(
      acc
        .index(2)
        .account(3)
        .coinIndex(4)
        .derivePath()
        .toString('hex')
    ).to.be.eq(
      '8000002980000004800000008000000380000002'
    );

  });
});