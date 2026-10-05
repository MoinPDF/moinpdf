"""Install missing English pivot pairs, including after an interrupted download.

Only this initialization container has internet access. Once complete, both the
document server and LibreTranslate run on an internal Docker network.
"""
import json
import os
import time
from pathlib import Path

from argostranslate import package
from libretranslate.init import check_and_install_models

languages = set(os.environ['LT_LOAD_ONLY'].split(','))
required = {(a, b) for code in languages - {'en'} for a, b in [('en', code), (code, 'en')]}


def missing_pairs():
    installed = {(p.from_code, p.to_code) for p in package.get_installed_packages()}
    return required - installed


def warm_models():
    # Sentence-splitting models may also download on first use. Prime every
    # source language while this initialization container still has internet.
    fingerprint = sorted((p.from_code, p.to_code, p.package_version) for p in package.get_installed_packages())
    marker = Path.home() / '.local/share/moinpdf/ready-models.json'
    serialized = json.dumps(fingerprint)
    if marker.exists() and marker.read_text() == serialized:
        return
    from argostranslate import translate
    examples = {'en': 'This is a test.', 'de': 'Das ist ein Test.', 'fr': 'Ceci est un test.',
                'es': 'Esto es una prueba.', 'it': 'Questo è un test.', 'nl': 'Dit is een test.',
                'pl': 'To jest test.'}
    for source, target in sorted(required):
        output = translate.translate(examples[source], source, target)
        if not output.strip():
            raise RuntimeError(f'Leere Testübersetzung: {source} → {target}')
        print(f'Sprachpaar bereit: {source} → {target}', flush=True)
    marker.parent.mkdir(parents=True, exist_ok=True)
    marker.write_text(serialized)


while True:
    try:
        if missing_pairs():
            print('Installiere fehlende Sprachpaare:', sorted(missing_pairs()), flush=True)
            check_and_install_models(load_only_lang_codes=sorted(languages), update=True)
        if missing_pairs():
            raise RuntimeError('Noch fehlende Sprachpaare: ' + str(sorted(missing_pairs())))
        warm_models()
        break
    except Exception as error:
        print(f'Sprachinstallation wird in 30 Sekunden erneut versucht: {error}', flush=True)
        time.sleep(30)

print('Sprachmodelle vollständig: ' + ', '.join(sorted(languages)), flush=True)
