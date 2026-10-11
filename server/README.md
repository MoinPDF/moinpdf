# MoinPDF-Dokumentenserver

> **Für die vollständige App inklusive Übersetzungen:** `docker compose up -d --build` im Repository-Hauptverzeichnis ausführen. Siehe [Docker-Anleitung](../DOCKER.md). Die nachfolgende Anleitung betrifft ausschließlich einen separaten Dokumentenserver für eine bereits anderweitig gehostete Web-App.

Viele Werkzeuge verarbeiten Dateien lokal im Browser. Dieser Server ergänzt die unten beschriebenen Konvertierungen und Prüfungen:

| Funktion | Verarbeitung | Ergebnis |
| --- | --- | --- |
| Office zu PDF | LibreOffice (Word, Excel, PowerPoint, OpenDocument, Pages, Visio, Publisher) | PDF |
| PDF/A erzeugen und prüfen | Ghostscript und veraPDF, Profile 1b/2b/3b | Archivkopie + XML-Prüfbericht + JSON im ZIP |
| XRechnung vollständig validieren | KoSIT 1.6.3, XRechnung-Konfiguration 3.0.2 vom 31.08.2026 | Vollständiger XSD-/Schematron-Bericht im ZIP |
| Zertifikatssignaturen | pyHanko, PKCS#12 und Prüfung bestehender Signaturen | Signierte PDF bzw. JSON-Bericht |

Die vollständige Docker-Installation verbindet Web-App und Dokumentenserver automatisch. Bei einer separat gehosteten Web-App ohne konfigurierten Serverproxy werden Serveradresse und API-Schlüssel eingetragen. Eine Verbindung wird ohne Dokumentübertragung geprüft. Dateien werden erst mit dem jeweiligen Verarbeitungsauftrag gesendet.

## Separaten Dokumentenserver mit Docker Compose starten

Voraussetzungen: Linux-Server mit Docker Compose, etwa 2 GB freiem RAM, eine auf diesen Server zeigende Domain und erreichbare Ports 80/443. Die bereitgestellte Compose-Datei betreibt Caddy mit HTTPS und hält den Dokumentencontainer in einem internen Netzwerk ohne ausgehenden Internetzugriff.

```bash
cd server
cp .env.example .env
python3 -c 'import secrets; print(secrets.token_urlsafe(48))'
```

Den erzeugten Schlüssel, die Serverdomain und die genaue Adresse der App in `.env` eintragen. `MOINPDF_ORIGINS` kann mehrere mit Komma getrennte App-Adressen enthalten; keine abschließenden Schrägstriche. `.env` gehört nicht in Git.

```bash
docker compose up -d --build
docker compose ps
```

In der App ein Serverwerkzeug öffnen, `https://deine-serverdomain` und den Schlüssel eingeben und **Verbindung und Funktionen prüfen** anklicken. Jede Serverkomponente wird einzeln als bereit oder fehlend angezeigt. Der Server startet ohne ausreichenden Schlüssel keine Dokumentenaufträge.

## Prüfungen und Betriebsverhalten

