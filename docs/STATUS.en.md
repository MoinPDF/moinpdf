# Implementation status

[Deutsch](AUSBAUSTAND.md) · **English** · [← README](../README.en.md)

As of 18 October 2026, version 0.15.2.

“New document”, beside “Projects”, opens a local document editor with rich text,
images, tables, page settings, headers, footers and page numbers. Drafts are saved
in this browser and can be transferred as editable .moindoc files. The responsive
writing view and actual PDF page preview are separate; PDF exports contain selectable
text. Creation and draft import also work on local HTTP installations.

Tool navigation restores the previous category, search, scroll and focus. Duplicate
uploads are detected by their contents. Results show format, size and known page
counts, allow filename editing and support native file sharing when available.

The entire language catalogue, originally 4,513 entries, has been reviewed. Around 2,000 translations were improved; missing UI messages and app-owned text in reports and document outputs were added. Regression tests check original data, form values, embedded invoices and language coverage.

The interface includes 22 fully visible header images, six shortcuts, a document overview and a mobile action bar in the shared PDF workspace. On desktop, the header image is limited to 640 pixels; its mobile presentation is unchanged. Tool cards and icons remain still. The project button uses a subtle white/green design. Working states without pages also offer undo and redo. The tool sidebar starts collapsed. The header and upload area retain their existing layout and colours; compression offers Gentle, Balanced and As small as possible. The handbook is available in German and English. Sample PDFs are generated in the selected app language. Evidence for technical features is recorded in the corresponding verification runs; a version number does not replace a functional check.

This overview describes the actual scope. The original 22-area plan is not yet fully complete. Unsupported conversions and validation standards are not presented as available.

| Area | Implemented | Notes and remaining limits |
| --- | --- | --- |
| 1. Native text editor | Original objects and paragraphs; local font library, browser spellcheck, lists, superscript/subscript and paragraph find/replace; up to 32 formatting ranges with font, size and colour; ligatures and combining characters; automatic continuation pages; real previews and overflow checks | HarfBuzz with 14 additional Noto fonts, Arabic/Hebrew and mixed-direction text, original text within groups. Missing font files and arbitrary unusual fonts remain document-dependent. |
| 2. Images and graphics | Multiple selection, alignment, distribution, mirroring, duplication, vector groups; move, rotate, scale, replace, delete and reorder objects; direct handles with keyboard controls | Open nested groups individually up to 16 levels; unsupported graphics types and conflicting inherited graphics states are rejected. |
| 3. Local Office to PDF | Pinned LibreOffice WASM core in the browser, plus LibreOffice on your own document server | Low-memory mobile devices and general layout fidelity; scope in [Browser Office](BROWSER-OFFICE.en.md). |
| 4. PDF to Office | Word reconstruction, table export and editable PowerPoint text boxes with style and position | General faithful reconstruction of complex tables and layouts. |
| 5. OCR | 21 locally served models; up to eight together; automatic language sampling per scan page with deliberate rejection of short or unclear text | Complete language recognition for handwriting, very short text and arbitrary language mixtures is not guaranteed. |
| 6. Import formats | HEIC/HEIF and PSD in a local worker, WebP, BMP, multipage TIFF, SVG; Pages 4/5, Visio and Publisher through LibreOffice; integrity, format and size checks | SVG imports become image pages; PSD layers are not imported as editable PDF layers. |
| 7. Export formats | WebP, TIFF, BMP, JSON with positions and actual SVG vector export | SVG vector export requires the document server. |
| 8. Workflows | Freely arranged nodes, nested yes/no branches, templates, rotate, reverse, form flattening, lossless optimisation, import/export and decision logs; cycle and unreachable-node checks | Continuous background processing of large batches. |
| 9. XFA | Separate data editor for simple pure-XFA packet forms with read-back checks; detection before form processing; rejection of lossy form/page adoption; bookmark edits preserve XFA packets; clear notices | Full dynamic XFA rendering, editing and reliable export. |
| 10. Layers | Edit names and visibility; permanently flatten visible layers; change page-object drawing order | Creating layer contents and moving arbitrary objects between layers. |
| 11. Numbering | Cross-file Bates numbering, multiple independent header/footer rules, page ranges and internal page labels; overlap checks | Arbitrary nested section structures. |
| 12. Signatures | Local PKCS#12/CMS signing without upload; server-side PAdES-T/LT/LTA, strict offline revocation checking, embedded DSS evidence and document-timestamp renewal | Operators must provide a timestamp service, controlled connectivity, trust anchors and revocation evidence; qualified signature status is not claimed. |
| 13. Page tools | Arbitrary angles, long pages, poster printing on selectable paper with margins and overlap; cancellable previews when parameters change | Further freely designed print templates. |
| 14. Optimisation | Local compression by default; QPDF linearisation and conversion of existing font outlines to vector paths | Reconstructing missing original fonts without suitable, licensed font files. |
| 15. Vector-preserving redaction | PDFium groundwork for text/image regions with tests; released redaction fully rebuilds page images | Security approval of vector-preserving redaction for arbitrary PDF structures. |
| 16. Accessibility | PDF/UA validation, new structure editor and repair of existing tags with alternative text, table headers, field labels and reading order; tag repair preserves page content; output after successful veraPDF validation | Automatically structuring arbitrary untagged PDFs while faithfully preserving originals; human review remains necessary. |
| 17. Print preparation | Technical print checks, page resizing, margin cropping and poster printing | Complete colour management and independently validated PDF/X export. |
| 18. Translation | Translated paragraphs at original positions, background/link preservation, rejection before output on text overflow | Arbitrary complex layouts, font and language preservation. |
| 19. Document comparison | Column-aware reading order, sentences across pages, word changes and moves; notices for changed amounts, negations and obligation words | General domain-specific semantic review; manually check complex tables and layouts with more than two columns. |
| 20. Local assistant | CPU language model on your own device, verified model file, relevant-passage selection, unchanged original quotations, blocking unsupported numbers, JSON export, cancellation and unloading | No guarantee of completeness or truth; number checks conservatively require original formatting. Continue checking text and context against original passages. |
| 21. Large files | PDFium, image-decoder, checksum and page-tool workers; cancellation and memory cleanup | End-to-end streaming and higher verified file limits; limits remain 80 MB and 200 pages. |
| 22. Local projects | Five immutable working states, complete archive with deduplicated binaries, SHA-256 checks, atomic import and restoration | Automatically saving all specialist-tool results that have not yet been adopted. |

