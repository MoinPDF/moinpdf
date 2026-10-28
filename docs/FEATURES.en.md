# Features and limitations

Change colors & background offers custom text/background colors with text preservation, plus brightness, contrast and saturation as image output. It includes previews, presets and saved project drafts. Form helper unlocks selected read-only fields while keeping their values. Cropping can change only the visible area; hidden content remains in the file. Interleave also collates front/back blocks within one PDF, with a split position and page-order preview.

<!-- generated-capabilities:start -->
**Current implementation limits · 0.25.1**

| Capability | Value |
| --- | --- |
| Active source files | 80 MiB |
| Active pages | 200 |
| OCR | 21 languages; up to 8 combined |

Generated from the application constants when building the documentation.
<!-- generated-capabilities:end -->

[Deutsch](FUNKTIONEN.md) · **English** · [← README](../README.en.md)

This overview explains tools, output formats and technical limitations. Open **Documentation** in the app for the searchable handbook with step-by-step instructions. For the complete installation, see [Docker](../DOCKER.en.md).

## redaction, large PDFs and recognition rules

- **Text-preserving redaction:** Manual regions and search matches can remove complete, simple digital text objects while preserving remaining text and vectors. Page geometry, remaining text, links and rendered views are checked before export. Document metadata and unused resources are removed. Unsupported structures block export; the existing image mode remains an explicit choice.
- **Large PDFs:** Dedicated workspace for files up to 256 MB and 1,000 pages, with rotation, lossless optimization and OCR. File-backed reading, sections of at most 50 pages, atomic local checkpoints and resume after cancellation. Sections can be edited in the standard editor and replaced with the same page count. Every final page is checked against its verified section. The standard editor retains its 80 MB / 200 active-page limits.
- **Clear Deck:** Up to 30 explicitly saved local layout rules for sender, document number and date. Recurring documents receive suggestions; conflicting rules and uncertain OCR remain visible. Unambiguous suggestions can be confirmed together after review.

Large jobs and recognition rules remain unencrypted in this browser until deleted; project archives do not include them. Large PDFs containing forms, signatures, internal destinations, bookmarks, attachments or structure tags are rejected upfront. Up to 768 MB of saved jobs and 256 MB of final output; document metadata is not carried into the assembled output. A desktop browser is recommended.


## New in 0.21.0

Shared PDF export verification checks readability and known page counts. With source-page mapping it compares dimensions, links and form fields; tools that preserve text also check original text. Verification covers up to 200 pages and 100,000 characters per page. Findings require explicit review; unreadable results cannot be downloaded. Encrypted PDF output is labelled as not content-verified. This is not a complete visual comparison.

Project snapshots and archives support optional password encryption with a minimum of twelve characters. Export review lists included source files and earlier edits. Flattened handoff exports visible page images up to 2800 pixels without source files, attachments or project history. Searchable text, links, interactive forms and certificate signatures are not retained. Visible confidential information remains visible. Browser storage is still unencrypted.

Projects includes storage usage, an explicit persistent-storage request and offline packages. Offline use requires HTTPS or localhost, a supported browser and a completed download of the app and selected languages/runtimes. Every program file is integrity-checked. Updates activate once all older app tabs close. Server tools still need the user's document server. Removing offline files does not delete projects or results.

Unfinished offscreen previews are cancelled immediately so newly visible pages do not have to wait. Completed preview images are released after a short retention period. OCR allows at most two main workers on devices reporting at least 8 GB memory and eight logical cores, otherwise one. Language probes can use a separate short-lived worker. Input size and active page limits are not raised without additional load-test evidence.

Physical iPhone/iPad/Android/Windows touch devices and native Microsoft Word roundtrips remain separately pending; browser automation is not evidence of those checks. See the [device checklist](quality/editor-device-checklist.md).


## Clean up headers and footers

Recurring extractable margin text is suggested at similar positions on at least two pages. Headers and footers are selected separately, with search margins of 3–25%. Changing page numbers can be grouped. Exclude individual matches and review them against the original; cleanup preview shows white removal areas. Image-only scans and individual pages support manual areas within the top or bottom quarter, on the current page or at the same relative position on all pages.

