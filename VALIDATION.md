# Prüfstand: Erweiterung von 44 auf 62 Werkzeugansichten

Stand: 5. Oktober 2026. 58 Werkzeuge arbeiten im Browser. Vier zusätzliche Ansichten benötigen einen separat betriebenen Dokumentenserver.

## Automatisierte Browser-Engine-Tests

Alle neun Suiten in `pnpm test` wurden mit echten PDF-Dateien und PDF.js ausgeführt. Bestehende Funktionen wurden zusätzlich auf Regressionen geprüft.

- Seitenreihenfolge, Drehungen, Formulare, Lesezeichen, Bildextraktion, Passwortschutz und E-Rechnungen.
- Alle 62 Werkzeugnamen und 56 natürliche Suchanfragen.
- CSV mit Anführungszeichen und Zeilenumbrüchen, XLSX mit Textzellen und Schutz vor CSV-Formelausführung.
- Dateinamenvorschläge und eindeutige ZIP-Dateinamen; Aufteilung nach Text, Lesezeichen, Leerseiten und Code-Trennseiten.
- Suchschwärzung: keine alte Textebene, Formulare oder Anhänge in der Ausgabe.
- Anhangsentfernung und Ersetzung: verbleibende Anhänge separat lesbar; entfernte Inhalte auch nicht mehr in dekomprimierten PDF-Objekten enthalten.
- PDF-Links bei 0°, 90°, 180° und 270°; ungültige Protokolle/Zielseiten werden abgelehnt.
- Klickbare Inhaltsverzeichnisse mit korrekten Zielseiten; Serienformulare einschließlich Umlauten.
- Mehrstufige Abläufe, Leerseitenfilter, Seitennummern, verschlüsselte Stapelausgabe und Reihenfolgeprüfung.
- Pixelvergleich gleicher/geänderter Inhalte, Scanverbesserung, QR-Erzeugung und unabhängiges Auslesen, Kameraperspektive und ungültige Ecken.
- TypeScript-Prüfung und Produktionsbuild erfolgreich.

## Browserbedienung

In der Sites-Vorschau mit synthetischen Testdateien geprüft:

- Dateiauswahl, Werkzeugliste und Einstieg für Office-Dateien ohne vorherige PDF.
- Erkennbare Deaktivierung der Serververarbeitung ohne Verbindung.
- Suchschwärzung mit sechs kontrollierbaren Treffern und erfolgreichem PDF-Export.
- Deutsche/englische OCR mit Wortkoordinaten, Tabellenraster und editierbaren Zellen.
- QR-Code-Vorschau und Einfügen in eine PDF.
- Fotoauswahl, Perspektivvorschau, Seitensammlung und PDF-Ausgabe des Kamerascanners.

## Dokumentenserver

`server/test_service.py`: sieben Tests, sechs bestanden, einer wegen fehlender nativer Komponente übersprungen.

- API-Authentifizierung, Anfrageprüfung und CORS einschließlich Preflight und fehlendem Schlüssel.
- KoSIT 1.6.3 mit der XRechnung-Konfiguration 3.0.2 vom 31.08.2026: offizielle UBL-Testrechnung akzeptiert; eine formal wohlgeformte, inhaltlich ungültige Rechnung zurückgewiesen.
- Ghostscript und veraPDF 1.30.2: Erzeugung und bestandene Validierung für PDF/A-1b, 2b und 3b; gewöhnliche PDF im PDF/A-Check zurückgewiesen.
- Tatsächliche PKCS#12-Signatur mit eigens erzeugtem Testzertifikat; Integrität, fehlendes/konfiguriertes Zertifikatsvertrauen und manipulierte PDF unabhängig geprüft.
- **Nicht ausgeführt:** native Office-Konvertierung. LibreOffice ist in dieser Entwicklungsumgebung nicht verfügbar; die Installation scheiterte an den Laufzeitberechtigungen. Dockerfile und Integrationstest sind vorhanden.
- **Nicht ausgeführt:** vollständiger Docker-Compose-Build; hier steht kein Docker-Daemon zur Verfügung. Die verwendeten KoSIT- und veraPDF-Distributionen wurden separat installiert und ausgeführt.

## Noch erforderliche Inbetriebnahme

Für die vier Serverwerkzeuge ist kein externer Produktionsserver verbunden. Die bereitgestellte Docker-Konfiguration muss auf einem eigenen Server gestartet werden. Anschließend Serveradresse und API-Schlüssel in der App eintragen. Es wurden keine Zugangsdaten erfunden und keine Dokumente an einen fremden Konvertierungsdienst übertragen.

Die Signaturprüfung erfolgt ohne Online-Sperrstatus, qualifizierten Status oder vertrauenswürdigen externen Zeitstempel. OCR, Leerseitenerkennung und Dateinamenvorschläge bleiben kontrollbedürftig. Diese Grenzen werden auch in der Oberfläche erläutert.
