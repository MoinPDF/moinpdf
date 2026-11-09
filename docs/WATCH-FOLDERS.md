# Automatische Eingangsordner

[English](WATCH-FOLDERS.en.md) · [Funktionen](FUNKTIONEN.md)

Der optionale Dokumentenserver kann lokale PDF-Eingangsordner ohne geöffneten Browser verarbeiten. Die Funktion ist standardmäßig aus. Die gehostete Weboberfläche überwacht keine Ordner auf dem Gerät.

## Einrichten

1. Unter **Arbeitsabläufe** einen unterstützten linearen Ablauf wählen, beispielsweise **Zum Teilen vorbereiten**. **Für Eingangsordner exportieren** erzeugt `workflow.json`. Der Export weist nicht unterstützte Schritte ausdrücklich zurück.
2. Im Verzeichnis der Compose-Dateien `watchfolders/ablage/inbox` anlegen. `workflow.json` unter `watchfolders/ablage/` speichern. Weitere Profile erhalten eigene Ordner mit Namen aus Buchstaben, Ziffern, `_` und `-` (höchstens 64 Zeichen).
3. Dem Dokumentenserver (Standard-UID/GID `10001:10001`) Lese- und Schreibrechte auf diesen Ordner geben. Bei einer neuen, ausschließlich dafür angelegten Ablage beispielsweise:

   ```sh
   mkdir -p watchfolders/ablage/inbox
   # Vorher die exportierte workflow.json nach watchfolders/ablage/ kopieren.
   sudo chown -R 10001:10001 watchfolders
   docker compose -f compose.yaml -f compose.watch.yaml up -d --build
   ```

4. PDFs in `watchfolders/ablage/inbox` ablegen. Für verlässliche Übergaben zunächst mit Endung `.part` schreiben und nach Abschluss innerhalb desselben Dateisystems in `.pdf` umbenennen. Ergebnisse erscheinen in `output`, Auftragsberichte in `status`.

Ohne Compose setzt der Betreiber `MOINPDF_WATCH_DIR` auf einen vorhandenen, beschreibbaren Profilstamm. Nur diese ausdrücklich eingebundene Ablage wird verarbeitet. Eine Prozesssperre verhindert zwei gleichzeitige Überwachungen desselben Stamms.

## Unterstützte Schritte und Grenzen

- Drehen um 90°/180°, Seitenreihenfolge umkehren, Formulare festschreiben, verlustfrei optimieren, Dokumentinfos oder Kommentare entfernen.
- Version-1-Abläufe mit 1 bis 12 Schritten; keine Bedingungen, Diagramme, OCR oder Passwortschritte. Diese bleiben in den bisherigen interaktiven Arbeitsabläufen verfügbar.
- Ungeschützte PDFs mit höchstens 80 MB und 200 Seiten. PDFs mit Signaturfeldern und XFA werden abgewiesen. Höchstens 180 Sekunden je Auftrag, innerhalb derselben Kapazitätsbegrenzung wie interaktive Serveraufträge.
- Text, Vektoren und normale Formularfelder bleiben bei den dafür geeigneten Schritten erhalten. **Formulare festschreiben** entfernt die Bearbeitbarkeit ausdrücklich. Metadatenbereinigung ersetzt keine umfassende Sicherheitsbereinigung.
- Ein Eingang muss mindestens fünf Sekunden unverändert sein. Originaldateien bleiben im `inbox`; es gibt keine automatische Löschung. Ausgabe und Bericht werden jeweils atomar geschrieben.
- Dateiname, Inhalt und Ablauf bilden die Auftragskennung. Bereits protokollierte Aufträge werden auch nach Neustarts nicht erneut verarbeitet. Eine geänderte Datei oder ein geänderter Ablauf erzeugt einen neuen Auftrag. Dadurch werden bei einer Ablaufänderung auch noch vorhandene ältere Eingänge neu verarbeitet.
- Zum Wiederholen nach einem Fehler dessen JSON-Bericht in `status` entfernen. Das gilt auch, wenn eine erfolgreiche Ausgabe gelöscht wurde und erneut benötigt wird. Bei einem Absturz zwischen Ausgabe und Bericht wird der Auftrag wiederholt und dieselbe Ergebnisdatei ersetzt; Originale bleiben erhalten.
- Fehler stehen im jeweiligen JSON-Bericht; ungültige Profile erhalten `configuration-error.json`. Symbolische Links werden nicht als Eingänge akzeptiert. Verzeichnisrechte nur vertrauenswürdigen lokalen Benutzern geben. Für das Aufräumen der Ablage und die Aufbewahrungsdauer ist der Betreiber zuständig.

Ein minimaler Ablauf:

```json
{"version":1,"name":"Zum Teilen vorbereiten","steps":[{"kind":"metadata"},{"kind":"remove-annotations"},{"kind":"optimizeLossless"}]}
```