Export actually removes content, including images and lines inside confirmed areas and fully enclosed links. Partially enclosed text lines or links, overlapping comments/form fields and conflicting exceptions block export. Remaining extractable text, page count, visible page sizes and remaining annotations are independently checked. Up to 200 pages, 2,000 matches and 80 MB. No automatic OCR for image-only scans. Signed PDFs and dynamic XFA are rejected. Attachments, metadata and accessibility tags are not specifically cleaned; this does not replace full anonymisation. Drafts are saved in projects; review must be confirmed again after changes.

## Form helper and receipts on A4

**Form helper** stores up to ten profiles locally on explicit save. Exact field labels suggest values for empty text fields; existing values and ambiguous labels are kept unchanged. Manually assign details or place transparent text fields on scans. Review the original before export. Optional flattening makes values permanent. Profiles stay unencrypted in browser storage and are separate from project exports; form drafts are retained in projects. Signed PDFs and dynamic XFA are rejected. New text that does not fit or uses unsupported characters blocks export.

**Collect receipts on A4** crops individual receipts from photos or PDFs, including several crops from one scan. Choose order, captions, numbering and print widths of 30–190 mm. The A4 preview uses the export layout. Long receipts are split into numbered parts at the selected width; excessively wide items require correction. Export uses cropped page images, without original text layers, links, forms, attachments or signatures. Up to 200 receipts, 400 placed parts and 80 MB of output; crops are rendered at up to about four megapixels. Print at 100% / Actual size. Crops and layout are saved in projects.

## Browser and document server

Many tools run locally in the browser. The complete Docker installation adds an automatically connected document server. Server jobs start only when you press the respective action button. The PDF editor automatically prepares visible pages and recognises scans locally.

The browser edition offers three local PDF-to-Word modes: page layout with images and text boxes, flowing text with recognized tables and images, and plain paragraphs. Standard compression preserves PDF content and reduces compatible scan images; the target-size tool also reduces image resolution and JPEG quality locally. Advanced conversions and validation require the corresponding server components; see the [server documentation](../server/README.en.md).

## Pages, editing and OCR

- Check & page finder: cross-file text search, local scan recognition, matching pages exported as a new PDF; hints for scan pages, possible blank pages, visually identical pages and mixed paper sizes
- OCR & text: 21 languages, up to eight combined, with optional automatic language sampling; automatic page segmentation, text block, column, line or sparse text; editable OCR lines beside the PDF preview and corrections applied to the PDF search layer
- JPG, PNG, WebP, BMP, multipage TIFF, HEIC/HEIF, PSD and standalone SVG to PDF as image pages; PDF to PNG/JPG/WebP/TIFF/BMP in a ZIP
- Compression preserving content, lossless optimization or explicitly selected page images; comparison at shared zoom
- Merge; individual pages as PDFs in a ZIP
- Organise pages: select, reorder, rotate, duplicate, remove and add blank pages
- Page numbers, cross-file Bates numbering with headers/footers and internal page labels
- Arbitrary rotation angles, continuous long pages and poster printing with overlap
- Paper size: A4 or US Letter, portrait and landscape
- Multiple pages per sheet: 2 or 4 pages
- Redaction
- Cropping
- Text notes and green highlights
- Drawn signatures
- Watermarks
- Greyscale
- Flatten PDF to page images
- Remove document information
- Edit PDF with automatic scan OCR, remove content and insert images
- Edit original objects: text in the existing font, per-page find/replace, image replacement, moving/rotating/scaling/deleting objects; paragraph mode for multiple text objects, mixed formatting, shaping, flow onto additional pages, preview and overflow checks; open and edit individual objects in nested groups while keeping reused instances independent
- Linearisation for fast web viewing; structured JSON export with text positions
- PDF information and text comparison between two PDFs
- Split into sections, alternate merging, booklets and page splitting
- Remove white margins, black-and-white scans and colour inversion
- Stamps, metadata editing, annotation removal and PDF overlays
- Extract file attachments and embedded images
- Fill/create forms and edit bookmarks
- Protect PDFs with AES-256 and unlock using a known password
- Read e-invoices and run a basic check; UBL, UBL credit notes and CII from XML or embedded PDF attachments

