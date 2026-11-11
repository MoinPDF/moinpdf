"""Temporary CI diagnostics on the exact 0.32.0 application source."""
import faulthandler, os, runpy, sys, time
sys.path.insert(0, 'tests')
faulthandler.enable()
faulthandler.dump_traceback_later(90, repeat=True)
watched = {'auto_flow', 'open_editor', 'pick', 'geometry', 'panel', 'save', 'execute'}
def progress(frame, event, arg):
    if not frame.f_code.co_filename.endswith('editor-adaptive-browser.py') or frame.f_code.co_name not in watched:
        return None
    if event == 'line':
        print(time.strftime('%H:%M:%S'), frame.f_code.co_name, frame.f_lineno, flush=True)
    return progress
if os.environ.get('MOINPDF_TRACE_DIAGNOSTICS', '1') == '1':
    sys.settrace(progress)
runpy.run_path('tests/editor-adaptive-browser.py', run_name='__main__')
