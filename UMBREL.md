# MoinPDF auf Umbrel mit Pages und Cloudflare Tunnel

Dieses Vorgehen nutzt den vollständigen MoinPDF-Compose-Stack auf Umbrel und liefert die Website über Denny's Pages-App aus. Pages führt statische Dateien aus; die Dokumentenverarbeitung bleibt in den Docker-Diensten. Die Installation ist ein separat verwalteter Compose-Stack und erzeugt keinen zusätzlichen Eintrag im Umbrel App Store.

## 1. Vorbereiten

- Mindestens 8 GB **verfügbaren** RAM und 20 GB freien Speicher als Ausgangspunkt einplanen. Der vollständige Stack mit sieben Übersetzungssprachen ist auf einem bereits ausgelasteten Umbrel ungeeignet.
- Die lokale Umbrel-IP im Router fest reservieren.
- Eine Domain oder Subdomain für MoinPDF festlegen, z. B. `pdf.example.org`. Sie muss im verwendeten Cloudflare-Konto liegen.
- Den bereits mit Umbrel verbundenen Cloudflare-Tunnel weiterverwenden. Seine bestehenden Routen bleiben bestehen.
- Auf Umbrel in den Einstellungen ein Terminal öffnen oder per SSH verbinden. Alle folgenden Shell-Befehle laufen **auf Umbrel**, nicht im Windows-Terminal ohne SSH.

## 2. Vollständigen Stack starten

```bash
git clone https://github.com/dennysubke/moinpdf.git ~/moinpdf
cd ~/moinpdf
cp .env.example .env
nano .env
```

Das Repository ist privat: zum Klonen den vorhandenen GitHub-Zugang verwenden. GitHub-Zugangsdaten gehören nicht in URLs, dieses Dokument oder einen Chat. Falls das Verzeichnis bereits vorhanden ist, darin stattdessen `git pull --ff-only` ausführen und die bestehende `.env` bearbeiten.

In `.env` zunächst einstellen:

```dotenv
MOINPDF_PORT=8785
MOINPDF_BIND=0.0.0.0
MOINPDF_PASSWORD=
```

Port 8785 ist der vorgeschlagene freie Zusatzport; mit `sudo ss -ltnp '( sport = :8785 )'` prüfen. Wird er bereits verwendet, einen anderen freien Port wählen und alle nachfolgenden Portangaben entsprechend ersetzen. `0.0.0.0` ermöglicht dem separaten Tunnel-Container den Zugriff über die Umbrel-IP. Die letzten drei Einstellungen beschreiben zunächst einen Zugang im vertrauenswürdigen LAN; Router-Portfreigaben sind für den Tunnel nicht erforderlich.

```bash
sudo docker compose version
sudo docker compose up -d --build --wait --wait-timeout 1800
sudo docker compose ps -a
```

Der erste Start lädt Konverter und Übersetzungsmodelle. `initialize` und `translation-models` dürfen erfolgreich mit `Exited (0)` enden; `app`, `documents` und `translation` sollen `healthy` sein. Bei einem Zeitlimit zunächst `sudo docker compose logs --tail 100 translation-models translation` prüfen und nach erfolgreicher Modellinstallation denselben Startbefehl erneut ausführen.

Lokal `http://UMBREL-IP:8785` öffnen. Schon hier laufen Oberfläche und Dokumentenserver zusammen. Mit synthetischen Beispielen eine PDF öffnen, eine DOCX in PDF konvertieren und ein kurzes textbasiertes PDF übersetzen. Keine Originalunterlagen für den ersten Test verwenden.

## 3. Oberfläche nach Pages laden

Das bereitgestellte `MoinPDF-Pages.zip` ist der vorgebaute Export des Docker-Webbuilds. Alternativ lässt es sich auf einem Entwicklungsrechner mit installierten Projektabhängigkeiten erzeugen:

```bash
pnpm run package:pages
```

Das Paket liegt anschließend unter `dist/MoinPDF-Pages.zip`, der SHA-256-Wert daneben. Es enthält nur öffentliche Webdateien, einschließlich lokaler OCR-Modelle, Logo, Impressum und Datenschutz. API-Schlüssel oder Docker-Konfiguration sind nicht enthalten.

In der **Pages-App auf Umbrel**:

1. Neue leere Website namens **MoinPDF** anlegen.
2. Das ZIP importieren und entpacken. `index.html`, `assets`, `vendor` usw. müssen direkt im Hauptverzeichnis der Website liegen.
3. Unter **Sharing / Teilen** die ausgewählte Domain, z. B. `pdf.example.org`, als eigene Domain hinterlegen und die Website veröffentlichen.
4. Verzeichnisauflistung ausschalten, CORS ausschalten, Cache zunächst auf **none** setzen. Ein SPA-Fallback ist für die Hauptseite nicht notwendig; ausgeschaltet bleiben fehlende API-Routen als Fehler erkennbar.
5. In den globalen Pages-Einstellungen **Statistiken deaktivieren**, wenn keine zusätzliche Besucherauswertung erfolgen soll. Diese Einstellung betrifft auch andere Pages-Websites. Bei eingeschalteten Statistiken die tatsächliche Verarbeitung und Aufbewahrung in der Datenschutzerklärung ergänzen.

MoinPDF wird am Root-Pfad einer eigenen Domain betrieben. Die lokale Pages-Adresse `/p/moinpdf/` ist für diesen Build kein vollständiger Funktionstest, weil dessen Ressourcen und API-Adressen mit `/` beginnen.

## 4. Zwei Routen im bestehenden Cloudflare-Tunnel

Im Cloudflare-Dashboard unter **Networking → Tunnels** den laufenden Umbrel-Tunnel öffnen. Unter **Routes → Add route → Published application** zwei Einträge für **denselben Hostnamen** anlegen. In der älteren Oberfläche heißen diese Bereiche **Networks → Connectors → Cloudflare Tunnels** und **Public Hostnames / Published application routes**.

| Reihenfolge | Hostname | Path | Type | URL |
| --- | --- | --- | --- | --- |
| 1 | `pdf.example.org` | `^/api/documents/.*` | HTTP | `UMBREL-IP:8785` |
| 2 | `pdf.example.org` | leer | HTTP | `UMBREL-IP:8377` |

8377 ist der Standardport von Denny's Pages-App. Einen abweichenden Installationsport entsprechend einsetzen. Im zusammengefassten Feld **Service URL** entsprechend `http://UMBREL-IP:8785` bzw. `http://UMBREL-IP:8377` eintragen. Bei getrennten Type-/URL-Feldern HTTP auswählen und in URL kein zusätzliches `http://` eintragen. Die API-Route muss oberhalb der allgemeinen Website-Route stehen; der volle Pfad muss unverändert weitergereicht werden. Keine URL-Rewrite-Regel ergänzen.

Bei der Pages-Route unter **Additional application settings → HTTP settings → HTTP Host Header** denselben Hostnamen wie in Pages eintragen, z. B. `pdf.example.org`. So liefert Pages eindeutig die richtige Website. `localhost` im Tunnel-Container bezeichnet den Container selbst; als Ziel deshalb die erreichbare Umbrel-LAN-IP verwenden.

Der Tunnel stellt den öffentlichen HTTPS-Zugang bereit. HTTP zu den internen Diensten betrifft die lokale Strecke zwischen Tunnel-Container und Umbrel. `compose.https.yaml` und zusätzliche öffentliche Ports 80/443 werden für diesen Aufbau nicht benötigt. Falls die Tunnel-Ziele auf einem anderen, nicht vertrauenswürdigen Rechner liegen, die interne Strecke zusätzlich absichern.

Die App nutzt damit unter derselben Domain automatisch `/api/documents`; ein separater öffentlicher API-Schlüssel und Browser-CORS-Freigaben sind nicht erforderlich. Die Dokumenten- und Übersetzungscontainer erhalten keine eigenen veröffentlichten Ports.

## 5. Zugang, Caching und Datenschutz