Drop PDFs, invoice XML and supported image formats anywhere in the window. Change page order using drag-and-drop or arrows. Draw or place visual regions directly, or enter percentages. Undo/redo up to 30 working states, including adopted results and page and region changes with Ctrl/⌘ + Z and Ctrl/⌘ + Shift + Z. Adding or closing files starts a new history.

Results can be adopted as new working documents. OCR exports searchable PDF, TXT and DOCX; DOCX contains text without reconstruction of the original layout. Page tools apply pending visual changes on the selected pages. Switching to specialist tools applies the current workspace; potentially lossy structural transitions require an explicit choice. Adopting results retains undo history.

**Projects** locally restore files and working states, including editing history, forms and bookmarks, from the last five saved states. Storage is unencrypted browser storage; the current session is saved before switching projects. The latest ten results are saved locally up to 160 MB in total, and the workspace is automatically saved for recovery after reloading. A chosen state can be transferred as an optionally password-encrypted `.moinpdf` file including originals and history, using “Download project file” or “Open project file”. Project files are not sanitised final PDFs. Limits: 80 MB of active source files, 200 active pages and 240 MB including undo history. Extensive OCR can be slow on mobile devices.

## Website link to PDF

“HTML & websites to PDF” accepts a public website address. A separate web converter in the complete Docker installation renders images, fonts, CSS and publicly loadable JavaScript content. Choose A4/Letter, portrait/landscape, backgrounds and screen/print rendering. Download the result or continue editing it directly.

The fetch does not inherit your browser login or cookies. Cookie banners, bot protection and protected or highly dynamic content may produce different results. Private network addresses and non-standard ports are blocked. Saved HTML/HTM files remain available as simplified text conversion without images, scripts or CSS.

## Clear Deck

Under **Batch**, Clear Deck proposes groups for invoices and letters using document references, senders, dates and printed page numbering. Three steps cover local reading with scan OCR, original-page review and export. Each document must be confirmed. Users can edit metadata and filenames, reorder documents and pages, move pages to another or a new document, and explicitly exclude or restore pages.

Visually matching preview pages are flagged as possible duplicates and never removed automatically. Gap warnings refer only to printed page numbering. Uncertain boundaries remain review notes; this is not general semantic classification or a completeness guarantee. Export individual PDFs plus an assignment manifest in a ZIP, or a combined PDF with linked contents and bookmarks. Original pages are copied; scans remain image pages. Form values are flattened; original signatures, bookmarks and attachments are not retained. Assignments persist across tool switches and project files.

## Batches, workflows and more formats

- Batch processing and saved multistep workflows with JSON import/export, if/else steps based on file name, existing text or page count, and a decision log. Passwords and documents are not stored in workflows.
- Automatic file-name suggestions from dates, invoice numbers and titles, with an editable preview.
- Split by text, bookmarks, blank pages or QR/barcode separator sheets, with section previews.
- Table regions to Excel/CSV, OCR for scans, manual column boundaries and editable cells. Multi-page extraction supports repeated headers, per-column types, German/English number formats, typed numbers and dates; identifiers and formulas remain text. CSV protects against formula execution.
- Search for supplied terms/names, email addresses and possible IBANs; confirmed matches are removed by fully rebuilding page images. Detection does not guarantee completeness.
- Pixel-based PDF comparison with coloured differences and a percentage for each page.
- Scan enhancement with automatic deskewing, contrast, brightness and background cleanup.
- Cover page, clickable table of contents and bookmarks with adjusted page numbers.
- Batch forms from CSV/TSV with field mapping, named individual outputs in a ZIP and optional flattening.
- Create and place QR, Code 128 and EAN-13 codes; read common QR/barcode formats.
- Add, edit and remove internal/external PDF links; previews and coordinates support rotated pages.
- Add, replace, rename and remove attachments; QPDF cleans up unreferenced embedded file streams.
- Camera/photo scanner with four-point perspective correction, scan cleanup and up to 50 collected pages.
- Further tools in the **complete installation**: server-based Office to PDF, PDF/A creation/validation, full KoSIT XRechnung validation and server-based certificate signatures. [Server setup and limitations](../server/README.en.md). Standard Office formats and basic certificate signing also have local browser modes; see [Implementation status](STATUS.en.md).

