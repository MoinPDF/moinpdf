# Local speech dependencies

[Deutsch](AUDIO-NOTICES.de.md) · **English (original)** · [← README](../README.en.md)

MoinPDF uses Piper 1.8.0 in a separate, bounded document worker. The engine is
GPL-3.0-or-later, not MIT. `audio_documents.py` is provided under
GPL-3.0-or-later; its complete source is shipped in `/service` in the image.
The other existing project files retain their respective licenses. Complete,
unmodified Piper and matching eSpeak build-source archives are included in
`/opt/moinpdf-tools/speech-source`, with `SOURCE-MANIFEST.json` and `SHA256SUMS`.
The worker, Dockerfile, dependency locks and installers are included in `/service`.
The source archives retain the original copyright, license and model-source
notices. They include the native bridge, eSpeak dictionary/phoneme sources,
ucd-tools and the original build scripts; the PyPI sdist alone lacks the bridge.

The image installs unmodified upstream wheels. To rebuild the engine, use the
included upstream CMake/build instructions (CMake 3.26 or later); Piper's CMake
file pins the exact eSpeak commit included in the second archive. An offline
source build must use that extracted archive instead of CMake's Git checkout.
No independently reproducible wheel build is claimed.

- Piper source: https://github.com/OHF-Voice/piper1-gpl
- Exact 1.8.0 source distribution:
  https://files.pythonhosted.org/packages/02/cc/95b18b58d9c235d8e0bcece7321b7a7347873c14f9fea2c734b31ef04ff2/piper_tts-1.8.0.tar.gz
  SHA-256: `830588aded347df579c91a32703e0fc2a3685d84f1e3533b14f2de69135d4904`
- Piper embeds eSpeak NG (GPL-3.0-or-later): https://github.com/espeak-ng/espeak-ng
  Upstream copyright/license notices are retained in the installed wheel.
- ONNX Runtime: MIT, https://github.com/microsoft/onnxruntime

Voice model repository: https://huggingface.co/rhasspy/piper-voices (MIT).
The two models use CC0 voice datasets; these are separate from the engine license:

- Thorsten Voice: https://github.com/thorstenMueller/Thorsten-Voice
- Kerstin: https://github.com/rhasspy/dataset-voice-kerstin

Model files, JSON configurations, and the individual upstream model cards are
pinned to revision `c10ece1aade47bb51c153c893d14e5bf8e5b7117` in
`voices.lock.json`. All six files are SHA-256 checked during image construction.
The cards and lock file remain in `/opt/moinpdf-tools/voices` in the image.
No voice model download is performed during document processing.
