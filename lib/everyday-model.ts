import type { FormField } from './document-tools';
import type { Rect } from './studio-engine';

export type ProfileEntry = { id: string; label: string; value: string };
export type FormProfile = { id: string; name: string; entries: ProfileEntry[] };
export const PROFILE_STORAGE_KEY = 'moinpdf.form-profiles.v1';
export const profileLabels = [
  'Vorname',
  'Nachname',
  'Vollständiger Name',
  'Straße und Hausnummer',
  'Postleitzahl',
  'Ort',
  'Geburtsdatum',
  'E-Mail',
  'Telefon',
];
const aliases = [
  ['vorname', 'first name', 'given name', 'firstname'],
  ['nachname', 'familienname', 'surname', 'last name', 'lastname'],
  ['vollständiger name', 'vor und nachname', 'full name', 'fullname'],
  [
    'straße und hausnummer',
    'straße hausnummer',
    'strasse hausnummer',
    'street address',
    'address line 1',
    'street',
  ],
  ['postleitzahl', 'plz', 'postcode', 'postal code', 'zip code', 'zipcode'],
  ['ort', 'wohnort', 'stadt', 'city', 'town'],
  ['geburtsdatum', 'date of birth', 'birth date', 'dob'],
  ['e mail', 'email', 'email address', 'e mail adresse'],
  ['telefon', 'telefonnummer', 'phone', 'phone number', 'telephone'],
];
export const normaliseField = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
export function emptyProfile(): FormProfile {
  return {
    id: '',
    name: '',
    entries: profileLabels.map((label, i) => ({ id: `entry-${i}`, label, value: '' })),
  };
}
/** Exact aliases only. A generic Name, guardian name or repeated ambiguous label is not guessed. */
export function suggestProfileEntry(field: FormField, entries: ProfileEntry[]) {
  if (field.kind !== 'text' || field.readOnly || field.deleted || String(field.value || '').trim())
    return undefined;
  const name = normaliseField(field.name);
  const matches = entries.filter((entry) => {
    if (!entry.value.trim()) return false;
    const label = normaliseField(entry.label);
    if (label === name) return true;
    return aliases.some(
      (group) =>
        group.map(normaliseField).includes(label) && group.map(normaliseField).includes(name),
    );
  });
  return matches.length === 1 ? matches[0] : undefined;
}
export function validateProfile(profile: FormProfile) {
  if (
    !profile.name.trim() ||
    profile.name.length > 80 ||
    profile.entries.length < 1 ||
    profile.entries.length > 30
  )
    throw new Error('Bitte einen Profilnamen und höchstens 30 Angaben verwenden.');
  const ids = new Set<string>();
  for (const entry of profile.entries) {
    if (
      !entry.id ||
      ids.has(entry.id) ||
      !entry.label.trim() ||
      entry.label.length > 80 ||
      entry.value.length > 500
    )
      throw new Error(
        'Angaben brauchen eindeutige Kennungen, eine Bezeichnung und höchstens 500 Zeichen.',
      );
    ids.add(entry.id);
  }
}
export function decodeProfiles(raw: string | null): FormProfile[] {
  if (!raw) return [];
  if (raw.length > 200000)
    throw new Error('Die gespeicherten Profile konnten nicht gelesen werden.');
  const data: unknown = JSON.parse(raw);
  if (!Array.isArray(data) || data.length > 10)
    throw new Error('Die gespeicherten Profile konnten nicht gelesen werden.');
  const ids = new Set<string>();
  return data.map((item: unknown) => {
    if (!item || typeof item !== 'object') throw new Error('Ungültiges Profil.');
    const p = item as FormProfile;
    if (
      typeof p.id !== 'string' ||
      !p.id ||
      ids.has(p.id) ||
      typeof p.name !== 'string' ||
      !Array.isArray(p.entries) ||
      p.entries.some(
        (e) =>
          !e ||
          typeof e.id !== 'string' ||
          typeof e.label !== 'string' ||
          typeof e.value !== 'string',
      )
    )
      throw new Error('Ungültiges Profil.');
    validateProfile(p);
    ids.add(p.id);
    return {
      id: p.id,
      name: p.name,
      entries: p.entries.map(({ id, label, value }) => ({ id, label, value })),
    };
  });
}
export function storeProfile(profiles: FormProfile[], profile: FormProfile) {
  validateProfile(profile);
  const next = profiles.filter((item) => item.id !== profile.id);
  if (next.length >= 10) throw new Error('Es können höchstens zehn Profile gespeichert werden.');
  return [...next, structuredClone(profile)];
}

