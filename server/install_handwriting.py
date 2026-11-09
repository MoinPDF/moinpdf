"""Download immutable HTR assets at image build time, never on a document request."""
import hashlib,json,os,time,urllib.request
from pathlib import Path
def install():
    lock=json.loads(Path(__file__).with_name('handwriting.lock.json').read_text());root=Path(os.getenv('MOINPDF_TOOLS','/opt/moinpdf-tools'))/'handwriting';root.mkdir(parents=True,exist_ok=True)
    for item in lock['files']:
        for attempt in range(3):
            try:
                with urllib.request.urlopen(item['url'],timeout=90) as response:data=response.read(item['bytes']+1)
                if len(data)!=item['bytes'] or hashlib.sha256(data).hexdigest()!=item['sha256']:raise ValueError('Handwriting asset checksum mismatch')
                (root/item['name']).write_bytes(data);break
            except Exception:
                if attempt==2:raise
                time.sleep(2)
if __name__=='__main__':install()
