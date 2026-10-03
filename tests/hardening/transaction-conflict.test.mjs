import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTypeScript} from './load-typescript.mjs';
const {isRetryableTransactionConflict}=await loadTypeScript('backend/src/config/transaction-conflict.ts');
for(const error of [
 {code:'P2010',meta:{driverAdapterError:{name:'DriverAdapterError',cause:{kind:'TransactionWriteConflict',originalCode:'40001'}}}},
 {code:'P2034'},{code:'P2002'},{code:'P2010',meta:{code:'40001'}},{code:'P2010',meta:{code:'40P01'}},
 {name:'DriverAdapterError',cause:{kind:'TransactionWriteConflict',originalCode:'40001'}},
 {name:'DriverAdapterError',cause:{kind:'TransactionWriteConflict'}},
 {name:'DriverAdapterError',cause:{kind:'UniqueConstraintViolation',originalCode:'23505'}},
])test(`DATA-001: retry recognized transaction conflict ${JSON.stringify(error)}`,()=>{
 assert.equal(isRetryableTransactionConflict(error),true);
});
for(const error of [null,{},new Error('unknown outcome'),{code:'P1001'},
 {name:'DriverAdapterError',cause:{kind:'ConnectionClosed'}},
 {name:'DriverAdapterError',cause:{kind:'TransactionWriteConflict',originalCode:'08006'}},
 {code:'P2010',meta:{code:'42P01'}},
])test(`DATA-001: do not retry unrecognized/connection failures ${JSON.stringify(error)}`,()=>{
 assert.equal(isRetryableTransactionConflict(error),false);
});
