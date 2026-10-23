# Working on MoinPDF

- Complete changes, run the relevant checks and integrate the verified result into
  `main` as part of each change. A preview or an unmerged feature branch does not
  complete the task. Use a pull request when CI needs to validate a branch, then
  merge the tested head. Do not force-push or bypass failed required checks.
- Include shared editor changes made in the hosted Site in the GitHub source.
  Preserve the different Site and self-hosted build/deployment configurations.
- Publish an updated existing Site when requested work changes that Site; preserve
  its audience. A GitHub merge does not require a new release or Docker tag unless
  the task requests one.
- Keep private customer PDFs, document text and screenshots out of the repository,
  CI artifacts and public reports. Use licensed public or clearly fictional fixtures.
- Report browser automation, touch emulation, native Safari and physical-device
  checks separately. Never count an unavailable device as tested.
