# Vollständige Installation mit Docker Compose

**Deutsch** · [English](DOCKER.en.md) · [← README](README.md)

Der Compose-Aufbau im **Repository-Hauptverzeichnis** enthält die Web-App, den Dokumentenserver, den Webseiten-Konverter und LibreTranslate. Alle Werkzeugansichten sind enthalten. Der Browser verbindet sich automatisch mit dem eigenen Dokumentenserver; Serveradressen und API-Schlüssel müssen nicht eingetragen werden. Die dokumentbezogenen Grenzen der einzelnen Werkzeuge gelten auch in Docker.

## Start

Voraussetzungen: Docker Engine mit Compose v2 oder Docker Desktop, Internet beim ersten Aufbau und für Website-Link-Konvertierungen sowie ausreichend Speicher. Für den vollständigen Stack sind **8 GB verfügbarer RAM und 20 GB freier Plattenplatz** als Ausgangspunkt vorgesehen. Die Containergrenzen sind in `.env.example` anpassbar. Die Installation baut lokal; es werden keine privaten Container-Registry-Zugangsdaten benötigt. Der Quellcode ist öffentlich; zum Klonen des Repositorys ist keine GitHub-Anmeldung erforderlich.

```bash
git clone https://github.com/MoinPDF/moinpdf.git
cd moinpdf
docker compose up -d --build
```

Anschließend **http://localhost:8080** oder **http://SERVER-IP:8080** öffnen. Eine `.env` ist für den Standardstart nicht erforderlich. Der ältere Aufruf `docker-compose` kann bei Installationen mit einem kompatiblen Compose-v2-Binary ebenfalls verwendet werden.

Der erste Start dauert länger: Images, Konverter und Sprachmodelle werden heruntergeladen. Compose wartet auf die Modellinstallation und die Bereitschaft der Dienste. Die Dienste `initialize` und `translation-models` dürfen danach **Exited (0)** anzeigen; sie haben ihre einmalige Einrichtung erfolgreich abgeschlossen. Die vier laufenden Dienste `app`, `documents`, `translation` und `website` sollen **healthy** sein.

```bash
docker compose ps -a
docker compose logs -f translation-models translation
```

Für einen Start mit expliziter Bereitschaftsprüfung:

```bash
docker compose up -d --build --wait --wait-timeout 1800
```

## Enthaltene Komponenten

| Bereich | Automatisch vorhanden |
| --- | --- |
| Web-App | Eigenständiger Produktionsbuild, lokale Schriften, PDF.js, qpdf-WASM und OCR-Dateien |
| Browser-OCR | 21 lokale OCR-Sprachen, bis zu acht kombiniert, mit optionaler automatischer Sprachprobe |
| Dokumentenserver | LibreOffice, Ghostscript, Tesseract OSD, pdf2docx, EML/MSG-Import, PowerPoint, Formularerkennung und Dokumentprüfungen |
| Webseiten-Konverter | Chromium für öffentliche Website-Links mit Bildern, Schriften und CSS |
| Rechnungen und Archivierung | KoSIT, XRechnung-Regeln, veraPDF, Mustang/ZUGFeRD und pyHanko |
| Übersetzung | LibreTranslate mit Deutsch, Englisch, Französisch, Spanisch, Italienisch, Niederländisch und Polnisch |
| Verbindung | Gemeinsame Web-Adresse, interner zufälliger API-Schlüssel, automatische Funktionsprüfung in der App |

Die Installation lädt die erforderlichen Sprachpaare einschließlich Englisch als Zwischensprache und führt erste Übersetzungen aus, damit auch benötigte Satztrennungsmodelle zwischengespeichert sind. Unterbrochene Downloads werden beim nächsten Versuch ergänzt. Die Modelle und Zwischenspeicher liegen in Docker-Volumes. Die Modellinitialisierung hat Internetzugriff; **Dokumentenserver und laufender Übersetzungsdienst sind im internen Docker-Netz isoliert**. Bei späteren Starts werden vollständige, bereits vorbereitete Modelle wiederverwendet.

PDF-Übersetzung benötigt auslesbaren Text; Scans zuerst mit OCR bearbeiten. Sie kann Originaltext und Übersetzung nebeneinander ausgeben. Die App-Oberfläche lässt sich unabhängig davon zwischen Deutsch und Englisch umschalten. Ein eigenes Signaturzertifikat und gegebenenfalls vertrauenswürdige CA-Zertifikate werden weiterhin vom Betreiber bereitgestellt.

## Einstellungen und optionaler Login

