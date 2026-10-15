# Entwicklung und Rückmeldungen

**Deutsch** · [English](CONTRIBUTING.en.md) · [← README](README.md)

Allgemeine Rückmeldungen: **[ahoi@moinpdf.de](mailto:ahoi@moinpdf.de)** oder über die
[deutschen und englischen Issue-Vorlagen](https://github.com/MoinPDF/moinpdf/issues/new/choose)
in diesem öffentlichen Repository. Sicherheitsmeldungen gehören
an den in [SECURITY.md](SECURITY.md) genannten vertraulichen Kontakt.

## Änderungen vorbereiten

1. Einen eigenen Branch vom aktuellen `main` erstellen.
2. Eine klar abgegrenzte Änderung vornehmen und die passende Dokumentation auf **Deutsch und Englisch** pflegen.
3. Quellcode formatieren, Typprüfung und Linter ausführen.
4. Betroffene Funktionen mit künstlichen Dokumenten prüfen; bei Änderungen an
   Verarbeitung oder Exporten auch die erzeugte Datei unabhängig wieder einlesen.
5. Die automatisierten Prüfungen abwarten, bevor eine Version freigegeben wird.

Einrichtung und Befehle stehen in [docs/ENTWICKLUNG.md](docs/ENTWICKLUNG.md).
Versionsnummern werden zentral in `package.json` gepflegt. Vor einer neuen
Version den Changelog ergänzen und die Docker-Veröffentlichung prüfen.

Bitte keine privaten Dokumente, Passwörter, Zertifikatsschlüssel oder lokale
Laufzeitdaten einchecken. Die vorhandenen Lizenzhinweise sind zu erhalten.
