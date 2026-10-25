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
