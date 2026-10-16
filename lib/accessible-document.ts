import { readPdfText } from './pdf-text';
import { z } from 'zod';
import type { Source } from './pdf-engine';
const content = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine(
      (v) => !/[\x00-\x08\x0b\x0c\x0e-\x1f\ufffe\uffff]/.test(v),
      'Unzulässiges Steuerzeichen.',
    );
export const accessibleSchema = z
  .object({
    title: content(300),
    language: z.enum(['de-DE', 'en-US', 'fr-FR', 'es-ES', 'it-IT', 'nl-NL', 'pl-PL']),
    blocks: z
      .array(
        z.union([
          z.object({ kind: z.enum(['h1', 'h2', 'h3', 'p']), text: content(10000) }).strict(),
          z
            .object({
              kind: z.literal('figure'),
              alt: content(2000),
              data: z
                .string()
                .min(4)
                .max(4 * 1024 * 1024)
                .regex(/^[A-Za-z0-9+/]+={0,2}$/),
            })
            .strict(),
        ]),
      )
      .min(1)
      .max(200),
  })
  .strict();
export type AccessibleDocument = z.infer<typeof accessibleSchema>;
export type AccessibleBlock = AccessibleDocument['blocks'][number];
export function validateAccessibleDocument(value: unknown): AccessibleDocument {
  const result = accessibleSchema.safeParse(value);
  if (!result.success)
    throw new Error(
      'Bitte Titel, Sprache und alle Inhaltsblöcke prüfen. Jeder Absatz und jede Bildbeschreibung muss ausgefüllt sein; höchstens 200 Blöcke.',
    );
  const document = result.data;
  let heading = 0,
    characters = 0,
    figures = 0;
  for (const block of document.blocks) {
    characters += block.kind === 'figure' ? block.alt.length : block.text.length;
    if (block.kind === 'figure') figures++;
    else if (block.kind !== 'p') {
      const level = Number(block.kind[1]);
      if (level > heading + 1)
        throw new Error('Überschriftenebenen nicht überspringen: mit Überschrift 1 beginnen.');
      heading = level;
    }
  }
  if (
    characters > 100000 ||
    figures > 10 ||
    new TextEncoder().encode(JSON.stringify(document)).length > 8 * 1024 * 1024
  )
    throw new Error('Höchstens 100.000 Zeichen, zehn Bilder und insgesamt 8 MB verwenden.');
  return document;
}
export async function accessibleTextDraft(
  source: Source,
  signal: AbortSignal,
): Promise<AccessibleBlock[]> {
  const blocks: AccessibleBlock[] = [];
  let characters = 0;
  for (let i = 1; i <= source.pdf.numPages; i++) {
    signal.throwIfAborted();
    const page = await source.pdf.getPage(i),
      content = await readPdfText(page);
    let text = '';
    for (const item of content.items) {
      if ('str' in item) text += item.str + (item.hasEOL ? '\n' : ' ');
    }
    text = text.trim();
    characters += text.length;
    if (characters > 100000)
      throw new Error(
        'Der Text überschreitet 100.000 Zeichen. Bitte zuerst die benötigten Seiten ausgliedern.',
      );
    // Limit individual blocks without cutting a surrogate pair or dropping text.
    while (text) {
      let end = Math.min(9000, text.length);
      if (end < text.length) {
        const boundary = Math.max(text.lastIndexOf('\n', end), text.lastIndexOf(' ', end));
        if (boundary > end / 2) end = boundary;
        else if (/[\uD800-\uDBFF]/.test(text[end - 1])) end--;
      }
      blocks.push({ kind: 'p', text: text.slice(0, end).trim() });
      text = text.slice(end).trim();
      if (blocks.length > 199)
        throw new Error('Zu viele Textblöcke. Bitte zuerst die benötigten Seiten ausgliedern.');
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  signal.throwIfAborted();
  if (!blocks.length)
    throw new Error('Kein auslesbarer Text. Reine Scans zuerst mit OCR durchsuchbar machen.');
  return blocks;
}