- Pro Auftrag wird ein eigenes temporäres Verzeichnis verwendet und anschließend gelöscht. Aufträge und Dateiinhalte werden nicht dauerhaft gespeichert. Der MoinPDF-API-Schlüssel wird nicht an Konverter-Unterprozesse weitergegeben. Nur der Übersetzungsauftrag erhält bei Bedarf den separat konfigurierten LibreTranslate-Schlüssel. Zertifikatspasswörter werden weder in Befehlszeilen noch in Berichten abgelegt.
- Höchstens zwei gleichzeitige Dokumentenaufträge; native Konverter werden nach drei Minuten einschließlich Kindprozessen beendet. Dateigrenze 80 MB, Rechnungs-XML 10 MB, Zertifikat 2 MB. HTTP-Abbruch im Browser beendet zunächst das Warten; ein bereits gestarteter Serverauftrag läuft bis Abschluss oder Timeout weiter.
- LibreOffice verwendet ein frisches Profil mit deaktivierten Makros. Der Container hat ein schreibgeschütztes Dateisystem, ein temporäres Arbeitsverzeichnis und keinen Internetzugriff. Office-Layout hängt unter anderem von den verfügbaren Schriften ab. Eigene lizenzierte Schriften können beim Image-Build ergänzt werden.
- PDF/A gilt nur bei bestandenem veraPDF-Check als konform. Bei einem fehlgeschlagenen Check heißt die Ausgabedatei ausdrücklich `NICHT-PDF-A-konform.pdf`. Die neue Archivkopie kann Formulare, Anhänge, aktive Elemente und bestehende Signaturen verändern oder verlieren; die Originaldatei bleibt erhalten. Das Profil 3b allein erzeugt keine ZUGFeRD-Rechnung.
- KoSIT wendet die vollständig installierte Szenariokonfiguration an. Akzeptanz und Version stehen in `Ergebnis.json`, alle Einzelregeln im unveränderten XML-Bericht. DTDs und externe XML-Entitäten werden abgelehnt.
- Die Signaturprüfung unterscheidet kryptografische Integrität, Dokumentänderungen, Zertifikatsvertrauen, Widerruf und Zeitstempel. Eigene vertrauenswürdige CA-Zertifikate liegen als PEM in `trust/`, Sperrnachweise als DER-Dateien mit Endung `.crl` oder `.ocsp` in `trust/revocation/`. Eingebettete DSS-Nachweise werden ebenfalls geprüft. Fehlende oder abgelaufene Nachweise begründen kein Vertrauen; es gibt keine automatische Netzabfrage an Zertifikatsadressen. Ein qualifizierter Signaturstatus wird nicht bestätigt.
- Das Basisprofil signiert ohne externen Zeitstempel. PAdES-T, -LT und -LTA sowie die Erneuerung einer LTA-Zeitstempelkette benötigen explizite Vertrauensanker, passende Sperrnachweise und `MOINPDF_TSA_URL` mit HTTPS; optional authentifiziert `MOINPDF_TSA_BEARER` den Betreiber beim Zeitstempeldienst. Der Betreiber muss dessen gezielte Erreichbarkeit aus dem isolierten Netz einrichten. Das Setzen der URL öffnet das Containernetz nicht. Fehlgeschlagene Signatur-, Zeitstempel- oder Langzeitprüfungen blockieren die erweiterte Ausgabe.

