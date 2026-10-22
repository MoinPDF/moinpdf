# Changelog

[Deutsch](CHANGELOG.md) · **English** · [← README](README.en.md)

MoinPDF uses semantic version numbers (`MAJOR.MINOR.PATCH`). The central version is in `package.json`; the interface reads it from there. Docker image tags also include the source commit, and published containers have a fixed digest. Entries below describe each release at the time; see [Implementation status](docs/STATUS.en.md) for current capabilities.

## Unreleased – Edit PDF

- Late font preparation no longer takes focus back from OCR correction or another control into the PDF text. Regression cases cover desktop and narrow touch views, including keyboard operation.
- Editor CI requires complete result reports for all 29 cases per browser; missing, duplicate or unsuccessful cases prevent a successful finish. Failed workflow cases also retain a Playwright trace.
- Updated the document server's image processing to Pillow 13.0.0 to address the vulnerabilities reported in 12.3.0.
- Combined selection of text, original images and simple table cells; logical text lines, delayed preflight and bounded preparation of one neighbouring page.
- Static Type-1/CFF1 source fonts and TTF/OTF import; fallback only for missing characters. Invalid font metrics and stale font responses during undo are handled.
- Previewed paragraph continuation with following paragraphs and up to 20 new blank pages; atomic undo and preserved original following pages.
- Real vector tables with rectangular merged cells, repeated row-height changes and inserted multi-line rows; validated original references in project archives.
- Instance-specific edits of supported nested text/image objects and preserved baselines for slanted text. Simple AcroForm structures are preserved under the documented conditions.
- Bounded text corrections in supported scans up to 16 megapixels retain original resolution and outside pixels; paper backgrounds and demonstrably continuous rules are considered.
- Local structural repair compares every page, retains original bytes and displays a repair notice. Extended browser cases are included in editor CI; release requires successful checks.

## 0.19.0 – 20 October 2026

- Eligible horizontal word edits remove only affected original characters. Unchanged prefixes, and suffixes whose positions still agree, retain native PDF text. Ambiguous mappings, ligatures, style or layout changes continue to use verified whole-field editing.
- Link text fields in a chosen order across existing pages. Preview text and style distribution without automatic shrinking; overflow and collisions prevent application. Preview the flow again after further edits.
- Simple aligned tables gain cell editing with Tab/Shift+Tab. A format painter, millimetre measurements and edge, centre and baseline guides support precise editing.
- Document-wide change list with before/after text, navigation and independent reversion. Related splits and text flows revert together while unrelated later edits remain.
- Move, proportionally resize, replace and crop individual original images in the text editor. Cropping removes image pixels while retaining orientation. Scan backgrounds, groups and images with existing associated OCR layers are handled conservatively; image decoding and cropping are limited to 4 megapixels.
- Local OCR working copies support small-angle deskew, shadow compensation, contrast and conservative noise reduction. Compare original and processed region recognition; suspicious letters in numbers are flagged for review. No automatic numeric correction or new document transmission.
- Unambiguous full-page scans up to 4 megapixels retain their original pixel grid during editing when an independent rendering agrees. Complex scan pages continue to use the verified raster rebuild.
- Touch mode adds larger handles, a compact expandable font toolbar, a selection magnifier and caret adjustment for the visible keyboard area. Physical devices and native virtual keyboards require separate verification.
- Font appearance checks adapt resolution to text size up to a 3,600-pixel long edge and highlight mismatch locations. The pinned public corpus adds a French accent scan, with checksums and licence attribution; test documents are not shipped with the application.

## 0.18.0 – 20 October 2026

- Untouched pages retain their original text layer even after local search preparation. Tight text lines tolerate tiny rounding differences in reconstructed font widths, preventing spurious line breaks from thousandths of a point.
- Paragraph grouping follows interleaved column extraction. Join text blocks on a page with a preview, or split at the cursor; original removal areas remain separate and inline formatting is retained.
- On-page overflow and collision warnings include newly added text. An explicit fit option reduces relative font sizes proportionally, with a six-point lower limit.
- Whole-document search with optional local OCR, page preview, selectable matches, literal queries and atomic undo. Batch replacements are checked for space and collisions; document changes invalidate stale results.
- Three locally rendered replacement font suggestions for comparison, preserving selected-range formatting.
- Reopened exports are also checked inside edited fields against independently painted glyph outlines. Font, size, colour and position differences and unavailable checks appear in the result report; limited resolution remains a constraint.
- Pinned public test corpus: two invoice examples, historical book scan, multi-column brochure, rotated scan and form-preservation guard. Browser acceptance expanded for new controls and actual scanned source material. No claim of complete Acrobat equivalence or universal OCR accuracy.

## 0.17.0 – 20 October 2026

