"""Fetch pinned upstream releases and verify their SHA-256 before installing."""
import hashlib
import json
import os
import subprocess
import tempfile
import urllib.request
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape


def extract(archive: Path, destination: Path):
    destination.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive) as bundle:
        for member in bundle.infolist():
            target = (destination / member.filename).resolve()
            if not target.is_relative_to(destination.resolve()):
                raise ValueError("Unsafe archive path")
        bundle.extractall(destination)


def install(root: Path):
    root = root.resolve()
    root.mkdir(parents=True, exist_ok=True)
    lock = json.loads(Path(__file__).with_name("tools.lock.json").read_text())
    with tempfile.TemporaryDirectory() as directory:
        temporary = Path(directory)
        for name, spec in lock.items():
            request = urllib.request.Request(spec["url"], headers={"User-Agent": "MoinPDF-build/1"})
            with urllib.request.urlopen(request, timeout=120) as response:
                data = response.read(128 * 1024 * 1024)
            if hashlib.sha256(data).hexdigest() != spec["sha256"]:
                raise ValueError(f"SHA-256 mismatch: {name}")
            path = temporary / name
            path.write_bytes(data)
            if name == "kosit":
                (root / "validator.jar").write_bytes(data)
            elif name == "mustang":
                (root / "mustang.jar").write_bytes(data)
            elif name == "xrechnung":
                extract(path, root / "xrechnung")
            else:
                extract(path, temporary / "installer")
                jar = next((temporary / "installer").rglob("verapdf-izpack-installer-*.jar"))
                config = temporary / "install.xml"
                config.write_text(f'''<AutomatedInstallation langpack="eng">
<com.izforge.izpack.panels.htmlhello.HTMLHelloPanel id="welcome"/>
<com.izforge.izpack.panels.target.TargetPanel id="install_dir"><installpath>{escape(str(root / 'verapdf'))}</installpath></com.izforge.izpack.panels.target.TargetPanel>
<com.izforge.izpack.panels.packs.PacksPanel id="sdk_pack_select">
<pack index="0" name="veraPDF GUI" selected="true"/>
<pack index="1" name="veraPDF Mac and *nix Scripts" selected="true"/>
<pack index="2" name="veraPDF Validation model" selected="false"/>
<pack index="3" name="veraPDF Documentation" selected="false"/>
<pack index="4" name="veraPDF Sample Plugins" selected="false"/>
</com.izforge.izpack.panels.packs.PacksPanel>
<com.izforge.izpack.panels.install.InstallPanel id="install"/>
<com.izforge.izpack.panels.finish.FinishPanel id="finish"/>
</AutomatedInstallation>''')
                subprocess.run(["java", "-jar", str(jar), str(config)], check=True, timeout=180)
                (root / "verapdf" / "verapdf").chmod(0o755)
    (root / "versions.json").write_text(json.dumps({name: spec["version"] for name, spec in lock.items()}, indent=2))


if __name__ == "__main__":
    install(Path(os.getenv("MOINPDF_TOOLS", "/opt/moinpdf-tools")))