## Verification and release

36 engine and interface test suites check processing, navigation and display settings. PDF outputs are read back independently, covering text, glyphs, image pixels, links, forms, font sizes, page order, project archives, real HEIC/PSD decoding and actual OCR with the shipped language models. Dense two-column pages are ordered without quadratic full comparisons and checked for complete text preservation.

Server checks cover real LibreOffice inputs, SVG/vectors, editable slides, translation overflow, veraPDF and synthetic CA/TSA/CRL evidence for long-term signatures. Passing a synthetic test does not replace production configuration of the timestamp service.

Release requires type checking, formatting checks, linting, a production build and complete Docker CI. Browser checks cover every tool view on desktop and phones, downloads, mixed paragraph formatting, new continuation pages, project transfer, eight OCR languages and real local model inference. Every new source commit receives its own verification run. Incomplete or failed checks are not replaced by older successful runs.

## Components and licences

PDFium 2.15.1, OCR models, decoders, model runtime and statistical language selection ship with component notices. Details and licence texts: [component notices](../public/component-notices/README.txt). These additions do not change the MoinPDF project's licence.

## XFA and print-standard review (11 October 2026)

PDF.js 6.3.289, examined on 11 October, can display pure dynamic XFA forms and write simple inputs back into dataset packets through `annotationStorage`. This is not a complete XFA runtime: saving explicitly does not support XFA as a single stream; hybrid forms, JavaScript, calculations and dynamic actions are not fully covered. Version 0.11.0 added this limited data editor with rejection of unsupported forms and independent read-back checks. Existing guards remain active to prevent loss of XFA data.

MoinPDF now uses PDF.js 6.4.299. The XFA guards were checked again with this version; full XFA editing remains unreleased. The following source analysis refers to the version originally examined: [document detection](https://github.com/mozilla/pdf.js/blob/v6.3.289/src/core/document.js), [saving](https://github.com/mozilla/pdf.js/blob/v6.3.289/src/core/worker.js), [input layer](https://github.com/mozilla/pdf.js/blob/v6.3.289/src/display/xfa_layer.js).

A CMYK profile alone does not establish PDF/X compliance. veraPDF supports [PDF/A and PDF/UA](https://docs.verapdf.org/validation/), not a complete PDF/X validation profile. The examined free validator [pdf0](https://github.com/mgilbir/pdf0/blob/main/docs/validators.md) also describes its PDF/X checks as limited. Releasing validated PDF/X output still requires a complete independent validator. The [CGATS21_CRPC6 ICC profile](https://registry.color.org/profile-registry/CGATS21_CRPC6), which may be redistributed unchanged, could be used for the corresponding printing condition, but replaces neither colour management nor compliance validation. No unverified PDF/X export was added.

The paragraph editor also stores logical text as PDF ActualText. Readers without ActualText support may determine a different copy order for unusual mixed-direction text, such as a right-to-left paragraph containing mostly Latin text. Rendering and re-editing use the complete stored paragraph.

## Website link to PDF

Public HTTP/HTTPS websites can be loaded directly by link in “HTML & websites to PDF”. The separate Docker web converter includes images, CSS, fonts and publicly loadable JavaScript content. Options include A4/Letter, portrait/landscape, backgrounds and screen/print rendering. Private network targets are blocked; login, bot protection and dynamic content may limit rendering. Saved HTML files remain available as simplified text conversion.