- Edit PDF explicitly shows mixed fonts, sizes and formatting. Font status and controls follow the actual selection; bold/italic commands restore writing focus.
- Find and replace within the selected text box: single/all matches, case sensitivity, whole words, match selection and shared undo/redo. Each replacement inherits its match's style; queries are literal rather than executable regular expressions.
- Actual page zoom from 50 to 400 percent, fit width, higher-resolution previews and bounded image memory. The previous fixed page width limited enlargement on wide displays. The current preview and OCR crop remain valid while a replacement image renders.
- Added regressions for mixed selections, search matches, style preservation, large replacement lists and zoom. Document-wide Word reflow, arbitrary scan quality and full Acrobat equivalence are not promised.

## 0.16.0 – 20 October 2026

- Direct caret placement and word selection, with bold, italic, colour, font and size within a text box. Formatting and edits persist through undo and project archives.
- More conservative paragraph grouping for tables and mixed fonts. Explicit previews for enlarging a text box, reflowing lines or reducing font size.
- Automatic font substitution also compares text width for suitable single-line text. Compare the original with the edit and load a custom static TrueType font locally; font bytes are retained in the project.
- Correct OCR beside the original crop, navigate uncertain words and recognise a selected area again locally, reviewing the suggestion before applying it.
- Export reopens the saved PDF and checks text content, text position and visual differences outside edited regions. Detected text loss stops export; incomplete or suspicious visual checks are reported with side-by-side original/result views.
- German and English help, regression tests and browser coverage expanded for selection, word formatting, OCR correction and export checks. Document-wide Word reflow and guaranteed original fonts in scans remain outside the editor’s capabilities.

## 0.15.5 – 20 October 2026

- “Edit PDF” removes replaced source text from the PDF. Backgrounds, table rules, images and links are retained when native text objects can be edited reliably; preview and export use the same removal path.
- Complex text pages no longer silently become images. Unsafe removal stops export; an explicit image rebuild remains available with a warning. Scan preparation stays local.
- Individual text runs are selected by default. Paragraph line breaks, undo/redo while typing and OCR corrections without duplicate text layers have been improved. Slanted, mirrored and vertical text receives a clear limitation message.
- Better Nimbus family/style recognition and overflow checks using actual glyph descenders. Type 1/CFF fonts that cannot be reliably re-embedded receive a visible local substitute; reusable TrueType originals are retained.
- Signature and form structures are checked before export. German and English messages and documentation have been updated.
- Added permanent preservation/export checks and Chromium, Firefox and WebKit flows covering desktop, 390-pixel layout, an OCR scan and English. The [implementation status](docs/STATUS.en.md) records validation and remaining limits.

## 0.15.4 – 18 October 2026

- Corrected tool search for screen readers: expanded state, result list and keyboard navigation remain consistent.
- Added correct accessible names to sliders, JSON/CSV imports and document previews; previews are keyboard reachable and text/annotation controls belong to the correct tab panels.
- Improved light-theme contrast for supporting text, manual chapter numbers, success notifications and inactive editing tabs.
- Linux entrypoints retain the required line endings after Windows checkouts; bundled third-party notices remain byte-for-byte unchanged.
- Added persistent German and English browser accessibility checks. Interface changes also trigger Firefox and Safari checks; the Office cancellation test now supports Windows while retaining strict Linux checks for remaining operating-system threads.

## 0.15.3 – 18 October 2026

- Adopted compatible library updates for the interface, Word export, font processing, HEIF/PSD import and build tools.
- Updated BeautifulSoup and FontTools in the document server, plus the GitHub Actions for Python setup and verification artifacts.
- Limited automated Node and Node typings proposals to the existing runtime strategy. Future Pydantic and Pydantic Core updates are proposed together.
- Aligned German and English help and Docker documentation with automatic local backups and persistent job storage; corrected outdated test documentation.
- Aligned Docker with the current web features: automatic local scan OCR in the PDF editor, direct paragraph editing, 14 font families, original font detection and explicit substitution notices.
- Bundled local workers and their WASM assets reliably and verified the generated output.
- Added Edit PDF, Office to PDF and Page numbers to quick access; included Results under More and the latest typography and alignment fixes.

## 0.15.2 – 18 October 2026

- Version links no longer show an underline on hover or after tapping. Keyboard focus remains visible.

## 0.15.1 – 18 October 2026

- Version labels in the app, handbook and media area open the matching GitHub release notes in a new tab.
- Added English messages for OCR/Word results, project limits, original-object editing and background jobs. Results-tray errors, dates and file sizes follow the app language.
- Updated the German and English handbook for the shared workspace, extended undo history and resuming background jobs.
- Clearing or deleting results remains effective when an earlier local save finishes later. Older saves no longer hide newer results.

## 0.15.0 – 18 October 2026

- Multi-page table extraction, repeated headers and typed Excel numbers/dates with per-column controls. Identifiers and formulas remain text.
- Automatic OCR for image-only Word pages, including mixed documents. Native PDF pages retain layout reconstruction on the document server; scan pages become editable paragraphs.
- Shared workspace transitions, undo across adopted results, persisted source history and form drafts in project files.
- Local recovery after reload and a tray of the latest ten results, up to 160 MB.
- Persistent background conversion jobs in Docker: two workers, 16 outstanding jobs, 15-minute processing, 24-hour retrieval, restart recovery and real subprocess cancellation. Signing secrets are excluded.