## Checks with source references

These browser tools connect detection, an original-document preview and export:

| Tool | Scope and limitations |
| --- | --- |
| Number comparison | Match amounts, dates, percentages and possible IBANs using their row labels. Ambiguous rows remain unresolved. |
| Collect receipt fields | Search custom labels across files, correct values and export to XLSX/CSV with source references and review status. |
| Compare invoice and XML | Read visible pages using OCR and compare selected details with embedded UBL/CII. Unrecognised values remain unresolved; this is not an authenticity check. |
| Find document gaps | Check printed numbering such as “Page 3 of 7”. Separate files containing different numbering sequences first. |
| OCR correction assistant | Review words with OCR confidence and a source crop; export corrected TXT or a new PDF with corrected search text. Visible pages remain images. |
| Pseudonymisation | Replace explicitly supplied terms across files with consistent placeholders. Supply all spelling variants and review matches. Undetected details remain visible. |
| Link appendices | Detect references and appendix headings, review or manually select targets, and produce a merged PDF with internal links. Export unresolved references. |
| Best scan pages | Evaluate similarity, sharpness, contrast and edge content; confirm, supplement and reorder the selection per page. Preserve original pages without recompressing images. |
| Quote/order/invoice | Detect simple line items, correct them manually and compare quantities/prices/amounts. Align units, currency and pricing basis first. |
| Comments as a task list | Read actual PDF annotations with author, page and text excerpt; edit tasks and export to XLSX/CSV/Markdown. Burned-in comments cannot be extracted. |

These tools do not process document data outside the browser. OCR uses bundled German and English language data and may take longer for large batches. Analysis and scan comparison are limited to 400 pages in total. Pseudonymisation carries over neither the original text layer nor attachments; the confidential mapping is available only as a separate export. PDFs are output as new files. Modified PDFs do not retain a valid original digital signature.

## Forms, chronology, measurements and audio

| Tool | Behaviour and output |
| --- | --- |
| Analyse returned forms | AcroForm fields across files, checkboxes and selection values; required-value checks, corrections with original values, Excel/CSV as a matrix or detailed table. XFA and image-only scans are marked incomplete. |
| Order documents chronologically | Date references from text/OCR, explicit confirmation, manual ordering, PDF with a clickable table of contents and bookmarks; forms are flattened. |
| PDF arithmetic check | Mark a number column, correct/deselect terms, German/English number formats, exact decimal arithmetic up to six decimal places; annotated PDF with a calculation log and CSV. |
| PDF security cleanup | Remove active actions, scripts, XFA and media; optionally attachments, comments and metadata. Discard unreferenced data and then structurally check the output. Not a virus scan. |
| Manage PDF layers | Actual optional PDF layers with previews and mutually exclusive choices. Export the selected view as page images; hidden content and original search text are not retained. |
| PDF measuring tool | Reference distance per page, lengths and simple polygon areas; self-intersecting areas are rejected. Labelled PDF with calibration log and CSV, including rotated pages. |
| PDF audiobook | Local OCR, editable narration text, sections by page or main bookmark; Thorsten/Kerstin for German and LJ for US English, independent narration language, speaking speed and voice preview. WAV or chapter ZIP with playlist. Audio export requires the complete Docker installation. |

