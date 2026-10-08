# Entwicklung und Prüfung

[← Zurück zur README](../README.md)

## Lokale Einrichtung

Voraussetzungen sind **Node.js ab 22.13.0** und die in [package.json](../package.json) festgelegte pnpm-Version. Der Lockfile hält die Abhängigkeiten reproduzierbar.

```bash
pnpm install --frozen-lockfile
node scripts/prepare-pdf-assets.mjs
pnpm dev
```

Das Vorbereitungsskript kopiert PDF-Worker, Schriftressourcen, OCR-Worker und Sprachdaten aus den installierten Abhängigkeiten nach `public/vendor`. Die Produktionsbuilds wiederholen diesen Schritt. Im verwalteten Sites-Umfeld gelten die vorgesehenen Setup-, Vorschau- und Build-Hilfen.

## Builds

| Befehl | Ergebnis |
| --- | --- |
| `pnpm run build:selfhost` | Statischer Web-Build unter `dist/selfhost`. |
| `pnpm run package:pages` | Selfhosting-Build mit anschließendem Pages-Paket. |
| `pnpm run build` | Build für die verwaltete Hosting-Umgebung. |
| `pnpm run typecheck:selfhost` | Typprüfung der eigenständigen Web-App. |

Der statische Web-Build allein enthält keinen laufenden Dokumentenserver. Die [vollständige Docker-Installation](../DOCKER.md) verbindet die Web-App mit Dokumentenserver und Übersetzungsdienst.

## Orientierung im Repository

| Pfad | Inhalt |
| --- | --- |
| `components/studio/` | PDF-Arbeitsplatz, Werkzeugansichten und Navigation. |
| `lib/` | Werkzeugkatalog, Suche, Dokumentverarbeitung und Exporte. |
| `selfhost/` | Einstieg für die eigenständig gehostete Web-App. |
| `server/` | Dokumentenserver, Konverter und Prüfungen. |
| `docker/` | Containerkonfiguration und Übersetzungsdienst. |
| `docs/` | Handbuchinhalte und ergänzende Projektdokumentation. |
| `media/` und `public/media/` | Bannerkatalog und Medienmaterialien. |
| `scripts/` | Build, Ressourcenaufbereitung und Paketerstellung. |
| `tests/` | Engine-, Server- und Browserprüfungen. |

## Tests

Die folgenden Prüfungen decken Dokumentverarbeitung und Ausgaben ab. Serverprüfungen setzen die installierten Serverkomponenten voraus; Audioprüfungen benötigen zusätzlich die Sprachmodelle.

- `pnpm test`: alle Browser-Engine-Testsuiten
- `pnpm test:evidence`: Fundstellenwerkzeuge mit tatsächlicher lokaler OCR, Gegenprüfung der PDF-Ausgaben, sichtbarer Pseudonymisierung, Linkzielen, Positionsvergleich und sicheren Exporten
- `pnpm test:century`: Formularrückläufe, bestätigte Chronologie, exakte Summen, versteckte Skript-/Anhangsentfernung, echte Ebenenpixel, Messungen bei vier Seitendrehungen und Hörbuchkapitel
- `python -m unittest server.test_audio -v`: echte Spracherzeugung mit beiden installierten Modellen, Tempovergleich, WAV/ZIP, Authentifizierung, Eingabegrenzen und temporäre Dateibereinigung
- `pnpm test:advanced`: zusätzliche Dateiformate, Suchschwärzung, echte Anhangsbereinigung, Linkkoordinaten, Workflows, Codes und Kameraperspektive
- `pnpm test:pdf`: Reihenfolge, Drehungen, Seitenexport, ZIP, Nummerierung, Wasserzeichen und Eingabeprüfung
- `pnpm test:studio`: echte PDF.js-Exporte und Textextraktion, Schwärzungs-Pixel, Zuschneidegrenzen, Textnotizen, N-up, Papierformate, Leerseiten, Graustufen, Fixieren, Metadaten und Abbruch. Normalisierte Drehungen werden pixelweise mit der Originalvorschau verglichen. Nutzt die optionale Node-Canvas-Abhängigkeit von PDF.js.
- `pnpm test:check`: Textindex, Scan- und Leerseitenhinweise, Vorschau-Duplikate, gemischte Papierformate, Suche mit mehreren Begriffen, PDF aus Fundstellen und Abbruch
- `pnpm test:tools`: Werkzeugnamen und natürliche Suchanfragen, Konvertierungsrichtung, Teilbegriffe und unbekannte Vorhaben
- `pnpm test:editor`: Text entfernen/ersetzen, Bildplatzierung, Schriftvarianten, gedrehte und zugeschnittene Seiten
- `pnpm test:extra`: zusätzliche Seitenwerkzeuge, Scanfilter, Anhänge, Metadaten und PDF-Vergleich
- `pnpm test:documents`: Formularwerte und Felder, Lesezeichen, Bilderextraktion und Erhalt bestehender Dokumentfunktionen
- `pnpm test:security`: AES-256 mit unabhängigem PDF.js-Leser, falsche und Unicode-Passwörter, Berechtigungen, Formulare/Anhänge sowie UBL/CII, XML-Fehler, Summen, Exporte und unveränderte Rechnungs-XML
- `pnpm exec tsc --noEmit` und Produktionsbuild