## Unreleased

- Repository documentation is available in German and English, with paired language navigation, a redesigned README and bilingual issue templates.
- Project documentation and release workflows focus on standalone Docker operation.
- Platform-specific installation packages and integration tests have moved to the responsible external package repository.

## 0.14.5 – 16 October 2026

- After local Office conversion or cancellation, the browser now terminates the
  complete worker tree through its owner. Explicitly terminating the child
  threads first could strand native worker threads in Chromium.
- Document cleanup, bounded cancellation and local PDF validation remain intact.
  Repeated conversions now also check for surviving operating-system threads.
- A standalone reproduction separates the browser behavior from LibreOffice;
  Office tests still validate actual PDF text, images, tables, offline caching
  and repeated cancellation followed by a fresh conversion.

## 0.14.4 – 16 October 2026

- Mobile glass navigation with Home, Tools, Search, Projects and More. The search
  button opens local tool search with direct results, keyboard navigation and
  a height adjusted to the visible viewport.
- The search dialog stays on screen using bottom placement without centered-dialog
  offsets. Projects move to the mobile bar and remain in the desktop header;
  desktop also retains an All tools button beside search.
- Separate browser and server type checks; license source copies and build output
  are not treated as application source. The hosted build checks both runtimes,
  and Docker additionally checks the complete application and build configuration.
- Quickly reopening Projects during its closing animation keeps the project list
  open; automatic backups and restoration remain accessible after deleting the
  last page.
- Production tests cover search geometry, touch targets, results, clearing,
  keyboard focus, project access, document retention and desktop resizing.

## 0.14.3 – 16 October 2026

- Docker update from 0.13.26 with a local document editor: formatted text, images,
  tables, page preview, PDF export and transferable .moindoc drafts.
- Includes the 0.14.2 usability improvements: restored tool selection, editable
  result filenames, size summaries, duplicate detection, intent search and file sharing.
- Document creation and draft import also work over local HTTP addresses used by
  Umbrel. Random document identifiers no longer require a secure context.
- Complete React dependencies for draft persistence and result sharing.
- PDF results remain available after export and when leaving page preview;
  only actual document changes invalidate the previous output.
- Draft actions retain accessible names on small screens.
- Switching between blank and saved drafts no longer reads a destroyed editor;
  document contents and separate undo histories are preserved.
- Returning to tool selection restores keyboard focus to the original control
  even when the same tool is also listed as a search suggestion.
- Docker release retains all four services and adds production checks for the
  document editor, drafts, filenames, duplicate uploads and tool navigation.

## 0.14.2 — 2026-10-16

- Returning to quick access or the tool catalogue restores the category, search,
  scroll position and keyboard focus within the current session.
- Edit output filenames beside the download button while retaining the actual
  extension. Renaming does not reload the preview or reset its current page.
- Consistent format, page-count and size summaries, with size comparisons for
  compression and optimization.
- Content-based duplicate upload detection, including repeated files in one
  selection. Skip or add anyway, optionally remembering that choice for the batch.
- Expanded everyday search phrases in German and English.
- Share generated files with their edited names through the native share sheet on
  supported devices. Downloads remain available when sharing is unsupported.
- Added DOM and functional coverage for interactions, cancellation and project transfer.

## 0.14.1 — 2026-10-16

- On mobile, New document and Projects are small, circular icon buttons next
  to each other in the existing header. Removed the additional second row.
- New document remains immediately to the left of Projects, with accessible
  button labels in German and English.

## 0.14.0 — 2026-10-16

- New document button immediately to the left of Projects, opening a dedicated
  editor without an upload or a tool catalogue entry.
- Rich text, three font families, headings, lists, images, tables, page breaks,
  paper formats, margins, headers, footers and page numbers.
- Local draft autosave and management, plus editable .moindoc files for backup
  and transfer between devices.
- Local PDF download with selectable text and a separate, accurate page preview.
  Responsive editing, light/dark appearance and German/English interface.
- Regression tests exercise editor commands, safe paste, draft persistence and
  actual PDF output, including complete multi-page documents.

## 0.13.27 — 2026-10-16

- Removed the extra sailor photo banner after opening documents. The ready
  message now appears with a subtle green check directly in the file overview:
  next to the file information on desktop and below it on mobile.
- Singular and plural messages and German/English translations are preserved.
  The homepage header photo is unchanged.

## 0.13.26 — 2026-10-16

- Fixed PDF text extraction in Safari. OCR, text editing, content comparison,
  Word, Markdown, HTML, EPUB and JSON exports, and text import for structured
  PDFs read text streams without requiring asynchronous stream iteration.
- Font information, text positions, language and XFA form text are preserved.
  Regression tests cover multi-chunk text streams, empty scans and failures.

## 0.13.25 — 2026-10-15

