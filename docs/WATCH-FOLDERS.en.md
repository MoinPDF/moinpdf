# Watched input folders

[Deutsch](WATCH-FOLDERS.md) · [Features](FEATURES.en.md)

The optional document server can process local PDF input folders without an open browser. This feature is off by default. The hosted web interface does not monitor folders on the user's device.

## Setup

1. In **Workflows**, select a supported linear workflow, such as **Prepare for sharing**. **Export for watched folders** produces `workflow.json` and explicitly rejects unsupported steps.
2. Beside the Compose files, create `watchfolders/filing/inbox`. Save `workflow.json` in `watchfolders/filing/`. Each additional profile has its own folder, using letters, digits, `_` and `-` (up to 64 characters).
3. Give the document server (default UID/GID `10001:10001`) read/write access to this dedicated directory. For a newly created folder, for example:

   ```sh
   mkdir -p watchfolders/filing/inbox
   # First copy the exported workflow.json into watchfolders/filing/.
   sudo chown -R 10001:10001 watchfolders
   docker compose -f compose.yaml -f compose.watch.yaml up -d --build
   ```

4. Place PDFs in `watchfolders/filing/inbox`. For reliable handoffs, write to a `.part` file first, then rename it to `.pdf` on the same filesystem once writing finishes. Results appear in `output`, job reports in `status`.

Without Compose, set `MOINPDF_WATCH_DIR` to an existing writable profile root. Only this explicitly mounted location is processed. A process lock prevents two watchers from using the same root concurrently.

## Supported steps and limits

- Rotate by 90°/180°, reverse page order, flatten forms, optimize losslessly, remove document metadata or comments.
- Versions 1 and 2 support 1–12 steps, OCR (deu+eng) and conservative blank-page removal. Conditions inspect filenames, readable text or page count, with an optional else step. Run OCR first for scans. Graphs and password steps are not exported.
- Version 2 splits at each page or a literal text match on the first page of a document. The matching page is retained. Filing rules use literal text; multiple different matching folders route to `Pruefen`, no match to `Unsortiert`.
- Filename placeholders: `{original}`, `{date}`, `{part}`, `{invoice}`. Dates and invoice numbers require an unambiguous match; otherwise `ohne-Datum`/`ohne-Nummer` is used. A job suffix prevents name collisions.
- OCR replaces text-poor scanned pages with a page image and recognised text. Forms or comments on those pages stop the job; existing links on those pages are not transferred. Blank pages are removed only without text/forms/comments or clearly visible content; removing every page is rejected.
- Unencrypted PDFs up to 80 MB and 200 pages. Signature fields and XFA are rejected. Up to 180 seconds per job, sharing the capacity limit with interactive server jobs.
- Text, vectors and ordinary form fields are retained by applicable steps. **Flatten forms** explicitly removes editability. Metadata removal is not comprehensive security sanitization.
- Inputs must remain unchanged for at least five seconds. Originals stay in `inbox` and are never automatically deleted. Results and reports are each written atomically.
- The file name, content and workflow determine the job identifier. Recorded jobs are not repeated after restarts. Changed input or workflow creates a new job, so changing a workflow also reprocesses older inputs still in its inbox.
- To retry a failed job, remove its JSON report from `status`. Do the same when a successful result was deleted and needs rebuilding. A crash between output and report triggers a retry that replaces the same result file; originals are retained.
- Errors appear in individual JSON reports; invalid profiles receive `configuration-error.json`. Symlinks are not accepted as inputs. Restrict directory access to trusted local users. The operator manages cleanup and retention.

Minimal workflow:

```json
{"version":1,"name":"Prepare for sharing","steps":[{"kind":"metadata"},{"kind":"remove-annotations"},{"kind":"optimizeLossless"}]}
```
