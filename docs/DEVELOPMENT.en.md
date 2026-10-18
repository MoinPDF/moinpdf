# Development and verification

[Deutsch](ENTWICKLUNG.md) · **English** · [← README](../README.en.md)

## Local setup

You need **Node.js 22.13.0 or later** and the pnpm version specified in [package.json](../package.json). The lockfile keeps dependency installation reproducible.

```bash
pnpm install --frozen-lockfile
node scripts/prepare-pdf-assets.mjs
pnpm dev
```

The preparation script copies PDF workers, font resources, OCR workers and language data from installed dependencies into `public/vendor`. Production builds repeat this step. The development server uses the same React interface as the standalone installation.

## Builds

| Command | Result |
| --- | --- |
| `pnpm run build:selfhost` | Static web build in `dist/selfhost`. |
| `pnpm run package:pages` | Self-hosting build followed by a Pages package. |
| `pnpm run build` | Regular production build of the standalone web app. |
| `pnpm run typecheck:selfhost` | Type checking for the standalone web app. |

The static web build does not include a running document server. The [complete Docker installation](../DOCKER.en.md) connects the web app to the document server and translation service.

## Repository map

| Path | Contents |
| --- | --- |
| `components/studio/` | PDF workspace, tool views and navigation. |
| `lib/` | Tool catalogue, search, document processing and exports. |
| `selfhost/` | Entry point for the self-hosted web app. |
| `server/` | Document server, converters and checks. |
| `docker/` | Container configuration and translation service. |
| `docs/` | Handbook content and additional project documentation. |
| `media/` and `public/media/` | Banner catalogue and media materials. |
| `scripts/` | Builds, asset preparation and packaging. |
| `tests/` | Engine, server and browser checks. |

## Tests

These checks cover document processing and outputs. Server checks require the installed server components; audio checks also require the voice models.

- `pnpm audit`: known vulnerabilities, including development dependencies
- `python -m pip_audit --disable-pip --no-deps -r server/requirements.lock.txt`: the complete Python lockfile, including transitive packages (pip-audit 2.10.1)
- `pnpm run lint`: ESLint with no warnings allowed
- `node tests/release-workflow-smoke.mjs`: release safeguards against incorrect images, source commits or verification runs
- `pnpm test`: all browser-engine test suites listed in `tests/run-all.mjs`
- `node tests/complex-scripts-smoke.mjs`: 19 references generated with native HarfBuzz, glyph positions, independent PDF images, Unicode and atomic paragraph changes
- `node tests/nested-native-smoke.mjs`: shared and nested form/image resources, transformations, clipping, transparency and repeated editing
- `python tests/native-editor-browser.py`: production browser, local HarfBuzz/WASM, font fallback and group controls
- `pnpm test:evidence`: source-reference tools with real local OCR, independent PDF output checks, visible pseudonymisation, link targets, line-item comparison and safe exports
- `pnpm test:century`: returned forms, confirmed chronology, exact sums, hidden-script/attachment removal, actual layer pixels, measurements at four page rotations and audiobook chapters
- `python -m unittest server.test_audio -v`: real speech generation with both installed models, speed comparison, WAV/ZIP, authentication, input limits and temporary-file cleanup
- `pnpm test:advanced`: additional formats, search-based redaction, actual attachment cleanup, link coordinates, workflows, codes and camera perspective
- `pnpm test:pdf`: order, rotation, page export, ZIP, numbering, watermarks and input validation
- `pnpm test:studio`: real PDF.js exports and text extraction, redaction pixels, crop boundaries, text notes, N-up, paper sizes, blank pages, greyscale, flattening, metadata and cancellation. Normalised rotations are compared pixel by pixel with the original preview. Uses PDF.js's optional Node canvas dependency.
- `pnpm test:check`: text index, scan/blank-page hints, preview duplicates, mixed paper sizes, multi-term search, PDFs from matches and cancellation
- `pnpm test:tools`: tool names and natural-language searches, conversion direction, partial terms and unknown tasks
- `pnpm test:editor`: text removal/replacement, image placement, font variants, rotated and cropped pages
- `pnpm test:extra`: additional page tools, scan filters, attachments, metadata and PDF comparison
- `pnpm test:documents`: form values and fields, bookmarks, image extraction and preservation of existing document features
- `pnpm test:security`: AES-256 with an independent PDF.js reader, incorrect and Unicode passwords, permissions, forms/attachments, UBL/CII, XML errors, sums, exports and unchanged invoice XML
- `pnpm run typecheck:selfhost`, `pnpm run lint`, `pnpm run format:check` and the production build

Additional converter checks:

```bash
node tests/size-split-smoke.mjs
python -m unittest server.test_service server.test_expansion server.test_extended_documents -v
```