- Reviewed all 4,513 existing language entries for technical and linguistic accuracy; improved around 2,000 translations and added current messages. Tool text, help, documentation and information pages use the same catalogue.
- Added missing translations in dialogs, screen-reader labels, OCR notices, workflows and reports. Number formats follow the app language.
- Localised app-owned headings and notices in PDF, CSV, Excel, Markdown, HTML and EPUB outputs, including the invoice reading view and accompanying text for server-side PDF translation.
- User file names, form values, quotations, invoice XML and edited document text remain unchanged. Language tests check this separation using real outputs; a catalogue test detects newly missing UI messages.

## 0.13.24 — 2026-10-15

- Sample PDFs follow the selected app language when opened. The invoice and project overview are fully available in German or English, including dates, amounts and file names.
- Language changes apply to newly generated samples; documents already open are preserved. Both versions remain image-based scans for trying OCR and page tools.

## 0.13.23 — 2026-10-14

- The local Office runtime prepares eight background threads and checks readiness at each native thread start. An exhausted pool produces an explicit error instead of loading a worker during a synchronous native call.
- The browser test now checks 15 cancellation/restart cycles using real Excel and Word files, entirely from the local cache and without document uploads.

## 0.13.22 — 2026-10-14

- Long file names no longer widen the document overview on narrow phones. File cards remain within the screen; the full name stays accessible through the label.
- Responsive browser checks wait for the image width to adjust and verify current project labels and save status.

## 0.13.21 — 2026-10-14

- Undo and redo remain available in the file-entry view after removing the last page, including restored project states.
- GitHub and Docker include the current web version with a white/green project button, still tool cards and a smaller desktop header image.
- Browser checks account for the six shortcuts, current navigation and unchanged mobile image presentation. Docker-specific website conversion remains fully included.

## 0.13.20 — 2026-10-14

- The home-page sailor image is centred and limited to 640 pixels wide on desktop. The complete 16:9 artwork remains visible; mobile presentation is unchanged.

## 0.13.19 — 2026-10-14

- Tool cards remain still on hover, click and keyboard focus. Lift effects, press shrinking and brief icon animations were removed.

## 0.13.18 — 2026-10-14

- A subtle light reflection follows the pointer inside tool cards.
- The white/green project button indicates saved and unsaved changes. Successful saves are confirmed with “All aboard — saved.”
- Drop zones show the file count when the browser exposes it and receive a soft green border during file dragging.
- PDF pages show an animated preview and a clear insertion marker while reordering. Arrow keys on the handle and mobile arrow buttons remain usable.
- Page actions offer an immediate undo notice; old notices cannot undo later changes.
- Search terms are subtly highlighted in tool names and descriptions, including German umlauts. All additions support German and English.
- Reduced motion and high contrast are respected.
- Project archives and document checks load on demand; the self-hosting build also keeps its existing per-JavaScript-file size limit.

## 0.13.17 — 2026-10-14

- The active shortcut category uses a stronger fill and double outline in its category colour, accounting for light/dark modes and high contrast.
- The project button receives a subtle turquoise surface, visible border and larger folder icon, including on phones. Keyboard focus and an open project dialog are clearly indicated.

## 0.13.16 — 2026-10-14

- Tool cards lift subtly on desktop hover. Icons briefly respond to interaction, with matching details for merge and OCR.
- Mobile navigation gains a subtle shadow edge when content scrolls underneath it.
- Successfully opened or accepted files briefly show a check mark beside the name. Completed processing transitions to a check mark and highlights the available download once.
- Reduced motion, keyboard focus and high contrast are respected. Categories still switch immediately; layout and existing colours are preserved.

## 0.13.15 — 2026-10-14

- Category buttons keep their labels together. Narrow displays fit fewer buttons side by side; larger text moves the entire button to the next line.
- The card mosaic is limited to the home-page shortcut views. “All tools” again uses the complete tool overview from 0.13.13.
- Removed unused mosaic styles for the full catalogue. The green upload area, selection colours and 0.13.13 backup are preserved.

## 0.13.14 — 2026-10-14

- Redesigned tool selection and home page as a responsive mosaic with large primary cards, tool pairs, illustrated icons and subtle category colours.
- Category buttons use two rows on phones and a sidebar in desktop tool selection. German and English labels remain available.
- Preserved the bright green upload button and existing colours/light effects for selection, hover and focus. The harbour image remains fully visible.
- Saved a 0.13.13 restoration point before the redesign: Git tag `backup-0.13.13-before-mosaic-20261014`, saved Site version 119.

## 0.13.13 — 2026-10-14

- Complete 16:9 sailor images without cropping; upload-area size and design are preserved.
- Six shortcuts with short descriptions, categories with icons and complete tool lists per category.
- Document overview with file names, page counts and sizes; a more compact workspace with the tool sidebar initially closed.
- Mobile action bar with back, processing, cancellation and download. Navigation and content have the required spacing.
- Existing colours, gradients and category assignments are preserved.
- German and English user documentation reflects the current interface.

## 0.13.12 — 2026-10-14

- Added ten sailor images to the existing header: 22 images in total, with unchanged framing and switching behaviour.
- Added the “Gentle” compression level, including higher image resolution and JPEG quality. “Balanced” remains the default.
- Added German/English compression instructions and further English translations.
- Structure, categories, tool cards, colours and mobile controls still match the restored morning state of 0.13.11.

