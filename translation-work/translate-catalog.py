import json, re, time
from pathlib import Path
import argostranslate.package
import argostranslate.translate

argostranslate.package.update_package_index()
package=next(p for p in argostranslate.package.get_available_packages() if p.from_code=='de' and p.to_code=='en')
argostranslate.package.install_from_path(package.download())
translator=next(p for p in argostranslate.translate.get_installed_languages() if p.code=='de').get_translation(next(p for p in argostranslate.translate.get_installed_languages() if p.code=='en'))
rows=json.loads(Path('/repo/translation-work/strings.json').read_text())
known=json.loads(Path('/repo/translation-work/known.json').read_text())
output={}; failed=[]
for index,row in enumerate(rows):
    source=row['de']
    if source in known:
        output[source]=known[source];continue
    if source=='use client' or re.fullmatch(r'[A-Za-z]+(?:Error|Exception)',source) or len(source)>1400 or '<svg' in source or '<?xml' in source or 'font-family:' in source or 'background:' in source:
        continue
    # Preserve interpolation slots while drafting copy. No document/user data is submitted.
    slots=re.findall(r'\{\d+\}',source)
    protected=source
    for slot in set(slots): protected=protected.replace(slot,'ZXQ'+slot[1:-1]+'QXZ')
    try:
        target=translator.translate(protected)
        for slot in set(slots): target=re.sub(r'ZXQ\s*'+slot[1:-1]+r'\s*QXZ',slot,target,flags=re.I)
        if sorted(re.findall(r'\{\d+\}',target))!=sorted(slots):
            failed.append(source);continue
        output[source]=target
    except Exception as error:
        failed.append(source)
    if index%100==0:
        print(f'{index}/{len(rows)} translated',flush=True)
        Path('/out/draft-en.json').write_text(json.dumps(output,ensure_ascii=False,indent=2))
Path('/out/draft-en.json').write_text(json.dumps(output,ensure_ascii=False,indent=2))
Path('/out/missing.json').write_text(json.dumps(failed,ensure_ascii=False,indent=2))
print(f'Done: {len(output)} drafts, {len(failed)} require manual translation.',flush=True)
