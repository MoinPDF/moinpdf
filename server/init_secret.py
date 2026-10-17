"""Create the internal proxy credential once; never print it or overwrite it."""
import os
import secrets
from pathlib import Path


def initialize(path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        if len(path.read_text().strip()) < 32:
            raise ValueError('Der vorhandene interne API-Schlüssel ist ungültig.')
    else:
        # Atomic replace prevents a partial secret if initialization is interrupted.
        temporary = path.with_suffix('.tmp')
        descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(descriptor, 'w') as output:
            output.write(secrets.token_urlsafe(48) + '\n')
            output.flush()
            os.fsync(output.fileno())
        temporary.replace(path)
    os.chmod(path, 0o400)
    os.chown(path, 10001, 10001)
    print('Interner Dokumentenserver-Schlüssel ist eingerichtet.')


if __name__ == '__main__':
    initialize(Path('/run/moinpdf/api-key'))
    jobs = Path('/var/lib/moinpdf-jobs')
    jobs.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chown(jobs, 10001, 10001)
    os.chmod(jobs, 0o700)