Weitere Konverterprüfungen:

```bash
node tests/size-split-smoke.mjs
python -m unittest server.test_service server.test_expansion server.test_extended_documents -v
```

Die automatisierten Browserprüfungen decken unter anderem Mehrfachimport, Werkzeugauswahl, Suche, mobile Darstellung, Ergebnisübernahme und Dokumentexporte ab. Die Engine-Tests lesen erzeugte Dateien zusätzlich unabhängig ein und prüfen je nach Werkzeug Text, Seiten, Bildpixel, Links oder Formularfelder.

Die Übersetzung wird in den Servertests mit einer lokalen HTTP-Testantwort auf Anfrageformat, Zielsprachenübergabe und Ausgabe geprüft. Der [Docker-Integrationsworkflow](../.github/workflows/docker.yml) ergänzt einen echten LibreTranslate-Durchlauf. Weitere Workflows prüfen [Dokumentation und Footer](../.github/workflows/documentation.yml), [die veröffentlichte Web-App](../.github/workflows/published-web.yml) und [die Umbrel-Installation](../.github/workflows/umbrel.yml).

## Handbuch pflegen

Die Inhalte liegen in [tool-guides.mjs](tool-guides.mjs) und [overview.mjs](overview.mjs). Der Build gleicht sie mit dem tatsächlichen Werkzeugkatalog ab und prüft Vollständigkeit sowie interne Verweise.

```bash
node --experimental-strip-types scripts/build-documentation.mjs
```

Das Ergebnis ist `public/dokumentation.html`. Beide Produktionsbuilds erzeugen das Handbuch automatisch. Suchfunktion, Kategorien, direkt verlinkbare Anleitungen und Druckansicht gehören zum Handbuch; Inhalte bleiben auch ohne JavaScript lesbar.

## Medienbereich pflegen

[media/banner-catalog.json](../media/banner-catalog.json) enthält Motive, Beschreibungen, Pixelmaße und SHA-256-Prüfsummen. Die Originaldateien liegen unter `public/media/banners/`.

```bash
node scripts/build-media.mjs
```

Der Build prüft die Originaldateien und erzeugt Medienseite, Textdateien und ein reproduzierbares ZIP-Paket. Die Medienseite funktioniert ohne JavaScript. Originalmotive und Schriftzüge entsprechend den [Nutzungshinweisen](../public/media/moinpdf-nutzung.txt) verwenden.

## Bibliotheken und Lizenzhinweise

PDF.js, Tesseract.js und deutsche/englische Sprachdaten (Apache-2.0), pdf-lib, JSZip und docx (MIT), Manrope und Space Grotesk (SIL Open Font License). Lizenztexte werden aus den Paketen unter `public/vendor/licenses` mitgeliefert. qpdf/WASM für Verschlüsselung, fontkit und Noto Sans für die E-Rechnungs-Leseansicht werden ebenfalls lokal ausgeliefert; zugehörige Lizenztexte liegen unter `public/vendor`. Für Codes kommen bwip-js und ZXing hinzu; ihre Lizenztexte werden ebenfalls mitgeliefert. Die Browserfunktionen verwenden lokal ausgelieferte Ressourcen.

Schriftlizenzen der Wortmarke: [public/branding/LICENSES.txt](../public/branding/LICENSES.txt). Modellversionen und Lizenzen der Sprachausgabe: [server/AUDIO-NOTICES.md](../server/AUDIO-NOTICES.md). Weitere Serverkomponenten sind in der [Serverdokumentation](../server/README.md) beschrieben.

## Versionierung

Die zentrale Versionsnummer steht in [package.json](../package.json) und wird im Footer angezeigt. Versionsänderungen sind in [CHANGELOG.md](../CHANGELOG.md) dokumentiert. Docker-Images enthalten Version und Quellcode-Commit im Tag; die Umbrel-Pakete binden Images zusätzlich per Digest.

---

[Zur README](../README.md) · [Funktionen und Grenzen](FUNKTIONEN.md) · [Docker-Anleitung](../DOCKER.md)
