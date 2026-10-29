import type { WorkspaceTool } from './tool-catalog';

// UI copy only: tool identifiers and processing options are language independent.
export const englishTools: Record<
  WorkspaceTool,
  { title: string; description: string; action: string }
> = {
  'large-document': {
    title: 'Process large PDFs',
    description:
      'Process up to 1,000 pages in locally saved sections, pause and resume. Verify every page before exporting the complete file.',
    action: 'Prepare large PDF',
  },
  'document-colors': {
    title: 'Change colors & background',
    description:
      'Recolor text and background, or adjust page brightness, contrast and saturation with a preview.',
    action: 'Adjust colors',
  },
  'header-footer-cleanup': {
    title: 'Clean up headers and footers',
    description:
      'Find recurring margin text and page numbers, review matches and remove selected header or footer areas.',
    action: 'Clean up margins',
  },
  'form-helper': {
    title: 'Form helper',
    description:
      'Save recurring details in local profiles, match form fields and place entries on scans.',
    action: 'Prepare form',
  },
  'receipts-a4': {
    title: 'Collect receipts on A4',
    description: 'Crop and label receipts, then arrange them at a readable size on A4 sheets.',
    action: 'Arrange receipts',
  },
  'klar-schiff': {
    title: 'Clear Deck',
    description:
      'Recognise, organise and split document piles. Review assignments and download individual PDFs or an organised bundle.',
    action: 'Recognise documents',
  },
  'local-assistant': {
    title: 'Local PDF assistant',
    description:
      'Answer questions with a local language model and check quotations directly on the original PDF pages.',
    action: 'Answer locally',
  },
  'native-objects': {
    title: 'Edit PDF objects',
    description:
      'Edit original text, reflow paragraphs with your chosen font, and edit images and graphics.',
    action: 'Edit objects',
  },
  bates: {
    title: 'Bates numbering',
    description:
      'Apply continuous numbering across multiple PDFs with case numbers, filenames and headers or footers.',
    action: 'Apply numbering',
  },
  'page-labels': {
    title: 'Page labels',
    description: 'Set Roman, alphabetic or custom page labels for document navigation.',
    action: 'Save labels',
  },
  'rotate-free': {
    title: 'Rotate freely',
    description: 'Rotate pages by any angle and automatically adjust the page size.',
    action: 'Rotate pages',
  },
  'continuous-page': {
    title: 'Continuous PDF page',
    description:
      'Combine multiple pages into one continuous page for scrolling. Preserve text and vector graphics.',
    action: 'Create continuous page',
  },
  'poster-print': {
    title: 'Poster printing',
    description: 'Split large pages across multiple print tiles with adjustable overlap.',
    action: 'Split poster',
  },
  linearize: {
    title: 'Fast web view',
    description: 'Prepare PDFs so the first page can load before the whole file.',
    action: 'Optimise web view',
  },
  'svg-export': {
    title: 'PDF to vector SVG',
    description:
      'Export each PDF page as a standalone SVG file. Vector graphics and glyph outlines remain sharp.',
    action: 'Export SVG files',
  },
  'font-outlines': {
    title: 'Fonts to outlines',
    description: 'Export characters as fixed vector outlines, independent of installed fonts.',
    action: 'Create outlines',
  },
  'flatten-layers': {
    title: 'Flatten layers',
    description: 'Save the initially visible layers as a fixed PDF view and remove hidden layers.',
    action: 'Flatten layers',
  },
  'structured-export': {
    title: 'PDF to structured JSON',
    description:
      'Export text, pages and source locations as structured data for further processing.',
    action: 'Export JSON',
  },
  'form-responses': {
    title: 'Collect form responses',
    description:
      'Read completed PDF forms together, check required values and export corrected responses to Excel or CSV.',
    action: 'Read form values',
  },
  chronology: {
    title: 'Document chronology',
    description:
      'Find dates in document content, check the order and create a document bundle with a clickable table of contents.',
    action: 'Find dates',
  },
  'arithmetic-check': {
    title: 'Check calculations',
    description:
      'Select number ranges, correct the values to add and compare their sum with a stated total.',
    action: 'Collect numbers',
  },
  'pdf-sanitize': {
    title: 'Sanitize PDF',
    description:
      'Remove scripts and risky actions. Optionally remove attachments, comments and document metadata too.',
    action: 'Review content',
  },
  'pdf-layers': {
    title: 'Manage PDF layers',
    description:
      'Rename PDF layers, save their order and visibility, or flatten the view into page images.',
    action: 'Load layers',
  },
  'pdf-measure': {
    title: 'PDF measuring tool',
    description:
      'Calibrate pages using a known distance. Measure distances and areas and save them as an annotated PDF or CSV.',
    action: 'Set measurement points',
  },
  'pdf-audio': {
    title: 'PDF to audio',
    description:
      'Review text and OCR results. Export audio with local German or English voices as WAV or as an audio ZIP organised by pages and chapters.',
    action: 'Prepare narration text',
  },
  'number-compare': {
    title: 'Compare numbers',
    description:
      'Show changes to amounts, percentages, dates and IBANs between two versions, with source locations.',
    action: 'Compare numbers',
  },
  'field-collector': {
    title: 'Collect document fields',
    description:
      'Extract custom fields from multiple PDFs, check values against the original and export them together to Excel or CSV.',
    action: 'Collect document fields',
  },
  'invoice-visual-check': {
    title: 'Compare invoice and XML',
    description:
      'Use OCR to compare visible invoice details with embedded UBL or CII XML. Check uncertain values at their source locations.',
    action: 'Compare invoice',
  },
  'page-gaps': {
    title: 'Find missing pages',
    description:
      'Check printed page numbering, such as “Page 3 of 7”, for gaps, repeats and jumps.',
    action: 'Find gaps',
  },
  'ocr-review': {
    title: 'Review OCR',
    description:
      'Review uncertain words and numbers in enlarged crops of the original. Save corrected searchable text as PDF or TXT.',
    action: 'Review OCR',
  },
  pseudonymize: {
    title: 'Pseudonymize files',
    description:
      'Replace specified names and other terms with consistent placeholders. Review matches and export new page images.',
    action: 'Apply placeholders',
  },
  'attachment-links': {
    title: 'Link attachments',
    description:
      'Detect attachment references, assign target pages and create a PDF bundle with clickable references.',
    action: 'Link attachments',
  },
  'best-scans': {
    title: 'Combine best scans',
    description:
      'Compare similar pages from several scans. Review quality suggestions and reassemble the original pages.',
    action: 'Select scan pages',
  },
  'document-reconcile': {
    title: 'Reconcile business documents',
    description:
      'Review suggested line items and compare quantities, unit prices and amounts between related documents.',
    action: 'Compare line items',
  },
  'comment-export': {
    title: 'Export comments as tasks',
    description:
      'Collect PDF comments and highlights with author, text excerpt and page. Edit tasks and save them as Excel, CSV or Markdown.',
    action: 'Collect comments',
  },
  'pdf-repair': {
    title: 'Repair PDF',
    description:
      'Restore the structure of damaged PDFs. Upload directly even when a preview is unavailable.',
    action: 'Repair PDF',
  },
  'optimize-pdf': {
    title: 'Compress to target size',
    description:
      'Optimise losslessly or reduce image sizes. Preserve text and forms and check the output against the target size.',
    action: 'Optimise PDF',
  },
  'scan-split': {
    title: 'Automatically split scanned photos',
    description:
      'Detect, straighten and crop multiple photos on a scan page. Save as JPG, PNG or a combined PDF.',
    action: 'Create crops',
  },
  'pdf-markdown': {
    title: 'PDF to Markdown',
    description:
      'Export extractable text with headings and page sections as an editable Markdown file.',
    action: 'Create Markdown',
  },
  'pdf-html': {
    title: 'PDF to HTML',
    description: 'Save extractable text as a standalone, readable HTML file with page navigation.',
    action: 'Create HTML',
  },
  'pdf-epub': {
    title: 'PDF to e-book',
    description:
      'Export extractable text as an EPUB with an adjustable font and a table of contents.',
    action: 'Create EPUB',
  },
  'ebook-pdf': {
    title: 'E-book to PDF',
    description:
      'Convert unprotected EPUB files to PDF with a choice of font size and page format.',
    action: 'Create PDF',
  },
  'pdf-powerpoint': {
    title: 'PDF to PowerPoint',
    description:
      'Transfer PDF pages to PowerPoint slides as slide images or individually editable text objects.',
    action: 'Create PowerPoint file',
  },
  'html-pdf': {
    title: 'HTML & web pages to PDF',
    description:
      'Paste a website link and save it as PDF with images and page styling. Also convert saved HTML files.',
    action: 'Create PDF',
  },
  'auto-orient': {
    title: 'Auto-orient pages',
    description:
      'Detect rotated text pages and correct them by 90, 180 or 270 degrees. Flag uncertain pages in the report.',
    action: 'Orient pages',
  },
  'book-dewarp': {
    title: 'Dewarp book scans',
    description:
      'Straighten curved text lines near the book gutter with adjustable curve correction. Create new page images.',
    action: 'Dewarp scan',
  },
  'form-detect': {
    title: 'Detect form fields',
    description:
      'Detect empty boxes and input lines and create fillable fields. Review the suggestions afterwards.',
    action: 'Detect form fields',
  },
  'redaction-check': {
    title: 'Check redactions',
    description:
      'Look for terms that can still be extracted and possible dark overlays. Includes a findings report.',
    action: 'Check redactions',
  },
  'print-check': {
    title: 'Check print quality',
    description:
      'Check image resolution, embedded fonts and page boxes. Collect notes for print preparation.',
    action: 'Check print quality',
  },
  'accessibility-check': {
    title: 'Check accessibility',
    description:
      'Check PDF/UA and create new structured PDFs with headings, reading order and image descriptions.',
    action: 'Check accessibility',
  },
  'translate-pdf': {
    title: 'Translate PDF',
    description:
      'Translate extractable text into another language. Export the original and translation side by side.',
    action: 'Translate PDF',
  },
  'zugferd-create': {
    title: 'ZUGFeRD assistant',
    description:
      'Combine an invoice PDF with matching CII XML into a hybrid invoice. Validate with Mustang and veraPDF.',
    action: 'Process invoice',
  },
  'word-mail-merge': {
    title: 'Word mail merge',
    description:
      'Fill DOCX templates with Excel records. Create a separate PDF for each row and collect them in a ZIP.',
    action: 'Create merged documents',
  },
  'split-size': {
    title: 'Split by file size',
    description:
      'Split a PDF into consecutive parts within an MB limit. Check the size of every output file.',
    action: 'Calculate split files',
  },
  'pdf-word': {
    title: 'PDF to Word',
    description: 'Create an editable Word file from your PDF.',
    action: 'Create Word file',
  },
  'email-pdf': {
    title: 'Email to PDF',
    description:
      'Save EML and Outlook MSG files as PDFs with the sender, subject and message. Optionally include attachments in a ZIP.',
    action: 'Create PDF',
  },
  batch: {
    title: 'Batch processing',
    description:
      'Stamp, number, protect or clean multiple PDFs individually. Get all results in one ZIP.',
    action: 'Process batch',
  },
  workflows: {
    title: 'Workflows',
    description:
      'Combine steps such as OCR, blank page removal and numbering. Save and reuse workflows.',
    action: 'Run workflow',
  },
  'auto-rename': {
    title: 'Rename automatically',
    description:
      'Suggest filenames from dates, invoice numbers and titles. Review and edit the suggestions.',
    action: 'Suggest names',
  },
  'smart-split': {
    title: 'Smart split',
    description: 'Split PDFs based on text, bookmarks, blank pages or QR/barcode separator sheets.',
    action: 'Find split points',
  },
  'table-export': {
    title: 'Table to Excel',
    description:
      'Extract table areas using text or OCR. Correct columns and values and save them as Excel or CSV.',
    action: 'Detect table',
  },
  'search-redact': {
    title: 'Search & redact',
    description:
      'Find search terms, names, email addresses and possible IBANs. Review areas and permanently remove them from the output.',
    action: 'Find matches',
  },
  'visual-compare': {
    title: 'Visual PDF comparison',
    description:
      'Use colour to highlight differences in scans, images, stamps and text on the pages.',
    action: 'Compare visually',
  },
  'scan-enhance': {
    title: 'Enhance scans',
    description: 'Correct skew, increase contrast and clean up light backgrounds, with a preview.',
    action: 'Enhance scans',
  },
  'cover-toc': {
    title: 'Cover & table of contents',
    description:
      'Add a cover page and a clickable table of contents with automatically adjusted page numbers.',
    action: 'Create table of contents',
  },
  'mail-merge': {
    title: 'Form mail merge',
    description:
      'Fill PDF form fields with CSV or TSV records. Create an individual PDF for each row.',
    action: 'Create forms',
  },
  'qr-barcode': {
    title: 'QR & barcodes',
    description:
      'Read codes from PDF pages. Create QR, Code 128 or EAN-13 codes and place them in PDFs.',
    action: 'Edit codes',
  },
  'link-editor': {
    title: 'Edit links',
    description: 'Add, edit and remove links to websites, email addresses and PDF pages.',
    action: 'Save links',
  },
  'attachment-manager': {
    title: 'Manage attachments',
    description: 'Add, rename, replace and remove embedded files from the output.',
    action: 'Save attachments',
  },
  'camera-scan': {
    title: 'Camera scanner',
    description: 'Take photos, correct document perspective and combine multiple pages into a PDF.',
    action: 'Create scan',
  },
  'office-pdf': {
    title: 'Office to PDF',
    description: 'Save Word, Excel, PowerPoint and OpenDocument files as PDF.',
    action: 'Create PDF',
  },
  pdfa: {
    title: 'Create & check PDF/A',
    description: 'Create an archival copy of your PDF or check an existing PDF/A.',
    action: 'Process PDF/A',
  },
  'xrechnung-validate': {
    title: 'Validate XRechnung',
    description: 'Check an XRechnung against KoSIT rules and download the validation report.',
    action: 'Validate XRechnung',
  },
  'certificate-sign': {
    title: 'Certificate signatures',
    description: 'Sign PDFs with a PKCS#12 certificate and verify signatures.',
    action: 'Process signature',
  },
  protect: {
    title: 'Protect PDF',
    description: 'Encrypt PDFs with AES-256. Set an opening password and permissions.',
    action: 'Protect PDF',
  },
  unlock: {
    title: 'Unlock PDF',
    description: 'Save PDFs opened with a known password as unprotected copies.',
    action: 'Unlock PDF',
  },
  'invoice-read': {
    title: 'Read e-invoice',
    description:
      'Display UBL and CII invoices from XML or PDF attachments. Save them as a readable PDF, XML or CSV.',
    action: 'Read e-invoice',
  },
  'invoice-check': {
    title: 'Check e-invoice',
    description:
      'Check basic details, date formats and totals. A basic check with an exportable report.',
    action: 'Check e-invoice',
  },
  'fill-form': {
    title: 'Fill form',
    description: 'Fill in interactive PDF fields. Save as a fillable or flattened PDF.',
    action: 'Save form',
  },
  'create-form': {
    title: 'Create form',
    description: 'Place text fields, checkboxes and dropdown lists directly on your PDF.',
    action: 'Create form',
  },
  bookmarks: {
    title: 'Edit bookmarks',
    description: 'Structure chapters, indent them and link them to the appropriate pages.',
    action: 'Save bookmarks',
  },
  'extract-images': {
    title: 'Extract images',
    description: 'Save embedded images from selected pages as individual PNG files in a ZIP.',
    action: 'Extract images',
  },
  inspect: {
    title: 'Check & page finder',
    description:
      'Check your entire document bundle, search across all files and collect matching pages in a single PDF.',
    action: 'Save selection as PDF',
  },
  ocr: {
    title: 'OCR & text',
    description:
      'Extract text from scans. Correct the text and export it as Word, TXT or a searchable PDF.',
    action: 'Recognise text',
  },
  images: {
    title: 'Images to PDF',
    description: 'Fit JPG and PNG images proportionally onto A4 pages in a single PDF document.',
    action: 'Create PDF',
  },
  'to-images': {
    title: 'PDF to images',
    description: 'Export each selected page as JPG or PNG, together in a ZIP.',
    action: 'Export images',
  },
  compress: {
    title: 'Compress scans',
    description: 'Save image-based documents with reduced resolution and JPEG compression.',
    action: 'Compress',
  },
  merge: {
    title: 'Merge PDFs',
    description: 'Merge multiple files into one document. PDFs and images can be mixed.',
    action: 'Merge PDFs',
  },
  split: {
    title: 'Split PDF',
    description: 'Export each selected page as a separate PDF. All files in one ZIP.',
    action: 'Create individual pages',
  },
  organize: {
    title: 'Organize pages',
    description: 'Reorder, rotate, duplicate and remove pages. You can also insert blank pages.',
    action: 'Save pages',
  },
  numbers: {
    title: 'Page numbers',
    description: 'Number selected pages in their current order at the bottom centre.',
    action: 'Add numbers',
  },
  resize: {
    title: 'Page format',
    description: 'Fit pages proportionally to a uniform format. Preserve all content.',
    action: 'Adjust format',
  },
  nup: {
    title: 'Multiple pages per sheet',
    description: 'Arrange two or four document pages on one sheet.',
    action: 'Arrange pages',
  },
  'edit-text': {
    title: 'Edit PDF',
    description:
      'Edit PDF text and automatically recognise scans. Replace, add, move and format text.',
    action: 'Create edited PDF',
  },
  erase: {
    title: 'Remove content',
    description:
      'Remove text or image areas from the output, with a choice of fill colour and precise area selection.',
    action: 'Create cleaned PDF',
  },
  'insert-image': {
    title: 'Insert image',
    description:
      'Insert images and logos into existing pages, move them and resize them proportionally.',
    action: 'Create PDF with images',
  },
  redact: {
    title: 'Redact',
    description: 'Mark confidential areas and remove them from the exported page images.',
    action: 'Create redacted PDF',
  },
  crop: {
    title: 'Crop',
    description: 'Crop pages: remove margins or change the visible area while preserving text.',
    action: 'Crop',
  },
  annotate: {
    title: 'Text & annotations',
    description: 'Add text notes and highlight important passages.',
    action: 'Apply changes',
  },
  sign: {
    title: 'Signature',
    description: 'Draw your signature with a mouse or finger and place it in the document.',
    action: 'Insert signature',
  },
  watermark: {
    title: 'Watermark',
    description: 'Add a transparent text note centred on the pages.',
    action: 'Add watermark',
  },
  grayscale: {
    title: 'Grayscale',
    description: 'Convert colour pages into a new PDF with greyscale page images.',
    action: 'Convert to greyscale',
  },
  flatten: {
    title: 'Flatten PDF',
    description: 'Save pages as fixed images. Visible content is preserved.',
    action: 'Flatten PDF',
  },
  metadata: {
    title: 'Remove document info',
    description:
      'Remove title, author, subject, keywords, creator, date fields and XMP document information.',
    action: 'Remove document info',
  },
  compare: {
    title: 'Compare PDFs',
    description:
      'Compare text page by page or across pages. Detect moved text blocks and changed words.',
    action: 'Compare text',
  },
  'pdf-info': {
    title: 'PDF information',
    description: 'View a report of metadata, PDF version, file size and the formats of all pages.',
    action: 'Create report',
  },
  attachments: {
    title: 'Extract attachments',
    description: 'Save embedded file attachments from PDFs as a ZIP, such as invoice XML.',
    action: 'Extract attachments',
  },
  'split-ranges': {
    title: 'Split into sections',
    description: 'Create multiple documents using a fixed page count or custom page ranges.',
    action: 'Create sections',
  },
  interleave: {
    title: 'Interleave PDFs',
    description: 'Alternate fronts and backs from two files or two blocks within one PDF.',
    action: 'Interleave PDFs',
  },
  booklet: {
    title: 'Create booklet',
    description: 'Arrange pages as print sheets for a folded booklet. Blank pages are added.',
    action: 'Create booklet',
  },
  'split-grid': {
    title: 'Divide pages',
    description: 'Split each page into two, four or nine equally sized crops.',
    action: 'Create crops',
  },
  'auto-crop': {
    title: 'Remove white margins',
    description: 'Automatically detect white outer margins and trim them with adjustable spacing.',
    action: 'Remove margins',
  },
  bilevel: {
    title: 'Black & white scan',
    description: 'Convert scans to pure black and white with an adjustable threshold.',
    action: 'Convert to black and white',
  },
  invert: {
    title: 'Invert colors',
    description: 'Invert all page colours, for example to show light text on a dark background.',
    action: 'Invert colors',
  },
  stamp: {
    title: 'Add stamp',
    description:
      'Add a clearly legible stamp with custom text, an optional date and a chosen position.',
    action: 'Add stamp',
  },
  'edit-metadata': {
    title: 'Edit metadata',
    description: 'Set the title, author, subject and keywords for the output.',
    action: 'Save metadata',
  },
  'remove-annotations': {
    title: 'Remove annotations',
    description: 'Remove PDF comments, highlights and optionally links from selected pages.',
    action: 'Remove annotations',
  },
  overlay: {
    title: 'Overlay PDFs',
    description:
      'Place a template page with adjustable opacity in front of or behind the pages of a second PDF.',
    action: 'Create overlay',
  },
};