Speech generation uses installed models verified with SHA-256 and runs without a cloud service during processing. Only the selected narration text is sent to the integrated document server. Limits: 20,000 characters and 100 sections per job, with at most three minutes of processing. Cancelling the browser request does not immediately stop an already running server job. The browser edition can save narration text as TXT without a server. Licences and model versions: [Audio notices](../server/AUDIO-NOTICES.md).

## Conversion and advanced checks

Use the shortcuts, search or “All tools” to find tools grouped by task. Long tool names wrap inside their cards on narrow screens. The overview is accessible without opening a PDF first.

| Tool | Runs in | Scope |
| --- | --- | --- |
| Split by file size | Browser | Actual measured bytes per PDF, complete page order, ZIP; oversized single pages are reported |
| PDF to Word | Browser / Server | Locally: page layout with images and text boxes, flowing text with recognised grid tables and images, or plain paragraphs. The server reconstructs digital pages using pdf2docx and converts pages without extractable text into editable paragraphs using OCR. |
| PDF to PowerPoint | Server | One rendered page per slide by default; optional editable text with style and position. Complex layouts may differ. |
| Emails to PDF | Server | EML/MSG, Unicode headers and message body; unchanged attachments with unique names in a ZIP |
| HTML & websites to PDF | Server | Saved HTML with headings and tables without scripts/external resources; public website links use the separate Chromium service described above |
| Auto-orient pages | Server | Tesseract OSD, 90/180/270 degrees, minimum confidence and a per-page report |
| Dewarp book scans | Server | Adjustable quadratic column correction on the left/right, new page images |
| Detect form fields | Server | Empty rectangles, lines and scan contours; edit generated fields afterwards |
| Check redactions | Server | Text search, metadata and suspicious dark vector overlays; no security certification |
| Check print quality | Server | Image resolution, font embedding and page boxes; no PDF/X certification |
| Check accessibility | Server | Basic checks, veraPDF for PDF/UA-1/-2; structure editor for new PDF/UA-1 documents with verified output; manual content review remains necessary |
| Translate PDF | Server + your own LibreTranslate service | Extractable text and translation side by side, or translation at original positions with overflow checks; up to 60,000 characters |
| ZUGFeRD wizard | Server | Combine PDF/A-3 and matching CII XML; Mustang and veraPDF reports clearly identify negative findings |
| Word mail merge | Server | DOCX with {{ColumnName}} and XLSX; up to 50 records, individual PDFs in a ZIP |

Advanced converters are part of the complete Docker installation, which sets up LibreTranslate automatically. Separate server deployments must connect it themselves. Saved HTML import is not live URL browsing. Book correction and document checks have the specific limitations described here.

## Behaviour and limitations

- Edit PDF: type directly in paragraphs and choose among 14 local families with 56 faces; reuse original fonts, sizes, bold/italic and colours from digital text. Embedded subsets may lack new characters; substitutions are shown. Scan fonts are estimates. Verified original object edits retain unchanged vectors; otherwise an image fallback is reported. Overflow and collisions with other text block export.

