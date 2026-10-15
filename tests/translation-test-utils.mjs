import { readFile } from 'node:fs/promises';
import ts from 'typescript';

// Exercise the production catalogue and matcher, including interpolation, in each suite.
export async function englishTranslator() {
  const source = await readFile('lib/ui-language.ts', 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  const language = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
  language.installEnglishCatalog(JSON.parse(await readFile('public/locales/en.json', 'utf8')));
  language.setUiLanguage('en');
  return language.ui;
}
