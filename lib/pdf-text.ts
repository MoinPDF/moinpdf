import type { PDFPageProxy } from 'pdfjs-dist';

type TextContent = Awaited<ReturnType<PDFPageProxy['getTextContent']>>;
type TextOptions = Parameters<PDFPageProxy['getTextContent']>[0];

// PDF.js uses ReadableStream async iteration, which some Safari versions lack.
// Read the same chunks through the widely supported reader API instead.
export async function readPdfText(page: PDFPageProxy, options?: TextOptions): Promise<TextContent> {
  // Pure XFA pages obtain their text from the XFA tree, not the PDF stream.
  if (page.isPureXfa) return page.getTextContent(options);

  const reader = page.streamTextContent(options).getReader();
  const content: TextContent = { items: [], styles: Object.create(null), lang: null };
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return content;
      content.lang ??= value.lang;
      Object.assign(content.styles, value.styles);
      for (const item of value.items) content.items.push(item);
    }
  } finally {
    reader.releaseLock();
  }
}
