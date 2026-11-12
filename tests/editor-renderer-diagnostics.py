"""Observe the unchanged export acceptance process without retries or extra time.

Only the disposable Linux WebKit job collects process data. An ordinary form
export taking over 25 seconds also gets native stacks before the existing
300-second watchdog can end an unresponsive browser. Intentional fault cases
are excluded. Fixtures are fictional; process arguments/environment are omitted.
"""
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path


def descendants(root):
    result = subprocess.run(
        ['ps', '-eo', 'pid=,ppid=,pcpu=,rss=,stat=,comm='],
        check=True, capture_output=True, text=True, timeout=5,
    )
    rows = []
    for line in result.stdout.splitlines():
        values = line.split(None, 5)
        if len(values) == 6:
            pid, parent, cpu, rss, state, command = values
            rows.append({'pid': int(pid), 'parent': int(parent), 'cpu': float(cpu),
                         'rss_kib': int(rss), 'state': state, 'command': command})
    owned = {root}
    while True:
        expanded = owned | {row['pid'] for row in rows if row['parent'] in owned}
        if expanded == owned:
            return [row for row in rows if row['pid'] in owned]
        owned = expanded


def main():
    command = [sys.executable, 'tests/editor-verification-browser.py']
    if sys.platform != 'linux' or os.environ.get('MOINPDF_TEST_BROWSERS') != 'webkit':
        return subprocess.call(command)

    out = Path(os.environ.get('MOINPDF_BROWSER_OUTPUT', '.cache/editor-browser')) / 'verification'
    out.mkdir(parents=True, exist_ok=True)
    started = time.time()
    child = subprocess.Popen(command)
    seen_stage, since = None, time.monotonic()
    captured = set()
    try:
        with (out / 'native-processes.jsonl').open('w') as log:
            while child.poll() is None:
                try:
                    rows = descendants(child.pid)
                    progress_file = out / 'progress.json'
                    progress = json.loads(progress_file.read_text()) if progress_file.exists() and progress_file.stat().st_mtime >= started else {}
                    stage = (progress.get('case'), progress.get('stage'))
                    if stage != seen_stage:
                        seen_stage, since = stage, time.monotonic()
                    log.write(json.dumps({'elapsed': round(time.time() - started, 2),
                                          'progress': progress, 'processes': rows}) + '\n')
                    log.flush()
                    case, step = stage
                    if (case and re.fullmatch(r'webkit-verification-form-\d+', case)
                            and step == 'wait-for-verified-download'
                            and time.monotonic() - since > 25 and case not in captured):
                        captured.add(case)
                        print('DIAGNOSTICS: capturing native renderer stacks for ' + case, flush=True)
                        for row in rows:
                            if row['command'] not in ('WPEWebProcess', 'WebKitWebProcess', 'WebKitGPUProcess'):
                                continue
                            with (out / f'{case}-native-{row["pid"]}.txt').open('w') as stack:
                                try:
                                    subprocess.run(
                                        ['sudo', '-n', 'gdb', '--batch', '--quiet', '-p', str(row['pid']),
                                         '-ex', 'set pagination off', '-ex', 'thread apply all bt 40',
                                         '-ex', 'detach'], stdout=stack, stderr=subprocess.STDOUT,
                                        timeout=20, check=False,
                                    )
                                except subprocess.TimeoutExpired:
                                    stack.write('\nNative stack collection timed out.\n')
                except (OSError, ValueError, subprocess.SubprocessError) as error:
                    log.write(json.dumps({'diagnostic_error': str(error)}) + '\n')
                    log.flush()
                time.sleep(2)
        return child.wait()
    finally:
        if child.poll() is None:
            child.terminate()
            try:
                child.wait(timeout=5)
            except subprocess.TimeoutExpired:
                child.kill()
                child.wait()


if __name__ == '__main__':
    sys.exit(main())
