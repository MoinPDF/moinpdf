import io
import json
import os
import sys
import tempfile
import unittest
import wave
import zipfile
from pathlib import Path
from unittest.mock import patch

import numpy as np
sys.path.insert(0, str(Path(__file__).parent))
from audio_documents import validate_request, text_chunks, synthesize, voices_available


class AudioTests(unittest.TestCase):
    def request(self, voice="thorsten", speed=1):
        return {"voice": voice, "speed": speed, "sections": [{"title": "Moin", "text": "Moin! Dies ist ein kurzer Hörbuchtest mit deutschen Wörtern."}]}

    def validate_wave(self, data, rate):
        with wave.open(io.BytesIO(data), "rb") as audio:
            self.assertEqual(audio.getnchannels(), 1)
            self.assertEqual(audio.getsampwidth(), 2)
            self.assertEqual(audio.getframerate(), rate)
            seconds = audio.getnframes() / rate
            self.assertGreater(seconds, .5)
            self.assertLess(seconds, 30)
            pcm = np.frombuffer(audio.readframes(audio.getnframes()), dtype="<i2").astype(np.int32)
            self.assertGreater(int(np.max(np.abs(pcm))), 200)
            return seconds

    def test_real_installed_voices_and_speed(self):
        self.assertEqual(len(voices_available()), 2, "Both verified voice models must be installed; this test must not pass with mocks.")
        durations = []
        for voice, rate, speed in [("thorsten", 22050, .8), ("thorsten", 22050, 1.4), ("kerstin", 16000, 1)]:
            with tempfile.TemporaryDirectory() as directory:
                output = Path(directory)
                self.assertEqual(synthesize(self.request(voice, speed), output), "wav")
                durations.append(self.validate_wave((output / "output.wav").read_bytes(), rate))
        self.assertGreater(durations[0], durations[1] * 1.3)

    def test_limits_and_lossless_chunk_boundaries(self):
        for value in [None, [], {}, {"voice": []}, self.request("../model"), self.request(speed=True), self.request(speed=float("nan")), self.request(speed=2)]:
            with self.assertRaises(ValueError):validate_request(value)
        for sections in [[], [{"title":"x", "text":""}], [{"title":"../unsafe\n#EXTINF", "text":"Text"}], [{"title":"x", "text":"x" * 20001}], [{"title":"x", "text":"a"}] * 101]:
            with self.assertRaises(ValueError):validate_request({**self.request(), "sections": sections})
        text = "Ununterbrochen" * 100 + ". Nächster Satz.\n" + "Ä" * 900
        chunks = list(text_chunks(text))
        self.assertTrue(all(len(c) <= 350 for c in chunks))
        self.assertEqual("".join(chunks), text)

    def test_authenticated_endpoint_real_zip_and_cleanup(self):
        from fastapi.testclient import TestClient
        import app as service
        key = "synthetic-audio-test-key-never-used-in-production"
        with patch.dict(os.environ, {"MOINPDF_API_KEY": key}):
            client = TestClient(service.app)
            headers = {"Authorization": "Bearer " + key}
            self.assertEqual(client.post('/v1/audio', data={"request": json.dumps(self.request())}).status_code, 401)
            caps = client.get('/v1/capabilities', headers=headers).json()
            self.assertTrue(caps['capabilities']['speech'])
            self.assertEqual(len(caps['audioVoices']), 2)
            before = set(Path(tempfile.gettempdir()).glob('moinpdf-*'))
            request = self.request()
            request['sections'] = [{"title": "Einleitung", "text": "Moin aus dem Norden."}, {"title": "Kapitel zwei", "text": "Dies ist das zweite Kapitel."}]
            response = client.post('/v1/audio', headers=headers, data={"request": json.dumps(request)})
            self.assertEqual(response.status_code, 200, response.text[:200] if response.status_code != 200 else '')
            self.assertEqual(response.headers['cache-control'], 'no-store')
            self.assertIn('application/zip', response.headers['content-type'])
            with zipfile.ZipFile(io.BytesIO(response.content)) as bundle:
                self.assertEqual(set(bundle.namelist()), {'001.wav','002.wav','Kapitel.json','Hoerbuch.m3u8'})
                self.validate_wave(bundle.read('001.wav'), 22050)
                self.validate_wave(bundle.read('002.wav'), 22050)
                self.assertEqual(json.loads(bundle.read('Kapitel.json'))['sections'][1]['title'], 'Kapitel zwei')
                self.assertIn('002.wav', bundle.read('Hoerbuch.m3u8').decode())
            self.assertEqual(set(Path(tempfile.gettempdir()).glob('moinpdf-*')), before)
            for payload in ['{bad', json.dumps(self.request(speed=-1)), json.dumps({**request, 'sections':[]})]:
                self.assertEqual(client.post('/v1/audio', headers=headers, data={'request':payload}).status_code, 422)
            with patch.object(service, 'voices_available', return_value=[]):
                self.assertEqual(client.post('/v1/audio', headers=headers, data={'request':json.dumps(request)}).status_code, 503)


if __name__ == '__main__':unittest.main()
