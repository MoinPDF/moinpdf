# PDF-Bearbeitung: Web-Ausbau auf Basis von 0.19.0

Stand: 23. Oktober 2026. Ausgangspunkt des Site-Quellstands:
`bca58ccc1aa5a8c5e52fffe1ebd571275b6fd709`.
Die Paketversion und der vorhandene Release-Link bleiben 0.19.0; diese Änderung
stellt einen aktualisierten Webstand dar und erzeugt kein neues GitHub-Release.

## Verhalten

- Automatische Auswahl von Absätzen und Tabellenzellen als Standard; manuelle
  Auswahlarten unter „Auswahl anpassen“.
- Unterstreichen direkt in der Textleiste. Hoch-/Tiefstellung, Blocksatz,
  Aufzählungen, nummerierte Listen, Absatzabstand und optionale
  Browser-Rechtschreibprüfung unter „Mehr“.
- Formatiertes Einfügen mit ausdrücklicher Wahl zwischen Anpassung an die PDF
  und Übernahme unterstützter Formatierungen. Die tastaturbedienbare Auswahl
  liegt außerhalb skalierter Textfelder. HTML wird inert geparst; Bilder,
  Skripte und externe Inhalte werden nicht eingefügt.
- Ein gemeinsames Layout für Vorschau, Überlaufprüfung, PDF-Export und
  Schriftkonturprüfung. Listennummerierung bleibt beim Trennen von Textfeldern
  und beim Seitenwechsel erhalten; Grapheme werden beim Trennen geschützt.
- Unterstützte variable TrueType- und CFF2-Schriften lassen sich mit expliziten
  Achsenwerten als feste Instanz importieren. Konturen und Zeichenbreiten werden
  aus derselben Instanz gewonnen. Eigene Schriften funktionieren auch auf
  lokalen HTTP-Adressen über den vorhandenen SHA-256-Fallback.
- Ersatzschriftvorschläge berücksichtigen bei geeigneten einzeiligen Stellen
  zusätzlich Buchstabenform, Proportionen und Strichstärke. In anderen Fällen
  bleiben Breiten- und Umbruchvergleich verfügbar.
- Automatischer Vorschlag für die untere Textgrenze, übersteuerbare Grenze und
  maßstäbliche Textlayout-Miniaturen vor der Seitenfortsetzung. Vorhandene
  Prüfungen für Hindernisse, Spalten, Formulare und Anmerkungen bleiben aktiv.
- Der direkte Wechsel zu komplexen PDF-Objekten verwendet die vorhandene
  Übernahme mit Exportprüfung und gemeinsamem Arbeitsverlauf.
- Zwischenspeicherung vorbereiteter Schriftläufe und Zeichenbreiten sowie
  begrenzte Bildausschnitte für Scankorrekturen reduzieren wiederholte Arbeit.
- Deutsche und englische Oberfläche und Bedienungsanleitung aktualisiert.

## Prüfung dieses Quellstands

- Alle 49 Suiten aus `tests/run-all.mjs` bestanden in zwei aufeinanderfolgenden
  Teilabläufen (16 und 33 Suiten). Nach den letzten gezielten Korrekturen wurden
  die betroffenen Rich-Text-, UI- und Übersetzungstests erneut bestanden.
- `npm run typecheck`, `npm run lint`, `npm run format:check` und der
  Produktionsbuild bestanden. Der Build prüft außerdem die gebündelten
  Modul-Worker mit tatsächlichem PDF-Öffnen, Bearbeiten und Wiederöffnen in der VM.
- Neue Regressionen prüfen echte PDF-Ausgaben mit Unterstreichungen,
  Hoch-/Tiefstellung, Listen und Blocksatz, die visuelle Schrift-Rangfolge,
  Projektarchive und Listennummerierung an Seiten-/Textfeldgrenzen.
- Synthetische, reproduzierbare CC0-Schriften prüfen variable TrueType- und
  CFF2-Instanzen bei 400, 550 und 700 einschließlich Konturen, Prüfsummen,
  Zeichenbreiten und tatsächlichem PDF-Rendering. Importgrenzen und ungültige
  Achsenwerte werden geprüft.
- Die Scanprüfung erhält bei 8,75 Megapixeln alle Pixel außerhalb des gewählten
  Ausschnitts unverändert. Ein gesonderter 4-Megapixel-Test benötigt für einen
  kleinen Korrekturbereich 42.432 Byte an RGBA-Kopien statt zuvor 32.000.000 Byte.
  Das ist eine Messung dieses Ausschnitts, keine allgemeine RAM-/Tempozusage.
- Manuelle Chromium-Prüfung über die verwaltete Vorschau: automatische Auswahl,
  direkte Texteingabe, Formatmenü, Unterstreichung, Hochstellung, nummerierte
  Listen, Absatzabstand, formatiertes Einfügen mit Fokus-Rückkehr und Import
  einer CFF2-Instanz bei Gewicht 700. Listen- und Schrift-Exporte erreichten die
  abgeschlossene Text-, Bild- und Schriftkonturprüfung auf beiden Testseiten.
- Die Oberfläche berechnete eine zusätzliche Fortsetzungsseite für 45
  Listeneinträge und übernahm sie in das zuvor zweiseitige Dokument. Der Export
  bestand anschließend die Text- und Bildprüfung auf allen drei Seiten sowie
  die Schriftkonturprüfung beider bearbeiteter Textfelder.
  [Browseraufnahme](editor-web-upgrade-2026-10-23.jpg).
- Ein Download über die Cloud-Browser-API konnte wegen eines Tool-Timeouts
  nicht als lokale Datei erfasst werden. Die erzeugten PDFs wurden in der
  Anwendung geprüft; die automatisierten Tests prüfen ihre tatsächlichen
  Bytes mit unabhängigen Renderern. Eine erfolgreiche Browser-Downloadprüfung
  wird deshalb nicht behauptet.

## Grenzen

Dies ist keine Zusage vollständiger Acrobat-Pro-Gleichwertigkeit. Fehlende
Originalschriften, schwierige Scans, verschachtelte Layouts und komplexe
PDF-Objekte bleiben dokumentabhängig. Die Schriftähnlichkeit ist ein Vorschlag,
keine exakte Schrifterkennung. Listen sind einstufig und gelten pro Textfeld;
komplette HTML-/Word-Strukturen werden nicht übernommen.

Variable Schriften werden als feste Instanz eingebettet. Nicht unterstützte
globale/vertikale Metrikvariationen bei abweichenden MVAR-/VVAR-Achsenwerten
werden abgelehnt. Die Behandlung komplexer Schriftsysteme verbleibt im dafür
vorgesehenen Objekteditor. Masken-/Clipping-Schutz wird nicht aufgehoben.

Die bestehenden Obergrenzen (80 MB, 200 Dokumentseiten, 16 Megapixel für
Quellbilder und begrenzte Korrekturkacheln) sowie die Grenze von 20 zusätzlichen
Fortsetzungsseiten bleiben erhalten. Eine willkürliche Tabellenstruktur lässt
sich weiterhin nicht automatisch rekonstruieren. Neue Prüfungen auf realen
Mobilgeräten oder neue Firefox-/WebKit-CI-Läufe waren nicht Bestandteil dieser
Webabnahme; vorhandene frühere CI-Ergebnisse gelten nicht als Nachweis dieses
Quellstands.