- Check and page finder inspect imported pages. Apply pending visual changes and continue with the result first. Scan recognition in the page finder creates only a local search index; use OCR for a permanently searchable PDF. Comma-separated search terms are treated as alternatives, each at least two characters long.
- Blank-page and duplicate detection provide hints based on text, page images and page size. Small differences may not appear in the preview. Deselecting a page only removes it from the export selection and can be undone.
- In image mode, redactions are applied last to the rendered pixels of affected pages. A new page contains only this modified image; original page objects and text layers are not retained. Other pages remain unchanged. Review results before sharing.
- Cropped pages are rebuilt from the cropped pixel region, removing content outside it. Redaction, cropping, greyscale and flattening limit the longest raster dimension to 2800 pixels and the maximum scale factor to 4.2.
- Text notes, highlights and signatures preserve existing text unless a raster tool is used on the same page. Drawn signatures are inserted images, not certificate signatures. Text notes support Latin script, including umlauts. Apply visual changes before rotating, then continue with the result.
- Removing document information deletes the Info dictionary and document/page XMP. It does not anonymise visible content, comments, images or embedded object data.
- “OCR & text” uses existing readable text and automatically recognises scan regions on mixed pages. “Recognise all pages again” replaces existing OCR results; visible original text is preserved and locked in the OCR correction view. Edited lines are available for TXT, DOCX and clipboard output. Before downloading or continuing with the PDF, choose “Apply corrections” to update its search layer too. The visible page image stays unchanged; use “Edit PDF” for visible text changes.
- “Compress scans” defaults to “Preserve content, reduce images”: text, vectors, links and form fields are retained while compatible color and grayscale scan images are reduced individually. “Optimize losslessly” does not change image pixels. Only “Rebuild pages as images” removes copyable text, links and form functionality. Use a complete single PDF for forms, bookmarks or tags; signed PDFs are rejected. No mode guarantees a smaller file.
- Exports produce new files. Page-based exports may flatten form fields and lose document-wide features such as bookmarks. Form and bookmark tools preserve each other's document features; protect/unlock preserves pages, forms, bookmarks and attachments. Changes may invalidate existing digital signatures.
- Protected PDFs are decrypted locally after a password prompt. Opening protection uses AES-256; print/copy/edit restrictions also depend on the PDF viewer. Passwords are not stored permanently.
- E-invoices: at most 5 MB per XML file and 2,000 line items. The basic check covers essential details, date/number formats and selected totals, not full XSD, EN-16931, KoSIT, Peppol or PDF/A compliance. Line items that cannot be calculated are flagged. Payment terms remain visible without separate bank details. The reading PDF and check report attach the unchanged XML; they are not certified ZUGFeRD or PDF/A files.
- Resources and OCR language data come from the same origin. Hosting access and hosting login are independent of local document processing.
- Optional WebMCP tools register only when `document.modelContext` exists. This interface is absent in the HTTP preview browser; the UI works independently of it.

## Historical additions in 0.7.0

These entries describe their release at the time. Current OCR supports up to eight languages and optional language sampling, as described above.

- **OCR and scan search:** Combine up to four of the 21 locally served languages. No automatic language detection at that release; additional languages require more RAM.
- **Compare PDFs:** Alongside per-page comparison, a mode compares content across pages. Reports show word changes, source pages and moved text blocks. Duplicate or ambiguous matches are flagged; use visual comparison for images and formatting. TXT export contains every entry, including those hidden in the interface.
- **Project files:** A working state with undo history, sources and invoice XML; up to 80 MB of document data and 20 MB of editing data. Existing PDFs are actually opened during import and page references checked.

## Historical additions in 0.8.0

- Paragraph editor in “Edit PDF objects”: replace multiple text objects, automatic wrapping, Noto Sans or your own static TTF, size, colour, alignment, padding and line spacing; a real output preview. Missing glyphs, text overflow and protruding glyph outlines block export.
- Paragraphs support mixed formatting, continuation pages and complex shaping with HarfBuzz. Text inside object groups is excluded from paragraph mode. Other objects are preserved. Check existing signatures and structure tags after text edits.
- “Check accessibility” adds real veraPDF profiles for PDF/UA-1 and PDF/UA-2. Build new documents from headings, paragraphs and images with alternative text. Edit the reading order and save/import structure files locally.
- The document server produces the structured A4 version with LibreOffice and validates it with veraPDF. A failed check returns reports only, without PDF output. Machine validation does not replace reviewing meaning, completeness, reading order and contrast.
- PDF text import is a draft and does not preserve the original page layout, tables, images, forms or signatures. This feature is not automatic retrospective repair of arbitrary existing PDF tags.

---

[README](../README.en.md) · [Installation](../DOCKER.en.md) · [Development](DEVELOPMENT.en.md)

- Target size: Local image resizing with measured results, a percentage bar, stage/image counters and cancellation. The desktop workspace remains readable on wide monitors. Masked images, 1-bit scans, images above 40 megapixels and unsupported color spaces remain unchanged; unattainable targets are explicitly reported.
