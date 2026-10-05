# MoinPDF als Umbrel-App

MoinPDF wird als **`denny-moinpdf`** in [Denny's Umbrel Community Store](https://github.com/dennysubke/dennys-umbrel-app-store) paketiert. Das Paket enthält die Web-App, den Dokumentenserver und die lokale Übersetzung. Umbrel verwaltet Installation, Start, Stopp, Neustarts, Updates und die App-Daten. Eine Pages-Installation, ein ZIP-Import, eine eigene `.env` oder ein manueller Build auf Umbrel sind nicht erforderlich.

## Installation nach Freigabe des Store-Pakets

1. Im Umbrel App Store die Community-Stores öffnen und, falls noch nicht vorhanden, diesen Store hinzufügen:

   ```text
   https://github.com/dennysubke/dennys-umbrel-app-store
   ```

2. **MoinPDF** suchen und installieren. Mindestens **8 GB verfügbaren RAM und 20 GB freien Speicher** als Ausgangspunkt vorsehen. Die großen Konverter-Images und Sprachmodelle benötigen beim ersten Start Internetzugang und können mehrere Minuten laden.
3. MoinPDF über das Symbol auf Umbrel öffnen. Der App-Port ist **8785**. Die Oberfläche verbindet sich automatisch mit dem Dokumentenserver; es muss kein API-Schlüssel in den Browser eingetragen werden.
4. Unter einem Serverwerkzeug den Status prüfen. Während des ersten Modelldownloads zeigt die App „Wird vorbereitet“ und aktualisiert den Status selbst. Die übrigen Werkzeuge sind bereits nutzbar.
5. Eine Test-PDF öffnen, eine DOCX in PDF konvertieren und nach abgeschlossener Einrichtung ein kurzes Text-PDF übersetzen.

Der Store-Eintrag darf erst freigegeben werden, wenn alle drei Image-Pakete öffentlich und ohne Registry-Anmeldung abrufbar sind. Ein Draft-Pull-Request allein macht die App noch nicht im Umbrel Store installierbar.

## Zugriff und HTTPS

Standardmäßig schützt der **Umbrel-Login** die gesamte App. Es gibt kein zusätzliches MoinPDF-Standardpasswort. Der Zugriff im LAN erfolgt über die Umbrel-App oder `http://UMBREL-IP:8785`.

Kameraaufnahmen erfordern einen sicheren Browserkontext. Auf umbrelOS 2.0 kann der App-Port auch über HTTPS geöffnet werden; über die öffentliche Domain übernimmt Cloudflare HTTPS. Der normale Datei-Upload funktioniert auch im lokalen HTTP-Zugang.

## Direkt mit Cloudflare Tunnel veröffentlichen

Eine eigene Domain oder Subdomain verwenden, zum Beispiel `pdf.example.org`. Im bestehenden Cloudflare Tunnel **eine Published-application-Route** anlegen:

| Einstellung | Wert |
| --- | --- |
| Hostname | `pdf.example.org` |
| Path | leer |
| Service | HTTP |
| Ziel | `UMBREL-IP:8785` |

In einem gemeinsamen URL-Feld lautet das Ziel `http://UMBREL-IP:8785`. Als Ziel die feste LAN-IP des Umbrel verwenden; `localhost` im Tunnel-Container bezeichnet den Tunnel-Container selbst. Die Oberfläche und `/api/documents/*` laufen unter derselben Domain. Zusätzliche API-Routen, eigene öffentliche API-Schlüssel oder Browser-CORS-Freigaben werden nicht benötigt.

**Zugang bewusst auswählen:** Für eine öffentlich zugängliche Website in den MoinPDF-App-Einstellungen von umbrelOS 2.0 „Require Umbrel login“ ausschalten. Danach können Besucher auch Serveraufträge ausführen. Für einen beschränkten Benutzerkreis zuerst eine Cloudflare-Access-Regel für den **gesamten Hostnamen einschließlich API** einrichten. Die Einstellung der MoinPDF-App betrifft nicht den Login der Umbrel-Verwaltung. Auf älteren Umbrel-Versionen unterscheidet sich die Verwaltung des App-Proxy-Logins; der ausgelieferte Standard bleibt geschützt.

Keine Router-Portfreigabe ist für den Tunnel erforderlich. Eine Cloudflare-Regel zum Umgehen des Cache für `/api/documents/*` anlegen und dort `Cache-Control: no-store` nicht überschreiben. Keine zusätzlichen Analyse-Skripte oder Rocket Loader für MoinPDF einschalten.

**Zeitgrenze:** Serveraufträge sind derzeit synchron. Cloudflares standardmäßiger Proxy Read Timeout beträgt 125 Sekunden; lange Übersetzungen können deshalb mit Fehler 524 abbrechen. Für solche Dokumente den direkten LAN-Zugang oder kleinere Dokumente verwenden. Das Paket enthält noch keine asynchrone Warteschlange. Cloudflares Uploadgrenze gilt zusätzlich zum MoinPDF-Limit von 80 MB.

## Was Umbrel automatisch einrichtet

- Ein separater, stabiler API-Schlüssel wird aus Umbrels App-Entropie abgeleitet und nur an Web-Proxy und Dokumentenserver übergeben.
- Web-App, Dokumentenserver und Übersetzung laufen ohne Root-Rechte als UID/GID `1000:1000`.
- Nur die Web-App hängt am üblichen Umbrel-Netz. Dokumentenserver und laufende Übersetzung befinden sich zusätzlich in einem eigenen internen Netz ohne Internetroute. Der separate Modell-Downloader hat Internetzugang und erhält keine Dokumente.
- Sprachmodelle, Übersetzungscache und Caddy-Daten liegen unter `${APP_DATA_DIR}/data/`; Neustarts und Updates behalten sie. Auf umbrelOS 2.0 kann dieser Datenbereich über Umbrel verschoben werden.
- Unter `data/trust` können bei Bedarf eigene vertrauenswürdige CA-Zertifikate für die Signaturprüfung bereitgestellt werden. Ein eigenes Signaturzertifikat bleibt erforderlich, wenn Dokumente unterschrieben werden sollen.
- Temporäre Dokumentenaufträge liegen im Arbeitsspeicher-Dateisystem des Dokumentenservers und werden nach der Verarbeitung entfernt. MoinPDF ist kein Dokumentenarchiv.
- Docker-Protokolle sind pro Dienst auf drei Dateien zu je 10 MB begrenzt. Dies ist eine Größenbegrenzung, keine Aufbewahrungsfrist in Tagen.

Der Dienst `translation-models` darf mit `Exited (0)` enden: Das bedeutet, dass alle Sprachmodelle vorbereitet sind. Die dauerhaft laufenden Dienste heißen `web`, `documents` und `translation`.

## Impressum, Datenschutz und E-Mail

Die eingebundenen Seiten beschreiben **Denny Wenkes eigenen Betrieb mit eigenem Server, Cloudflare und Tuta**. Andere Betreiber müssen diese Angaben vor einer öffentlichen Bereitstellung anpassen. Tatsächlich eingesetzte zusätzliche Anmeldedienste, Statistiken und Aufbewahrungsregeln berücksichtigen. Tuta bleibt das externe Kontaktpostfach; MoinPDF benötigt weder SMTP-Zugangsdaten noch einen Mail-Container. Die DNS-Einträge des Postfachs müssen für diese Installation nicht verändert werden.

## Updates und Prüfung auf dem Zielgerät

Updates über den Umbrel App Store installieren. Die Paketversion verweist auf geprüfte, mit Manifest-Digests festgelegte Images für `linux/amd64` und `linux/arm64`. Ein normales Update behält die App-Daten; eine Deinstallation kann sie löschen.

Vor der öffentlichen Nutzung auf dem tatsächlichen Umbrel die Installation, den App-Start, eine Office-Konvertierung, eine Übersetzung und einen Neustart prüfen. Danach dieselben Aufträge über die öffentliche Domain testen. Ein erfolgreicher Docker-Test auf GitHub ersetzt diesen Umbrel- und Cloudflare-Verbindungstest nicht.

## Image-Veröffentlichung für den Store-Maintainer

`.github/workflows/publish-images.yml` baut die drei Images aus demselben Quellstand für beide Architekturen und veröffentlicht sie mit dem integrierten GitHub-Actions-Token. Zusätzliche Registry-Passwörter im Repository sind nicht nötig. Tags enthalten App-Version und Quell-Commit; die Workflow-Artefakte enthalten die zugehörigen Multiarch-Index-Digests.

Beim **ersten** GHCR-Publish muss der Eigentümer die Pakete `moinpdf-web`, `moinpdf-documents` und `moinpdf-translation` in GitHub unter **Package settings → Change visibility → Public** öffentlich freigeben. Die Sichtbarkeit des Quellcode-Repositories muss dafür nicht geändert werden. Danach die anonyme Abrufbarkeit und beide Plattformen mit dem Umbrel-Linter prüfen, die Referenzen samt Digest im Store aktualisieren und erst dann den Store-Pull-Request freigeben.

Quellen: [Umbrel-Paketierung](https://github.com/getumbrel/umbrel-apps/blob/master/.agents/skills/umbrel-package-app/SKILL.md), [GHCR-Paketsichtbarkeit](https://docs.github.com/en/packages/learn-github-packages/configuring-a-packages-access-control-and-visibility), [Cloudflare 524](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-524/).
