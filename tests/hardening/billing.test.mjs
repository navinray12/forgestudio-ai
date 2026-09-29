import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTypeScript } from './load-typescript.mjs';

async function fixture(options = {}) {
  const free = { id: 'free-id', slug: 'free', name: 'Free', price: 0, isActive: true, websiteLimit: 1 };
  const paid = { ...free, id: 'paid-id', slug: 'agency', name: 'Agency', price: 100, websiteLimit: 50 };
  const calls = { mutations: [], audits: [], invoices: 0, transactions: 0, count: 0 };
  let subscription = options.subscription;
  const get = async () => { if (options.readFailure) throw new Error('database unavailable'); return subscription ?? null; };
  const tx = {
    subscriptionPlan: { findUnique: async ({where}) => options.noPlan ? null : where.slug === 'free' ? free : paid },
    userSubscription: {
      findUnique: get,
      create: async ({data}) => { calls.mutations.push(data); return { id: 'sub', ...data, plan: free }; },
      update: async ({data}) => { calls.mutations.push(data); return { ...subscription, ...data }; },
    },
    auditLog: { create: async ({data}) => { if (options.auditFailure) throw new Error('audit unavailable'); calls.audits.push(data); } },
  };
  const prisma = { ...tx,
    website: { count: async () => { calls.count++; return options.count ?? 0; } },
    billingInvoice: { findMany: async () => [] },
    $transaction: async (operation) => { calls.transactions++; return operation(tx); },
  };
  const service = await loadTypeScript('backend/src/services/subscription.service.ts', { '../config/prisma.js': { prisma } });
  const policy = await loadTypeScript('backend/src/services/billing/subscription-policy.ts');
  return { service, policy, calls, free, paid, tx, setSubscription: (value) => { subscription = value; } };
}

test('FG-008: paid selection cannot activate access, issue an invoice or mutate a license', async () => {
  const f = await fixture();
  await assert.rejects(f.service.changeUserPlan('user', 'agency'), { code: 'PAYMENT_VERIFICATION_REQUIRED' });
  assert.equal(f.calls.mutations.length, 0); assert.equal(f.calls.transactions, 0);
});

test('FG-008: a missing subscription read does not provision a plan', async () => {
  const f = await fixture();
  await assert.rejects(f.service.getUserSubscription('user'), { code: 'SUBSCRIPTION_NOT_PROVISIONED' });
  assert.equal(f.calls.transactions, 0); assert.equal(f.calls.mutations.length, 0);
});

test('FG-009: unknown subscription authority never returns synthetic ACTIVE or allowed', async () => {
  const f = await fixture({ readFailure: true });
  await assert.rejects(f.service.getUserSubscription('user'), /database unavailable/);
  await assert.rejects(f.service.checkWebsiteLimit('user', 0), /database unavailable/);
});

test('BILL-001: explicit free provisioning records an audit without fabricated paid artifacts', async () => {
  const f = await fixture(); const result = await f.service.assignDefaultFreePlan('user');
  assert.equal(result.plan.price, 0); assert.equal(result.currentPeriodEnd, null);
  assert.equal(result.invoiceNumber, undefined); assert.equal(result.license, undefined);
  assert.equal(f.calls.audits.length, 1);
});

test('BILL-001: onboarding cannot overwrite an existing paid subscription', async () => {
  const f = await fixture(); f.setSubscription({ id: 'existing', plan: f.paid });
  assert.equal((await f.service.assignDefaultFreePlan('user')).id, 'existing');
  assert.equal(f.calls.mutations.length, 0);
  await assert.rejects(f.service.changeUserPlan('user', 'free'), { code: 'BILLING_PROVIDER_REQUIRED' });
});

test('SEC-003: failed free-plan audit fails the provisioning transaction', async () => {
  const f = await fixture({ auditFailure: true });
  await assert.rejects(f.service.assignDefaultFreePlan('user'), /audit unavailable/);
});

test('BILL-001: missing free catalogue entry is explicit, not a fallback plan', async () => {
  const f = await fixture({ noPlan: true });
  await assert.rejects(f.service.assignDefaultFreePlan('user'), { code: 'FREE_PLAN_UNAVAILABLE' });
});

test('BILL-001: a zero website quota is respected and supplied counts are ignored', async () => {
  const f = await fixture({ count: 3 });
  f.setSubscription({ status: 'ACTIVE', currentPeriodEnd: null, plan: { ...f.free, websiteLimit: 0 } });
  const result = await f.service.checkWebsiteLimit('user', -999);
  assert.equal(result.allowed, false); assert.equal(result.limit, 0); assert.equal(result.current, 3);
});

for (const status of ['PAST_DUE', 'SUSPENDED', 'EXPIRED', 'UNKNOWN']) {
  test(`BILL-001: ${status} does not grant new website creation`, async () => {
    const f = await fixture(); f.setSubscription({ status, currentPeriodEnd: null, plan: f.free });
    await assert.rejects(f.service.checkWebsiteLimit('user'), { code: 'SUBSCRIPTION_INACTIVE' });
    assert.equal(f.calls.count, 0);
  });
}

test('BILL-001: paid access requires an unexpired period', async () => {
  const f = await fixture();
  for (const currentPeriodEnd of [null, new Date(0)]) {
    assert.throws(() => f.policy.requireSubscriptionAccess({status:'ACTIVE',currentPeriodEnd,plan:f.paid}), {code:'SUBSCRIPTION_INACTIVE'});
  }
});

test('BILL-001: confirmed cancellation retains access only through an explicit future period', async () => {
  const f = await fixture();
  assert.equal(f.policy.requireSubscriptionAccess({status:'CANCELED',currentPeriodEnd:new Date(Date.now()+60000),plan:f.paid}),50);
  assert.throws(() => f.policy.requireSubscriptionAccess({status:'CANCELED',currentPeriodEnd:null,plan:f.paid}),{code:'SUBSCRIPTION_INACTIVE'});
});

test('FG-008: paid cancellation cannot report success without a provider operation', async () => {
  const f = await fixture(); f.setSubscription({ plan: f.paid, status: 'ACTIVE' });
  await assert.rejects(f.service.cancelSubscription('user'), { code: 'BILLING_PROVIDER_REQUIRED' });
  assert.equal(f.calls.mutations.length, 0);
});

test('BILL-001: free cancellation is an audited local operation', async () => {
  const f = await fixture(); f.setSubscription({ id: 'sub', plan: f.free, status: 'ACTIVE', currentPeriodEnd: null });
  const result = await f.service.cancelSubscription('user');
  assert.equal(result.subscription.status, 'CANCELED'); assert.equal(f.calls.audits.length, 1);
});
