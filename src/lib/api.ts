import type { Room } from '../data/rooms';
import type { Receipt } from './receipts';
const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export interface Guidance { summary: string; steps: string[]; privacy_note: string; source: 'gemini' | 'local' }
export function localGuidance(room: Room): Guidance {
  return { summary: room.summary, steps: ['Check the scope and public price band.', 'Save your offer in your local encrypted vault.', 'Connect 1AM, deploy your worker contract, and seal the offer.'], privacy_note: 'Only this public brief is used. Your offer is never sent to RODA or Gemini.', source: 'local' };
}
export async function getGuidance(room: Room, question: 'brief' | 'privacy' | 'checklist'): Promise<Guidance> {
  if (!base) return localGuidance(room);
  try {
    const response = await fetch(`${base}/api/compose`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room_id: room.id, question }), signal: AbortSignal.timeout(22000) });
    if (!response.ok) throw new Error('Guidance unavailable');
    const data = await response.json();
    if (typeof data.summary !== 'string' || !Array.isArray(data.steps) || !data.steps.every((v: unknown) => typeof v === 'string') || typeof data.privacy_note !== 'string' || !['gemini', 'local'].includes(data.source)) throw new Error('Invalid public guidance');
    return data as Guidance;
  } catch { return localGuidance(room); }
}
export async function publishReceipt(receipt: Receipt) {
  if (!base) return false;
  const response = await fetch(`${base}/api/receipts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10000),
    body: JSON.stringify({ network: receipt.network, room_id: receipt.roomId, contract_address: receipt.contractAddress,
      tx_hash: receipt.txHash, action: receipt.action, block_height: receipt.blockHeight }) });
  return response.ok;
}
export async function getMetrics(): Promise<{ verified_transactions: number; reported_receipts: number } | null> {
  if (!base) return null;
  try { const response = await fetch(`${base}/api/metrics`, { signal: AbortSignal.timeout(6000) }); return response.ok ? response.json() : null; } catch { return null; }
}