## 0.13.11 — 2026-10-13

- Twelve sailor images in the header, including the previous image without duplication.
- A random image on opening and a different random image on click, touch or keyboard input. Switching is unanimated; the next image is preloaded.
- Optimised WebP files, appropriate framing, and German/English image descriptions.

## 0.13.10 — 2026-10-13

- Category buttons use subtler selection colours, calmer typography and soft shadows in light/dark modes, consistently on the home page and tool overview.
- Removed the thick category underline, extra divider below categories and vertical light edge in the upload button.

## 0.13.9 — 2026-10-13

- Harbour-light styling with compact, finely outlined cards, green selection markers and subtle light edges in light/dark modes.
- Brief light pulse when selecting tools and categories, including touch/keyboard input. Tools open immediately; the effect does not block input.
- Coordinated phone, tablet and desktop views with category touch targets at least 44 pixels high.
- Reduced motion and high contrast are respected; scrolling clears light effects.
- Expanded browser checks for mouse, keyboard and touch, both colour modes, every tool and document preservation.

## 0.13.8 — 2026-10-13

- Consistent outlines for tool cards and icons, including the Convert category.
- Empty PDF workspaces use the compact converter layout: tool description, three steps and file selection in one card. The former large welcome area is removed.
- File selection, drag-and-drop, the sample document and blank pages remain available; the selected tool is preserved.
- Corrected a malformed character sequence in the Word conversion OCR reference.
- Invoice, protection and document tools without a loaded file lead safely to shared file selection; browser checks cover all 112 empty tool views.

## 0.13.7 — 2026-10-13

- Rectangular shortcut cards use the original icons from “All tools”, without extra document illustrations.
- Tools can open from the home page and overview without a PDF already loaded.
- Tool selection survives subsequent file opening and PDF dropping; mobile navigation shows the workspace from the top.
- Added browser checks for all shortcuts without a document, matching icons and importing a file into the selected tool.

## 0.13.6 — 2026-10-13

- Tool cards with fine borders, subtle light gradients and compact, slightly dimensional icons.
- Coloured document artwork for merge, compression and PDF to Word, plus matching icons for text, OCR and websites.
- Calmer shadows and smaller cards in both colour modes; categories and existing click effects remain.

## 0.13.5 — 2026-10-13

- Category buttons are compact again with visible outlines; on phones they adapt to text width.
- Coloured selection and the brief light streak remain.

## 0.13.4 — 2026-10-13

- “Recommended” labels the home-page selection; “Show all tools” opens the complete overview.
- Category buttons show a brief light streak and gentle press movement, coordinated with the lighthouse. Reduced-motion preferences are respected.
- On phones, categories occupy two even rows with sufficiently large touch targets.

## 0.13.3 — 2026-10-13

- Removed the separate “All tools” home-page button; the category row follows search directly.
- Selected categories are highlighted in turquoise in light/dark views, with “All” selected by default.

## 0.13.2 — 2026-10-13

- The home page starts with the sailor artwork; the additional heading is removed.
- Shortcuts have their own section heading and divider above the cards, clearly separated from “All tools”.

## 0.13.1 — 2026-10-13

- Consistent harbour-studio layout with sailor artwork above upload, search and shortcuts; the slogan appears only with the logo.
- Coordinated light and dark-grey interfaces for the home page, tool selection, workspaces, documentation, media and legal pages.
- Optimised phone, tablet and desktop views with accessible navigation, touch targets and safe bottom spacing.
- Switching between home and workspace preserves open documents. PDF processing, converters and server functions are unchanged.

## 0.13.0 — 2026-10-13

- Save website links directly as PDFs, including images, fonts, CSS and publicly loadable JavaScript content; A4/Letter, portrait/landscape, backgrounds and screen/print rendering.
- Preview, download and continued editing in the existing HTML tool; saved HTML files remain supported. Complete German/English controls and documentation.
- Separate Chromium web converter in Docker for amd64/arm64. Controlled public requests, protection against private network targets and DNS rebinding, resource limits and termination of cancelled jobs.
- Update the complete Docker stack: the new `website` service and `/api/website/*` are part of the installation.

## 0.12.2 — 2026-10-12

- Compact home-page buttons with icons, highlighted “All tools” and additional footer spacing in light/dark modes.
- Local Office conversion cleans up documents and background processes before shutdown, including cancellation during initialisation; bounded forced termination remains for blocked runtimes.
- Wait for all prestarted Office threads; configure graphics import, scaling and formula calculation for sequential execution before runtime initialisation.
- Conversion-only Office jobs use the regular LibreOfficeKit event loop without additional editor polling callbacks.
- Docker publication checks the successful test run directly by ID. All three images and release approval use the same evidenced source commit and test run.
- Regression tests for cleanup, cancellation, reconversion and approval of immutable images.

## 0.12.1 — 2026-10-12

