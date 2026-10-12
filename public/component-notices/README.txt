MoinPDF – zusätzliche lokale Komponenten (Entwicklung 0.9)

HEIC: libheif-js 1.23.2, LGPL-3.0
Paketquelle: https://github.com/catdad-experiments/libheif-js/tree/6ca00b818c0ff51cb2a5c75b9ce97d708083335a
Buildquelle: https://github.com/catdad-experiments/libheif-emscripten/tree/dd5a19b878149437a5a427f6e1afa8bac624a714
libheif-Quellstand: https://github.com/strukturag/libheif/tree/ac1cb05c39008f01525c991ff8b88f84ddf70fd2
libde265 1.0.15: https://github.com/strukturag/libde265/tree/v1.0.15
Der unveränderte WASM-Decoder wird separat über /vendor/images/libheif.js
und /vendor/images/libheif.wasm geladen. Die Bibliothek wurde mit
Emscripten 3.1.61 gebaut; das gepinnte Upstream-Workflow-Skript dokumentiert
USE_WASM=1, USE_UNSAFE_EVAL=0 und USE_TYPESCRIPT=1 sowie die Codec-Abhängigkeiten.
Vollständige LGPL-3.0- und GPL-3.0-Texte:
/vendor/licenses/libheif-js-LICENSE und /vendor/licenses/libheif-WASM-LICENSE.
Weitere libde265-Hinweise: /component-notices/libde265-COPYING.txt.
Es wurden keine Änderungen an der Bibliothek vorgenommen. Eine kompatible,
selbst neu gebaute Fassung kann durch Ersetzen dieser beiden Dateien in der
eigenen Installation verwendet werden. Die Schnittstelle und der Aufrufer
liegen in public/workers/image-decode.js; es gibt keine Signatur- oder
Hash-Sperre gegen eine eigene Decoderfassung. Die Lizenzbedingungen der
Bibliotheken bleiben von MoinPDF-Lizenzhinweisen unberührt.

PSD: ag-psd 31.0.2, MIT, Copyright Agamnentzar.
https://github.com/Agamnentzar/ag-psd
Enthaltene Paketabhängigkeiten base64-js und pako behalten ihre MIT-/Zlib-
Hinweise. Vollständige Texte werden nach /vendor/licenses/ kopiert.

Sprachmodell-Laufzeit: @wllama/wllama 3.8.1, MIT,
Copyright (c) 2024 Xuan Son NGUYEN.
https://github.com/ngxson/wllama
Enthält llama.cpp b11364-46ca246 (MIT); der zugehörige Text liegt unter
/component-notices/llama.cpp-LICENSE.txt. Die Modelldatei ist nicht Bestandteil
des App-Bundles. Optional verwendet wird Qwen2.5-0.5B-Instruct-GGUF,
Apache-2.0, Revision 9217f5db79a29953eb74d5343926648285ec7e67.
https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/tree/9217f5db79a29953eb74d5343926648285ec7e67
Datei: qwen2.5-0.5b-instruct-q4_0.gguf
SHA-256: 7671c0c304e6ce5a7fc577bcb12aba01e2c155cc2efd29b2213c95b18edaf6ed
Die Auswahl/Prüfung einer lokalen Modelldatei lädt weder Dokumente noch
Fragen zu Hugging Face hoch.

Testdaten für Pages/Visio/Publisher werden nur während der Tests aus dem
LibreOffice-Quellarchiv geladen. Sie sind keine ausgelieferten App-Ressourcen.
Commit und Git-Blob-Prüfsummen stehen in tests/fetch-office-fixtures.py.

Statistische Sprachwahl: franc 6.2.0 (MIT), https://github.com/wooorm/franc.
Der vollständige Upstream-Lizenztext aus Tag 6.2.0 liegt unter
/component-notices/franc-LICENSE.txt und /vendor/licenses/franc-LICENSE.txt.
Die MIT-Texte der Abhängigkeiten trigram-utils, n-gram und
collapse-white-space werden ebenfalls unter /vendor/licenses/ ausgeliefert.
Die Sprachprobe verarbeitet Text ausschließlich auf dem lokalen Gerät.

Browser-Office 2.7.2: browser-office/README.txt mit vollständigen Komponentenhinweisen, Fontlizenzen und Quellverweisen. Lokale Signatur: PKI.js/ASN1.js; Absatzrichtung: bidi-js; Lizenzkopien unter /vendor/licenses/. DejaVu-Editor-Schriften: /vendor/editor-fonts/LICENSE.txt.

Komplexe Absatzschriften: harfbuzz/README.txt; HarfBuzzJS 1.6.2 mit HarfBuzz 14.5.0. Gepinnte Noto-Schriften und Prüfsummen unter /vendor/editor-fonts/NOTO-MANIFEST.json, OFL-Lizenz daneben.
