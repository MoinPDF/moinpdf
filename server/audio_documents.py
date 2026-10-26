"""Local Piper worker. SPDX-License-Identifier: GPL-3.0-or-later.

The worker receives reviewed plain text, never URLs or model paths from clients.
Models are pinned and installed while building the image, not during synthesis.
"""
from __future__ import annotations
import importlib.util
import json
import math
import os
import re
import sys
import wave
import zipfile
from pathlib import Path

MAX_CHARACTERS = 20000
MAX_SECTIONS = 100
MAX_PCM_BYTES = 80 * 1024 * 1024
VOICES = {
    "thorsten": {"id": "thorsten", "label": "Thorsten · Deutsch", "language": "de-DE", "model": "de_DE-thorsten-medium.onnx", "rate": 22050},
    "kerstin": {"id": "kerstin", "label": "Kerstin · Deutsch", "language": "de-DE", "model": "de_DE-kerstin-low.onnx", "rate": 16000},
    "ljspeech": {"id": "ljspeech", "label": "LJ · English (US)", "language": "en-US", "model": "en_US-ljspeech-medium.onnx", "rate": 22050},
}


def voice_root():
    return Path(os.getenv("MOINPDF_TOOLS", "/opt/moinpdf-tools")) / "voices"


def voices_available():
    if importlib.util.find_spec("piper") is None:
        return []
    root = voice_root()
    return [{key: value[key] for key in ("id", "label", "language")} for value in VOICES.values()
            if (root / value["model"]).is_file() and (root / (value["model"] + ".json")).is_file()]


def validate_request(value):
    if not isinstance(value, dict) or not isinstance(value.get("voice"), str) or value["voice"] not in VOICES:
        raise ValueError("Bitte eine der installierten Stimmen wählen.")
    speed = value.get("speed", 1.0)
    if isinstance(speed, bool) or not isinstance(speed, (float, int)) or not math.isfinite(speed) or not .75 <= speed <= 1.5:
        raise ValueError("Das Sprechtempo muss zwischen 0,75 und 1,5 liegen.")
    sections = value.get("sections")
    if not isinstance(sections, list) or not 1 <= len(sections) <= MAX_SECTIONS:
        raise ValueError("Bitte 1 bis 100 nicht leere Abschnitte auswählen.")
    clean = []
    for item in sections:
        if not isinstance(item, dict) or not isinstance(item.get("text"), str) or not isinstance(item.get("title"), str):
            raise ValueError("Jeder Abschnitt braucht Titel und Text.")
        text, title = item["text"].strip(), item["title"].strip()
        if not text or not title or len(title) > 200 or re.search(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", text) or re.search(r"[\x00-\x1f]", title):
            raise ValueError("Leere Abschnitte, Steuercodes oder Titel über 200 Zeichen sind nicht erlaubt.")
        clean.append({"title": title, "text": text})
    if sum(len(item["text"]) for item in clean) > MAX_CHARACTERS:
        raise ValueError("Pro Auftrag sind höchstens 20.000 Zeichen möglich. Bitte weniger Abschnitte auswählen.")
    return {"voice": value["voice"], "speed": float(speed), "sections": clean}


def text_chunks(text, size=350):
    """Bound even unpunctuated input; preserve every non-whitespace character."""
    while len(text) > size:
        cut = max(text.rfind(mark, 0, size) for mark in (". ", "! ", "? ", "; ", "\n"))
        if cut < size // 3:
            cut = text.rfind(" ", 0, size)
        cut = cut + 1 if cut >= size // 3 else size
        yield text[:cut]
        text = text[cut:]
    if text.strip():
        yield text


def synthesize(request, directory: Path):
    from piper import PiperVoice, SynthesisConfig
    request = validate_request(request)
    spec = VOICES[request["voice"]]
    model = voice_root() / spec["model"]
    # Explicitly bound ONNX CPU threads inside the same per-job process limit.
    import onnxruntime
    session = onnxruntime.SessionOptions()
    session.intra_op_num_threads = 2
    session.inter_op_num_threads = 1
    # The public load API configures CPU execution. Its default session can use
    # every host core, so construct the documented voice with a bounded session.
    from piper.config import PiperConfig
    config = PiperConfig.from_dict(json.loads(model.with_suffix(".onnx.json").read_text()))
    voice = PiperVoice(onnxruntime.InferenceSession(str(model), sess_options=session, providers=["CPUExecutionProvider"]), config)
    syn_config = SynthesisConfig(length_scale=1.0 / request["speed"])
    total_bytes = 0
    entries = []
    for index, section in enumerate(request["sections"], 1):
        name = f"{index:03}.wav"
        with wave.open(str(directory / name), "wb") as output:
            output.setnchannels(1)
            output.setsampwidth(2)
            output.setframerate(spec["rate"])
            frames = 0
            for text in text_chunks(section["text"]):
                for chunk in voice.synthesize(text, syn_config=syn_config):
                    if chunk.sample_rate != spec["rate"] or chunk.sample_width != 2 or chunk.sample_channels != 1:
                        raise ValueError("Unerwartetes Audioformat der Stimme.")
                    data = chunk.audio_int16_bytes
                    total_bytes += len(data)
                    if total_bytes > MAX_PCM_BYTES:
                        raise ValueError("Die Audioausgabe ist zu groß. Bitte weniger Abschnitte auswählen.")
                    output.writeframesraw(data)
                    frames += len(data) // 2
            if not frames:
                raise ValueError("Der Abschnitt hat keine Audioausgabe erzeugt.")
        entries.append({"file": name, "title": section["title"], "seconds": round(frames / spec["rate"], 3)})
    if len(entries) == 1:
        (directory / entries[0]["file"]).rename(directory / "output.wav")
        return "wav"
    manifest = {"voice": request["voice"], "language": spec["language"], "speed": request["speed"], "sections": entries}
    playlist = "#EXTM3U\n" + "".join(f"#EXTINF:{round(item['seconds'])},{item['title']}\n{item['file']}\n" for item in entries)
    with zipfile.ZipFile(directory / "output.zip", "w", compression=zipfile.ZIP_DEFLATED) as bundle:
        for item in entries:
            bundle.write(directory / item["file"], item["file"])
        bundle.writestr("Kapitel.json", json.dumps(manifest, ensure_ascii=False, indent=2))
        bundle.writestr("Hoerbuch.m3u8", playlist)
    return "zip"


if __name__ == "__main__":
    directory = Path(sys.argv[1])
    try:
        synthesize(json.loads((directory / "request.json").read_text()), directory)
    except ValueError as error:
        # Only our fixed validation messages, never document contents or paths.
        (directory / "audio-error.json").write_text(json.dumps({"error": str(error)}))
        sys.exit(2)
