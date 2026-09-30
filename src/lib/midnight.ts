import { Buffer } from 'buffer';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import { Transaction } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { sampleSigningKey } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { createUnprovenDeployTx, findDeployedContract, submitTx } from '@midnight-ntwrk/midnight-js-contracts';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { createProofProvider, type MidnightProviders, type FinalizedTxData } from '@midnight-ntwrk/midnight-js-types';
import { Contract, ledger, type Witnesses } from '../../contracts/managed/worker/contract/index.js';
import type { Room } from '../data/rooms';
import { digest, type WalletSession } from './wallet';
import type { PrivateOffer } from './vault';
import { clearPending, readDeployment, readPending, saveDeployment, savePending, type Action, type Deployment, type Receipt } from './receipts';

type Circuit = 'seal' | 'open' | 'withdraw';
export type Stage = 'preparing' | 'proving' | 'approving' | 'finalizing' | 'done';
function artifactBaseUrl(): string {
  const root = import.meta.env.VITE_MIDNIGHT_ARTIFACT_BASE_URL || '/contract';
  return new URL(`${root.replace(/\/$/, '')}/`, window.location.origin).toString();
}
export const witnesses: Witnesses<PrivateOffer> = {
  workerSecret: ({ privateState }) => [privateState, privateState.secret],
  offerAmount: ({ privateState }) => [privateState, privateState.amount],
  offerSalt: ({ privateState }) => [privateState, privateState.salt],
};
const compiled = CompiledContract.withCompiledFileAssets<Contract<PrivateOffer>, PrivateOffer, { readonly compiledAssetsPath: string }>(
  CompiledContract.withWitnesses(CompiledContract.make<Contract<PrivateOffer>, PrivateOffer>('roda-worker', Contract<PrivateOffer>), witnesses),
  '/contract',
);
let active = false;

interface Operation {
  session: WalletSession; room: Room; scope: string; password: string; offer: PrivateOffer;
  stage: (stage: Stage) => void;
  checkpoint?: (checkpoint: string) => void;
}

async function makeProviders(operation: Operation, action: Action) {
  const { session, scope, password, stage, checkpoint } = operation;
  checkpoint?.('requesting 1AM permission for the transaction methods');
  await session.api.hintUsage([
    'getConnectionStatus', 'getConfiguration', 'getShieldedAddresses', 'getProvingProvider',
    'balanceUnsealedTransaction', 'submitTransaction',
  ]);
  checkpoint?.('checking the 1AM connection');
  const status = await session.api.getConnectionStatus();
  if (status.status !== 'connected' || status.networkId !== session.network) throw new Error('NETWORK_MISMATCH');
  setNetworkId(session.network);
  checkpoint?.('reading the selected network configuration');
  const config = await session.api.getConfiguration();
  if (config.networkId !== session.network) throw new Error('NETWORK_MISMATCH');
  checkpoint?.('checking the connected wallet account');
  const current = await session.api.getShieldedAddresses();
  if (current.shieldedCoinPublicKey !== session.coinPublicKey) throw new Error('STALE_SESSION');
  checkpoint?.('initializing the 1AM proving provider');
  const zkConfigProvider = new FetchZkConfigProvider<Circuit>(artifactBaseUrl(), window.fetch.bind(window));
  // Delegate to the user's chosen wallet proving environment. Do not send witness
  // material to the application API, Gemini, or an app-controlled remote prover.
  const provingProvider = await session.api.getProvingProvider(zkConfigProvider);
  const proof = provingProvider
    ? createProofProvider(provingProvider)
    : config.proverServerUri
      ? httpClientProofProvider(config.proverServerUri, zkConfigProvider)
      : null;
  if (!proof) throw new Error('1AM did not provide a proving service and no wallet-configured prover URL is available.');
  const privateStateProvider = levelPrivateStateProvider<'worker', PrivateOffer>({
    midnightDbName: `roda-${session.network}`, accountId: session.fingerprint,
    privateStoragePasswordProvider: () => password,
  });
  let address = readDeployment(scope)?.receipt.contractAddress || readPending(scope)?.contractAddress || '';
  const originalSetAddress = privateStateProvider.setContractAddress.bind(privateStateProvider);
  privateStateProvider.setContractAddress = (value) => { address = value; originalSetAddress(value); };
  const providers: MidnightProviders<Circuit, 'worker', PrivateOffer> = {
    privateStateProvider, zkConfigProvider,
    publicDataProvider: indexerPublicDataProvider(config.indexerUri, config.indexerWsUri, window.WebSocket),
    proofProvider: { proveTx: (tx, config) => { checkpoint?.('generating the zero-knowledge proof'); stage('proving'); return proof.proveTx(tx, config); } },
    walletProvider: {
      getCoinPublicKey: () => session.coinPublicKey,
      getEncryptionPublicKey: () => session.encryptionPublicKey,
      balanceTx: async (tx) => {
        checkpoint?.('waiting for 1AM transaction approval');
        stage('approving');
        const result = await session.api.balanceUnsealedTransaction(Buffer.from(tx.serialize()).toString('hex'));
        return Transaction.deserialize('signature', 'proof', 'binding', Buffer.from(result.tx, 'hex'));
      },
    },
    midnightProvider: {
      submitTx: async (tx) => {
        const txId = tx.identifiers()[0];
        if (!txId || !address) throw new Error('Missing transaction recovery data');
        checkpoint?.('submitting the approved transaction');
        // Save BEFORE submission: a transport failure may still mean the node received it.
        savePending(scope, { contractAddress: address, txId, action, submittedAt: new Date().toISOString() });
        await session.api.submitTransaction(Buffer.from(tx.serialize()).toString('hex'));
        checkpoint?.('waiting for Midnight finalization');
        stage('finalizing');
        return txId;
      },
    },
  };
  return providers;
}

