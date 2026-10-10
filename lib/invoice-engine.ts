import { PDFDocument, rgb, type PDFPage } from 'pdf-lib';
import type { Source } from './pdf-engine';

export const INVOICE_MAX_BYTES = 5 * 1024 * 1024;
export const INVOICE_CHECK_SCOPE =
  'Basischeck für grundlegende Angaben, Datums- und Zahlenformate sowie ausgewählte Summen. Keine vollständige XSD-, EN-16931-, KoSIT-, Peppol- oder PDF/A-Validierung.';
const ns = {
  cbc: 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
  cac: 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
  rsm: 'urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100',
  ram: 'urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100',
  udt: 'urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100',
};
type Node = Element | undefined;
const children = (node: Node, key: string): Element[] => {
  const [prefix, name] = key.split(':');
  return node
    ? Array.from(node.children).filter(
        (e) => e.localName === name && e.namespaceURI === ns[prefix as keyof typeof ns],
      )
    : [];
};
const at = (node: Node, path: string): Node =>
  path.split('/').reduce((n, key) => children(n, key)[0], node);
const value = (node: Node, path: string) => at(node, path)?.textContent?.trim() || '';
const list = (node: Node, path: string) =>
  path
    .split('/')
    .reduce<Element[]>((nodes, key) => nodes.flatMap((n) => children(n, key)), node ? [node] : []);
const texts = (node: Node, path: string) =>
  list(node, path)
    .map((e) => e.textContent?.trim() || '')
    .filter(Boolean);
export type InvoiceParty = {
  name: string;
  address: string;
  country: string;
  vatId: string;
  email: string;
};
export type InvoiceLine = {
  id: string;
  name: string;
  description: string;
  quantity: string;
  unit: string;
  price: string;
  baseQuantity: string;
  net: string;
  taxRate: string;
  taxCategory: string;
  allowances: string[];
  charges: string[];
};
export type InvoiceTax = {
  base: string;
  amount: string;
  rate: string;
  category: string;
  reason: string;
};
export type InvoiceCheck = { level: 'pass' | 'error' | 'warning'; title: string; detail: string };
export type Invoice = {
  format: 'UBL' | 'CII';
  profile: string;
  profileLabel: string;
  number: string;
  date: string;
  dueDate: string;
  currency: string;
  type: string;
  buyerReference: string;
  orderReference: string;
  seller: InvoiceParty;
  buyer: InvoiceParty;
  notes: string[];
  lines: InvoiceLine[];
  taxes: InvoiceTax[];
  payment: {
    iban: string;
    name: string;
    bic: string;
    code: string;
    reference: string;
    terms: string;
  }[];
  totals: {
    lines: string;
    allowances: string;
    charges: string;
    net: string;
    tax: string;
    gross: string;
    paid: string;
    rounding: string;
    due: string;
  };
  checks: InvoiceCheck[];
};
export type InvoiceEntry = { name: string; xml: string; bytes: Uint8Array; invoice: Invoice };
function decodeXml(bytes: Uint8Array) {
  if (bytes.length > INVOICE_MAX_BYTES)
    throw new Error('Rechnungs-XML darf höchstens 5 MB groß sein.');
  const encoding =
    bytes[0] === 0xff && bytes[1] === 0xfe
      ? 'utf-16le'
      : bytes[0] === 0xfe && bytes[1] === 0xff
        ? 'utf-16be'
        : bytes[0] === 0 && bytes[1] === 0x3c
          ? 'utf-16be'
          : bytes[0] === 0x3c && bytes[1] === 0
            ? 'utf-16le'
            : 'utf-8';
  const xml = new TextDecoder(encoding, { fatal: true }).decode(bytes);
  if (
    encoding === 'utf-8' &&
    /encoding\s*=\s*['"](?!utf-8|utf8)[^'"]+['"]/i.test(xml.slice(0, 200))
  )
    throw new Error('Bitte die XML-Datei in UTF-8 oder UTF-16 speichern.');
  return xml;
}
const ciiDate = (node: Node, path: string) => {
  const e = at(node, path + '/udt:DateTimeString');
  const t = e?.textContent?.trim() || '';
  return e?.getAttribute('format') === '102' && /^\d{8}$/.test(t)
    ? `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6)}`
    : t;
};
const profileLabel = (s: string) =>
  /xrechnung/i.test(s)
    ? 'XRechnung-Profil'
    : /factur-x|zugferd/i.test(s)
      ? 'Factur-X / ZUGFeRD-Profil'
      : /peppol/i.test(s)
        ? 'Peppol-Profil'
        : /16931/i.test(s)
          ? 'EN-16931-Profil'
          : 'Profil nicht zugeordnet';