- **Öffentlich oder beschränkt:** Ohne zusätzlichen Zugangsschutz können alle Besucher Serveraufträge starten. Für den Zugang nur durch dich oder Kollegen eine Cloudflare-Access-Anwendung für den **gesamten Hostnamen** mit passender Zulassung einrichten, einschließlich `/api/documents/*`. Nur die Pages-Verwaltung mit einem Passwort zu schützen, schützt die veröffentlichte Website und MoinPDF-API nicht.
- **Einheitlicher Login:** Bei Pages als separatem Frontend `MOINPDF_PASSWORD` leer lassen und einen erforderlichen Login vor beide Routen legen. Ein Basic-Auth-Passwort nur am Docker-Backend ergibt sonst einen geteilten Anmeldeweg. Die direkte Docker-Betriebsart ohne Pages kann weiterhin den eingebauten Basic-Auth-Login verwenden.
- **Cache-Regel:** Für den MoinPDF-Host und URI-Pfade beginnend mit `/api/documents/` die Cache-Einstellung **Bypass cache** setzen. Keine andere Regel darf dort `Cache-Control: no-store` überschreiben. In Cloudflare keine zusätzlichen Analyse-Skripte/Rocket Loader für diese App einschalten.
- **Protokolle:** MoinPDF begrenzt Docker-Logs automatisch auf drei Dateien zu je 10 MB pro Dienst; das ist eine Größenbegrenzung, keine Frist in Tagen. Pages, Cloudflare und der Umbrel-Host haben eigene Einstellungen. Tatsächlich verwendete Löschregeln dokumentieren; nicht pauschal „keine Logs“ versprechen.
- **Anbieter und Vereinbarungen:** Impressum und Datenschutz enthalten Denny Wenke, den eigenen Server, Cloudflare und Tuta. Die erforderlichen Vereinbarungen zur Auftragsverarbeitung mit den tatsächlich eingesetzten Dienstleistern vorhalten. Zusätzliche Hostinganbieter, Anmeldedienste oder Statistiken müssen in den Angaben berücksichtigt werden.
- **E-Mail:** Für MoinPDF sind keine SMTP-Zugangsdaten und kein E-Mail-Container nötig. Das Kontaktpostfach bleibt bei Tuta. Bestehende MX-, SPF-, DKIM- und DMARC-Einträge der E-Mail-Domain unverändert lassen.

## 6. Öffentlichen Zugang prüfen und Grenzen beachten

`https://DEINE-DOMAIN` im Browser öffnen. Die Startseite, Logo, Impressum und Datenschutz müssen erreichbar sein. Danach mit Testdateien die lokale PDF-Bearbeitung, Office-Konvertierung und Übersetzung prüfen. Unter „Server“ soll der integrierte Server erreichbar sein. Wenn die API HTML statt einer Serverantwort liefert, zuerst Reihenfolge und Pfad der Tunnel-Routen prüfen.

**Bekannte Grenze bei langen Aufträgen:** Die aktuelle MoinPDF-API wartet synchron auf den Konverter. Cloudflare dokumentiert derzeit einen standardmäßigen Proxy Read Timeout von 125 Sekunden. Umfangreiche Übersetzungen oder Konvertierungen können daher über den Tunnel mit Fehler 524 abbrechen, obwohl der lokale Server noch arbeitet. Ein höheres Timeout im lokalen Caddy oder beim Tunnel-Verbindungsaufbau hebt diese Cloudflare-Grenze nicht auf. Für diese Aufträge den direkten LAN-Zugang verwenden und kleinere Dokumente verarbeiten; für zuverlässig längere öffentliche Aufträge ist eine zusätzliche asynchrone Verarbeitung mit Statusabfrage erforderlich. Sie ist in diesem Stand noch nicht enthalten. Auch Cloudflares Uploadgrenzen gelten zusätzlich zum MoinPDF-Limit von 80 MB.

Dieser Stand ist ohne Zugriff auf den konkreten Umbrel, Pages und das Cloudflare-Konto vorbereitet. Ein lokaler Build ersetzt den abschließenden Verbindungstest auf dem Zielgerät nicht.

## 7. Spätere Updates

```bash
cd ~/moinpdf
git pull --ff-only
sudo docker compose up -d --build --wait --wait-timeout 1800
```

Danach auch das neu gebaute Pages-Paket importieren, damit Oberfläche und Server denselben Stand haben. Beim Ersetzen alter Webdateien die Dateiüberschreibung in Pages bestätigen und gegebenenfalls den Cloudflare-Cache für diese Website leeren. Compose-Volumes bei normalen Updates behalten; `docker compose down -v` löscht sie.

Quellen: [Pages](https://github.com/dennysubke/pages/blob/master/README.md), [Tunnel-Routen und Reihenfolge](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/configuration-file/), [Cloudflare 524](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-524/), [Docker-Protokollrotation](https://docs.docker.com/engine/logging/drivers/local/).
