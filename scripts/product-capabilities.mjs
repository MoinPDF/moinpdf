import { readFile, writeFile } from 'node:fs/promises';
import { individualOcrLanguages, MAX_OCR_LANGUAGES } from '../lib/ocr-languages.ts';
/** Read implementation constants instead of maintaining another limit table. */
export async function productCapabilities() {
  const engine = await readFile(new URL('../lib/pdf-engine.ts', import.meta.url), 'utf8');
  const number = pattern => {
    const match = engine.match(pattern);
    if (!match) throw new Error('Capability constant changed: update the documentation extractor.');
    return Number(match[1]);
  };
  const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  return { version, sourceMiB: number(/export const MAX_BYTES = (\d+) \* 1024 \* 1024;/),
    activePages: number(/export const MAX_PAGES = (\d+);/), ocrLanguages: individualOcrLanguages.length, simultaneousOcrLanguages: MAX_OCR_LANGUAGES };
}
export async function writeCapabilityDocs() {
  const capabilities = await productCapabilities();
  await writeFile(new URL('../public/capabilities.json', import.meta.url), JSON.stringify(capabilities, null, 2) + '\n');
  for (const [file, english] of [['FUNKTIONEN.md', false], ['FEATURES.en.md', true]]) {
    const path = new URL('../docs/' + file, import.meta.url), text = await readFile(path, 'utf8');
    const block = `<!-- generated-capabilities:start -->\n${english ? '**Current implementation limits' : '**Aktuelle Grenzen aus der Implementierung'} · ${capabilities.version}**\n\n| ${english ? 'Capability | Value' : 'Funktion | Wert'} |\n| --- | --- |\n| ${english ? 'Active source files' : 'Aktive Quelldateien'} | ${capabilities.sourceMiB} MiB |\n| ${english ? 'Active pages' : 'Aktive Seiten'} | ${capabilities.activePages} |\n| OCR | ${capabilities.ocrLanguages} ${english ? 'languages; up to' : 'Sprachen; bis zu'} ${capabilities.simultaneousOcrLanguages} ${english ? 'combined' : 'gleichzeitig'} |\n\n${english ? 'Generated from the application constants when building the documentation.' : 'Beim Dokumentationsbuild aus den Anwendungskonstanten erzeugt.'}\n<!-- generated-capabilities:end -->`;
    const next = text.includes('<!-- generated-capabilities:start -->')
      ? text.replace(/<!-- generated-capabilities:start -->[\s\S]*?<!-- generated-capabilities:end -->/, block)
      : text.replace(/^(#[^\n]*\n)/, '$1\n' + block + '\n');
    await writeFile(path, next);
  }
  return capabilities;
}