function receiptFrom(data: FinalizedTxData, address: string, operation: Operation, action: Action): Receipt {
  if (data.status !== 'SucceedEntirely') throw new Error('The transaction failed on chain');
  return { network: operation.session.network, roomId: operation.room.id, contractAddress: address,
    txHash: data.txHash, txId: data.txId, blockHeight: data.blockHeight, action,
    finalizedAt: new Date(data.blockTimestamp < 1_000_000_000_000 ? data.blockTimestamp * 1000 : data.blockTimestamp).toISOString() };
}
function retain(operation: Operation, receipt: Receipt): Deployment {
  const prior = readDeployment(operation.scope);
  if (receipt.action !== 'deploy' && !prior) throw new Error('Missing original deployment receipt');
  const record: Deployment = { receipt: prior?.receipt || receipt, lastReceipt: receipt,
    phase: receipt.action === 'deploy' ? 'ready' : receipt.action === 'seal' ? 'sealed' : receipt.action === 'open' ? 'opened' : 'withdrawn' };
  saveDeployment(operation.scope, record);
  clearPending(operation.scope);
  operation.stage('done');
  return record;
}
export async function execute(operation: Operation, action: Action): Promise<Deployment> {
  if (active) throw new Error('Another transaction is already pending');
  if (readPending(operation.scope)) throw new Error('An existing transaction needs finalization recovery');
  active = true;
  try {
    operation.stage('preparing');
    const providers = await makeProviders(operation, action);
    if (action === 'deploy') {
      if (readDeployment(operation.scope)) throw new Error('Worker contract already deployed');
      operation.checkpoint?.('computing the public room identifier');
      const roomHash = new Uint8Array(Buffer.from(await digest(operation.room.id), 'hex'));
      operation.checkpoint?.('initializing the worker contract');
      const loadVerifierKey = providers.zkConfigProvider.getVerifierKey.bind(providers.zkConfigProvider);
      providers.zkConfigProvider.getVerifierKey = async (circuitId) => {
        operation.checkpoint?.(`loading the ${circuitId} verifier artifact`);
        const key = await loadVerifierKey(circuitId);
        operation.checkpoint?.(`loaded the ${circuitId} verifier artifact`);
        return key;
      };
      const unsubmitted = await createUnprovenDeployTx(providers, {
        compiledContract: compiled, initialPrivateState: operation.offer, signingKey: sampleSigningKey(),
        args: [roomHash, BigInt(operation.room.minimum), BigInt(operation.room.maximum), BigInt(Date.parse(operation.room.deadline) / 1000)],
      });
      const address = unsubmitted.public.contractAddress;
      providers.privateStateProvider.setContractAddress(address);
      await providers.privateStateProvider.set('worker', unsubmitted.private.initialPrivateState);
      await providers.privateStateProvider.setSigningKey(address, unsubmitted.private.signingKey);
      const finalized = await submitTx(providers, { unprovenTx: unsubmitted.private.unprovenTx });
      if (finalized.status !== 'SucceedEntirely') throw new Error('The transaction failed on chain');
      return retain(operation, receiptFrom(finalized, address, operation, action));
    }
    const record = readDeployment(operation.scope);
    if (!record) throw new Error('Deploy your worker contract first');
    const address = record.receipt.contractAddress;
    const found = await findDeployedContract(providers, { compiledContract: compiled, contractAddress: address,
      privateStateId: 'worker', initialPrivateState: operation.offer });
    // Explicitly update the provider from the encrypted draft before sealing;
    // a previously stored SDK state must never silently seal an older price.
    providers.privateStateProvider.setContractAddress(address);
    await providers.privateStateProvider.set('worker', operation.offer);
    const result = await found.callTx[action]();
    return retain(operation, receiptFrom(result.public, address, operation, action));
  } finally { active = false; }
}

export async function recover(operation: Operation): Promise<Deployment> {
  if (active) throw new Error('Another transaction is already pending');
  const pending = readPending(operation.scope);
  if (!pending) throw new Error('No pending transaction');
  active = true;
  try {
    operation.checkpoint?.('checking the pending transaction');
    operation.stage('finalizing');
    const providers = await makeProviders(operation, pending.action);
    const finalized = await providers.publicDataProvider.watchForTxData(pending.txId);
    if (finalized.status !== 'SucceedEntirely') {
      clearPending(operation.scope);
      throw new Error('The transaction failed on chain. You can retry.');
    }
    const state = await providers.publicDataProvider.queryContractState(pending.contractAddress);
    if (!state) throw new Error('Indexer has not found the worker contract yet');
    const publicState = ledger(state.data);
    if (Buffer.from(publicState.room).toString('hex') !== await digest(operation.room.id)
      || publicState.minimum !== BigInt(operation.room.minimum) || publicState.maximum !== BigInt(operation.room.maximum)) throw new Error('Worker policy mismatch');
    return retain(operation, receiptFrom(finalized, pending.contractAddress, operation, pending.action));
  } finally { active = false; }
}
