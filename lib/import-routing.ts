import type { ServerTool, AdvancedTool } from './advanced-types';

export const documentAccept =
  '.pdf,.xml,.jpg,.jpeg,.png,.webp,.bmp,.tif,.tiff,.svg,.heic,.heif,.psd,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.rtf,.pages,.vsd,.vsdx,.pub,.eml,.msg,.html,.htm,.epub,.fb2,.cbz,.xps,.oxps,.mobi,.azw3,.cbr,.wpd,.wps,.odg,.md,.markdown,.txt,.csv,.json';

// Route the original file straight to its converter, without requiring a PDF first.
export function conversionToolForFile(name: string): ServerTool | AdvancedTool | null {
  if (/\.(docx?|xlsx?|pptx?|od[tsp]|rtf|pages|vsdx?|pub|wpd|wps|odg)$/i.test(name))
    return 'office-pdf';
  if (/\.(eml|msg)$/i.test(name)) return 'email-pdf';
  if (/\.html?$/i.test(name)) return 'html-pdf';
  if (/\.(epub|fb2|cbz|xps|oxps|mobi|azw3|cbr)$/i.test(name)) return 'ebook-pdf';
  if (/\.(md|markdown|txt|csv)$/i.test(name)) return 'text-pdf';
  if (/\.json$/i.test(name)) return 'pdf-json';
  return null;
}