```bash
cp .env.example .env
```

| Einstellung | Standard | Bedeutung |
| --- | --- | --- |
| `MOINPDF_PORT` | `8080` | Port der Web-App |
| `MOINPDF_BIND` | `0.0.0.0` | Bindung an alle Host-Adressen; `127.0.0.1` beschränkt auf den Host |
| `MOINPDF_USERNAME` | `moinpdf` | Benutzername für den optionalen Login |
| `MOINPDF_PASSWORD` | leer | Bei gesetztem Passwort schützt HTTP Basic Auth die gesamte App und ihre API |
| `MOINPDF_DOCUMENT_MEMORY` | `2g` | Speichergrenze für Konverter und temporäre Dokumente |
| `MOINPDF_WEBSITE_MEMORY` | `1g` | Speichergrenze für den Webseiten-Konverter |
| `MOINPDF_TRANSLATION_MEMORY` | `4g` | Speichergrenze für LibreTranslate |

Nach Änderungen `docker compose up -d` ausführen. Passwörter mit Sonderzeichen in `.env` in einfache Anführungszeichen setzen. `.env` wird nicht versioniert. Der Standardstart ist für den eigenen Rechner bzw. ein vertrauenswürdiges Netzwerk gedacht; bei öffentlicher Erreichbarkeit HTTPS und einen Zugangsschutz verwenden.

## HTTPS und Kamera

Browser erlauben die Kamera auf `localhost` oder über HTTPS. Für den Zugriff über eine Server-IP ohne HTTPS bleibt der normale Datei-Upload nutzbar. Eine bereits vorhandene HTTPS-Reverse-Proxy-Lösung kann auf Port 8080 zeigen; für Dokumentenaufträge mindestens 85 MB Uploadgröße und 200 Sekunden Zeitlimit vorsehen. Die App erwartet den Root-Pfad einer eigenen Domain, keinen Unterordner.

Alternativ ist automatische HTTPS-Einrichtung mit Caddy enthalten. Domain in `.env` unter `MOINPDF_DOMAIN` setzen, DNS auf den Server zeigen lassen und Ports 80/443 bereitstellen:

```bash
docker compose -f compose.yaml -f compose.https.yaml up -d --build
```

Danach `https://DEINE-DOMAIN` öffnen. Für nachfolgende Compose-Befehle dieselben beiden `-f`-Argumente verwenden. Zertifikate bleiben im Volume `caddy_data` gespeichert.

## Impressum und Datenschutz

Impressum und Datenschutzerklärung sind als kleine Links am unteren Rand jeder Werkzeugansicht erreichbar. Sie öffnen einen neuen Tab, damit die aktuelle Dokumentensitzung erhalten bleibt. Beide Seiten werden zusammen mit der App ausgeliefert und benötigen keine extern geladenen Schriften oder Skripte.

Die Anbieterangaben in `public/impressum.html` und `public/datenschutz.html` beziehen sich auf die ursprüngliche MoinPDF-Instanz: eigener Server mit vorgeschaltetem Cloudflare und Kontaktpostfach bei Tuta (Tutao GmbH). Die Erklärung beschreibt lokale Bearbeitung, Serveraufträge und Übersetzungen, Browser-Speicher sowie die Verarbeitung durch diese Anbieter. Sie weist darauf hin, dass über Cloudflare übertragene Dokumentenaufträge einschließlich ihrer Inhalte dessen Infrastruktur durchlaufen. Betreiber einer unabhängigen Instanz müssen die Angaben an ihre eigene Bereitstellung anpassen.

Vor dem öffentlichen Start die tatsächlichen Cloudflare-Schutzfunktionen, Sicherheits-Cookies, Protokolle und Löschregeln mit der Erklärung abgleichen. Die Standardkonfiguration aktiviert weder HTTP-Zugriffsprotokolle in Caddy noch im Dokumentenserver; Betriebs- und Fehlerprotokolle von Docker, dem Host und Cloudflare sind davon unabhängig. Deren Aufbewahrung begrenzen und dokumentieren. Erforderliche Vereinbarungen zur Auftragsverarbeitung mit den eingesetzten Dienstleistern prüfen; die Datenschutzerklärung ersetzt diese nicht. Falls ein zusätzlicher Rechenzentrums- oder Hostinganbieter eingesetzt wird, diesen ebenfalls berücksichtigen.

