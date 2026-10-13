# Entwicklung und Prüfung

[← Zurück zur README](../README.md)

## Lokale Einrichtung

Voraussetzungen sind **Node.js ab 22.13.0** und die in [package.json](../package.json) festgelegte pnpm-Version. Der Lockfile hält die Abhängigkeiten reproduzierbar.

```bash
pnpm install --frozen-lockfile
node scripts/prepare-pdf-assets.mjs
pnpm dev
```

Das Vorbereitungsskript kopiert PDF-Worker, Schriftressourcen, OCR-Worker und Sprachdaten aus den installierten Abhängigkeiten nach `public/vendor`. Die Produktionsbuilds wiederholen diesen Schritt. Der Entwicklungsserver verwendet dieselbe React-Oberfläche wie die eigenständige Installation.

## Builds

| Befehl | Ergebnis |
| --- | --- |
| `pnpm run build:selfhost` | Statischer Web-Build unter `dist/selfhost`. |
| `pnpm run package:pages` | Selfhosting-Build mit anschließendem Pages-Paket. |
| `pnpm run build` | Regulärer Produktionsbuild der eigenständigen Web-App. |
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

- `pnpm audit`: bekannte Schwachstellen einschließlich Entwicklungsabhängigkeiten
- `python -m pip_audit --disable-pip --no-deps -r server/requirements.lock.txt`: vollständiger Python-Lockfile einschließlich transitiver Pakete (pip-audit 2.10.1)
- `pnpm run lint`: ESLint ohne zugelassene Warnungen
- `node tests/release-workflow-smoke.mjs`: Freigabesicherheit bei falschen Images, Quellständen oder Prüfläufen
- `pnpm test`: alle 30 Browser-Engine-Testsuiten
- `node tests/complex-scripts-smoke.mjs`: 19 mit nativem HarfBuzz erzeugte Referenzen, Glyphenpositionen, unabhängige PDF-Bilder, Unicode und atomare Absatzänderung
- `node tests/nested-native-smoke.mjs`: geteilte und verschachtelte Form-/Bildressourcen, Transformationen, Beschnitt, Transparenz und mehrfache Bearbeitung
- `python tests/native-editor-browser.py`: Produktionsbrowser, lokales HarfBuzz/WASM, Font-Fallback und Gruppenbedienung
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
- `pnpm run typecheck:selfhost`, `pnpm run lint`, `pnpm run format:check` und Produktionsbuild

Weitere Konverterprüfungen:

```bash
node tests/size-split-smoke.mjs
python -m unittest server.test_service server.test_expansion server.test_extended_documents -v
```

Die automatisierten Browserprüfungen decken unter anderem Mehrfachimport, Werkzeugauswahl, Suche, mobile Darstellung, Ergebnisübernahme und Dokumentexporte ab. Die Engine-Tests lesen erzeugte Dateien zusätzlich unabhängig ein und prüfen je nach Werkzeug Text, Seiten, Bildpixel, Links oder Formularfelder.

Die Übersetzung wird in den Servertests mit einer lokalen HTTP-Testantwort auf Anfrageformat, Zielsprachenübergabe und Ausgabe geprüft. Der [Docker-Integrationsworkflow](../.github/workflows/docker.yml) ergänzt einen echten LibreTranslate-Durchlauf. Weitere Workflows prüfen [Dokumentation und Footer](../.github/workflows/documentation.yml) und [die veröffentlichte Web-App](../.github/workflows/published-web.yml).

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

Der projektweite [Lizenzstatus](../LICENSE) erteilt keine pauschale Open-Source-Freigabe. Ausdrücklich lizenzierte Dateien und Drittanbieterkomponenten behalten ihre bestehenden Rechte und Hinweise.


