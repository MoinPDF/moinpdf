# Verification and evidenced version

[Deutsch](VALIDATION.md) · **English** · [← README](README.en.md)

The version number is in [package.json](package.json). A successful run provides evidence only for the commit shown in that run, not for later changes or arbitrary documents.

## Automated checks

| Area | Scope |
| --- | --- |
| Source code | TypeScript, ESLint without warnings, consistent formatting and dependency audit |
| Browser engines | 44 suites using real PDFs, independent readers, and checks for text, pixels, forms, links and encryption |
| Document server | 65 tests: native converters, authentication, size/time limits, translation, cleanup, audio, accessibility, long-term signatures and upload parsers |
| Integration | Real Office conversion, German/English translation, local speech generation, restart and preserved models |
| Interface | All tool views on desktop and mobile, PDF/EPUB/audio downloads |
| Documentation and media | Search, categories, printing, downloads, video, no horizontal overflow and preserved working files |
| Legal pages | 1440, 390 and 320 pixels, shared palette, contact links and spacing between address and email |
| Containers | Platform indexes for amd64 and arm64, plus fixed digests |

[Current runs](https://github.com/MoinPDF/moinpdf/actions) and their artifacts can be inspected by people with repository access. [docs/DEVELOPMENT.en.md](docs/DEVELOPMENT.en.md) explains how to run the checks.

## Evidenced baseline

Version **0.9.1**, commit `b488a9ce0358ce54fb3030e1b66bc8d20b3b04e4`, passed the [Docker run on 11 October 2026](https://github.com/MoinPDF/moinpdf/actions/runs/38149865248): 24 browser-engine suites, 56 server tests, all 112 tool views, conversion, translation, restart, access protection and real local model inference. New versions receive their own runs; this evidence does not automatically cover later changes to `main`.

## Limitations and operator checks

- ARM images are built and their platform indexes checked. This does not establish a successful native ARM run.
- Full interface checks run in Chromium. Additional PDF text and OCR checks run in Firefox and native Safari. Specific smartphones and native share sheets still require device testing.
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
