# Local Office to PDF

[Deutsch](BROWSER-OFFICE.md) · **English** · [← README](../README.en.md)

MoinPDF 0.11.0 introduced `@matbee/libreoffice-converter` 2.7.2 with LibreOffice/WASM. Word, Excel, PowerPoint, OpenDocument and RTF are processed in the browser by default. Pages, Visio and Publisher remain features of your own document server. A failed local job is not uploaded automatically.

The input limit is 40 MB. The runtime requires HTTPS or localhost, COOP/COEP, SharedArrayBuffer and DecompressionStream. It reserves 1 GiB of shared WASM memory; total requirements exceed 1 GB of free RAM. This mode is unreliable on mobile devices with little memory.

On first use, about 75 MB of compressed program data is loaded from the same origin. Pinned checksums verify the archive, individual chunks and extracted resources. An optional browser cache stores program files only, never documents or results. The manifest and JavaScript must remain reachable; this is not a complete offline mode. After success, failure or cancellation, the destroy protocol runs first and the pthread pool shuts down. If the runtime does not respond, it is forcibly terminated after at most one second. The next job starts a fresh runtime.

## Sources and components

- [Matbee source revision](https://github.com/matbeedotcom/libreoffice-document-converter/tree/b72a3d584bc28c5111afafcf25def7a24fb5fcb0)
- [LibreOffice core](https://github.com/LibreOffice/core/tree/d1c9e0e4e1ddeb24fe8f93e56860b3765043f8b1)
- [Included notices, source references and font sources](../public/component-notices/browser-office/README.txt)

TGZ SHA-256: `14d670936fe220ee49becbfd40bf233ceabb94981fa9987fccde345449ee2c3a`.

PDF export uses direct load/save operations; additional editor page queries are only required for image exports. The PDF page count is then read from the generated file. `scripts/prepare-office-assets.mjs` prepares the runtime from this verified archive for every production build. All 137 embedded font paths are inventoried. The collection contains various licences; MPL-2.0 is not a blanket licence for every font and library. LibreOffice's licence catalogue also includes optional components and is not an exact inventory of all statically linked libraries.

The browser worker is adapted for conversion only: `noInitialRun=true` prevents Emscripten from starting a second Office application on a background thread alongside LibreOfficeKit. Dummy polling callbacks needed only for editor input events are not registered, allowing the regular LibreOfficeKit yield path to process XLSX imports; verbose LibreOffice debug output respects `verbose=false`. Exact changes are recorded in `MOINPDF-PATCHES.json` beside the unmodified original sources. The build rejects unexpected source text and recalculates the patched worker's checksum.

Before the first native calls, the adapter waits for all prestarted pthreads to become ready. Graphics import, image scaling and formula calculation run sequentially using LibreOffice's intended environment options. These are set in `preRun` before native environment initialisation; changing `Module.ENV` afterwards is insufficient because Emscripten caches the environment. The thread pool contains eight preloaded workers. Synchronous native thread starts must not load another browser worker, which could start only after control returns to JavaScript's event loop. The adapter therefore checks readiness at every start and explicitly fails if the pool is exhausted. The browser test records these starts and the available pool. WASM and embedded resources remain unchanged. Background: [Emscripten pthreads — special considerations](https://emscripten.org/docs/porting/pthreads.html#special-considerations).

## Verification

During shutdown, the runtime first acknowledges document cleanup. Only the calling browser code then terminates the complete worker tree; competing runtime self-closure has been removed. An unresponsive runtime is forcibly terminated after one second. Checks for surviving native worker threads remain unchanged.

`tests/browser-office-browser.py` converts six Office/ODF fixtures and three richer DOCX/XLSX/PPTX files in real production Chromium. MuPDF checks text, umlauts, images, table/chart drawings, the calculated amount 53.30 and both presentation pages. Tests also cover 15 cancellation/restart cycles without reloading, further conversions after success, blocked binary downloads, absence of document uploads and complete termination of Office workers. The current GitHub CI run determines release readiness.

Complex layouts, missing fonts, macros and external data sources may produce different results. Macros are not enabled; the adapter exposes neither arbitrary loading options nor document passwords. General fidelity to the original and PDF/A compliance are not claimed. Review outputs before using them.