Der Compose-Stack verwendet für alle Dienste den Docker-Logtreiber `local` mit höchstens drei Protokolldateien zu jeweils 10 MB. Ältere Dateien werden bei der Rotation entfernt. Das begrenzt den Umfang, ist aber keine Löschung nach einer festen Anzahl von Tagen. Bereits gestartete Container übernehmen diese Änderung beim nächsten `docker compose up -d`; Protokolle anderer Dienste, des Tunnels und des Hosts werden dadurch nicht geändert.

Für Cloudflare den Transport bis zum eigenen Server absichern: bei einem öffentlichen HTTPS-Ursprung mit gültigem Zertifikat den Modus „Full (strict)“ verwenden, bei Cloudflare Tunnel eine entsprechend abgesicherte Verbindung zum lokalen Dienst. Dokumenten- und Webseiten-API samt Ergebnissen (`/api/documents/*` und `/api/website/*`) nicht durch zusätzliche Cache-Regeln zwischenspeichern; der mitgelieferte Proxy setzt dort `Cache-Control: no-store`. Die App aktiviert keine externen Analyse-Tracker. Zusätzlich im Cloudflare-Konto eingeschaltete Analyse- oder Anmeldedienste müssen gesondert berücksichtigt werden.

Gestaltung: `public/legal/legal.css`; Links in der App: `components/studio/legal-footer.tsx`. Nach Änderungen die Web-App mit `docker compose up -d --build` neu bauen.

## Updates, Neustart und Daten

```bash
git pull --ff-only
docker compose build --pull
docker compose up -d --wait --wait-timeout 1800
```

`docker compose stop` stoppt die Dienste; `docker compose up -d` startet sie erneut. `docker compose down` entfernt die Container und Netze, behält aber die Volumes. **`docker compose down -v` löscht auch Schlüssel, Modelle, Cache und HTTPS-Zertifikate** und ist nur für einen bewussten vollständigen Neustart gedacht.

Synchrone Serveraufträge verwenden temporäre Verzeichnisse, die nach der Verarbeitung entfernt werden. Unterstützte Hintergrundaufträge liegen dagegen im Volume `document_jobs`, damit sie nach einem Neustart fortgesetzt werden können. Eingaben werden nach Abschluss oder Abbruch entfernt; Auftragstickets und Ergebnisse verfallen 24 Stunden nach Auftragserstellung. Die laufende Warteschlange bereinigt abgelaufene Aufträge, beim nächsten Start ebenso. Unter „Ergebnisse und Aufträge“ lassen sich Aufträge abbrechen und Ergebnisse früher löschen. Ein Backup dieses Volumes kann daher Dokumentinhalte und Ergebnisse enthalten; eine externe Sicherung wird durch die Bereinigung des laufenden Volumes nicht gelöscht.

Der Browser speichert den Arbeitsstand automatisch lokal und unverschlüsselt. Zusätzlich bleiben die letzten zehn Ergebnisse mit insgesamt höchstens 160 MB in der lokalen Ergebnisablage. Projekte und Dokumententwürfe werden ebenfalls lokal gespeichert. „Arbeitsbereich leeren“ entfernt automatische Sicherung und Ergebnisablage; Projekte und Entwürfe separat löschen. Wichtige Ergebnisse zusätzlich herunterladen. Die übrigen Docker-Volumes enthalten Schlüssel, Modelle, Cache und HTTPS-Zertifikate.

## Probleme eingrenzen

- **Erster Start wartet:** `docker compose logs -f translation-models`. Downloads können mehrere Minuten dauern; fehlgeschlagene Versuche werden wiederholt. Ohne Internet kann eine leere Installation nicht eingerichtet werden.
- **Container beendet / Exit 137:** Speicherstatus und Docker-Desktop-RAM prüfen; verfügbare Ressourcen bzw. die betroffenen Container-Speichergrenzen erhöhen.
- **Port belegt:** `MOINPDF_PORT` in `.env` ändern, dann `docker compose up -d`.
- **Serverfunktionen fehlen:** `docker compose logs documents` und `docker compose ps -a` prüfen; anschließend Images neu bauen und in der App „Erneut versuchen“ wählen.
- **API-Aufruf liefert 403:** Die App setzt `X-MoinPDF-Client: web` automatisch. Direkte Aufrufe ohne diesen Header sowie browserseitige fremde Ursprünge werden am Web-Proxy abgewiesen. Ein öffentlicher Bearer-Schlüssel ist für diese Installation nicht vorgesehen.

## Automatische Prüfung

