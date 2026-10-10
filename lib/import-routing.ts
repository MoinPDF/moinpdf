import type { ServerTool } from './advanced-types';

export const documentAccept =
  '.pdf,.xml,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.eml,.msg,.html,.htm,.epub';

// Route the original file straight to its converter, without requiring a PDF first.
export function conversionToolForFile(name: string): ServerTool | null {
  if (/\.(docx?|xlsx?|pptx?|od[tsp])$/i.test(name)) return 'office-pdf';
  if (/\.(eml|msg)$/i.test(name)) return 'email-pdf';
  if (/\.html?$/i.test(name)) return 'html-pdf';
  if (/\.epub$/i.test(name)) return 'ebook-pdf';
  return null;
}
