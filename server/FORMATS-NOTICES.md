# Additional document formats — sources and notices

The runtime invokes the following installed components as separate programs or libraries. Their upstream licences remain applicable to distribution of the container and its dependencies.

| Component | Purpose | Upstream licence/source |
| --- | --- | --- |
| Calibre (Debian package) | DRM-free MOBI/AZW3 import and AZW3 export | GNU GPL v3, [source](https://github.com/kovidgoyal/calibre), [Debian source packages](https://sources.debian.org/src/calibre/); installed notices in `/usr/share/doc/calibre/` |
| libarchive (Debian package) | RAR/CBR reading and output verification | BSD, [source](https://github.com/libarchive/libarchive); installed notices in `/usr/share/doc/libarchive13/` |
| libarchive-c 5.3 | Python libarchive binding | CC0, [source](https://github.com/Changaco/python-libarchive-c) |
| LibreOffice | Legacy Office import and RTF/ODT/ODP output | Existing distribution notices, [source and licences](https://www.libreoffice.org/about-us/licenses/) |
| marked 18.1.3 | Browser Markdown parsing | MIT, [source](https://github.com/markedjs/marked) |
| QPDF WASM | Complete PDF JSON roundtrip | Existing QPDF/package notices, [JSON format](https://qpdf.readthedocs.io/en/stable/json.html) |

RAR creation is optional. No proprietary RAR executable or licence is bundled, downloaded or activated. Operators supply a compatible, appropriately licensed executable themselves. CBR import and local CBZ output do not require that executable.

Tests download public, pinned sample files with Git blob-hash verification rather than embedding private documents. LibreOffice WPD/Works fixtures are pinned in `tests/fetch-office-fixtures.py`. The nonblank Microsoft Works fixture `testWORKS.wps` is from Apache Tika commit `3d2a7592d47c378962bf24040b7d764d83c0bda7` (Apache-2.0 project); source and blob hash are recorded in the downloader. Synthetic PDFs, images and stored RAR test archives contain fictional content only.