- Updated LibreTranslate to 1.9.6, Uvicorn to 0.54.0 and pycparser to 3.1.
- Adopted TypeScript 6.0.3, ESLint 10.12.0 and current checkout/container-login actions.
- Retained Python 3.12 and types compatible with Node.js 22.13 or later. The separate pyHanko update was not adopted because it conflicts with the pinned certificate validator.

## 0.12.0 — 2026-10-12

- Paragraph editor with HarfBuzz and 14 local Noto fonts for Indic and Southeast Asian scripts; appropriate fonts are added as needed.
- Conjuncts and ligatures remain together during wrapping and formatting. A linked logical text layer preserves search, copying and re-editing; generated paragraphs are selected together per page.
- Edit, move, rotate, scale, reorder and delete individual text, images and paths inside nested groups. Reused groups and image resources are separated for the selected instance.
- Groups retain transformation, clipping and transparency. Unsupported graphics types and conflicting inherited graphics states are rejected before output.
- New independent tests for shaping, Unicode output, group instances, repeated editing and real browser interaction; updated German/English instructions.

## 0.11.0 — 2026-10-12

- Convert Office documents locally with pinned LibreOffice/WASM; downloads and cache contain only program data. Your own document server remains an explicit option.
- Local PKCS#12 certificate signatures with WebCrypto/PKI.js, without uploading the PDF, private key or password; independent OpenSSL verification.
- Paragraph editor with Arabic/Hebrew, bidirectional mixed text, eight additional fonts, browser spellcheck, lists, find/replace and superscript/subscript.
- Multiple selection with alignment, distribution, mirroring, duplication and vector groups.
- Limited XFA data editor preserving templates with read-back checks; active and hybrid forms are rejected.
- Workflow templates and additional steps for rotation, reversal, flattening and lossless optimisation; local compression by default.
- Additional engine, browser and privacy checks, plus German/English documentation. Full XFA, independent PDF/X, local PDF/A validation and local SVG vector export remain outstanding.

## 0.10.2 — 2026-10-12

- Language and lighthouse switches made smaller again: 32 pixels on desktop, 30 on narrow screens, with sufficiently large touch targets retained.
- The lighthouse briefly rocks with a subtle light pulse on switching. Every click restarts the animation; reduced motion is respected.

## 0.10.1 — 2026-10-12

- Smaller, subtler language/lighthouse switches; invisible touch targets remain large enough on touch devices.
- Added English text for all tool views, menus, dialogs, notices, progress and errors. Translations load as a local app file; document contents are not transferred for this purpose.
- Added English documentation for all 112 tools, the media section, legal notice and privacy policy. Media package includes English supporting text, a wordmark and subtitles for the unchanged original clip.
- Language selection survives reloads and synchronises information pages across tabs. Open documents and edits survive switching.
- Added browser checks for English tool views/menus, mobile information pages, downloads and language switching with an open document.

## 0.10.0 — 2026-10-12

- Home page follows the approved concept: mint gradient, calm wordmark, floating document and compact controls.
- Dark-grey mode with a saved lighthouse switch: the tower lights up in light mode and is off in dark mode. PDFs retain their own colours. Documentation, media and legal pages follow the selected appearance.
- Language menu with German/English flags. Home page, slogan, tool catalogue and main navigation are translated; detailed specialist-tool text and documentation initially remain German.
- All 112 tool titles, descriptions and catalogue actions are available in English; search supports German and English tool terms.
- Calmer cards, subtle category accents, fixed search, mobile spacing and restrained result animations. Reduced motion is respected. Appearance changes preserve open documents.

## 0.9.3 — 2026-10-11

- Closing a file removes its notes, images and crop data from the current working state. Saving and project download also clean orphaned editing data from older states while preserving valid undo steps.
- Projects with no remaining pages can be saved and reopened. Switching to other projects remains possible without losing undo history.
- Project selection has its own place above the workspace and no longer overlaps mobile form fields.
- Released dependency updates from the verified merge; corrected OCR language counts and PDF.js versions in documentation.
- Load barcode generators selectively, remove ineffective dynamic imports and introduce separate, checked browser-build size budgets.
- New regression tests cover removed project contents, empty page lists, project switching and mobile project selection.
- Regular type checking also covers background processes; page tools explicitly use the PDF data actually available there.

## 0.9.2 — 2026-10-11

- Security updates for Vite and transitive dependencies. Updated python-multipart to 0.0.32; the complete Python lockfile is audited before Docker builds. No known vulnerabilities were reported for the released lockfile; Docker verification repeats the check before each release.
- Fixed all 37 ESLint warnings, including complete page-preview dependencies and typed embedded-image data. New warnings fail verification.
- Specialist tools load only when opened, substantially reducing the main JavaScript chunk; tool changes display an accessible loading state.
- Added privacy notices for the local document assistant, deliberately opened external model download and optional model storage.
- Updated the verification overview to 24 engine suites, 60 server tests and 112 tools; refined limitations based on current Office, XFA and PDF/X checks.
- Releases are created automatically after successful Docker tests and image publication. Source commit, version, both architectures and current main must match; existing releases are not replaced.

## 0.9.1 — 2026-10-11