PDF.js, Tesseract.js und deutsche/englische Sprachdaten (Apache-2.0), pdf-lib, JSZip und docx (MIT), Manrope und Space Grotesk (SIL Open Font License). Lizenztexte werden aus den Paketen unter `public/vendor/licenses` mitgeliefert. qpdf/WASM für Verschlüsselung, fontkit und Noto Sans für die E-Rechnungs-Leseansicht werden ebenfalls lokal ausgeliefert; zugehörige Lizenztexte liegen unter `public/vendor`. Für Codes kommen bwip-js und ZXing hinzu; ihre Lizenztexte werden ebenfalls mitgeliefert. Die Browserfunktionen verwenden lokal ausgelieferte Ressourcen.

Zusätzliche lokale Decoder, Modelllaufzeit, genaue Quellstände und Austausch der LGPL-Bibliothek: [Komponentenhinweise](../public/component-notices/README.txt).

Schriftlizenzen der Wortmarke: [public/branding/LICENSES.txt](../public/branding/LICENSES.txt). Modellversionen und Lizenzen der Sprachausgabe: [server/AUDIO-NOTICES.md](../server/AUDIO-NOTICES.md). Weitere Serverkomponenten sind in der [Serverdokumentation](../server/README.md) beschrieben.

## Formatierung und Wartung

`pnpm run format` formatiert die gepflegten Anwendungsdateien. `pnpm run format:check` prüft dieselben Dateien ohne Änderungen. ESLint prüft TypeScript und Hook-Regeln; Warnungen zu schrittweisen Verbesserungen bleiben im Prüfprotokoll sichtbar. Dokumentverarbeitung wird durch echte Ausgabetests abgesichert.

Dependabot schlägt Aktualisierungen für JavaScript, Python, Container und GitHub Actions vor. Aktualisierungen werden nicht automatisch gemergt. Rückmeldungen und Beiträge sind in [CONTRIBUTING.md](../CONTRIBUTING.md) beschrieben.

## Versionierung

Die zentrale Versionsnummer steht in [package.json](../package.json) und wird im Footer angezeigt. Versionsänderungen sind in [CHANGELOG.md](../CHANGELOG.md) dokumentiert. Docker-Images enthalten Version und Quellcode-Commit im Tag. Veröffentlichte Releases enthalten zusätzlich die unveränderlichen Image-Referenzen mit Digest.

---

[Zur README](../README.md) · [Funktionen und Grenzen](FUNKTIONEN.md) · [Docker-Anleitung](../DOCKER.md)


## Eine Version veröffentlichen

1. Versionsnummer und Changelog aktualisieren und die Änderungen auf `main` prüfen lassen.
2. Der vollständige Docker-Lauf muss erfolgreich sein. Erst danach startet
   **Publish Docker images** für genau diesen Quellstand.
3. Den erfolgreichen Abschluss aller vier Images für amd64 und arm64 abwarten.
   Die Artefakte `docker-image-web`, `docker-image-documents` und
   `docker-image-translation` sowie `docker-image-website` enthalten Tags, Digests, Quellstand und Plattformen.
4. Unter Actions **Publish verified release** auf `main` starten und als
   `image_run_id` die ID des erfolgreichen Image-Laufs angeben. Der Workflow
   verlangt identische Quellstände, bestandene Docker-Prüfungen, vollständige
   Image-Referenzen und einen Changelog für die aktuelle Version. Anschließend
   erstellt er Tag und Release samt Image-Nachweisen. Bestehende Releases werden
   nicht überschrieben.

Zwischen Image-Build und Release darf sich der Quellstand nicht ändern.
Weitere Änderungen benötigen einen neuen geprüften Image-Build.
Installationspakete für externe Plattformen werden außerhalb dieses Repositorys
gepflegt und verwenden die freigegebenen, per Digest festgelegten Images.

Zusätzliche Schriftformung: [HarfBuzz-Hinweise](../public/component-notices/harfbuzz/README.txt), [Noto-Prüfsummen](../public/vendor/editor-fonts/NOTO-MANIFEST.json) und [OFL-Lizenz](../public/vendor/editor-fonts/NOTO-LICENSE.txt). Die Formreferenzen werden unabhängig mit `tests/research/generate-native-shaping.py` und dem nativen System-HarfBuzz erzeugt; die Tests erzeugen ihre Sollwerte nicht aus der verwendeten JavaScript-Bibliothek.
