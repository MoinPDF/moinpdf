import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { localFontBytes } from './local-font-bytes';
import { centsText, moneyCents } from './payment-match';
import type { Invoice } from './invoice-engine';
export type InvoiceParty={name:string;street:string;postcode:string;city:string;country:string;email:string;taxId:string;vatId:string;contact:string;phone:string};
export type InvoiceLineDraft={name:string;quantity:string;unit:string;price:string;tax:string;exemption:string};
export type InvoiceDraft={number:string;date:string;due:string;delivery:string;reference:string;iban:string;note:string;seller:InvoiceParty;buyer:InvoiceParty;lines:InvoiceLineDraft[]};
const party=():InvoiceParty=>({name:'',street:'',postcode:'',city:'',country:'DE',email:'',taxId:'',vatId:'',contact:'',phone:''});
export const blankInvoice=():InvoiceDraft=>({number:'',date:new Date().toISOString().slice(0,10),due:'',delivery:'',reference:'',iban:'',note:'',seller:party(),buyer:party(),lines:[{name:'',quantity:'1',unit:'C62',price:'',tax:'19',exemption:''}]});
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'})[c]!);
const el=(tag:string,s:string)=>`<ram:${tag}>${esc(s.trim())}</ram:${tag}>`;
const decimal=(s:string)=>s.trim().replace(',','.');
function scaled(s:string,places=4){s=decimal(s);if(!new RegExp(`^\\d{1,9}(?:\\.\\d{1,${places}})?$`).test(s))throw new Error('Menge und Einzelpreis als positive Dezimalzahl mit höchstens vier Nachkommastellen eingeben.');const [a,b='']=s.split('.');return BigInt(a)*10n**BigInt(places)+BigInt(b.padEnd(places,'0'));}
function dateValid(s:string){const d=new Date(s+'T00:00:00Z');return /^\d{4}-\d{2}-\d{2}$/.test(s)&&s>='1900-01-01'&&s<='2199-12-31'&&Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s;}
export function validIban(raw:string){const s=raw.replace(/\s/g,'').toUpperCase();if(!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(s))return false;let mod=0;for(const c of s.slice(4)+s.slice(0,4))for(const digit of /[A-Z]/.test(c)?String(c.charCodeAt(0)-55):c)mod=(mod*10+Number(digit))%97;return mod===1;}
export function invoiceTotals(d:InvoiceDraft){
  if(!d.lines.length||d.lines.length>100)throw new Error('Bitte 1 bis 100 Rechnungspositionen anlegen.');
  const taxes=new Map<string,{base:bigint;amount:bigint;rate:bigint;category:string;reason:string}>();
  const lines=d.lines.map(l=>{const quantity=scaled(l.quantity),price=scaled(l.price),rate=scaled(l.tax,2);if(quantity<=0n||price<=0n||rate>10000n||!l.name.trim()||!['C62','HUR','DAY','KGM','MTR'].includes(l.unit)||rate===0n&&!l.exemption.trim())throw new Error('Positionen, Einheit, Steuersatz und Befreiungsgrund bitte vollständig prüfen.');
    const net=(quantity*price+500000n)/1000000n,category=rate===0n?'E':'S';if(net<=0n)throw new Error('Eine Position ergibt keinen positiven Centbetrag.');
    const reason=category==='E'?l.exemption.trim():'',key=`${rate}:${category}:${reason}`,tax=taxes.get(key)||{base:0n,amount:0n,rate,category,reason};tax.base+=net;taxes.set(key,tax);return {...l,net,category};});
  for(const tax of taxes.values())tax.amount=(tax.base*tax.rate+5000n)/10000n;
  const net=lines.reduce((n,l)=>n+l.net,0n),tax=[...taxes.values()].reduce((n,t)=>n+t.amount,0n);if(net+tax>99999999999999n)throw new Error('Der Rechnungsbetrag ist zu groß.');
  return {lines,taxes:[...taxes.values()],net,tax,gross:net+tax};
}
export function validateInvoiceDraft(d:InvoiceDraft,profile:'xrechnung'|'zugferd'='zugferd'){
  const strings=[d.number,d.date,d.due,d.delivery,d.reference,d.iban,d.note,...Object.values(d.seller),...Object.values(d.buyer),...d.lines.flatMap(l=>Object.values(l))];
  if(strings.some(s=>typeof s!=='string'||/[\x00-\x08\x0b-\x1f]/.test(s)||s.length>5000)||strings.join('').length>100000)throw new Error('Ungültige oder zu lange Rechnungsangaben.');
  if(!d.number.trim()||!dateValid(d.date)||!dateValid(d.due)||!dateValid(d.delivery)||d.due<d.date)throw new Error('Rechnungsnummer, Rechnungsdatum, Leistungsdatum und Fälligkeit prüfen.');
  if(!validIban(d.iban))throw new Error('Bitte eine gültige IBAN eingeben.');
  for(const p of [d.seller,d.buyer])if(!p.name.trim()||!p.street.trim()||!p.postcode.trim()||!p.city.trim()||!/^[A-Z]{2}$/.test(p.country)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email))throw new Error('Namen, vollständige Anschriften, Ländercodes und E-Mail-Adressen ergänzen.');
  if(!(d.seller.vatId.trim()||d.seller.taxId.trim())||!d.seller.contact.trim()||!d.seller.phone.trim())throw new Error('Steuerangaben und Kontaktperson mit Telefonnummer beim Rechnungssteller ergänzen.');
  if(profile==='xrechnung'&&!d.reference.trim())throw new Error('Für XRechnung die Käuferreferenz ergänzen.');
  return invoiceTotals(d);
}
export function invoiceCii(d:InvoiceDraft,profile:'xrechnung'|'zugferd'){
  const t=validateInvoiceDraft(d,profile),date=(tag:string,s:string)=>`<ram:${tag}><udt:DateTimeString format="102">${s.replaceAll('-','')}</udt:DateTimeString></ram:${tag}>`;
  const address=(p:InvoiceParty,seller:boolean)=>el('Name',p.name)+(seller?`<ram:DefinedTradeContact>${el('PersonName',p.contact)}<ram:TelephoneUniversalCommunication>${el('CompleteNumber',p.phone)}</ram:TelephoneUniversalCommunication><ram:EmailURIUniversalCommunication>${el('URIID',p.email)}</ram:EmailURIUniversalCommunication></ram:DefinedTradeContact>`:'')+`<ram:PostalTradeAddress>${el('PostcodeCode',p.postcode)}${el('LineOne',p.street)}${el('CityName',p.city)}${el('CountryID',p.country)}</ram:PostalTradeAddress><ram:URIUniversalCommunication><ram:URIID schemeID="EM">${esc(p.email.trim())}</ram:URIID></ram:URIUniversalCommunication>`+(seller?[['VA',p.vatId],['FC',p.taxId]].filter(([,v])=>v.trim()).map(([scheme,v])=>`<ram:SpecifiedTaxRegistration><ram:ID schemeID="${scheme}">${esc(v.trim())}</ram:ID></ram:SpecifiedTaxRegistration>`).join(''):'');
  const lineXml=t.lines.map((l,i)=>`<ram:IncludedSupplyChainTradeLineItem><ram:AssociatedDocumentLineDocument>${el('LineID',String(i+1))}</ram:AssociatedDocumentLineDocument><ram:SpecifiedTradeProduct>${el('Name',l.name)}</ram:SpecifiedTradeProduct><ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice>${el('ChargeAmount',decimal(l.price))}</ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement><ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="${l.unit}">${decimal(l.quantity)}</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery><ram:SpecifiedLineTradeSettlement><ram:ApplicableTradeTax>${el('TypeCode','VAT')}${l.category==='E'?el('ExemptionReason',l.exemption):''}${el('CategoryCode',l.category)}${el('RateApplicablePercent',decimal(l.tax))}</ram:ApplicableTradeTax><ram:SpecifiedTradeSettlementLineMonetarySummation>${el('LineTotalAmount',centsText(l.net))}</ram:SpecifiedTradeSettlementLineMonetarySummation></ram:SpecifiedLineTradeSettlement></ram:IncludedSupplyChainTradeLineItem>`).join('\n');
  const taxXml=t.taxes.map(a=>`<ram:ApplicableTradeTax>${el('CalculatedAmount',centsText(a.amount))}${el('TypeCode','VAT')}${a.reason?el('ExemptionReason',a.reason):''}${el('BasisAmount',centsText(a.base))}${el('CategoryCode',a.category)}${el('RateApplicablePercent',centsText(a.rate))}</ram:ApplicableTradeTax>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
<rsm:ExchangedDocumentContext><ram:BusinessProcessSpecifiedDocumentContextParameter>${el('ID','urn:fdc:peppol.eu:2017:poacc:billing:01:1.0')}</ram:BusinessProcessSpecifiedDocumentContextParameter><ram:GuidelineSpecifiedDocumentContextParameter>${el('ID',profile==='xrechnung'?'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0':'urn:cen.eu:en16931:2017')}</ram:GuidelineSpecifiedDocumentContextParameter></rsm:ExchangedDocumentContext>
<rsm:ExchangedDocument>${el('ID',d.number)}${el('TypeCode','380')}${date('IssueDateTime',d.date)}${d.note.trim()?`<ram:IncludedNote>${el('Content',d.note)}</ram:IncludedNote>`:''}</rsm:ExchangedDocument>
<rsm:SupplyChainTradeTransaction>${lineXml}
<ram:ApplicableHeaderTradeAgreement>${d.reference.trim()?el('BuyerReference',d.reference):''}<ram:SellerTradeParty>${address(d.seller,true)}</ram:SellerTradeParty><ram:BuyerTradeParty>${address(d.buyer,false)}</ram:BuyerTradeParty></ram:ApplicableHeaderTradeAgreement>
<ram:ApplicableHeaderTradeDelivery><ram:ActualDeliverySupplyChainEvent>${date('OccurrenceDateTime',d.delivery)}</ram:ActualDeliverySupplyChainEvent></ram:ApplicableHeaderTradeDelivery>
<ram:ApplicableHeaderTradeSettlement>${el('InvoiceCurrencyCode','EUR')}<ram:SpecifiedTradeSettlementPaymentMeans>${el('TypeCode','58')}<ram:PayeePartyCreditorFinancialAccount>${el('IBANID',d.iban.replace(/\s/g,'').toUpperCase())}</ram:PayeePartyCreditorFinancialAccount></ram:SpecifiedTradeSettlementPaymentMeans>${taxXml}
<ram:SpecifiedTradePaymentTerms>${date('DueDateDateTime',d.due)}</ram:SpecifiedTradePaymentTerms><ram:SpecifiedTradeSettlementHeaderMonetarySummation>${el('LineTotalAmount',centsText(t.net))}${el('TaxBasisTotalAmount',centsText(t.net))}<ram:TaxTotalAmount currencyID="EUR">${centsText(t.tax)}</ram:TaxTotalAmount>${el('GrandTotalAmount',centsText(t.gross))}${el('DuePayableAmount',centsText(t.gross))}</ram:SpecifiedTradeSettlementHeaderMonetarySummation></ram:ApplicableHeaderTradeSettlement></rsm:SupplyChainTradeTransaction></rsm:CrossIndustryInvoice>`;
}
export function draftFromInvoice(i:Invoice):InvoiceDraft {
  if(i.type!=='380'||i.currency!=='EUR'||[i.totals.allowances,i.totals.charges,i.totals.paid,i.totals.rounding].some(v=>v&&Number(v)!==0)||i.lines.some(l=>l.allowances.length||l.charges.length||Number(l.baseQuantity||1)!==1||!['S','E'].includes(l.taxCategory)))throw new Error('Diese Rechnung enthält nicht unterstützte Gutschriften, Nachlässe, Zuschläge oder Vorauszahlungen.');
  const d=blankInvoice();d.number=i.number;d.date=i.date;d.due=i.dueDate;d.reference=i.buyerReference;d.iban=i.payment[0]?.iban||'';d.note=i.notes.join('\n');
  for(const k of ['seller','buyer'] as const){d[k].name=i[k].name;d[k].country=i[k].country;d[k].email=i[k].email;d[k].vatId=i[k].vatId;}
  d.lines=i.lines.map(l=>({name:l.name,quantity:l.quantity,unit:l.unit,price:l.price,tax:l.taxRate||'0',exemption:i.taxes.find(t=>t.category===l.taxCategory&&Number(t.rate)===Number(l.taxRate))?.reason||''}));
  const total=invoiceTotals(d);if(total.gross!==moneyCents(i.totals.gross)||total.net!==moneyCents(i.totals.net)||total.tax!==moneyCents(i.totals.tax))throw new Error('Die übernommenen Positionen stimmen nicht mit den Rechnungssummen überein.');return d;
}
export async function renderInvoiceDraft(d:InvoiceDraft,signal?:AbortSignal,t:(s:string)=>string=s=>s){
  const totals=validateInvoiceDraft(d),pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);const font=await pdf.embedFont(await localFontBytes(await fetch('/vendor/invoice-font/NotoSans-Regular.ttf',{signal})),{subset:true});
  const supported=new Set(font.getCharacterSet());let page=pdf.addPage(),y=780;
  const draw=(s:string,size:number)=>{if(y<60){page=pdf.addPage();y=780;}page.drawText(s,{x:45,y,size,font,color:rgb(.06,.16,.18)});y-=size*1.6;};
  const line=(s:string,size=11)=>{signal?.throwIfAborted();for(const paragraph of s.split('\n')){let chunk='';for(const c of paragraph){if(!supported.has(c.codePointAt(0)!))throw new Error('Eine Schrift enthält nicht alle benötigten Zeichen.');if(font.widthOfTextAtSize(chunk+c,size)>500){draw(chunk,size);chunk='';}chunk+=c;}draw(chunk,size);}};
  line(t('Rechnung'),24);line(d.number,16);line(`${t('Rechnungsdatum')}: ${d.date}`);line(`${t('Leistungsdatum')}: ${d.delivery}`);y-=10;
  for(const [label,p] of [[t('Rechnungssteller'),d.seller],[t('Rechnungsempfänger'),d.buyer]] as const){line(label,14);line(p.name);line(p.street);line(`${p.postcode} ${p.city} · ${p.country}`);line(p.email);if(p.vatId)line(`${t('USt-IdNr.')}: ${p.vatId}`);if(p.taxId)line(`${t('Steuernummer')}: ${p.taxId}`);y-=10;}
  if(d.reference)line(`${t('Käuferreferenz')}: ${d.reference}`);
  for(const [i,l] of totals.lines.entries()){y-=10;line(`${i+1}. ${l.name}`,12);line(`${l.quantity} ${l.unit} × ${l.price} EUR = ${centsText(l.net)} EUR`);line(`${t('Umsatzsteuer')}: ${l.tax} %`);if(l.exemption)line(l.exemption);}
  y-=12;line(`${t('Netto')}: ${centsText(totals.net)} EUR`,14);
  for(const tax of totals.taxes)line(`${t('Umsatzsteuer')} ${centsText(tax.rate)} %: ${centsText(tax.amount)} EUR`);
  line(`${t('Zahlbetrag')}: ${centsText(totals.gross)} EUR`,16);line(`${t('Fällig am')}: ${d.due}`);line(`IBAN: ${d.iban}`);if(d.note)line(d.note);
  pdf.setTitle(`${t('Rechnung')} ${d.number}`);signal?.throwIfAborted();return pdf.save();
}
