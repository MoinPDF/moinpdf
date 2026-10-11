import type { ServerTool } from './advanced-types';

export const documentAccept =
  '.pdf,.xml,.jpg,.jpeg,.png,.webp,.bmp,.tif,.tiff,.svg,.heic,.heif,.psd,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.pages,.vsd,.vsdx,.pub,.eml,.msg,.html,.htm,.epub';

// Route the original file straight to its converter, without requiring a PDF first.
export function conversionToolForFile(name: string): ServerTool | null {
  if (/\.(docx?|xlsx?|pptx?|od[tsp]|pages|vsdx?|pub)$/i.test(name)) return 'office-pdf';
  if (/\.(eml|msg)$/i.test(name)) return 'email-pdf';
  if (/\.html?$/i.test(name)) return 'html-pdf';
  if (/\.epub$/i.test(name)) return 'ebook-pdf';
  return null;
}
