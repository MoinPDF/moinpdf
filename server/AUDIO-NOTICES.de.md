# Abhängigkeiten der lokalen Sprachausgabe

**Deutsch** · [English (Original)](AUDIO-NOTICES.md) · [← README](../README.md)

Deutsche Übersetzung der [englischen Komponentenhinweise](AUDIO-NOTICES.md). Die ursprünglichen Lizenztexte und Rechte bleiben unverändert.

MoinPDF verwendet Piper 1.8.0 in einem separaten, begrenzten Dokumenten-Worker. Die Engine steht unter GPL-3.0-or-later, nicht MIT. `audio_documents.py` wird unter GPL-3.0-or-later bereitgestellt; sein vollständiger Quelltext liegt im Image unter `/service`. Die übrigen vorhandenen Projektdateien behalten ihre jeweiligen Lizenzen. Vollständige, unveränderte Piper- und passende eSpeak-Build-Quellarchive liegen unter `/opt/moinpdf-tools/speech-source`, zusammen mit `SOURCE-MANIFEST.json` und `SHA256SUMS`. Worker, Dockerfile, Abhängigkeits-Lockfiles und Installationsskripte sind unter `/service` enthalten. Die Quellarchive erhalten die ursprünglichen Urheberrechts-, Lizenz- und Modellquellenhinweise. Sie enthalten die native Bridge, eSpeak-Wörterbuch-/Phonemquellen, ucd-tools und die ursprünglichen Build-Skripte; dem PyPI-sdist allein fehlt die Bridge.

Das Image installiert unveränderte Upstream-Wheels. Zum Neubau der Engine die mitgelieferten CMake-/Build-Anleitungen verwenden (CMake ab 3.26); Pipers CMake-Datei fixiert genau den eSpeak-Commit des zweiten Archivs. Ein Offline-Quellbuild muss dieses entpackte Archiv anstelle des Git-Checkouts von CMake verwenden. Ein unabhängig reproduzierbarer Wheel-Build wird nicht behauptet.

- Piper-Quelltext: https://github.com/OHF-Voice/piper1-gpl
- Genaue Quelldistribution für 1.8.0:
  https://files.pythonhosted.org/packages/02/cc/95b18b58d9c235d8e0bcece7321b7a7347873c14f9fea2c734b31ef04ff2/piper_tts-1.8.0.tar.gz
  SHA-256: `830588aded347df579c91a32703e0fc2a3685d84f1e3533b14f2de69135d4904`
- Piper bindet eSpeak NG ein (GPL-3.0-or-later): https://github.com/espeak-ng/espeak-ng
  Ursprüngliche Urheberrechts- und Lizenzhinweise bleiben im installierten Wheel erhalten.
- ONNX Runtime: MIT, https://github.com/microsoft/onnxruntime

Repository der Stimmmodelle: https://huggingface.co/rhasspy/piper-voices (MIT).
Beide Modelle verwenden CC0-Sprachdatensätze; diese sind von der Engine-Lizenz getrennt:

- Thorsten Voice: https://github.com/thorstenMueller/Thorsten-Voice
- Kerstin: https://github.com/rhasspy/dataset-voice-kerstin

Modelldateien, JSON-Konfigurationen und die einzelnen Upstream-Modellkarten sind in `voices.lock.json` auf Revision `c10ece1aade47bb51c153c893d14e5bf8e5b7117` fixiert. Alle sechs Dateien werden beim Imagebau mit SHA-256 geprüft. Karten und Lockfile bleiben im Image unter `/opt/moinpdf-tools/voices`. Während der Dokumentverarbeitung werden keine Stimmmodelle heruntergeladen.
