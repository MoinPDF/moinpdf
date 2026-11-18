import { PDFDocument, PDFString } from 'pdf-lib';

/** Only these explicit PDF actions are authored. Document scripts are never evaluated. */
export function formButtonAction(
  doc: PDFDocument,
  action: { kind: 'reset' | 'submit' | 'print'; url?: string },
) {
  if (action.kind === 'reset') return doc.context.obj({ S: 'ResetForm', Flags: 0 });
  if (action.kind === 'print')
    return doc.context.obj({
      S: 'JavaScript',
      JS: PDFString.of('this.print({bUI:true,bSilent:false,bShrinkToFit:true});'),
    });
  if (action.kind !== 'submit') throw new Error('Unbekannte Formularaktion.');
  let url: URL;
  try {
    url = new URL(action.url || '');
  } catch {
    throw new Error('Bitte eine gültige HTTPS-Empfangsadresse eingeben.');
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.hash ||
    url.href.length > 2048
  )
    throw new Error('Bitte eine HTTPS-Empfangsadresse ohne Zugangsdaten und Fragment verwenden.');
  // XFDF submission; the PDF reader prompts before any network request.
  return doc.context.obj({ S: 'SubmitForm', F: PDFString.of(url.href), Flags: 32 });
}
