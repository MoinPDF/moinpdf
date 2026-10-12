import type { WorkspaceTool } from './tool-catalog';

// UI copy only: tool identifiers and processing options are language independent.
export const englishTools: Record<
  WorkspaceTool,
  { title: string; description: string; action: string }
> = {
  'local-assistant': {
    title: 'Local PDF assistant',
    description:
      'Ask a local language model questions and check its original quotes on the PDF pages.',
    action: 'Answer locally',
  },
  'native-objects': {
    title: 'Edit PDF objects',
    description: 'Edit original text, reflow paragraphs, and adjust images and graphics.',
    action: 'Edit objects',
  },
  bates: {
    title: 'Bates numbering',
    description:
      'Number multiple PDFs continuously with case references, filenames, headers and footers.',
    action: 'Apply numbering',
  },
  'page-labels': {
    title: 'Page labels',
    description: 'Set Roman, alphabetic or custom page labels for document navigation.',
    action: 'Save labels',
  },
  'rotate-free': {
    title: 'Rotate freely',
    description: 'Rotate PDF pages by a custom angle.',
    action: 'Rotate pages',
  },
  'continuous-page': {
    title: 'Continuous PDF page',
    description: 'Combine pages into one long page.',
    action: 'Create continuous page',
  },
  'poster-print': {
    title: 'Poster printing',
    description: 'Split a large page into printable tiles.',
    action: 'Split poster',
  },
  linearize: {
    title: 'Fast web view',
    description: 'Optimize the PDF structure for progressive loading.',
    action: 'Optimize web view',
  },
  'svg-export': {
    title: 'PDF to vector SVG',
    description: 'Export PDF pages as vector SVG files.',
    action: 'Export SVG files',
  },
  'font-outlines': {
    title: 'Fonts to outlines',
    description: 'Convert text glyphs into vector outlines.',
    action: 'Create outlines',
  },
  'flatten-layers': {
    title: 'Flatten layers',
    description: 'Permanently reduce the PDF layers.',
    action: 'Flatten layers',
  },
  'structured-export': {
    title: 'PDF to structured JSON',
    description: 'Export document text and its locations as structured data.',
    action: 'Export JSON',
  },
  'form-responses': {
    title: 'Collect form responses',
    description: 'Read values from completed forms and review required fields.',
    action: 'Read form values',
  },
  chronology: {
    title: 'Document chronology',
    description: 'Find dates and arrange documents in chronological order.',
    action: 'Find dates',
  },
  'arithmetic-check': {
    title: 'Check calculations',
    description: 'Collect and check numbers in a PDF.',
    action: 'Collect numbers',
  },
  'pdf-sanitize': {
    title: 'Sanitize PDF',
    description: 'Review and remove active content from a PDF.',
    action: 'Review content',
  },
  'pdf-layers': {
    title: 'Manage PDF layers',
    description: 'Inspect layers and control which ones are visible.',
    action: 'Load layers',
  },
  'pdf-measure': {
    title: 'PDF measuring tool',
    description: 'Calibrate a scale and measure distances or areas.',
    action: 'Set measurement points',
  },
  'pdf-audio': {
    title: 'PDF to audio',
    description: 'Prepare document text for speech output.',
    action: 'Prepare reading text',
  },
  'number-compare': {
    title: 'Compare numbers',
    description: 'Find changes to amounts, dates and other numbers between versions.',
    action: 'Compare numbers',
  },
  'field-collector': {
    title: 'Collect document fields',
    description: 'Collect selected fields from multiple documents.',
    action: 'Collect fields',
  },
  'invoice-visual-check': {
    title: 'Compare invoice and XML',
    description: 'Compare visible invoice content with its structured XML.',
    action: 'Compare invoice',
  },
  'page-gaps': {
    title: 'Find missing pages',
    description: 'Check page numbering for possible gaps.',
    action: 'Find gaps',
  },
  'ocr-review': {
    title: 'Review OCR',
    description: 'Review uncertain words and correct recognized text.',
    action: 'Review OCR',
  },
  pseudonymize: {
    title: 'Pseudonymize files',
    description: 'Replace matching names with consistent placeholders across files.',
    action: 'Apply placeholders',
  },
  'attachment-links': {
    title: 'Link attachments',
    description: 'Connect attachment references to the corresponding documents.',
    action: 'Link attachments',
  },
  'best-scans': {
    title: 'Combine best scans',
    description: 'Choose the best pages from several scans.',
    action: 'Select scan pages',
  },
  'document-reconcile': {
    title: 'Reconcile business documents',
    description: 'Compare line items in quotes, orders and invoices.',
    action: 'Compare line items',
  },
  'comment-export': {
    title: 'Export comments as tasks',
    description: 'Collect document comments in a working list.',
    action: 'Collect comments',
  },
  'pdf-repair': {
    title: 'Repair PDF',
    description: 'Attempt to recover a damaged PDF.',
    action: 'Repair PDF',
  },
  'optimize-pdf': {
    title: 'Compress to target size',
    description: 'Optimize the PDF towards a chosen file size.',
    action: 'Optimize PDF',
  },
  'scan-split': {
    title: 'Split combined scans',
    description: 'Extract individual receipts or photos from a scan.',
    action: 'Create crops',
  },
  'pdf-markdown': {
    title: 'PDF to Markdown',
    description: 'Export readable document text as Markdown.',
    action: 'Create Markdown',
  },
  'pdf-html': {
    title: 'PDF to HTML',
    description: 'Export PDF text as an HTML document.',
    action: 'Create HTML',
  },
  'pdf-epub': {
    title: 'PDF to e-book',
    description: 'Export readable text as an EPUB e-book.',
    action: 'Create EPUB',
  },
  'ebook-pdf': {
    title: 'E-book to PDF',
    description: 'Convert an e-book to PDF.',
    action: 'Create PDF',
  },
  'pdf-powerpoint': {
    title: 'PDF to PowerPoint',
    description: 'Create PowerPoint slides from a PDF.',
    action: 'Create PowerPoint file',
  },
  'html-pdf': {
    title: 'HTML & web pages to PDF',
    description: 'Convert HTML content or a web page to PDF.',
    action: 'Create PDF',
  },
  'auto-orient': {
    title: 'Auto-orient pages',
    description: 'Detect page orientation and rotate scans.',
    action: 'Orient pages',
  },
  'book-dewarp': {
    title: 'Dewarp book scans',
    description: 'Correct distortion in scanned book pages.',
    action: 'Dewarp scan',
  },
  'form-detect': {
    title: 'Detect form fields',
    description: 'Identify potential form fields in a document.',
    action: 'Detect fields',
  },
  'redaction-check': {
    title: 'Check redactions',
    description: 'Inspect redactions for potentially remaining hidden text.',
    action: 'Check redactions',
  },
  'print-check': {
    title: 'Check print quality',
    description: 'Review document properties relevant to printing.',
    action: 'Check print quality',
  },
  'accessibility-check': {
    title: 'Check accessibility',
    description: 'Inspect the document for accessibility issues.',
    action: 'Check accessibility',
  },
  'translate-pdf': {
    title: 'Translate PDF',
    description: 'Translate readable text and export the original alongside its translation.',
    action: 'Translate PDF',
  },
  'zugferd-create': {
    title: 'ZUGFeRD assistant',
    description: 'Prepare an invoice with structured invoice data.',
    action: 'Process invoice',
  },
  'word-mail-merge': {
    title: 'Word mail merge',
    description: 'Create personalized Word documents from a template and data.',
    action: 'Create merged documents',
  },
  'split-size': {
    title: 'Split by file size',
    description: 'Split a PDF into files within a selected size limit.',
    action: 'Calculate split files',
  },
  'pdf-word': {
    title: 'PDF to Word',
    description: 'Convert PDF content into a Word document.',
    action: 'Create Word file',
  },
  'email-pdf': {
    title: 'Email to PDF',
    description: 'Convert email files to PDF.',
    action: 'Create PDF',
  },
  batch: {
    title: 'Batch processing',
    description: 'Apply the same operation to multiple files.',
    action: 'Process batch',
  },
  workflows: {
    title: 'Workflows',
    description: 'Combine repeatable processing steps in one workflow.',
    action: 'Run workflow',
  },
  'auto-rename': {
    title: 'Rename automatically',
    description: 'Suggest filenames based on document content.',
    action: 'Suggest names',
  },
  'smart-split': {
    title: 'Smart split',
    description: 'Find suitable boundaries for splitting a document.',
    action: 'Find split points',
  },
  'table-export': {
    title: 'Table to Excel',
    description: 'Extract a document table for use in a spreadsheet.',
    action: 'Detect table',
  },
  'search-redact': {
    title: 'Search & redact',
    description: 'Find text matches and prepare redactions.',
    action: 'Find matches',
  },
  'visual-compare': {
    title: 'Visual PDF comparison',
    description: 'Compare the visual appearance of PDF pages.',
    action: 'Compare visually',
  },
  'scan-enhance': {
    title: 'Enhance scans',
    description: 'Improve the appearance and readability of scans.',
    action: 'Enhance scans',
  },
  'cover-toc': {
    title: 'Cover & table of contents',
    description: 'Add a cover page and a table of contents.',
    action: 'Create contents',
  },
  'mail-merge': {
    title: 'Form mail merge',
    description: 'Fill a form with multiple sets of data.',
    action: 'Create forms',
  },
  'qr-barcode': {
    title: 'QR & barcodes',
    description: 'Work with QR codes and barcodes.',
    action: 'Edit codes',
  },
  'link-editor': {
    title: 'Edit links',
    description: 'Manage clickable links in the document.',
    action: 'Save links',
  },
  'attachment-manager': {
    title: 'Manage attachments',
    description: 'Add or remove embedded files.',
    action: 'Save attachments',
  },
  'camera-scan': {
    title: 'Camera scanner',
    description: 'Capture a document with the camera and adjust its crop.',
    action: 'Create scan',
  },
  'office-pdf': {
    title: 'Office to PDF',
    description: 'Convert an Office document to PDF.',
    action: 'Create PDF',
  },
  pdfa: {
    title: 'Create & check PDF/A',
    description: 'Convert or validate documents for PDF/A archiving.',
    action: 'Process PDF/A',
  },
  'xrechnung-validate': {
    title: 'Validate XRechnung',
    description: 'Validate a structured XRechnung invoice.',
    action: 'Validate XRechnung',
  },
  'certificate-sign': {
    title: 'Certificate signatures',
    description: 'Work with certificate-based digital signatures.',
    action: 'Process signature',
  },
  protect: {
    title: 'Protect PDF',
    description: 'Protect a PDF with a password.',
    action: 'Protect PDF',
  },
  unlock: {
    title: 'Unlock PDF',
    description: 'Remove password protection when you have permission and the required password.',
    action: 'Unlock PDF',
  },
  'invoice-read': {
    title: 'Read e-invoice',
    description: 'View the content of a structured electronic invoice.',
    action: 'Read e-invoice',
  },
  'invoice-check': {
    title: 'Check e-invoice',
    description: 'Check electronic invoice fields and totals.',
    action: 'Check e-invoice',
  },
  'fill-form': {
    title: 'Fill form',
    description: 'Complete existing interactive form fields.',
    action: 'Save form',
  },
  'create-form': {
    title: 'Create form',
    description: 'Add interactive form fields to a PDF.',
    action: 'Create form',
  },
  bookmarks: {
    title: 'Edit bookmarks',
    description: 'Create and organize document bookmarks.',
    action: 'Save bookmarks',
  },
  'extract-images': {
    title: 'Extract images',
    description: 'Save images embedded in a PDF.',
    action: 'Extract images',
  },
  inspect: {
    title: 'Check & page finder',
    description: 'Inspect a document, find text and collect selected pages.',
    action: 'Save selection as PDF',
  },
  ocr: {
    title: 'OCR & text',
    description: 'Recognize text in scanned pages.',
    action: 'Recognize text',
  },
  images: {
    title: 'Images to PDF',
    description: 'Combine image files into a PDF.',
    action: 'Create PDF',
  },
  'to-images': {
    title: 'PDF to images',
    description: 'Export PDF pages as image files.',
    action: 'Export images',
  },
  compress: {
    title: 'Compress scans',
    description: 'Reduce the size of scanned documents.',
    action: 'Compress',
  },
  merge: {
    title: 'Merge PDFs',
    description: 'Combine multiple PDFs into one document.',
    action: 'Merge',
  },
  split: {
    title: 'Split PDF',
    description: 'Export individual pages as separate PDF files.',
    action: 'Create individual pages',
  },
  organize: {
    title: 'Organize pages',
    description: 'Reorder, rotate or remove pages.',
    action: 'Save pages',
  },
  numbers: {
    title: 'Page numbers',
    description: 'Add visible page numbers to a PDF.',
    action: 'Add numbers',
  },
  resize: {
    title: 'Page format',
    description: 'Change the paper size or page orientation.',
    action: 'Adjust format',
  },
  nup: {
    title: 'Multiple pages per sheet',
    description: 'Arrange several PDF pages on each sheet.',
    action: 'Arrange pages',
  },
  'edit-text': {
    title: 'Edit text',
    description: 'Add or replace text on document pages.',
    action: 'Create edited PDF',
  },
  erase: {
    title: 'Remove content',
    description: 'Remove selected areas from a document.',
    action: 'Create cleaned PDF',
  },
  'insert-image': {
    title: 'Insert image',
    description: 'Place an image or logo on a PDF page.',
    action: 'Create PDF with images',
  },
  redact: {
    title: 'Redact',
    description: 'Redact selected confidential content.',
    action: 'Create redacted PDF',
  },
  crop: { title: 'Crop', description: 'Crop the visible area of PDF pages.', action: 'Crop' },
  annotate: {
    title: 'Text & annotations',
    description: 'Add text, highlights and annotations.',
    action: 'Apply changes',
  },
  sign: {
    title: 'Signature',
    description: 'Draw or add a visual signature.',
    action: 'Insert signature',
  },
  watermark: {
    title: 'Watermark',
    description: 'Add a watermark to document pages.',
    action: 'Add watermark',
  },
  grayscale: {
    title: 'Grayscale',
    description: 'Convert page appearance to grayscale.',
    action: 'Convert to grayscale',
  },
  flatten: {
    title: 'Flatten PDF',
    description: 'Fix page appearance in a flattened PDF.',
    action: 'Flatten PDF',
  },
  metadata: {
    title: 'Remove document info',
    description: 'Remove metadata from a document.',
    action: 'Remove document info',
  },
  compare: {
    title: 'Compare PDFs',
    description: 'Compare the text of two PDF documents.',
    action: 'Compare text',
  },
  'pdf-info': {
    title: 'PDF information',
    description: 'Create a report about document properties.',
    action: 'Create report',
  },
  attachments: {
    title: 'Extract attachments',
    description: 'Download files embedded in a PDF.',
    action: 'Extract attachments',
  },
  'split-ranges': {
    title: 'Split into sections',
    description: 'Export selected page ranges as separate documents.',
    action: 'Create sections',
  },
  interleave: {
    title: 'Interleave PDFs',
    description: 'Combine pages from documents in alternating order.',
    action: 'Interleave',
  },
  booklet: {
    title: 'Create booklet',
    description: 'Arrange pages for booklet printing.',
    action: 'Create booklet',
  },
  'split-grid': {
    title: 'Divide pages',
    description: 'Split pages into several cropped sections.',
    action: 'Create crops',
  },
  'auto-crop': {
    title: 'Remove white margins',
    description: 'Trim unused white page margins.',
    action: 'Remove margins',
  },
  bilevel: {
    title: 'Black & white scan',
    description: 'Convert scans to pure black and white.',
    action: 'Create black & white',
  },
  invert: {
    title: 'Invert colors',
    description: 'Invert the colors of PDF pages.',
    action: 'Invert colors',
  },
  stamp: {
    title: 'Add stamp',
    description: 'Place a stamp on document pages.',
    action: 'Add stamp',
  },
  'edit-metadata': {
    title: 'Edit metadata',
    description: 'Update title, author and other document information.',
    action: 'Save metadata',
  },
  'remove-annotations': {
    title: 'Remove annotations',
    description: 'Remove document comments and annotations.',
    action: 'Remove annotations',
  },
  overlay: {
    title: 'Overlay PDFs',
    description: 'Combine document pages with a PDF overlay.',
    action: 'Create overlay',
  },
};