Der Workflow `.github/workflows/docker.yml` baut die tatsächlichen Images, führt die Browser- und Konvertertests aus, startet den vollständigen Stack mit allen sieben Sprachen und prüft eine reale deutsch/englische PDF-Übersetzung über den Web-Proxy. Außerdem prüft er lokale OCR-/PDF-Dateien, Office-Konvertierung, Neustart mit vorhandenen Volumes und den optionalen Login. Ein grüner Lauf ist unter **GitHub → Actions → Complete Docker installation** erkennbar.

Für eine lokale Integrationsprüfung nach dem Start:

```bash
docker compose run --rm --no-deps --volume "$PWD:/repo:ro" documents python /repo/tests/selfhost-smoke.py
```

Bei aktiviertem Login zusätzlich `--env MOINPDF_TEST_USERNAME=... --env MOINPDF_TEST_PASSWORD=...` übergeben. Diesen Test nur mit dem enthaltenen synthetischen Testmaterial verwenden.

Die eigenständige Dokumenten-API bleibt unter [server/README.md](server/README.md) beschrieben. Die Benutzeroberfläche bietet ab 0.2.0 keine manuelle API-Verbindung mehr an; für sämtliche Konverter die vollständige Docker-Ausgabe verwenden. Versionen der Konverter und Python-Abhängigkeiten sind dort dokumentiert. LibreTranslate basiert auf [v1.9.6](https://github.com/LibreTranslate/LibreTranslate/tree/v1.9.6); Hinweise zu Modellen und Lizenzen stehen in der [Upstream-Dokumentation](https://docs.libretranslate.com/guides/build_from_sources/).

## Website-Link zu PDF

„HTML & Webseiten zu PDF“ bietet die Eingabe eines öffentlichen Website-Links. Der zusätzliche Dienst `website` enthält Chromium und erstellt PDFs mit Bildern, Schriften und CSS, wahlweise in Bildschirm- oder Druckansicht, A4/Letter und Hoch-/Querformat. Er ist in `compose.yaml` enthalten und benötigt keine API eines Drittanbieters. Beim Update den gesamten Stack neu bauen und starten, damit dieser Dienst und die neue Proxyroute hinzukommen. Für statisch ausgelieferte Webdateien müssen sowohl `/api/documents/*` als auch `/api/website/*` zum Docker-Webcontainer führen.

Nur `website` erhält für diese Aufgabe Internetzugriff. `documents` und `translation` bleiben im internen Netz. Der Browser nutzt einen lokalen HTTP-/HTTPS-Proxy, der bei jeder Verbindung ausschließlich öffentliche DNS-Antworten an den Socket übergibt. Direkte DNS-Auflösung, QUIC und WebRTC-Verbindungen außerhalb des Proxys sind deaktiviert. Auch Weiterleitungen, Skripte und eingebettete Inhalte unterliegen dieser Prüfung. Loopback, private/Link-Local-Netze, IPv6-Übergangsadressen, Zugangsdaten in URLs und abweichende Ports sind gesperrt. WebSockets, Service Worker und schreibende HTTP-Anfragen sind deaktiviert.

Pro Auftrag gelten 160 Abrufe, insgesamt 40 MiB übertragene Webressourcen und 40 MiB PDF-Ausgabe. Nach spätestens 75 Sekunden oder bei einem erkannten Verbindungsabbruch wird die gesamte Prozessgruppe beendet. Höchstens zwei Aufträge laufen gleichzeitig. Temporäre Dateien und Browserprofile werden anschließend entfernt; URL-Abfragen werden nicht protokolliert. Fehlende Ressourcen werden bei der Ausgabe gekennzeichnet. Login-Seiten, Cookie-Banner, Bot-Schutz und manche dynamischen Inhalte können das Ergebnis einschränken.

Der neue Dienst hat standardmäßig 1 GiB Arbeitsspeicher (`MOINPDF_WEBSITE_MEMORY`). Chromium stammt aus den Debian-Sicherheitsaktualisierungen für amd64 und arm64; das Image regelmäßig neu bauen, um Browser-Sicherheitskorrekturen zu übernehmen.

## Offline-App und lokale Sicherungen

Unter Projekte stehen Speicherbelegung, Anfrage dauerhafter Speicherung und Offline-Pakete zur Verfügung. Offline benötigt HTTPS oder localhost, einen unterstützten Browser und einen abgeschlossenen Download der App sowie der gewählten Sprachen/Laufzeiten. Der Download prüft die Integrität jeder Programmdatei. App-Updates werden nach dem Schließen aller älteren Tabs aktiv. Serverwerkzeuge brauchen weiter den eigenen Server. Offline-Dateien entfernen löscht keine Projekte oder Ergebnisse.
