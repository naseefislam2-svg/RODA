export interface Room {
  id: string; title: string; organization: string; category: string; location: string;
  summary: string; minimum: number; maximum: number; currency: 'BRL'; deadline: string;
  duration: string; tags: string[]; is_sample: true; color: string;
}
export const rooms: Room[] = [
  { id: 'solar-commons', title: 'A brighter kind of public space.', organization: 'Solar Commons',
    category: 'Design & build', location: 'Salvador, BR',
    summary: 'Design a modular, solar-powered gathering space for a neighborhood creative cooperative.',
    minimum: 240000, maximum: 800000, currency: 'BRL', deadline: '2026-10-16T18:00:00Z', duration: '6 weeks',
    tags: ['Spatial design', 'Clean energy'], is_sample: true, color: 'orange' },
  { id: 'radio-futura', title: 'Give the next wave a voice.', organization: 'Rádio Futura',
    category: 'Sound & culture', location: 'Recife, BR',
    summary: 'Create an original sonic identity and five audio signatures for an independent community radio.',
    minimum: 120000, maximum: 450000, currency: 'BRL', deadline: '2026-10-21T18:00:00Z', duration: '3 weeks',
    tags: ['Sound design', 'Community radio'], is_sample: true, color: 'lime' },
  { id: 'circular-objects', title: 'Nothing wasted. Everything reimagined.', organization: 'Oficina Circular',
    category: 'Objects & craft', location: 'São Paulo, BR',
    summary: 'Develop a small collection of repairable objects using reclaimed industrial material.',
    minimum: 180000, maximum: 600000, currency: 'BRL', deadline: '2026-10-28T18:00:00Z', duration: '4 weeks',
    tags: ['Product design', 'Circular materials'], is_sample: true, color: 'purple' },
];
export const money = (cents: number) => new Intl.NumberFormat('en', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(cents / 100);
export const deadlineLabel = (date: string) => new Date(date).toLocaleDateString('en', { month: 'short', day: 'numeric' });
export function parseAmount(value: string, room: Room): bigint {
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(value)) throw new Error('Enter a price with up to two decimal places.');
  const [whole, fraction = ''] = value.split('.');
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (cents < BigInt(room.minimum) || cents > BigInt(room.maximum)) throw new Error('Your offer must be within the public price band.');
  return cents;
}
