"""Install immutable Piper models and model cards, checking every SHA-256."""
import hashlib
import json
import os
import urllib.request
from pathlib import Path


def install(root):
    destination = Path(root) / "voices"
    destination.mkdir(parents=True, exist_ok=True)
    lock = json.loads(Path(__file__).with_name("voices.lock.json").read_text())
    source_lock = json.loads(Path(__file__).with_name("speech-sources.lock.json").read_text())
    source_destination = Path(root) / "speech-source"
    source_destination.mkdir(parents=True, exist_ok=True)
    downloads = [(item, lock["baseUrl"] + item["path"], destination) for item in lock["files"]]
    downloads += [(item, item["url"], source_destination) for item in source_lock["files"]]
    for item, url, target_directory in downloads:
        target = target_directory / item["name"]
        if target.is_file() and hashlib.sha256(target.read_bytes()).hexdigest() == item["sha256"]:
            continue
        request = urllib.request.Request(url, headers={"User-Agent": "MoinPDF-build/1"})
        temporary = target.with_name(target.name + ".part")
        digest = hashlib.sha256()
        try:
            count = 0
            with urllib.request.urlopen(request, timeout=120) as response, temporary.open("wb") as output:
                while data := response.read(1024 * 1024):
                    count += len(data)
                    if count > 80 * 1024 * 1024:
                        raise ValueError("Voice download exceeds limit")
                    digest.update(data)
                    output.write(data)
            if digest.hexdigest() != item["sha256"]:
                raise ValueError("Voice checksum mismatch: " + item["name"])
            temporary.replace(target)
        finally:
            temporary.unlink(missing_ok=True)
    (destination / "voices.lock.json").write_text(json.dumps(lock, indent=2))
    (source_destination / "SOURCE-MANIFEST.json").write_text(json.dumps(source_lock, indent=2))
    (source_destination / "SHA256SUMS").write_text("".join(item["sha256"] + "  " + item["name"] + "\n" for item in source_lock["files"]))


if __name__ == "__main__":
    install(os.getenv("MOINPDF_TOOLS", "/opt/moinpdf-tools"))
