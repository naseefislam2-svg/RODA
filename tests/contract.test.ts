// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createCircuitContext, createConstructorContext, type CircuitContext } from '@midnight-ntwrk/compact-runtime';
import { Contract, ledger, type Witnesses } from '../contracts/managed/worker/contract/index.js';
import type { PrivateOffer } from '../src/lib/vault';
import { describe, expect, it } from 'vitest';
const coinKey = '00'.repeat(32);
const address = '01'.repeat(32);
const now = 1790000000;
const deadline = BigInt(now + 3600);
const witness: Witnesses<PrivateOffer> = {
  workerSecret: ({ privateState }) => [privateState, privateState.secret],
  offerSalt: ({ privateState }) => [privateState, privateState.salt],
  offerAmount: ({ privateState }) => [privateState, privateState.amount],
};
function fixture(amount = 400000n) {
  const contract = new Contract(witness);
  const offer = { secret: new Uint8Array(32).fill(5), salt: new Uint8Array(32).fill(7), amount };
  const state = contract.initialState(createConstructorContext(offer, coinKey), new Uint8Array(32).fill(4), 240000n, 800000n, deadline);
  const context = createCircuitContext(address, coinKey, state.currentContractState, offer, undefined, undefined, now);
  return { contract, context, offer };
}
function atTime(context: CircuitContext<PrivateOffer>, time: number) {
  return createCircuitContext(address, coinKey, context.currentQueryContext.state, context.currentPrivateState, undefined, undefined, time);
}
describe('compiled Compact worker contract (real generated code)', () => {
  it('seals a valid offer without publishing its amount', () => {
    const { contract, context } = fixture(); const result = contract.circuits.seal(context);
    const state = ledger(result.context.currentQueryContext.state);
    expect(state.isSealed).toBe(true); expect(state.openedAmount).toBe(0n); expect(state.acceptedOffers).toBe(1n);
    expect(state.nullifiers.size()).toBe(1n); expect(state.commitment).not.toEqual(new Uint8Array(32));
  });
  it.each([239999n, 800001n])('rejects out of range amount %s', amount => {
    const { contract, context } = fixture(amount); expect(() => contract.circuits.seal(context)).toThrow();
  });
  it('prevents a second seal with the same worker secret', () => {
    const { contract, context } = fixture(); const first = contract.circuits.seal(context);
    expect(() => contract.circuits.seal(first.context)).toThrow('Offer already consumed');
  });
  it('rejects another worker secret', () => {
    const { contract, context } = fixture(); context.currentPrivateState = { ...context.currentPrivateState, secret: new Uint8Array(32).fill(8) };
    expect(() => contract.circuits.seal(context)).toThrow('another secret');
  });
  it('prevents opening before the deadline', () => {
    const { contract, context } = fixture(); const sealed = contract.circuits.seal(context);
    expect(() => contract.circuits.open(sealed.context)).toThrow('not available');
  });
  it('opens the committed amount after the deadline', () => {
    const { contract, context } = fixture(); const sealed = contract.circuits.seal(context);
    const opened = contract.circuits.open(atTime(sealed.context, Number(deadline) + 2));
    expect(ledger(opened.context.currentQueryContext.state).openedAmount).toBe(400000n);
  });
  it('binds the amount and salt against replacement before opening', () => {
    const { contract, context } = fixture(); const sealed = contract.circuits.seal(context);
    const later = atTime(sealed.context, Number(deadline) + 2); later.currentPrivateState = { ...later.currentPrivateState, amount: 410000n };
    expect(() => contract.circuits.open(later)).toThrow('does not match');
  });
  it('withdraws without publishing the amount and prevents re-entry', () => {
    const { contract, context } = fixture(); const sealed = contract.circuits.seal(context);
    const withdrawn = contract.circuits.withdraw(sealed.context); const state = ledger(withdrawn.context.currentQueryContext.state);
    expect(state.withdrawn).toBe(true); expect(state.openedAmount).toBe(0n); expect(state.acceptedOffers).toBe(0n); expect(state.nullifiers.size()).toBe(1n);
    expect(() => contract.circuits.seal(withdrawn.context)).toThrow();
  });
  it('rejects sealing and withdrawal after the deadline', () => {
    const { contract, context } = fixture(); expect(() => contract.circuits.seal(atTime(context, Number(deadline) + 1))).toThrow('closed');
    const sealed = contract.circuits.seal(context); expect(() => contract.circuits.withdraw(atTime(sealed.context, Number(deadline) + 1))).toThrow('ended');
  });
  it('never discloses a raw worker secret or salt in the source', () => {
    const source = readFileSync('contracts/worker.compact', 'utf8');
    expect(source).not.toMatch(/disclose\(workerSecret\(\)\)/); expect(source).not.toMatch(/disclose\(offerSalt\(\)\)/);
    expect(source.match(/disclose\(offerAmount\(\)\)/g)).toHaveLength(1);
  });
});
