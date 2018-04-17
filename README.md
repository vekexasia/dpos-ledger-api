[![npm](https://img.shields.io/npm/v/dpos-ledger-api.svg)](https://npmjs.org/package/dpos-ledger-api) [![Build Status](https://travis-ci.org/vekexasia/dpos-ledger-api.svg?branch=master)](https://travis-ci.org/vekexasia/dpos-ledger-api)  [![Coverage Status](https://coveralls.io/repos/github/vekexasia/dpos-ledger-api/badge.svg?branch=master)](https://coveralls.io/github/vekexasia/dpos-ledger-api?branch=master)

# dPoS Ledger 

This library is meant to be used with the corresponding Ledger C implementation. Given the end-user have:

 - His ledger connected & unlocked;
 - the corresponding app open;

This JS library will serve as an interface between your code and the hardware wallet handling the communication protocol.


## Documentation

Documention is available [here](https://vekexasia.github.io/dpos-ledger-api/index.html).

## Environment Support

This library does not make any assumption on the environment on which it is being consumed.

Both Node.JS and minified Browser version of this library are provided.

### NodeJS

To consume this library through an app running under the NodeVM, you'll need to use the [@ledgerhq/hw-transport-node-hid](https://github.com/LedgerHQ/ledgerjs/blob/master/packages/hw-transport-node-hid) transport.

This library, and the ledger app, have been developed and tested with `hw-transport-node-hid@4.7.6`.

### Browser

The Browser version currently weights `32KB` (non gzipped). It can be used both via webpack or directly including it in your page just like any other script.

This library, and the ledger app, have been tested with `@ledgerhq/hw-transport-node-hid@4.7.3` as Transport.

## Platform Indipendent Example

```typescript
import TransportU2F from '@ledgerhq/hw-transport-u2f';
import TransportNodeHid from '@ledgerhq/hw-transport-node-hid';
import { isBrowser, isNode } from 'browser-or-node';
import { DposLedger } from 'dpos-ledger-api';

let transportMethod;
if (isBrowser) {
	transportMethod = TransportU2F;
} else if (isNode) {
	transportMethod = TransportNodeHid;
} else {
	// ??
}

transportMethod.create()
	.then((transport) => new DposLedger(transport));
	.then((instance) => {
	    // ..
	});

```

## Thanks

Any improvement/suggestion is very welcome :)