## Lokale Entwicklung und Tests

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.lock.txt
pip install httpx==0.28.1
cd ..
python tests/fetch-office-fixtures.py
python -m unittest server.test_service server.test_expansion server.test_extended_documents server.test_expansion_documents server.test_tags server.test_signatures server.test_import_formats -v
```

Native Integrationstests werden ausgeführt, wenn Java, Ghostscript und die in `MOINPDF_TOOLS` installierten Werkzeuge verfügbar sind. Für Office ist zusätzlich LibreOffice nötig; beide Aufrufnamen `libreoffice` und `soffice` werden unterstützt. Die Office-Prüfung konvertiert synthetische DOCX-, XLSX-, PPTX-, ODT-, ODS- und ODP-Dateien und liest jede PDF anschließend unabhängig ein. Fehlende native Komponenten werden als übersprungen gemeldet. Installation in einen lokalen Ordner:

```bash
MOINPDF_TOOLS="$PWD/server/tools" python server/install_tools.py
MOINPDF_TOOLS="$PWD/server/tools" python -m unittest server.test_service server.test_expansion server.test_extended_documents -v
```

## Versionen und Quellen

`tools.lock.json` fixiert Download-URLs und SHA-256-Prüfsummen. Die Installation bricht bei einer abweichenden Prüfsumme ab. `requirements.lock.txt` hält die getesteten Python-Paketversionen fest. Upstream-Versionen und ihre Regeln sollten bewusst aktualisiert und erneut getestet werden.

- [LibreOffice: PDF-Exportparameter](https://help.libreoffice.org/latest/en-US/text/shared/guide/pdf_params.html)
- [LibreOffice: Programmaufruf und Parameter](https://help.libreoffice.org/latest/en-US/text/shared/guide/start_parameters.html)
- [KoSIT: Validator und CLI](https://github.com/itplr-kosit/validator/blob/v1.6.3/docs/cli.md)
- [KoSIT: XRechnung-Konfiguration](https://github.com/itplr-kosit/validator-configuration-xrechnung/releases/tag/v2026-08-31)
- [veraPDF: Installation](https://docs.verapdf.org/install/) und [Validierung](https://docs.verapdf.org/cli/validation/)
- [pyHanko: Signaturbibliothek](https://docs.pyhanko.eu/en/stable/lib-guide/signing.html)

Die heruntergeladenen Programme unterliegen ihren jeweiligen Upstream-Lizenzen. Insbesondere die Ghostscript-Lizenz (AGPL) ist bei einer Weitergabe des Container-Images zu beachten. Lizenzdateien sind in den installierten Distributionen enthalten.


## Erweiterte Werkzeuge

Die aktuelle Serverversion ergänzt PDF→Word (pdf2docx), PDF→PowerPoint (python-pptx), EML/MSG→PDF (email/extract-msg und LibreOffice), statischen HTML-Import (MuPDF Story), Tesseract-OSD-Ausrichtung, Buchfalzkorrektur, Formularerkennung, Dokumentprüfungen, Word/Excel-Serienbriefe sowie ZUGFeRD (Mustang 2.26.0). Die App prüft jede Fähigkeit einzeln; nach dem Aktualisieren des Codes das Docker-Image neu bauen.

Neue API-Routen:

- `POST /v1/pdf-to-word`: PDF als `file`, Ergebnis DOCX; Layoutrekonstruktion, reine Scans werden mit OCR-Hinweis abgewiesen.
- `POST /v1/office` unterstützt zusätzlich Pages 4/5, VSD/VSDX und Publisher. Umbenannte Textdateien und Archive ohne passende Dokumentstruktur werden abgewiesen. Echte Beispieldateien werden über gepinnte LibreOffice-Testdaten geprüft; komplexe Layouts bleiben von der LibreOffice-Unterstützung und den installierten Schriften abhängig.
- `POST /v1/email`: EML/MSG als `file`, `include_attachments=true|false`; PDF oder ZIP mit unveränderten Anlagen. Kein Laden externer E-Mail-Bilder.
- `POST /v1/documents/{action}`: `powerpoint`, `html`, `orient`, `form`, `print`, `accessibility`, `redaction`, `dewarp`, `translate`; Datei und optionales JSON-Formularfeld `options`.
- `POST /v1/word-merge`: DOCX als `file`, XLSX als `spreadsheet`; Platzhalter `{{Name}}` entsprechen dem Excel-Spaltennamen. Erste Tabelle, maximal 50 Datensätze und 50 Spalten. Formeln vorher in Werte umwandeln. Formatierung bleibt bei Platzhaltern über mehrere Word-Runs soweit möglich erhalten.
- `POST /v1/zugferd/create`: PDF als `file`, passende CII-XML als `invoice`, Profil `E`, `B`, `T` oder `X`. Erst PDF/A-3-Konvertierung, dann Einbettung, Mustang- und veraPDF-Prüfung. Fehlerhafte Ergebnisse heißen ausdrücklich `NICHT-VALIDIERT-Rechnung.pdf`.
- `POST /v1/zugferd/validate`: bestehende hybride PDF als `file`; ZIP mit maschinenlesbarem Gesamtergebnis und beiden Rohberichten.

Druckqualität, Barrierefreiheit und Schwärzungsprüfung liefern technische Befunde, keine umfassende Freigabe. Schwärzungsprüfung durchsucht Text und Metadaten und erkennt mögliche spätere dunkle Vektor-Überdeckungen; sie untersucht keine alten Revisionen oder sämtliche Bild-/Anlageninhalte. Buchfalzkorrektur ist eine manuell einstellbare quadratische Spaltenverschiebung, keine allgemeine automatische 3D-Entzerrung. HTML wird ohne Skripte, CSS, Bilder und externe Ressourcen neu gesetzt.

### Optional: eigener Übersetzungsdienst

`MOINPDF_TRANSLATE_URL` verweist auf die Basisadresse eines selbst betriebenen LibreTranslate-Dienstes, optional `MOINPDF_TRANSLATE_KEY`. Ohne diese Einstellung bleibt Übersetzung deaktiviert. Der Hostname wird der App angezeigt, und die Freigabe nennt die Weitergabe des ausgelesenen Texts. Die Konfiguration akzeptiert keine vom Dokument vorgegebene Zieladresse. Das bestehende interne Docker-Netz bleibt unverändert: LibreTranslate muss im selben internen Netzwerk erreichbar sein. Die benötigten Sprachmodelle vorher im Übersetzungsdienst installieren. Schlüssel nur in der lokalen `.env` verwalten und nicht committen.

### Prüfung der Erweiterungen

```sh
python -m unittest server.test_service server.test_expansion server.test_extended_documents -v
```

Die Suite prüft echte Konverter und Dateiinhalte: DOCX-Text, EML/MSG-Anlagenbytes, PowerPoint-Seitenbilder, HTML-Text, OSD-Drehung, editierbare erkannte Felder, verdeckten Text, zu geringe Bildauflösung, Tags-Lücken, Kurvenkorrektur und zwei individuelle Serienbrief-PDFs. ZUGFeRD wird mit Mustang/veraPDF positiv geprüft; eine gewöhnliche PDF wird als nicht konform erkannt. Die Übersetzungsschnittstelle nutzt eine lokale HTTP-Testantwort, keinen verbundenen Produktivdienst. Der Workflow `../.github/workflows/docker.yml` baut und prüft zusätzlich den vollständigen Docker-Stack samt echter Übersetzung.

Zusätzliche Abhängigkeiten und ihre Lizenzen beachten, insbesondere PyMuPDF/MuPDF (AGPL bzw. kommerzielle Lizenz); der optionale Dokumentenserver ist vom Browser-Bundle getrennt.

## Komprimierung und EPUB (ab 0.3.0)

`POST /v1/documents/optimize` akzeptiert PDF und `options` mit `targetMB`
(0,05–80) sowie `optimizeMode` (`images` oder `lossless`). Die Verarbeitung
startet für jede Qualitätsstufe vom Original. Text, Links und Formularfelder
bleiben erhalten. Der Header `X-MoinPDF-Note` enthält einen URL-kodierten
Ergebnistext einschließlich des tatsächlichen Zielgrößenstatus. Ein nicht
erreichtes Ziel wird nicht als erfolgreicher Größenabgleich ausgegeben.

`POST /v1/documents/ebook` akzeptiert ungeschützte `.epub`-Dateien bis 40 MB.
`options`: `paper` (`a4`/`a5`) und `fontSize` (8–24 pt). Maximal 80 MB entpackt,
1500 Archiveinträge und 200 Ausgabeseiten. Der isolierte Worker bereinigt aktive
und externe Ressourcen, weist verschlüsselte Archive/Inhalte zurück und
extrahiert keine Archivpfade auf das Dateisystem. PDF-Links werden nicht übernommen.

Test: `python -m unittest server.test_recovery -v`.

## Lokales Hörbuch (0.5.0)

`POST /v1/audio` nimmt ein authentifiziertes Multipart-Feld `request` mit JSON
entgegen: `voice` (`thorsten` oder `kerstin`), `speed` (0,75–1,5), `sections`
mit jeweils `title` und geprüftem Klartext `text`. Es werden keine Modellpfade,
Download-URLs oder Original-PDFs angenommen. Ein Abschnitt ergibt WAV, mehrere
ein ZIP mit nummerierten WAV-Dateien, `Kapitel.json` und `Hoerbuch.m3u8`.

Grenzen: 20.000 Zeichen, 100 Abschnitte, 80 MiB PCM-Ausgabe, zwei gleichzeitige
Dokumentenaufträge und 180 Sekunden Prozesslaufzeit. ONNX verwendet maximal zwei
CPU-Threads je Auftrag. Die bestehende Prozessgruppenbegrenzung beendet auch
Unterprozesse; alle Auftragsdateien liegen ausschließlich im temporären
Auftragsverzeichnis. Ein Browserabbruch beendet den Abruf, der Serverauftrag
läuft gegebenenfalls bis zum Abschluss oder Timeout weiter.

Piper und seine Laufzeitabhängigkeiten sind in `requirements.lock.txt` gepinnt.
`install_voices.py` lädt ausschließlich die unveränderlichen Revisionen aus
`voices.lock.json` und verifiziert Modell, Konfiguration und Modellkarte. Beide
deutschen Stimmen werden beim Imagebau installiert; der Dokumentendienst
braucht zur Laufzeit keinen Internetzugang. Fehlende Modelle deaktivieren die
Capability `speech`. `/v1/capabilities` nennt die verfügbaren `audioVoices` und
die Text-/Abschnittsgrenzen. Lizenzinformationen: `AUDIO-NOTICES.md`.

Lokaler Testaufbau: Python-Abhängigkeiten installieren, `MOINPDF_TOOLS` auf ein
eigenes Testverzeichnis setzen, `python server/install_voices.py` ausführen und
anschließend `python -m unittest server.test_audio -v`. Der Test erzeugt mit
beiden Modellen echte WAV-Dateien, prüft Format, Signal und Tempo sowie einen
authentifizierten Kapitel-ZIP-Export. Im Docker-Test läuft er ohne Netzwerk.
