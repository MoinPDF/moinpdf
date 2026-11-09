/** All allocations use integer cents; suggestions never confirm a payment. */
export type Payment = { id: string; date: string; amount: string; direction: 'debit' | 'credit' | ''; currency: string; text: string; sourceId: string; page: number };
export type Receipt = Omit<Payment, 'text'> & { number: string; partner: string };
export type Allocation = { paymentId: string; receiptId: string; amount: string; confirmed: boolean };
export function moneyCents(raw: string): bigint {
  let s = raw.trim().replace(/[\s\u00a0]/g, '');
  if(s.includes(',')) {
    if(!/^\d{1,3}(?:\.\d{3})*,\d{1,2}$/.test(s) && !/^\d+,\d{1,2}$/.test(s)) throw new Error('Bitte einen positiven Betrag mit höchstens zwei Nachkommastellen eingeben.');
    s=s.replace(/\./g,'').replace(',','.');
  }
  if(!/^\d{1,12}(?:\.\d{1,2})?$/.test(s)) throw new Error('Bitte einen positiven Betrag mit höchstens zwei Nachkommastellen eingeben.');
  const [a,b='']=s.split('.');return BigInt(a)*100n+BigInt(b.padEnd(2,'0'));
}
export const centsText=(v:bigint)=>`${v/100n}.${(v%100n).toString().padStart(2,'0')}`;
const fold=(s:string)=>s.normalize('NFKC').toLocaleLowerCase('de-DE');
const escape=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function paymentSuggestions(payments:Payment[],receipts:Receipt[]) {
  if(payments.length>3000||receipts.length>500)throw new Error('Höchstens 3.000 Buchungen und 500 Belege gleichzeitig abgleichen.');
  return payments.map(p=>{
    const eligible=receipts.filter(r=>r.currency===p.currency&&r.direction===p.direction);
    const refs=eligible.filter(r=>r.number.trim().length>=3&&new RegExp(`(?<![\\p{L}\\p{N}])${escape(fold(r.number.trim()))}(?![\\p{L}\\p{N}])`,'u').test(fold(p.text)));
    return {paymentId:p.id,receiptIds:(refs.length?refs:eligible.filter(r=>moneyCents(r.amount)===moneyCents(p.amount))).map(r=>r.id),reason:refs.length?'reference':'amount'};
  });
}
export function reconcilePayments(payments:Payment[],receipts:Receipt[],allocations:Allocation[]) {
  if(payments.length>3000||receipts.length>500||allocations.length>10000)throw new Error('Zu viele Belege, Buchungen oder Zuordnungen.');
  if([...payments,...receipts].some(p=>!p.id||!['debit','credit'].includes(p.direction)||!/^[A-Z]{3}$/.test(p.currency)||moneyCents(p.amount)<=0n))throw new Error('Alle Beträge müssen positiv sein; Währung und Zahlungsrichtung bitte prüfen.');
  const pm=new Map(payments.map(p=>[p.id,p])),rm=new Map(receipts.map(r=>[r.id,r]));
  if(pm.size!==payments.length||rm.size!==receipts.length)throw new Error('Doppelte Kennung im Abgleich.');
  const pa=new Map<string,bigint>(),ra=new Map<string,bigint>(),seen=new Set<string>();
  for(const a of allocations){const p=pm.get(a.paymentId),r=rm.get(a.receiptId),n=moneyCents(a.amount),key=JSON.stringify([a.paymentId,a.receiptId]);
    if(!p||!r||n<=0n||p.currency!==r.currency||p.direction!==r.direction||seen.has(key))throw new Error('Ungültige oder doppelte Zuordnung.');
    seen.add(key);if(!a.confirmed)continue;
    pa.set(p.id,(pa.get(p.id)||0n)+n);ra.set(r.id,(ra.get(r.id)||0n)+n);
  }
  return {payments:payments.map(p=>{const n=pa.get(p.id)||0n,total=moneyCents(p.amount);if(n>total)throw new Error('Eine Buchung wurde über ihren Betrag hinaus zugeordnet.');return {...p,allocated:centsText(n),remaining:centsText(total-n),status:n===0n?'unassigned':n===total?'matched':'partial'};}),receipts:receipts.map(r=>{const n=ra.get(r.id)||0n,total=moneyCents(r.amount);return {...r,allocated:centsText(n),remaining:centsText(n<total?total-n:0n),overpaid:centsText(n>total?n-total:0n),status:n===0n?'open':n<total?'partial':n===total?'paid':'overpaid'};})};
}
