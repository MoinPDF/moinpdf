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

Record failures with reproducible steps and non-sensitive evidence. A missing run
stays pending. Device checks complement the independent PDF/raster checks in CI.