export function parseInvoice(xml: string): Invoice {
  if (new TextEncoder().encode(xml).length > INVOICE_MAX_BYTES)
    throw new Error('Rechnungs-XML darf höchstens 5 MB groß sein.');
  if (/<!DOCTYPE|<!ENTITY/i.test(xml))
    throw new Error('XML mit DTD oder eigenen Entitäten wird nicht geöffnet.');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (
    doc.getElementsByTagName('parsererror').length ||
    doc.documentElement.localName === 'parsererror'
  )
    throw new Error('Die XML-Datei ist nicht korrekt aufgebaut und kann nicht gelesen werden.');
  if (doc.getElementsByTagName('*').length > 100000)
    throw new Error('Die XML-Datei enthält zu viele Elemente.');
  const root = doc.documentElement;
  let invoice: Invoice;
  if (
    (root.localName === 'Invoice' &&
      root.namespaceURI === 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2') ||
    (root.localName === 'CreditNote' &&
      root.namespaceURI === 'urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2')
  )
    invoice = readUbl(root);
  else if (root.localName === 'CrossIndustryInvoice' && root.namespaceURI === ns.rsm)
    invoice = readCii(root);
  else
    throw new Error(
      'Keine unterstützte E-Rechnung gefunden. Unterstützt werden UBL-Rechnungen, UBL-Gutschriften und CII (ZUGFeRD 2 / Factur-X).',
    );
  if (invoice.lines.length > 2000)
    throw new Error('Bitte höchstens 2.000 Rechnungspositionen öffnen.');
  invoice.profileLabel = profileLabel(invoice.profile);
  invoice.checks = checkInvoice(invoice);
  return invoice;
}
function readUbl(root: Element): Invoice {
  const v = (path: string) => value(root, path),
    credit = root.localName === 'CreditNote';
  const party = (path: string): InvoiceParty => {
    const n = at(root, path + '/cac:Party');
    return {
      name:
        value(n, 'cac:PartyLegalEntity/cbc:RegistrationName') || value(n, 'cac:PartyName/cbc:Name'),
      address: [
        'cbc:StreetName',
        'cbc:AdditionalStreetName',
        'cac:AddressLine/cbc:Line',
        'cbc:PostalZone',
        'cbc:CityName',
        'cbc:CountrySubentity',
      ]
        .map((p) => value(at(n, 'cac:PostalAddress'), p))
        .filter(Boolean)
        .join(', '),
      country: value(n, 'cac:PostalAddress/cac:Country/cbc:IdentificationCode'),
      vatId: children(n, 'cac:PartyTaxScheme')
        .filter((e) => value(e, 'cac:TaxScheme/cbc:ID') === 'VAT')
        .map((e) => value(e, 'cbc:CompanyID'))
        .join(', '),
      email: value(n, 'cac:Contact/cbc:ElectronicMail'),
    };
  };
  const currency = v('cbc:DocumentCurrencyCode'),
    tax =
      children(root, 'cac:TaxTotal').find(
        (e) => at(e, 'cbc:TaxAmount')?.getAttribute('currencyID') === currency,
      ) || at(root, 'cac:TaxTotal');
  const total = at(root, 'cac:LegalMonetaryTotal'),
    t = (path: string) => value(total, 'cbc:' + path);
  const paymentMeans = children(root, 'cac:PaymentMeans'),
    paymentTerms = texts(root, 'cac:PaymentTerms/cbc:Note').join('\n');
  return {
    format: 'UBL',
    profile: v('cbc:CustomizationID'),
    profileLabel: '',
    number: v('cbc:ID'),
    date: v('cbc:IssueDate'),
    dueDate: v('cbc:DueDate'),
    currency,
    type: v(credit ? 'cbc:CreditNoteTypeCode' : 'cbc:InvoiceTypeCode') || (credit ? '381' : ''),
    buyerReference: v('cbc:BuyerReference'),
    orderReference: v('cac:OrderReference/cbc:ID'),
    seller: party('cac:AccountingSupplierParty'),
    buyer: party('cac:AccountingCustomerParty'),
    notes: texts(root, 'cbc:Note'),
    lines: children(root, credit ? 'cac:CreditNoteLine' : 'cac:InvoiceLine').map((n) => {
      const q = at(n, credit ? 'cbc:CreditedQuantity' : 'cbc:InvoicedQuantity');
      return {
        id: value(n, 'cbc:ID'),
        name: value(n, 'cac:Item/cbc:Name'),
        description: value(n, 'cac:Item/cbc:Description'),
        quantity: q?.textContent?.trim() || '',
        unit: q?.getAttribute('unitCode') || '',
        price: value(n, 'cac:Price/cbc:PriceAmount'),
        baseQuantity: value(n, 'cac:Price/cbc:BaseQuantity') || '1',
        net: value(n, 'cbc:LineExtensionAmount'),
        taxRate: value(n, 'cac:Item/cac:ClassifiedTaxCategory/cbc:Percent'),
        taxCategory: value(n, 'cac:Item/cac:ClassifiedTaxCategory/cbc:ID'),
        allowances: children(n, 'cac:AllowanceCharge')
          .filter((e) => ['false', '0'].includes(value(e, 'cbc:ChargeIndicator')))
          .map((e) => value(e, 'cbc:Amount')),
        charges: children(n, 'cac:AllowanceCharge')
          .filter((e) => ['true', '1'].includes(value(e, 'cbc:ChargeIndicator')))
          .map((e) => value(e, 'cbc:Amount')),
      };
    }),
    taxes: children(tax, 'cac:TaxSubtotal').map((n) => ({
      base: value(n, 'cbc:TaxableAmount'),
      amount: value(n, 'cbc:TaxAmount'),
      rate: value(n, 'cac:TaxCategory/cbc:Percent'),
      category: value(n, 'cac:TaxCategory/cbc:ID'),
      reason: value(n, 'cac:TaxCategory/cbc:TaxExemptionReason'),
    })),
    payment: (paymentMeans.length ? paymentMeans : paymentTerms ? [undefined] : []).map((n) => ({
      iban: value(n, 'cac:PayeeFinancialAccount/cbc:ID'),
      name: value(n, 'cac:PayeeFinancialAccount/cbc:Name'),
      bic: value(n, 'cac:PayeeFinancialAccount/cac:FinancialInstitutionBranch/cbc:ID'),
      code: value(n, 'cbc:PaymentMeansCode'),
      reference: value(n, 'cbc:PaymentID'),
      terms: paymentTerms,
    })),
    totals: {
      lines: t('LineExtensionAmount'),
      allowances: t('AllowanceTotalAmount'),
      charges: t('ChargeTotalAmount'),
      net: t('TaxExclusiveAmount'),
      tax: value(tax, 'cbc:TaxAmount'),
      gross: t('TaxInclusiveAmount'),
      paid: t('PrepaidAmount'),
      rounding: t('PayableRoundingAmount'),
      due: t('PayableAmount'),
    },
    checks: [],
  };
}
function readCii(root: Element): Invoice {
  const document = at(root, 'rsm:ExchangedDocument'),
    transaction = at(root, 'rsm:SupplyChainTradeTransaction'),
    agreement = at(transaction, 'ram:ApplicableHeaderTradeAgreement'),
    settlement = at(transaction, 'ram:ApplicableHeaderTradeSettlement'),
    total = at(settlement, 'ram:SpecifiedTradeSettlementHeaderMonetarySummation');
  const v = (path: string) => value(settlement, path),
    t = (name: string) => value(total, 'ram:' + name),
    currency = v('ram:InvoiceCurrencyCode');
  const paymentMeans = children(settlement, 'ram:SpecifiedTradeSettlementPaymentMeans'),
    paymentTerms = texts(settlement, 'ram:SpecifiedTradePaymentTerms/ram:Description').join('\n'),
    paymentReference = v('ram:PaymentReference');
  const party = (key: string): InvoiceParty => {
    const n = at(agreement, 'ram:' + key),
      address = at(n, 'ram:PostalTradeAddress');
    return {
      name: value(n, 'ram:Name'),
      address: [
        'LineOne',
        'LineTwo',
        'LineThree',
        'PostcodeCode',
        'CityName',
        'CountrySubDivisionName',
      ]
        .map((p) => value(address, 'ram:' + p))
        .filter(Boolean)
        .join(', '),
      country: value(address, 'ram:CountryID'),
      vatId: children(n, 'ram:SpecifiedTaxRegistration')
        .filter((e) => at(e, 'ram:ID')?.getAttribute('schemeID') === 'VA')
        .map((e) => value(e, 'ram:ID'))
        .join(', '),
      email: value(n, 'ram:DefinedTradeContact/ram:EmailURIUniversalCommunication/ram:URIID'),
    };
  };
  return {
    format: 'CII',
    profile: value(
      root,
      'rsm:ExchangedDocumentContext/ram:GuidelineSpecifiedDocumentContextParameter/ram:ID',
    ),
    profileLabel: '',
    number: value(document, 'ram:ID'),
    date: ciiDate(document, 'ram:IssueDateTime'),
    dueDate: ciiDate(settlement, 'ram:SpecifiedTradePaymentTerms/ram:DueDateDateTime'),
    currency,
    type: value(document, 'ram:TypeCode'),
    buyerReference: value(agreement, 'ram:BuyerReference'),
    orderReference: value(agreement, 'ram:BuyerOrderReferencedDocument/ram:IssuerAssignedID'),
    seller: party('SellerTradeParty'),
    buyer: party('BuyerTradeParty'),
    notes: texts(document, 'ram:IncludedNote/ram:Content'),
    lines: children(transaction, 'ram:IncludedSupplyChainTradeLineItem').map((n) => {
      const a = at(n, 'ram:SpecifiedLineTradeAgreement'),
        s = at(n, 'ram:SpecifiedLineTradeSettlement'),
        q = at(n, 'ram:SpecifiedLineTradeDelivery/ram:BilledQuantity');
      return {
        id: value(n, 'ram:AssociatedDocumentLineDocument/ram:LineID'),
        name: value(n, 'ram:SpecifiedTradeProduct/ram:Name'),
        description: value(n, 'ram:SpecifiedTradeProduct/ram:Description'),
        quantity: q?.textContent?.trim() || '',
        unit: q?.getAttribute('unitCode') || '',
        price: value(a, 'ram:NetPriceProductTradePrice/ram:ChargeAmount'),
        baseQuantity: value(a, 'ram:NetPriceProductTradePrice/ram:BasisQuantity') || '1',
        net: value(s, 'ram:SpecifiedTradeSettlementLineMonetarySummation/ram:LineTotalAmount'),
        taxRate: value(s, 'ram:ApplicableTradeTax/ram:RateApplicablePercent'),
        taxCategory: value(s, 'ram:ApplicableTradeTax/ram:CategoryCode'),
        allowances: children(s, 'ram:SpecifiedTradeAllowanceCharge')
          .filter((e) => ['false', '0'].includes(value(e, 'ram:ChargeIndicator/udt:Indicator')))
          .map((e) => value(e, 'ram:ActualAmount')),
        charges: children(s, 'ram:SpecifiedTradeAllowanceCharge')
          .filter((e) => ['true', '1'].includes(value(e, 'ram:ChargeIndicator/udt:Indicator')))
          .map((e) => value(e, 'ram:ActualAmount')),
      };
    }),
    taxes: children(settlement, 'ram:ApplicableTradeTax').map((n) => ({
      base: value(n, 'ram:BasisAmount'),
      amount: value(n, 'ram:CalculatedAmount'),
      rate: value(n, 'ram:RateApplicablePercent'),
      category: value(n, 'ram:CategoryCode'),
      reason: value(n, 'ram:ExemptionReason'),
    })),
    payment: (paymentMeans.length
      ? paymentMeans
      : paymentTerms || paymentReference
        ? [undefined]
        : []
    ).map((n) => ({
      iban: value(n, 'ram:PayeePartyCreditorFinancialAccount/ram:IBANID'),
      name: value(n, 'ram:PayeePartyCreditorFinancialAccount/ram:AccountName'),
      bic: value(n, 'ram:PayeeSpecifiedCreditorFinancialInstitution/ram:BICID'),
      code: value(n, 'ram:TypeCode'),
      reference: paymentReference,
      terms: paymentTerms,
    })),
    totals: {
      lines: t('LineTotalAmount'),
      allowances: t('AllowanceTotalAmount'),
      charges: t('ChargeTotalAmount'),
      net: t('TaxBasisTotalAmount'),
      tax:
        children(total, 'ram:TaxTotalAmount')
          .find((e) => e.getAttribute('currencyID') === currency)
          ?.textContent?.trim() || t('TaxTotalAmount'),
      gross: t('GrandTotalAmount'),
      paid: t('TotalPrepaidAmount'),
      rounding: t('RoundingAmount'),
      due: t('DuePayableAmount'),
    },
    checks: [],
  };
}
// Decimal arithmetic uses integer fractions, avoiding floating point rounding in checks.
function decimal(s: string) {
  if (!/^[+-]?(?:\d{1,16}(?:\.\d{0,12})?|\.\d{1,12})$/.test(s)) return null;
  const [whole, fraction = ''] = s.split('.');
  return { n: BigInt(whole + fraction), d: 10n ** BigInt(fraction.length) };
}
function round(n: bigint, d: bigint) {
  if (d <= 0n) throw new Error('Invalid divisor');
  const sign = n < 0n ? -1n : 1n;
  return sign * ((sign * n + d / 2n) / d);
}
const cents = (s: string) => {
  const n = decimal(s);
  return n ? round(n.n * 100n, n.d) : null;
};
const validDate = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  Number.isFinite(Date.parse(s)) &&
  new Date(s).toISOString().slice(0, 10) === s;
const amount = (n: bigint) =>
  `${n < 0 ? '-' : ''}${(n < 0 ? -n : n) / 100n}.${String((n < 0 ? -n : n) % 100n).padStart(2, '0')}`;
export function checkInvoice(i: Invoice): InvoiceCheck[] {
  const checks: InvoiceCheck[] = [];
  const add = (ok: boolean, title: string, good: string, bad: string) =>
    checks.push({ level: ok ? 'pass' : 'error', title, detail: ok ? good : bad });
  const missing = [
    ['Rechnungsnummer', i.number],
    ['Rechnungsdatum', i.date],
    ['Währung', i.currency],
    ['Verkäufer', i.seller.name],
    ['Käufer', i.buyer.name],
    ['Dokumenttyp', i.type],
  ]
    .filter(([, v]) => !v)
    .map(([k]) => k);
  add(
    !missing.length,
    'Grundlegende Angaben',
    'Nummer, Datum, Währung, Parteien und Dokumenttyp sind vorhanden.',
    `Fehlt: ${missing.join(', ')}.`,
  );
  add(
    validDate(i.date) && (!i.dueDate || validDate(i.dueDate)),
    'Datumsangaben',
    'Vorhandene Datumsangaben sind gültig.',
    'Rechnungs- oder Fälligkeitsdatum fehlt oder ist ungültig.',
  );
  add(
    /^[A-Z]{3}$/.test(i.currency),
    'Währungsformat',
    'Die Währung ist als dreistelliger Code angegeben.',
    'Ein dreistelliger Währungscode fehlt. Die Gültigkeit der Codeliste wird nicht geprüft.',
  );
  if (!i.profile)
    checks.push({
      level: 'warning',
      title: 'Profilangabe fehlt',
      detail: 'Die XML enthält keine erkannte Spezifikationskennung.',
    });
  if (!i.lines.length)
    checks.push({
      level: 'warning',
      title: 'Keine Positionen',
      detail:
        'Es wurden keine Rechnungspositionen gefunden. Dies kann bei reduzierten ZUGFeRD-Profilen vorkommen.',
    });
  const badNumbers: string[] = [];
  for (const [key, s] of Object.entries(i.totals))
    if ((['lines', 'net', 'tax', 'gross', 'due'].includes(key) || s) && cents(s) === null)
      badNumbers.push(key);
  for (const l of i.lines) {
    for (const [key, s] of Object.entries({
      quantity: l.quantity,
      price: l.price,
      baseQuantity: l.baseQuantity,
      net: l.net,
    }))
      if (!decimal(s)) badNumbers.push(`Position ${l.id}: ${key}`);
    if (l.taxRate && !decimal(l.taxRate)) badNumbers.push(`Position ${l.id}: Steuersatz`);
  }
  for (const tax of i.taxes)
    for (const [key, s] of Object.entries({
      base: tax.base,
      amount: tax.amount,
      ...(tax.rate ? { rate: tax.rate } : {}),
    }))
      if (!decimal(s)) badNumbers.push(`Steuer: ${key}`);
  add(
    !badNumbers.length,
    'Zahlen und Beträge',
    'Die ausgelesenen Mengen, Preise und Summen sind als Dezimalzahlen lesbar.',
    `Fehlend oder ungültig: ${badNumbers.slice(0, 10).join(', ')}${badNumbers.length > 10 ? ' …' : ''}.`,
  );
  const match = (title: string, actual: string, expected: bigint | null) => {
    const a = cents(actual);
    if (a === null || expected === null) {
      checks.push({
        level: 'warning',
        title,
        detail: 'Nicht berechenbar: Mindestens ein benötigter Betrag fehlt oder ist ungültig.',
      });
      return;
    }
    const diff = a - expected;
    add(
      diff >= -1n && diff <= 1n,
      title,
      `Stimmt innerhalb von 0,01 ${i.currency}.`,
      `Angegeben: ${actual}. Rechnerisch: ${amount(expected)} ${i.currency}.`,
    );
  };
  const sum = (values: string[]) =>
    values.reduce<bigint | null>((s, v) => {
      const c = cents(v);
      return s !== null && c !== null ? s + c : null;
    }, 0n);
  if (i.lines.length) match('Summe der Positionen', i.totals.lines, sum(i.lines.map((l) => l.net)));
  const l = cents(i.totals.lines),
    a = cents(i.totals.allowances || '0'),
    c = cents(i.totals.charges || '0'),
    net = cents(i.totals.net),
    tax = cents(i.totals.tax),
    gross = cents(i.totals.gross),
    paid = cents(i.totals.paid || '0'),
    r = cents(i.totals.rounding || '0');
  match('Nettosumme', i.totals.net, l !== null && a !== null && c !== null ? l - a + c : null);
  match('Bruttosumme', i.totals.gross, net !== null && tax !== null ? net + tax : null);
  match(
    'Zahlbetrag',
    i.totals.due,
    gross !== null && paid !== null && r !== null ? gross - paid + r : null,
  );
  if (i.taxes.length)
    match('Steueraufschlüsselung', i.totals.tax, sum(i.taxes.map((t) => t.amount)));
  const badLines: string[] = [],
    skipped: string[] = [];
  for (const line of i.lines) {
    const q = decimal(line.quantity),
      p = decimal(line.price),
      b = decimal(line.baseQuantity),
      n = cents(line.net),
      discount = sum(line.allowances),
      charge = sum(line.charges);
    if (!q || !p || !b || b.n <= 0n || n === null || discount === null || charge === null) {
      skipped.push(line.id);
      continue;
    }
    const calculated = round(q.n * p.n * b.d * 100n, q.d * p.d * b.n) - discount + charge;
    if (calculated - n > 2n || n - calculated > 2n) badLines.push(line.id);
  }
  if (i.lines.length) {
    if (badLines.length)
      checks.push({
        level: 'error',
        title: 'Menge × Preis',
        detail: `Abweichung in Position ${badLines.slice(0, 20).join(', ')}.${skipped.length ? ` Zusätzlich sind ${skipped.length} Position(en) nicht berechenbar.` : ''}`,
      });
    else if (skipped.length)
      checks.push({
        level: 'warning',
        title: 'Menge × Preis',
        detail: `Nicht vollständig prüfbar: Für ${skipped.length} von ${i.lines.length} Position(en) fehlen geeignete Rechenwerte oder die Preisbasis ist nicht positiv.`,
      });
    else
      checks.push({
        level: 'pass',
        title: 'Menge × Preis',
        detail:
          'Positionsbeträge stimmen mit Menge, Preis, Preisbasis sowie Positionszu- und -abschlägen innerhalb von 0,02 überein.',
      });
  }
  if (/xrechnung/i.test(i.profile) && !i.buyerReference)
    checks.push({
      level: 'warning',
      title: 'Käuferreferenz fehlt',
      detail: 'Im angegebenen XRechnung-Profil wurde keine Käuferreferenz ausgelesen.',
    });
  return checks;
}
export async function invoiceEntries(source: Source): Promise<InvoiceEntry[]> {
  if (source.invoiceOriginal) {
    const { bytes, name } = source.invoiceOriginal;
    const xml = decodeXml(bytes);
    return [{ name, bytes, xml, invoice: parseInvoice(xml) }];
  }
  const attachments = await source.pdf.getAttachments(),
    entries: InvoiceEntry[] = [];
  let total = 0,
    invalid = 0;
  for (const [key, attachment] of attachments || []) {
    const name = attachment.filename || key;
    if (!/\.xml$/i.test(name)) continue;
    const content = attachment.content ?? (await source.pdf.getAttachmentContent(key));
    if (!content) {
      invalid++;
      continue;
    }
    total += content.length;
    if (total > 15 * 1024 * 1024 || entries.length >= 20)
      throw new Error('Zu viele oder zu große XML-Anhänge. Bitte einzelne Rechnungen öffnen.');
    try {
      const bytes = new Uint8Array(content);
      const xml = decodeXml(bytes);
      entries.push({ name, bytes, xml, invoice: parseInvoice(xml) });
    } catch {
      invalid++;
    }
  }
  if (!entries.length)
    throw new Error(
      invalid
        ? 'Die PDF enthält XML-Anhänge, aber keine lesbare UBL- oder CII-Rechnung.'
        : 'Keine Rechnungs-XML in dieser PDF gefunden. Ziehe eine XRechnung-XML oder eine ZUGFeRD-/Factur-X-PDF mit eingebetteter XML ins Fenster.',
    );
  return entries;
}
export function invoiceFromBytes(bytes: Uint8Array, name: string): InvoiceEntry {
  const xml = decodeXml(bytes);
  return { bytes, name, xml, invoice: parseInvoice(xml) };
}
export function invoiceCsv(i: Invoice) {
  const safe = (v: string) =>
    '"' + (/^[\s]*[=+@\-\t\r]/.test(v) ? "'" + v : v).replaceAll('"', '""') + '"';
  const rows = [
    [
      'Rechnungsnummer',
      'Datum',
      'Verkäufer',
      'Käufer',
      'Währung',
      'Position',
      'Beschreibung',
      'Menge',
      'Einheit',
      'Einzelpreis',
      'Preisbasis',
      'Netto',
      'Steuersatz',
      'Steuerkategorie',
    ],
    ...i.lines.map((l) => [
      i.number,
      i.date,
      i.seller.name,
      i.buyer.name,
      i.currency,
      l.id,
      [l.name, l.description].filter(Boolean).join(' – '),
      l.quantity,
      l.unit,
      l.price,
      l.baseQuantity,
      l.net,
      l.taxRate,
      l.taxCategory,
    ]),
  ];
  return '\ufeff' + rows.map((r) => r.map(safe).join(';')).join('\r\n');
}
export function invoiceCheckText(i: Invoice) {
  return [
    `E-Rechnung – Basischeck`,
    `${i.number || 'Ohne Nummer'} · ${i.date || 'Ohne Datum'}`,
    INVOICE_CHECK_SCOPE,
    `Deklariertes Profil: ${i.profile || 'Keines'}`,
    '',
    ...i.checks.map(
      (c) =>
        `${c.level === 'pass' ? 'OK' : c.level === 'error' ? 'FEHLER' : 'HINWEIS'} | ${c.title}\n${c.detail}`,
    ),
  ].join('\n');
}
let fontPromise: Promise<ArrayBuffer> | undefined;
async function invoiceFont() {
  fontPromise ??= fetch('/vendor/invoice-font/NotoSans-Regular.ttf')
    .then((r) => {
      if (!r.ok)
        throw new Error('Die Schrift konnte nicht geladen werden. Bitte erneut versuchen.');
      return r.arrayBuffer();
    })
    .catch((e) => {
      fontPromise = undefined;
      throw e;
    });
  return fontPromise;
}
export async function invoicePdf(
  entry: InvoiceEntry,
  report = false,
  fontBytes?: Uint8Array,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const fontkit = (await import('@pdf-lib/fontkit')).default;
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(fontBytes || (await invoiceFont()), { subset: true });
  const supported = new Set(font.getCharacterSet());
  let missingGlyphs = false;
  const clean = (s: string) =>
    Array.from(s.replace(/[\x00-\x08\x0b-\x1f]/g, ''))
      .map((c) => {
        if (c === '\n' || supported.has(c.codePointAt(0)!)) return c;
        missingGlyphs = true;
        return '?';
      })
      .join('');
  let page: PDFPage,
    y = 0;
  const margin = 45,
    width = 505;
  let pageNo = 0;
  const next = () => {
    page = pdf.addPage([595.28, 841.89]);
    pageNo++;
    y = 790;
    page.drawText('E-RECHNUNG · LESEANSICHT', {
      x: margin,
      y: 811,
      size: 8,
      font,
      color: rgb(0.2, 0.48, 0.48),
    });
    page.drawText(String(pageNo), { x: 535, y: 23, size: 9, font });
  };
  next();
  const line = (s: string, size = 10, color = rgb(0.1, 0.22, 0.23)) => {
    const words = clean(s || '—').split(/\s+/);
    let text = '';
    const write = (v: string) => {
      if (y < size + 50) next();
      page.drawText(v, { x: margin, y, size, font, color });
      y -= size * 1.5;
    };
    for (const word of words) {
      const candidate = (text ? text + ' ' : '') + word;
      if (font.widthOfTextAtSize(candidate, size) > width && text) {
        write(text);
        text = '';
      }
      if (font.widthOfTextAtSize(word, size) > width) {
        let chunk = '';
        for (const char of word) {
          if (font.widthOfTextAtSize(chunk + char, size) > width) {
            write(chunk);
            chunk = '';
          }
          chunk += char;
        }
        text = chunk;
      } else text += (text ? ' ' : '') + word;
    }
    if (text) write(text);
  };
  const gap = () => {
    y -= 12;
  };
  const heading = (s: string) => {
    if (y < 100) next();
    gap();
    line(s, 13, rgb(0.03, 0.45, 0.45));
    y -= 4;
  };
  const i = entry.invoice;
  pdf.setTitle(`Leseansicht ${i.number || entry.name}`);
  pdf.setProducer('Lokale E-Rechnungs-Leseansicht');
  line(i.type === '381' ? 'Gutschrift' : 'Rechnung', 24);
  line(i.number || 'Ohne Rechnungsnummer', 16);
  line(`${i.date || 'Datum fehlt'} · ${i.currency || 'Währung fehlt'} · ${i.format}`);
  gap();
  if (report) {
    heading('Basischeck');
    line(INVOICE_CHECK_SCOPE);
    for (const c of i.checks) {
      heading(
        `${c.level === 'pass' ? 'OK' : c.level === 'error' ? 'FEHLER' : 'HINWEIS'} · ${c.title}`,
      );
      line(c.detail);
    }
  } else {
    for (const [label, p] of [
      ['Von', i.seller],
      ['An', i.buyer],
    ] as const) {
      heading(label);
      line(p.name, 12);
      line([p.address, p.country].filter(Boolean).join(', '));
      if (p.vatId) line('USt-ID: ' + p.vatId);
      if (p.email) line(p.email);
    }
    if (i.buyerReference) line('Käuferreferenz: ' + i.buyerReference);
    if (i.orderReference) line('Bestellung: ' + i.orderReference);
    heading('Positionen');
    for (const l of i.lines) {
      line(`${l.id}. ${l.name}`, 11);
      if (l.description) line(l.description);
      line(
        `${l.quantity} ${l.unit} × ${l.price} / ${l.baseQuantity} = ${l.net} ${i.currency} netto${l.taxRate ? ' · ' + l.taxRate + ' %' : ''}`,
      );
      y -= 7;
    }
    heading('Summen');
    for (const [label, key] of [
      ['Positionen', 'lines'],
      ['Nachlässe', 'allowances'],
      ['Zuschläge', 'charges'],
      ['Netto', 'net'],
      ['Steuer', 'tax'],
      ['Brutto', 'gross'],
      ['Bereits bezahlt', 'paid'],
      ['Rundung', 'rounding'],
      ['Zahlbetrag', 'due'],
    ] as const)
      if (i.totals[key]) line(`${label}: ${i.totals[key]} ${i.currency}`, key === 'due' ? 14 : 11);
    if (i.taxes.length) {
      heading('Steueraufschlüsselung');
      for (const t of i.taxes)
        line(
          `${t.category} · ${t.rate || '—'} % · Basis ${t.base} · Steuer ${t.amount} ${i.currency}${t.reason ? ' · ' + t.reason : ''}`,
        );
    }
    if (i.payment.length || i.dueDate) {
      heading('Zahlung');
      if (i.dueDate) line('Fällig: ' + i.dueDate);
      for (const p of i.payment) {
        if (p.iban) line('Konto: ' + p.iban);
        if (p.name) line('Kontoinhaber: ' + p.name);
        if (p.bic) line('BIC: ' + p.bic);
        if (p.reference) line('Referenz: ' + p.reference);
        if (p.terms) line(p.terms);
      }
    }
    if (i.notes.length) {
      heading('Hinweise aus der Rechnung');
      for (const note of i.notes) line(note);
    }
  }
  heading('Zur Leseansicht');
  line(
    'Diese PDF stellt ausgewählte Rechnungsangaben dar. Maßgeblich bleibt die unveränderte XML im Anhang. Diese Ausgabe ist keine zertifizierte ZUGFeRD- oder PDF/A-Datei.',
    9,
  );
  line(`Deklariertes Profil: ${i.profile || 'Nicht angegeben'}`, 9);
  if (missingGlyphs)
    line(
      'Einzelne Zeichen werden von der PDF-Schrift nicht unterstützt und erscheinen als ?. Die XML und die Browseransicht enthalten die Originalzeichen.',
      9,
    );
  await pdf.attach(
    entry.bytes,
    entry.name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 120) || 'Rechnung.xml',
    { mimeType: 'application/xml', description: 'Unveränderte Rechnungs-XML' },
  );
  return new Uint8Array(await pdf.save());
}