export type ReceiptItem = {
  id: string;
  sourceId: string;
  page: number;
  rotation: number;
  rect: Rect;
  pageWidth: number;
  pageHeight: number;
  widthMm: number;
  label: string;
};
export type ReceiptOptions = { margin: number; gap: number; numbers: boolean };
export type ReceiptPlacement = {
  itemId: string;
  sheet: number;
  x: number;
  y: number;
  width: number;
  height: number;
  part: number;
  parts: number;
  rect: Rect;
  caption: string;
  captionHeight: number;
};
export type ReceiptLayout = { placements: ReceiptPlacement[]; sheets: number };
export function validReceipt(item: ReceiptItem) {
  const r = item.rect;
  if (
    !item.id ||
    !item.sourceId ||
    !Number.isInteger(item.page) ||
    item.page < 0 ||
    ![0, 90, 180, 270].includes(item.rotation) ||
    ![item.pageWidth, item.pageHeight, item.widthMm, r.x, r.y, r.w, r.h].every(Number.isFinite) ||
    item.pageWidth <= 0 ||
    item.pageHeight <= 0 ||
    item.widthMm < 30 ||
    item.widthMm > 190 ||
    r.x < 0 ||
    r.y < 0 ||
    r.w < 0.005 ||
    r.h < 0.005 ||
    r.x + r.w > 1.000001 ||
    r.y + r.h > 1.000001 ||
    item.label.length > 80
  )
    throw new Error('Bitte Belegbreite, Zuschnitt und Seitenzuordnung prüfen.');
}
/** Millimetres, row packing in the user's order; long receipts are sliced, never silently shrunk. */
export function layoutReceipts(items: ReceiptItem[], options: ReceiptOptions): ReceiptLayout {
  if (!items.length || items.length > 200) throw new Error('Bitte 1 bis 200 Belege auswählen.');
  if (
    ![options.margin, options.gap].every(Number.isFinite) ||
    options.margin < 5 ||
    options.margin > 25 ||
    options.gap < 2 ||
    options.gap > 20
  )
    throw new Error('Seitenrand: 5 bis 25 mm; Abstand: 2 bis 20 mm.');
  let sheet = 0,
    x = options.margin,
    y = options.margin,
    rowHeight = 0;
  const placements: ReceiptPlacement[] = [],
    ids = new Set<string>();
  const usableWidth = 210 - 2 * options.margin,
    usableHeight = 297 - 2 * options.margin;
  for (const [index, item] of items.entries()) {
    validReceipt(item);
    if (ids.has(item.id)) throw new Error('Ein Beleg ist doppelt zugeordnet.');
    ids.add(item.id);
    if (item.widthMm > usableWidth)
      throw new Error(
        'Ein Beleg ist breiter als der Druckbereich. Breite oder Seitenrand anpassen.',
      );
    const captionBase = [
      options.numbers ? String(index + 1).padStart(2, '0') : '',
      item.label.trim(),
    ]
      .filter(Boolean)
      .join(' · ');
    const totalHeight =
      (item.widthMm * (item.pageHeight * item.rect.h)) / (item.pageWidth * item.rect.w);
    const needsSplit = totalHeight > usableHeight - (captionBase ? 10 : 0);
    const captionHeight = captionBase || needsSplit ? 10 : 0;
    const maxHeight = usableHeight - captionHeight;
    const parts = Math.ceil(totalHeight / maxHeight);
    if (parts > 100 || placements.length + parts > 400)
      throw new Error('Die Ausgabe wäre zu umfangreich. Belege auf mehrere Aufträge verteilen.');
    let consumed = 0;
    for (let part = 0; part < parts; part++) {
      const height = Math.min(maxHeight, totalHeight - consumed),
        outer = height + captionHeight;
      if (x + item.widthMm > 210 - options.margin + 0.000001) {
        x = options.margin;
        y += rowHeight + options.gap;
        rowHeight = 0;
      }
      if (y + outer > 297 - options.margin + 0.000001) {
        sheet++;
        x = options.margin;
        y = options.margin;
        rowHeight = 0;
      }
      placements.push({
        itemId: item.id,
        sheet,
        x,
        y,
        width: item.widthMm,
        height,
        part: part + 1,
        parts,
        rect: {
          ...item.rect,
          y: item.rect.y + (item.rect.h * consumed) / totalHeight,
          h: (item.rect.h * height) / totalHeight,
        },
        caption: [captionBase, parts > 1 ? `${part + 1}/${parts}` : ''].filter(Boolean).join(' · '),
        captionHeight,
      });
      consumed += height;
      x += item.widthMm + options.gap;
      rowHeight = Math.max(rowHeight, outer);
    }
  }
  return { placements, sheets: sheet + 1 };
}
