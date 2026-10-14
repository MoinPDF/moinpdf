"""Verify English UI, options, information pages and language-state preservation."""
import io
import json
import os
import re
from pathlib import Path
import tempfile
import zipfile
import pymupdf
from playwright.sync_api import sync_playwright, expect

origin = os.environ.get('MOINPDF_DOCUMENTATION_URL', 'http://127.0.0.1:8765').rstrip('/')
out = Path('documentation-evidence')
out.mkdir(exist_ok=True)
catalog = json.loads(Path('public/locales/en.json').read_text())
# Recognizable German app copy must never remain on an English screen. Document
# names, entered values and PDF text are deliberately not translation targets.
german = {k:v for k,v in catalog.items() if k != v and len(k)>2 and '{' not in k}
completed, misses, errors = [], [], []

def check(page, name):
    expect(page.locator('html')).to_have_attribute('lang', 'en')
    visible = page.evaluate('''() => {
      const values = [];
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while (node = walk.nextNode()) {
        const el = node.parentElement;
        if (!el || ['SCRIPT','STYLE','TEXTAREA'].includes(el.tagName)) continue;
        if (!el.getClientRects().length || getComputedStyle(el).visibility === 'hidden') continue;
        if (el.closest('[data-sonner-toast], .language-menu')) continue;
        values.push(node.textContent.trim().replace(/\\s+/g,' '));
      }
      for (const el of document.querySelectorAll('[title],[aria-label],[placeholder]')) {
        if (!el.getClientRects().length) continue;
        for (const key of ['title','aria-label','placeholder']) {
          const value = el.getAttribute(key); if(value) values.push(value.trim());
        }
      }
      return [...new Set(values)];
    }''')
    for value in visible:
        if value in german:
            misses.append({'screen':name, 'text':value, 'expected':german[value]})
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 2'), name

def back(page):
    page.get_by_role('button', name=re.compile(r'^(All tools|Change tool)$')).click()
    expect(page.locator('.chooser-tool')).to_have_count(112)

with sync_playwright() as api, tempfile.TemporaryDirectory() as temporary:
    browser = api.chromium.launch()
    context = browser.new_context(viewport={'width':1440,'height':1000}, reduced_motion='reduce')
    page = context.new_page()
    page.on('pageerror',lambda error:errors.append(str(error)))
    try:
        page.goto(origin)
        page.locator('.language-trigger').click()
        page.get_by_role('menuitemradio',name='English',exact=True).click()
        expect(page.locator('html')).to_have_attribute('lang','en')
        expect(page.get_by_role('menuitemradio',name='English',exact=True)).not_to_be_visible()
        check(page,'home')
        assert 40 <= page.locator('.theme-toggle').bounding_box()['width'] <= 44
        assert 40 <= page.locator('.language-trigger').bounding_box()['height'] <= 44
        page.reload()
        expect(page.locator('html')).to_have_attribute('lang','en')
        expect(page.get_by_role('menuitemradio',name='English',exact=True)).not_to_be_visible()
        pdf = Path(temporary)/'original-user-content.pdf'
        with pymupdf.open() as document:
            document.new_page().insert_text((50,60),'Benutzerinhalt bleibt unveraendert. ORIGINAL-123.')
            document.save(pdf)
        page.locator('input[type=file]').first.set_input_files(str(pdf))
        expect(page.locator('.chooser-tool')).to_have_count(112)
        titles = page.locator('.chooser-tool strong').all_text_contents()
        for title in titles:
            page.locator('.chooser-tool').filter(has=page.get_by_text(title,exact=True)).click()
            expect(page.locator('main h1')).to_have_text(title)
            check(page,title)
            for box in page.get_by_role('combobox').all():
                if not box.is_visible() or not box.is_enabled(): continue
                if box.evaluate('(el) => el.tagName') == 'SELECT':
                    for label in box.locator('option').all_text_contents():
                        if label.strip() in german: misses.append({'screen':title,'option':label})
                else:
                    box.click()
                    check(page,title+' / menu')
                    page.keyboard.press('Escape')
            back(page)
        completed.append('All 112 English tool views and available selection menus, with the PDF retained')
        for route in ('documentation','media','legal','privacy'):
            info = context.new_page()
            info.goto(origin+'/en/'+route+'.html')
            check(info,route)
            if route=='documentation':
                expect(info.locator('.docs-tool')).to_have_count(112)
                info.get_by_role('searchbox').fill('Compress to target size')
                expect(info.locator('#docs-search-status')).to_contain_text('guides')
                info.get_by_role('searchbox').fill('')
                info.evaluate('document.querySelectorAll(".docs-tool").forEach(d=>d.open=true)')
                check(info,'all expanded English guides')
            if route=='media':
                response=info.request.get(origin+info.locator('.media-actions a[download]').get_attribute('href'))
                assert response.ok
                with zipfile.ZipFile(io.BytesIO(response.body())) as archive:
                    assert 'Paperwork. Sorted.' in archive.read('MoinPDF-MediaKit/Description.txt').decode()
                    assert archive.read('MoinPDF-MediaKit/Video/MoinPDF-Printer-Overboard.en.vtt').startswith(b'WEBVTT')
                expect(info.locator('track[srclang=en]')).to_have_count(1)
            info.set_viewport_size({'width':320,'height':844})
            check(info,route+' mobile')
            info.screenshot(path=str(out/('english-'+route+'.png')))
            info.close()
        completed.append('English manual, media downloads, legal/privacy pages and 320 px layout')
        # A live second tab follows the app language and retains its deep link.
        manual=context.new_page()
        manual.goto(origin+'/en/documentation.html#werkzeug-pdf-audio')
        page.bring_to_front()
        page.locator('.language-trigger').click()
        page.get_by_role('menuitemradio',name='Deutsch',exact=True).click()
        expect(manual).to_have_url(origin+'/dokumentation.html#werkzeug-pdf-audio')
        expect(page.locator('.chooser-document-count')).to_have_text('1 Datei·1 Seite')
        page.locator('.language-trigger').click()
        page.get_by_role('menuitemradio',name='English',exact=True).click()
        expect(manual).to_have_url(origin+'/en/documentation.html#werkzeug-pdf-audio')
        expect(page.locator('.chooser-file')).to_contain_text('original-user-content.pdf')
        manual.close()
        page.bring_to_front()
        page.set_viewport_size({'width':320,'height':844})
        check(page,'English tools mobile')
        page.evaluate('window.scrollTo(0,0)')
        page.screenshot(path=str(out/'english-tools-mobile.png'),animations='disabled')
        completed.append('Cross-tab language changes, reload preference, deep links and original document preserved')
        assert not errors, errors
        assert not misses, json.dumps(misses,ensure_ascii=False,indent=2)
    finally:
        (out/'english-verification.json').write_text(json.dumps({'completed':completed,'misses':misses,'errors':errors},ensure_ascii=False,indent=2))
        try:
            page.screenshot(path=str(out/'english-final-state.png'),animations='disabled',timeout=5000)
        except Exception:
            pass  # Preserve the functional failure/report if diagnostics cannot be captured.
        browser.close()
print('PASS:', '; '.join(completed))