Automated browser checks cover multiple-file import, tool selection, search, mobile presentation, adopting results and document exports. Engine tests also read generated files independently, checking text, pages, image pixels, links or form fields as appropriate for each tool.

Server translation tests use a local HTTP test response to check request format, target-language forwarding and output. The [Docker integration workflow](../.github/workflows/docker.yml) adds a real LibreTranslate run. Other workflows check [documentation and the footer](../.github/workflows/documentation.yml) and [the published web app](../.github/workflows/published-web.yml).

## Maintaining the handbook

Content lives in [tool-guides.mjs](tool-guides.mjs) and [overview.mjs](overview.mjs). The build compares it with the actual tool catalogue and checks completeness and internal references.

```bash
node --experimental-strip-types scripts/build-documentation.mjs
```

The output is `public/dokumentation.html`. Both production builds generate the handbook automatically. It includes search, categories, directly linkable guides and a print view; content remains readable without JavaScript.

Maintain repository documentation in German and English together. The [README documentation index](../README.en.md#documentation) lists the matching guides. Preserve executable commands, file paths, API names, checksums and historical version facts when translating.

## Maintaining the media section

[media/banner-catalog.json](../media/banner-catalog.json) contains artwork, descriptions, pixel dimensions and SHA-256 checksums. Originals are in `public/media/banners/`.

```bash
node scripts/build-media.mjs
```

The build verifies originals and generates the media page, text files and a reproducible ZIP package. The media page works without JavaScript. Use original artwork and wordmarks in accordance with the [usage notes](../public/en/media/moinpdf-usage.txt).

## Libraries and licence notices

The project-wide [licence notice](../LICENSE.en.md) does not grant a blanket open-source licence. Explicitly licensed files and third-party components retain their existing rights and notices.

PDF.js, Tesseract.js and German/English language data use Apache-2.0; pdf-lib, JSZip and docx use MIT; Manrope and Space Grotesk use the SIL Open Font License. Licence texts from packages are included under `public/vendor/licenses`. qpdf/WASM for encryption, fontkit and Noto Sans for the invoice reading view are also served locally; their licence texts are under `public/vendor`. Code generation/reading also uses bwip-js and ZXing, whose licences are included. Browser features use locally served resources.

Additional local decoders, model runtime, exact source revisions and replacement of the LGPL library: [component notices](../public/component-notices/README.txt).

Wordmark font licences: [public/branding/LICENSES.txt](../public/branding/LICENSES.txt). Speech model versions and licences: [server/AUDIO-NOTICES.md](../server/AUDIO-NOTICES.md). Other server components are described in the [server documentation](../server/README.en.md).

## Formatting and maintenance

`pnpm run format` formats maintained application files. `pnpm run format:check` checks the same files without changing them. ESLint checks TypeScript and hook rules; any reported warnings remain visible in the logs, and the lint gate allows none. Real output tests verify document processing.

Dependabot proposes updates for JavaScript, Python, containers and GitHub Actions. Updates are not merged automatically. Feedback and contributions are described in [CONTRIBUTING.en.md](../CONTRIBUTING.en.md).

## Versioning

The central version number is in [package.json](../package.json) and appears in the footer. Version changes are documented in [CHANGELOG.en.md](../CHANGELOG.en.md). Docker image tags contain the version and source commit. Published releases also contain immutable image references with digests.

## Publishing a version

1. Update the version and changelog, and have the changes checked on `main`.
2. The complete Docker run must succeed. Only then does **Publish Docker images** start for that exact source commit.
3. Wait for all four images to succeed for amd64 and arm64. Artifacts `docker-image-web`, `docker-image-documents`, `docker-image-translation` and `docker-image-website` contain tags, digests, source commit and platforms.
4. **Publish verified release** runs after successful image publication. It can also be started manually under Actions on `main`, with the successful image run ID as `image_run_id`. It requires matching source commits, successful Docker checks, complete image references and a changelog for the current version. It then creates the tag and release with image evidence. Existing releases are not overwritten.

The source commit must not change between image build and release. Further changes require a new verified image build. Installation packages for external platforms are maintained outside this repository and use released images pinned by digest.

Additional font shaping: [HarfBuzz notices](../public/component-notices/harfbuzz/README.txt), [Noto checksums](../public/vendor/editor-fonts/NOTO-MANIFEST.json) and [OFL licence](../public/vendor/editor-fonts/NOTO-LICENSE.txt). Shaping references are generated independently by `tests/research/generate-native-shaping.py` using native system HarfBuzz; tests do not generate their expected values from the JavaScript library being tested.

---

[README](../README.en.md) · [Features and limitations](FEATURES.en.md) · [Docker guide](../DOCKER.en.md)
