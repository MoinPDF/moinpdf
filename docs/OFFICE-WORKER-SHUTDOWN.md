# Office worker shutdown investigation

## Finding

MoinPDF 0.14.4 can leave native Chromium worker threads alive after a local Office
conversion has produced a valid PDF. This is a real cleanup defect, not merely an
obsolete DevTools target. The result alone does not establish that all resources
were released. No damaged PDF or document upload was observed in this investigation.

The worker-side destroy handler explicitly terminated its eight pthread children.
The application then terminated their owner immediately after the destroy
acknowledgment. This nested shutdown sequence can strand Chromium worker threads.

## Independent reproduction

`tests/research/worker-shutdown-repro.py` uses no MoinPDF or LibreOffice code. It
creates an owner with eight children, four waiting in `Atomics.wait`, and tests
three shutdown sequences. Each sequence starts with a fresh browser. The control
runs both through a real local HTTP server and with Playwright request routing.

| Browser | Request path | Children then owner | Children then self-close | Owner terminates complete tree |
| --- | --- | --- | --- | --- |
| Chromium 140.0.7339.16 | Native HTTP | Failed | Failed | 100 cycles passed |
| Chromium 140.0.7339.16 | Intercepted HTTP | Failed | Failed | 100 cycles passed |
| Chromium 156.0.8078.4 | Native HTTP | Failed | Failed | 100 cycles passed |
| Chromium 156.0.8078.4 | Intercepted HTTP | Failed | Failed | 100 cycles passed |

The failed sequences retained two to four native Linux `DedicatedWorker` threads
after the ten-second cleanup deadline. Their runtime probes did not respond.
The corrected sequence completed all 400 controls.

[Control run and retained evidence](https://github.com/MoinPDF/moinpdf/actions/runs/38939987885).
This research workflow is intentionally red because it also runs the known-bad
sequences; it is separate from the release acceptance workflow.

Reproduce on Linux with Playwright 1.55.0 or 1.64.0 and its installed Chromium:

```sh
python tests/research/worker-shutdown-repro.py
MOINPDF_CONTROL_ROUTE=intercepted python tests/research/worker-shutdown-repro.py
```

This establishes the trigger and an effective shutdown sequence. It does not
identify the exact upstream Chromium C++ defect or claim an upstream fix.

## Correction in 0.14.5

Runtime patch `moinpdf-conversion-worker-11` removes the explicit child-pool
termination from the destroy handler. Document cleanup and its acknowledgment
remain. The application then calls `Worker.terminate()` on the owner, allowing
the browser to terminate the whole tree. The one-second fallback still bounds
cancellation when synchronous WASM cannot receive the destroy message.

The runtime is regenerated from the unchanged, checksum-pinned upstream archive.
Its new manifest and the component-notice checksum identify the exact patch.

## Complete converter teardown

The Docker acceptance run on 2026-10-23 exposed a second child-termination path:
the destroy handler calls `LibreOfficeConverter.destroy()`, which also terminated
the pool and each running/unused child. Patch 11 had removed only the handler's
direct call. The last cached DOCX conversion produced a correct PDF and received
its destroy acknowledgment, but an Office target and native threads survived.

Runtime patch `moinpdf-conversion-worker-12` removes that converter block as well.
Session and cached-document cleanup, LibreOfficeKit destruction, cleared runtime
references and the destroy acknowledgment remain. The page-side owner termination
and one-second cancellation fallback are unchanged.

`tests/browser-office-smoke.mjs` executes the actual generated worker in a Node VM,
covering both the converter and fallback paths, including native cleanup errors.
It verifies document cleanup and acknowledgment while rejecting any child-pool or
individual-child termination. The test fails against patch 11 and passes against
patch 12; it supplements the real-browser thread and PDF checks below.

## Acceptance checks

`tests/browser-office-browser.py` continues to enforce the ten-second cleanup
deadline. It now checks actual Linux renderer worker threads as well as CDP
targets; surviving threads fail the test. The expected PDF.js result-preview
worker is counted only if its exact URL matches and its runtime responds; extra
native threads cannot be hidden by allowing an arbitrary thread baseline.
Diagnostics preserve lifecycle events
and bounded probes instead of treating an unresponsive target as proof of cleanup.

The test independently reads and renders the resulting PDFs, checks text, images,
tables and formulas, and exercises repeated abort/restart with cached assets.
Network assertions reject document uploads and external requests.

[Isolated correction comparison](https://github.com/MoinPDF/moinpdf/actions/runs/38942064147)
uses the published 0.14.4 image with only the regenerated Office worker and its
integrity manifest replaced. It runs 69 conversions and 30 cancellations per
browser. The normal complete Docker workflow additionally verifies the rebuilt
release and the rest of the application.

These checks cover the reproduced cleanup defect. They do not establish that all
possible documents, browsers, devices or unrelated application paths are bug-free.
