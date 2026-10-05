# MoinPDF-Dokumentenserver

Die 58 Browserwerkzeuge verarbeiten Dateien lokal. Vier zusätzliche Werkzeugansichten können diesen separaten Server verwenden:

| Funktion | Verarbeitung | Ergebnis |
| --- | --- | --- |
| Office zu PDF | LibreOffice (Word, Excel, PowerPoint, OpenDocument) | PDF |
| PDF/A erzeugen und prüfen | Ghostscript und veraPDF, Profile 1b/2b/3b | Archivkopie + XML-Prüfbericht + JSON im ZIP |
| XRechnung vollständig validieren | KoSIT 1.6.3, XRechnung-Konfiguration 3.0.2 vom 31.08.2026 | Vollständiger XSD-/Schematron-Bericht im ZIP |
| Zertifikatssignaturen | pyHanko, PKCS#12 und Prüfung bestehender Signaturen | Signierte PDF bzw. JSON-Bericht |

Die veröffentlichte App enthält **keinen vorinstallierten öffentlichen Dokumentenserver**. Eine eigene Serveradresse und ein API-Schlüssel müssen eingetragen werden. Eine Verbindung wird ohne Dokumentübertragung geprüft. Dateien werden erst nach dem ausdrücklichen Übertragungsauftrag gesendet.

## Start mit Docker Compose

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

- Pro Auftrag wird ein eigenes temporäres Verzeichnis verwendet und anschließend gelöscht. Aufträge und Dateiinhalte werden nicht dauerhaft gespeichert. API-Schlüssel werden nicht an Konverter-Unterprozesse weitergegeben. Zertifikatspasswörter werden weder in Befehlszeilen noch in Berichten abgelegt.
- Höchstens zwei gleichzeitige Dokumentenaufträge; native Konverter werden nach drei Minuten einschließlich Kindprozessen beendet. Dateigrenze 80 MB, Rechnungs-XML 10 MB, Zertifikat 2 MB. HTTP-Abbruch im Browser beendet zunächst das Warten; ein bereits gestarteter Serverauftrag läuft bis Abschluss oder Timeout weiter.
- LibreOffice verwendet ein frisches Profil mit deaktivierten Makros. Der Container hat ein schreibgeschütztes Dateisystem, ein temporäres Arbeitsverzeichnis und keinen Internetzugriff. Office-Layout hängt unter anderem von den verfügbaren Schriften ab. Eigene lizenzierte Schriften können beim Image-Build ergänzt werden.
- PDF/A gilt nur bei bestandenem veraPDF-Check als konform. Bei einem fehlgeschlagenen Check heißt die Ausgabedatei ausdrücklich `NICHT-PDF-A-konform.pdf`. Die neue Archivkopie kann Formulare, Anhänge, aktive Elemente und bestehende Signaturen verändern oder verlieren; die Originaldatei bleibt erhalten. Das Profil 3b allein erzeugt keine ZUGFeRD-Rechnung.
- KoSIT wendet die vollständig installierte Szenariokonfiguration an. Akzeptanz und Version stehen in `Ergebnis.json`, alle Einzelregeln im unveränderten XML-Bericht. DTDs und externe XML-Entitäten werden abgelehnt.
- Die Signaturprüfung unterscheidet kryptografische Integrität, Dokumentänderungen und Zertifikatsvertrauen. Eigene vertrauenswürdige CA-Zertifikate können als PEM-Dateien in `trust/` abgelegt werden. Ohne konfigurierte Vertrauensanker wird keine Kette als vertrauenswürdig bestätigt. Kein Online-OCSP, keine aktuelle Sperrlistenabfrage, kein qualifizierter Status und kein vertrauenswürdiger Zeitstempeldienst werden behauptet. Die erzeugte Zertifikatssignatur enthält keinen externen Zeitstempel.

## Lokale Entwicklung und Tests

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.lock.txt
pip install httpx==0.28.1
python -m unittest discover -s . -p 'test_*.py' -v
```

Native Integrationstests werden ausgeführt, wenn Java, Ghostscript und die in `MOINPDF_TOOLS` installierten Werkzeuge verfügbar sind. Für Office ist zusätzlich LibreOffice nötig; beide Aufrufnamen `libreoffice` und `soffice` werden unterstützt. Die Office-Prüfung konvertiert synthetische DOCX-, XLSX-, PPTX-, ODT-, ODS- und ODP-Dateien und liest jede PDF anschließend unabhängig ein. Fehlende native Komponenten werden als übersprungen gemeldet. Installation in einen lokalen Ordner:

```bash
MOINPDF_TOOLS="$PWD/tools" python install_tools.py
MOINPDF_TOOLS="$PWD/tools" python -m unittest discover -s . -p 'test_*.py' -v
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
