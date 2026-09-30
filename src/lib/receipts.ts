import type { Network } from './wallet';
export type Action = 'deploy' | 'seal' | 'open' | 'withdraw';
export interface Receipt {
  network: Network; roomId: string; contractAddress: string; txHash: string; txId: string;
  blockHeight: number; action: Action; finalizedAt: string;
}
export interface Deployment {
  receipt: Receipt; lastReceipt: Receipt; phase: 'ready' | 'sealed' | 'opened' | 'withdrawn';
}
export interface Pending { contractAddress: string; txId: string; action: Action; submittedAt: string }
const key = (scope: string) => `${scope}:public`;
export function readDeployment(scope: string): Deployment | null {
  try {
    const value = JSON.parse(localStorage.getItem(key(scope)) || 'null') as Deployment | null;
    if (!value || !/^[a-f0-9]{64}$/.test(value.receipt.contractAddress) || !/^[a-f0-9]{64}$/.test(value.receipt.txHash)) return null;
    return value;
  } catch { return null; }
}
export function saveDeployment(scope: string, value: Deployment) { localStorage.setItem(key(scope), JSON.stringify(value)); }
export function savePending(scope: string, pending: Pending) { localStorage.setItem(`${scope}:pending`, JSON.stringify(pending)); }
export function readPending(scope: string): Pending | null {
  try { return JSON.parse(localStorage.getItem(`${scope}:pending`) || 'null'); } catch { return null; }
}
export function clearPending(scope: string) { localStorage.removeItem(`${scope}:pending`); }
export const shortHash = (value: string) => `${value.slice(0, 8)}…${value.slice(-6)}`;
export const explorerUrl = (receipt: Receipt) => `https://${receipt.network}.midnightexplorer.com/tx/${encodeURIComponent(receipt.txHash)}`;