- Detect XFA before accessing the ordinary form API, preventing silent removal of XFA packets.
- Form editing, page adoption, arbitrary rotation, long pages, poster printing and chronological bundles reject unsupported XFA content before output.
- Bookmark-only changes preserve existing XFA packets unchanged. Form analysis reports unsupported XFA fields.
- Regression tests check direct/indirect form dictionaries, streams/packet lists and original-data preservation. The browser test checks blocked editing and independently reads back the download.

## 0.9.0 — 2026-10-11

- Immutable project archives with all five saved states, deduplicated original files and import integrity checks.
- Mixed paragraph formatting, ligatures, combining characters and text flow onto up to 19 additional pages; object handles and drawing order.
- Eight simultaneous OCR languages and optional local language sampling per scan page.
- Local PDF assistant with a verified model file, source quotations, JSON export, cancellation and memory cleanup.
- Browser HEIC/HEIF and PSD import; Pages, Visio and Publisher conversion with invalid-container checks.
- Workflow node diagrams with nested decisions, additional page operations and a traceable execution log.
- Multiple Bates/header/footer rules, paper sizes, print-ready poster sheets and cancellable output previews.
- SVG vector export, font outlines, permanently flattened layers, editable PowerPoint text and original-position translation with overflow checking.
- Repair existing PDF tags without changing page content, with output only after successful veraPDF validation.
- Strict offline signature verification, configurable PAdES-T/LT/LTA signatures and document-timestamp renewal. Credentials remain separate from converters.
- Column-aware comparison, sentences across pages and special notices for changed numbers, negations and obligation words.
- 24 engine suites plus expanded server/browser checks. Outstanding limits of the original plan are in [Implementation status](docs/STATUS.en.md).

## 0.8.1 — 2026-10-11

- Accessibility results are discarded after changes to content, title, language, profile or action. Downloads become available only after processing again and therefore match the current draft.
- Added browser checks for edited PDF/UA content, re-export and profile/action changes. New PDF content and metadata are read back independently.

## 0.8.0 — 2026-10-11

- Paragraph editor with selection of multiple existing text objects, wrapping, embedded Noto Sans or a custom static TTF, size, colour, alignment, spacing and actual PDF previews. Overflow/missing glyphs are reported before output; other page objects remain intact.
- PDF/UA-1 and PDF/UA-2 checks with the existing pinned veraPDF validator.
- Structure editor for new A4 documents: headings, paragraphs, reading order, images with alternative text, title/language and saved JSON structure files. LibreOffice generates PDF/UA-1; only a successful machine check allows PDF output. Manual review against the original remains necessary.
- 21 engine suites, six additional server checks and browser flows for paragraph preview, overflow and verified PDF/UA creation. Still 108 tools.

## 0.7.0 — 2026-10-11

- Portable `.moinpdf` project files for the current or a saved state, including originals, invoice XML, pages, editor, forms, bookmarks and undo history. Imported as a separate project; the current session is saved locally before switching.
- Size, integrity, data and page-reference checks during import. Project files are unencrypted and include originals/earlier edits; use the output PDF for sharing finished documents.
- OCR and scan search combine up to four of the 21 included languages, verified by actual recognition of a four-language scan.
- New PDF comparison content mode matches blocks across page boundaries, accounts for inserted pages and reports word changes/moves. Ambiguous and repeated matches remain visible.
- Reports optionally show unchanged text and progressively display large results; TXT downloads still contain every entry.
- 20 engine suites plus browser flows for project transfer, four OCR languages and content comparison. Still 108 tools.

## 0.6.0 — 2026-10-11

- Eight new browser tools: original-object editing, Bates numbering, page labels, arbitrary rotation, long pages, poster printing, fast web viewing and structured JSON export. 108 tools in total.
- PDFium processes original text, images and graphics in a cancellable local worker. Text editing preserves available original fonts and reports missing characters. Individual text objects only; no paragraph editor yet.
- 21 locally provided OCR languages and selectable page segmentation.
- WebP/BMP/TIFF/SVG import, multipage TIFF; WebP/TIFF/BMP export.
- Rename PDF layers and save their navigation/visibility without converting text and vectors to page images.
- If/else workflow steps with a traceable ZIP log.
- Local PDF projects with five saved states, restoration and undo history. Project data is unencrypted in browser storage.
- Independent PDF.js/PDFium checks, actual QPDF linearisation, image-codec and IndexedDB checks. 18 engine suites.
- Recorded the scope and outstanding parts of the larger expansion in [Implementation status](docs/STATUS.en.md).

## 0.5.11 — 2026-10-10

- Standalone development/build configuration for the Docker edition.
- Consistent source formatting; ESLint and formatting checks in integration.
- Container publication tied to the successful complete verification run.
- Added mobile checks for legal/privacy pages.
- Updated documentation, feedback channels, licence status and maintenance notes.
- Corrected the outdated cookie notice and inaccessible public support link.

## 0.5.10 — 2026-10-10

