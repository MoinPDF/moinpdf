# Verification and evidenced version

[Deutsch](VALIDATION.md) · **English** · [← README](README.en.md)

The version number is in [package.json](package.json). A successful run provides evidence only for the commit shown in that run, not for later changes or arbitrary documents.

## Verification scope for 0.21.1

- 59 engine/DOM suites cover real PDFs, independent AES-GCM decryption, wrong
  passwords, tampered/truncated project files and cancellation.
- Preview regressions check immediate cancellation of hidden work, queue release,
  bounded image retention and recreation on return.
- Export verification detects lost text, changed form fields and unreadable PDFs.
  Download, sharing and adoption use the status tied to the exact output Blob.
  Technical verification does not establish content accuracy.
- Offline checks cover complete packages, integrity requirements, failed downloads,
  sign-in pages, retained security headers and removal confined to program caches.
- `tests/release-021-browser.py` adds real encrypted project downloads, wrong-password
  rejection, reopening, independently inspected flattened PDFs, offline restart/OCR
  and 200-page preview eviction/re-entry to the Chromium/Firefox/WebKit matrix.
- A synthetic 200-page text fixture does not prove arbitrary 80-MiB scans. Limits
  remain 80 MiB of active source files in total and 200 active pages.
- Physical iPhone/iPad/Android devices, native share sheets and Microsoft Word remain
  pending in the [device checklist](docs/quality/editor-device-checklist.md). Desktop
  engines, touch emulation and native device results are separate evidence.
- Release evidence is the successful Actions run for the exact commit. Local checks
  and newly written test cases do not replace that gate.

## Investigation of the WebKit hang

The [unchanged baseline](https://github.com/MoinPDF/moinpdf/actions/runs/40216810705)
passed 25 consecutive form exports. Deliberately holding a `GetOperatorList` request
then proved that cancellation waited for a worker reply. This establishes the
cancellation defect, not the internal trigger of the original one-off WebKit hang.

`tests/pdf-session-smoke.mjs` covers eleven lifecycle and shared-audit cases with a controlled clock.
`tests/editor-verification-browser.py` adds five real form exports per engine and
four explicitly injected failures: cancellation, automatic retry, two timeouts
and stalled font loading. Downloaded PDFs are independently checked for text,
three form widgets and unchanged page pixels. Native macOS Safari additionally
checks actual downloads and cancellation followed by re-export. The successful
run for the exact source commit remains authoritative.


## Automated checks

| Area | Scope |
| --- | --- |
| Source code | TypeScript, ESLint without warnings, consistent formatting and dependency audit |
| PDF engines and DOM | 59 suites using real PDFs, independent readers, and checks for text, pixels, forms, links and encryption |
| Document server | 65 tests: native converters, authentication, size/time limits, translation, cleanup, audio, accessibility, long-term signatures and upload parsers |
| Integration | Real Office conversion, German/English translation, local speech generation, restart and preserved models |
| Interface | All tool views on desktop and narrow touch viewports, PDF/EPUB/audio downloads |
| Documentation and media | Search, categories, printing, downloads, video, no horizontal overflow and preserved working files |
| Legal pages | 1440, 390 and 320 pixels, shared palette, contact links and spacing between address and email |
| Containers | Platform indexes for amd64 and arm64, plus fixed digests |

[Current runs](https://github.com/MoinPDF/moinpdf/actions) and their artifacts can be inspected by people with repository access. [docs/DEVELOPMENT.en.md](docs/DEVELOPMENT.en.md) explains how to run the checks.

## Evidenced baseline

Version **0.9.1**, commit `b488a9ce0358ce54fb3030e1b66bc8d20b3b04e4`, passed the [Docker run on 11 October 2026](https://github.com/MoinPDF/moinpdf/actions/runs/38149865248): 24 browser-engine suites, 56 server tests, all 112 tool views, conversion, translation, restart, access protection and real local model inference. New versions receive their own runs; this evidence does not automatically cover later changes to `main`.

## Limitations and operator checks

- ARM images are built and their platform indexes checked. This does not establish a successful native ARM run.
- Full interface checks run in Chromium. Additional PDF text and OCR checks run in Firefox and native Safari on macOS CI. The separate editor matrix uses WebKit, which does not establish native Safari or iOS coverage. Specific smartphones and native share sheets still require device testing.
- Test your own server installation and public domain separately with synthetic documents.
- Large or unusual documents may reach converter limits. Check results against the original.
- The complete Docker installation includes the document server. Server addresses and API keys are not entered manually in the browser.
- A static web build alone does not provide a running document server; `/api/documents/*` requires the corresponding server installation.

## Release verification 0.14.3

- Preserves the complete 0.13.26 GitHub baseline, including the website converter,
  network isolation, all four images and bilingual repository documentation.
- Local preflight passes 36 engine/DOM suites, TypeScript, warning-free ESLint,
  formatting, release gates and the production build.
- Creation and draft import use random identifiers available on HTTP origins;
  the regression test explicitly removes `crypto.randomUUID`.
- Export and preview lock the editor without synthesizing a content change;
  generated PDFs and their edited filenames remain valid until an actual edit.
- `tests/release-usability-browser.py` adds actual HTTP/browser downloads, draft
  persistence/import, filename editing, duplicates and navigation to Docker CI.
  File sharing uses an explicit API test double; native share sheets require devices.
- Successful Actions runs for the exact release commit remain the authoritative
  container/browser verification. Local preflight does not replace that gate.
