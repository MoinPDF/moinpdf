"""Real-browser regressions for search semantics and small-text contrast."""
import os
import re
import tempfile
from pathlib import Path

import pymupdf
from playwright.sync_api import expect, sync_playwright

origin = os.environ.get('MOINPDF_DOCUMENTATION_URL', 'http://127.0.0.1:8765').rstrip('/')


def contrast(locator):
    colors = locator.evaluate('''el => {
      const foreground = getComputedStyle(el).color;
      for (let parent = el; parent; parent = parent.parentElement) {
        const color = getComputedStyle(parent).backgroundColor;
        if (color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') {
          return {foreground, background: color};
        }
      }
      throw new Error('No opaque background for contrast verification');
    }''')
    def luminance(color):
        channels = [float(value) for value in re.findall(r'[\d.]+', color)]
        assert len(channels) == 3 or channels[3] == 1, ('Expected opaque color', color)
        rgb = [value / 255 for value in channels[:3]]
        linear = [value / 12.92 if value <= .04045 else ((value + .055) / 1.055) ** 2.4 for value in rgb]
        return sum(value * weight for value, weight in zip(linear, [.2126, .7152, .0722]))
    light, dark = sorted([luminance(colors['foreground']), luminance(colors['background'])], reverse=True)
    ratio = (light + .05) / (dark + .05)
    assert ratio >= 4.5, (colors, ratio)
    return ratio


with sync_playwright() as api, tempfile.TemporaryDirectory() as temporary:
    browser = api.chromium.launch()
    page = browser.new_page(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce', color_scheme='light')
    page.goto(origin)
    page.keyboard.press('Control+k')
    search = page.locator('.desktop-tool-search input[cmdk-input]')
    expect(search).to_be_focused()
    expect(search).to_have_attribute('aria-expanded', 'true')
    target = search.get_attribute('aria-controls')
    assert target and page.locator('[id="' + target + '"]').count() == 1
    search.fill('zusammenfügen')
    expect(page.locator('.desktop-tool-search .mobile-search-results')).to_be_visible()
    search.press('ArrowDown')
    page.wait_for_function('document.querySelector(".desktop-tool-search input").getAttribute("aria-activedescendant")')
    active = search.get_attribute('aria-activedescendant')
    assert active and page.locator('[id="' + active + '"]').count() == 1
    search.fill('')
    expect(page.locator('.desktop-tool-search [role=option]')).to_have_count(7)
    search.press('Escape')
    expect(page.locator('.desktop-tool-search')).to_have_count(0)
    expect(page.locator('.desktop-command-trigger')).to_be_focused()
    pdf = Path(temporary) / 'contrast.pdf'
    with pymupdf.open() as document:
        document.new_page().insert_text((50, 70), 'Synthetic contrast test.')
        document.save(pdf)
    page.locator('input[type=file]').first.set_input_files(str(pdf))
    toast = page.locator('[data-sonner-toast][data-type="success"] [data-title]').first
    expect(toast).to_be_visible()
    print('Success-message contrast:', round(contrast(toast), 2))
    def tool(name):
        page.locator('.chooser-tool').filter(has=page.get_by_text(name, exact=True)).click()
        expect(page.locator('main h1')).to_have_text(name)
    def back():
        page.get_by_role('button', name=re.compile(r'^(Zurück zur Auswahl|Werkzeug wechseln)$')).click()
        expect(page.locator('.chooser-tool')).to_have_count(113)
    for name, label in [('Weiße Ränder entfernen', 'Rand in Millimetern'),
                        ('Schwarzweiß-Scan', 'Schwellenwert'),
                        ('PDFs überlagern', 'Deckkraft der Vorlage'),
                        ('Text & Markierungen', 'Schriftgröße')]:
        tool(name)
        slider = page.get_by_role('slider', name=label, exact=True)
        expect(slider).to_be_visible()
        before = slider.get_attribute('aria-valuenow')
        slider.focus()
        slider.press('ArrowRight')
        expect(slider).not_to_have_attribute('aria-valuenow', before)
        if name == 'Text & Markierungen':
            for label in ['Marker', 'Text']:
                tab = page.get_by_role('tab', name=label, exact=True)
                contrast(tab)
                tab.click()
                expect(tab).to_have_attribute('aria-selected', 'true')
                expect(page.locator('[id="' + tab.get_attribute('aria-controls') + '"]')).to_be_visible()
        back()
    tool('Zusammenfügen')
    page.get_by_role('tab', name=re.compile(r'^Seiten')).click()
    contrast(page.locator('.tile-top > span').first)
    back()
    tool('OCR & Text')
    for note in page.locator('.switch-field small').all():
        contrast(note)
    back()
    for name in ['Lesezeichen bearbeiten', 'Formular ausfüllen', 'Formular erstellen']:
        tool(name)
        # Tool navigation moves focus to the workspace in its next animation
        # frame. Wait for that handoff before testing the preview's own focus.
        expect(page.locator('#moinpdf-content')).to_be_focused()
        preview = page.get_by_role('region', name='Vorschaudokument', exact=True)
        expect(preview).to_have_attribute('tabindex', '0')
        preview.focus()
        expect(preview).to_be_focused()
        page.locator('.language-trigger').click()
        page.get_by_role('menuitemradio', name='English', exact=True).click()
        expect(page.get_by_role('region', name='Preview document', exact=True)).to_be_visible()
        page.locator('.language-trigger').click()
        page.get_by_role('menuitemradio', name='Deutsch', exact=True).click()
        back()
    for name, accept, label in [('Arbeitsabläufe', '.json,application/json', 'JSON importieren'),
                                ('Serienformulare', '.csv,.tsv,text/csv,text/tab-separated-values', 'Tabelle auswählen')]:
        tool(name)
        expect(page.locator('input[accept="' + accept + '"]').last).to_have_accessible_name(label)
        back()
    for language in ['de', 'en']:
        route = '/dokumentation.html' if language == 'de' else '/en/documentation.html'
        for theme in ['light', 'dark']:
            page.goto(origin + route)
            page.evaluate('theme => { document.documentElement.classList.toggle("dark", theme === "dark"); }', theme)
            for width in [1440, 320]:
                page.set_viewport_size({'width': width, 'height': 1000})
                for number in page.locator('.docs-section-number').all():
                    contrast(number)
            page.emulate_media(media='print')
            for number in page.locator('.docs-section-number').all():
                contrast(number)
            page.emulate_media(media='screen')
    browser.close()
print('PASS: home search exposes valid result references and expansion state; keyboard suggestions survive; success messages and DE/EN manual chapter numbers meet 4.5:1 contrast in desktop/mobile, dark mode and print.')
