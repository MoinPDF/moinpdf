# Physical-device editor acceptance

Automated Chromium, Firefox and WebKit tests include desktop and narrow touch
viewports. WebKit automation does not establish native Safari or physical iPhone,
iPad or Android behavior. This checklist records that remaining evidence.

Status: physical-device execution pending; no devices are connected to this work environment.

For each run record the tested commit SHA, app URL, date, tester, device model,
OS version, browser/version and result. Use the fictional payroll fixture from
`node tests/editor-adaptive-fixtures.mjs`, never a private payslip in shared artifacts.

| Device/browser | Commit | OS/browser version | Result |
| --- | --- | --- | --- |
| iPhone / Safari | — | — | Pending |
| iPad / Safari | — | — | Pending |
| Android / Chrome | — | — | Pending |
| Windows touch / Edge | — | — | Pending |

1. Open the fictional scan, select September and replace it with August without
   changing font, size or position. Repeat with personal number 12 → 18.
2. Open/close the virtual keyboard, place the cursor, select words, apply formatting,
   undo/redo, scroll and switch pages while font preparation is pending. Focus must
   stay in the chosen control, and page controls must remain reachable.
3. Export, select both changed details, set shared zoom to 400% and pan both crops.
   Both images must use the same scale and pan position. The approximation notice
   must remain distinct from export verification. No page-wide horizontal overflow.
4. Save using the platform's download/share flow. Reopen the saved PDF in another
   viewer. Confirm both replacements, unchanged labels/amount/footer and attachment.
5. Reload/close and reopen the app, restore the correct local working state and
   verify all edits. Repeat with two tabs/documents so recovery does not mix them.
6. Restore zoom, horizontal/vertical scrolling, corrected table cells and OCR-review
   inputs. Passwords and explicit review confirmations must require fresh entry.
7. Compress a fictional PDF with links and an editable form. Compare both previews
   at 200% and pan them; download and verify the links and form in another viewer.
8. Correct an OCR line, apply it, download and search for the corrected text. The
   visible scan must remain unchanged. Check on-screen keyboard and long lines.
9. Pause a multi-file workflow, close/reopen and resume using the same inputs.
   Download one completed file and a partial ZIP; retry a failed file without
   repeating a previously completed rotation. Check the platform download flow.
10. Download the flowing Word mode and open it in the device's actual Word viewer.
    Edit a paragraph and a table cell; inspect images, page numbers and headers.

Record failures with reproducible steps and non-sensitive evidence. A missing run
stays pending. Device checks complement the independent PDF/raster checks in CI.

## Additional 0.21.0 acceptance (pending on physical devices)

11. Export an encrypted snapshot and a complete archive, reopen both after restarting,
    and reject a wrong password without changing the current document. Verify no
    password is restored. Inspect the originals/history inventory before download.
12. Export the flattened handoff. Inspect visible edits in another PDF viewer;
    confirm the absence of searchable text, interactive fields and original attachments.
13. Prepare core and chosen OCR languages, close every app tab, disconnect, restart
    and process a fictional PDF. Cancel a package download and verify incomplete
    packages are not advertised as ready. Remove offline packages without losing projects.
14. Review storage estimates and persistence grant/refusal. Exercise a nearly full
    browser profile and retain the original project when a write fails.
15. Open a fictional 200-page document, scroll repeatedly, edit and export. Record
    peak memory, opening/export time and failures on the actual device. Do not raise
    the 80 MB / 200-page limits on the basis of desktop emulation.
16. Compare an export with retained text, links and forms; deliberately flattened
    output must show differences. Replacing the output resets the acknowledgement.

## 0.21.1 verification recovery

Automated tests distinguish ordinary repeated exports from injected worker/font
stalls. Native macOS Safari adds a real form download and cancellation/re-export
case. These are not physical iOS checks. On each physical device, also cancel an
ongoing editor export, verify that the edit remains available, and export it again.
Record any verification retry or timeout and confirm that no unverified download
is offered. Native Microsoft Word open/edit/save/reopen remains pending.