- Brought web and Docker editions to the same current state.
- Contact via ahoi@moinpdf.de and privacy enquiries via post@moinpdf.de; personal details limited to required provider/controller information.
- Standardised contact/provider text and cleaned up the media contact card.
- Compact legal/privacy layout with green text and a blank line between address and email.

## 0.5.9 — 2026-10-10

- “Printer overboard?” promotional clip with preview, download and media package in the Docker edition too.
- Single-column media introduction without a separate “Moin.” block on large screens.
- Official favicon and latest documentation text in the updated Docker release.
- HTML pages and favicons revalidate after updates; installation tests check delivered media.

## 0.4.0 — 2026-10-07

- Ten new tools, 93 in total: number comparison, receipt-field collection, invoice/XML comparison, document gaps, OCR correction, pseudonymisation, automatic appendix links, best scan pages, line-item comparison and comment lists.
- Shared original preview with highlighted source references and enlarged crops. Spreadsheet exports flag unchecked, missing and ambiguous data.
- Numbers and line items are matched by their labels. Moved pages are supported; duplicate/ambiguous labels remain review cases.
- Invoice/XML comparison reads visible pages with local OCR; a differing hidden text layer is not treated as visible invoice content.
- OCR corrections create search text behind new page images. Pseudonymised outputs contain only edited page images and neutral file names; old text layers, forms, metadata and attachments are excluded.
- Review and change appendix targets and scan pages before export. Add/correct suggested line items before comparing them.
- All ten tools run in the browser with locally served resources. No additional server services, external AI calls or API accounts are required.
- New tests verify actual OCR, visible pseudonymisation, independent reading of generated PDFs, internal link targets and safe spreadsheet/comment imports. Detection remains a reviewable aid, not proof of completeness or authenticity.

## 0.3.0 — 2026-10-07

- Seven new tools, 83 in total: PDF repair, target-size compression, splitting combined scans, PDF to Markdown/HTML/EPUB, and EPUB to PDF.
- Repair accepts originals without a prior preview, reconstructs the file structure, falls back to an independent parser and checks every output page. Unrecoverable files return an error; originals are preserved.
- Compression measures actual size, keeps the smallest variant and explicitly reports unreachable targets. Text, links and forms remain. Docker can downsample images; the browser edition uses QPDF.
- Combined scans: automatic suggestions from light gaps, manual frames, previews and checks of every crop before producing a ZIP of individual image PDFs/PNG/JPG.
- Markdown/HTML/EPUB are text outputs with page structure, marked scan pages and an EPUB table of contents. Images and original layout are not retained.
- Server EPUB import with A4/A5, font size, size/page limits and blocked active/external content. Direct EPUB uploads open the converter.
- Regression tests for repair, forms, target sizes, actual crops, safe exports, EPUB round-trips and protected server endpoints.

## 0.2.8 — 2026-10-07

- Restored categories below tool search: All, Check, Convert, Pages, Edit and Batch. “All” displays every tool by default.
- Categories filter the overview/search suggestions and update the count. Buttons wrap on small screens and support keyboard use.

## 0.2.7 — 2026-10-07

- Reduced the sailor logo to 16 pixels. Logo and version form a jointly centred row and are also vertically aligned.

## 0.2.6 — 2026-10-07

- Reduced the footer sailor logo to 24 pixels and made the footer more compact. Logo and version remain centred together.

## 0.2.5 — 2026-10-07

- Reduced the footer sailor logo from 48 to 32 pixels and centred it with the version below the legal links.

## 0.2.4 — 2026-10-07

- Added a small sailor emblem from the banners beside the footer version. The sailor looks out of a circle; logo and version sit together at the bottom left, below legal links on narrow screens.

## 0.2.3 — 2026-10-07

- Added a subtle light-teal and soft-green background gradient across the home page, tool overview and workspaces to the footer, adapting to screen size.

## 0.2.2 — 2026-10-07

- Replaced the home-page MoinPDF wordmark with the approved logo's letterforms: dark-teal “Moin”, green “PDF”, as scalable vectors. Slogan, underline and the rest of the interface remain unchanged.

## 0.2.1 — 2026-10-06

- Removed the additional browser-tool notice and shield icon below the tool list.
- All tools are visible directly below search, without preliminary shortcuts or category cards. Search and existing tools remain available.
- Long tool names wrap inside their cards, including on narrow phones.

## 0.2.0 — 2026-10-06

- Centred footer on small screens, wrapping links and a separate version row.
- Adapted the animated upload area to narrow phones.
- Word, Excel, PowerPoint, images and text are selectable immediately after PDF import.
- Tools are grouped by task; the separate server category is removed.
- Conversions require no server address, API key or extra approval checkbox. Processing starts only with the corresponding action button.
- Open Office, email and HTML files directly through the main upload area.
- Simple result view with an appropriately labelled download.
- Emails produce PDFs by default; attachments are optional as a ZIP.
- Connection checks and processing requests have time limits.
- Browser edition exports PDF text directly as real DOCX without layout/images. Docker retains conversion with layout reconstruction. Other native converters require the complete Docker installation.

## 0.1.0 — 2026-10-05

- First complete Docker edition with PDF tools, integrated document service and local translation.
