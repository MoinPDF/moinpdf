"""Hafenlicht: real pointer, keyboard and touch feedback in the production UI."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

origin = os.getenv('MOINPDF_TEST_URL', 'http://127.0.0.1:8765').rstrip('/')
out = Path('documentation-evidence')
out.mkdir(exist_ok=True)
checks, errors = [], []


def ready(page):
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(origin)
    expect(page.locator('.harbor-home')).to_be_visible()
    page.evaluate('document.fonts.ready')
    expect(page.locator('.harbor-photo img')).to_have_js_property('complete', True)


def no_overflow(page):
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')


def unobstructed(page, target):
    assert target.evaluate('''el => {
        const r = el.getBoundingClientRect();
        return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    }'''), 'Light overlay must never capture a click'


def tab_to(page, target):
    # Use real keyboard traversal: programmatic focus after a mouse click does
    # not enter :focus-visible modality in Chromium.
    for _ in range(24):
        page.keyboard.press('Tab')
        if target.evaluate('el => el === document.activeElement'):
            return
    raise AssertionError('Tile is unreachable with Tab')


with sync_playwright() as api:
    browser = api.chromium.launch()
    try:
        for theme in ('light', 'dark'):
            context = browser.new_context(viewport={'width':1440, 'height':1100}, reduced_motion='no-preference')
            context.add_init_script(f'localStorage.setItem("moinpdf-theme", "{theme}")')
            page = context.new_page()
            ready(page)
            no_overflow(page)
            page.screenshot(path=str(out/f'hafenlicht-desktop-{theme}.png'), full_page=True)
            categories = page.locator('.harbor-categories')
            convert = categories.get_by_role('button', name='Umwandeln', exact=True)
            convert.scroll_into_view_if_needed()
            box = convert.bounding_box()
            page.mouse.move(box['x'] + box['width']/2, box['y'] + box['height']/2)
            page.mouse.down()
            pulse = page.locator('.harbor-light-echo')
            expect(pulse).to_have_count(1)
            expect(pulse).to_be_visible()
            assert pulse.evaluate('el => getComputedStyle(el).pointerEvents') == 'none'
            assert pulse.evaluate('el => el.getAnimations().some(a => a.playState === "running")')
            unobstructed(page, convert)
            page.screenshot(path=str(out/f'hafenlicht-click-{theme}.png'))
            page.mouse.up()
            expect(convert).to_have_attribute('aria-pressed', 'true')
            expect(categories.locator('[aria-pressed=true]')).to_have_count(1)
            expect(pulse).to_have_count(0, timeout=1800)
            # Consecutive selections and a keyboard click must remain responsive.
            for name in ('Seiten', 'Bearbeiten', 'Prüfen', 'Empfohlen'):
                categories.get_by_role('button', name=name, exact=True).click()
            expect(categories.get_by_role('button', name='Empfohlen')).to_have_attribute('aria-pressed', 'true')
            expect(pulse).to_have_count(0, timeout=1800)
            convert.focus()
            page.keyboard.press('Space')
            expect(convert).to_have_attribute('aria-pressed', 'true')
            expect(pulse).to_have_count(1)
            expect(pulse).to_have_count(0, timeout=1800)
            categories.get_by_role('button', name='Empfohlen', exact=True).click()
            tile = page.locator('.harbor-tool-card').nth(1)
            title = tile.locator('strong').inner_text()
            tab_to(page, tile)
            assert tile.evaluate('el => getComputedStyle(el).outlineStyle') == 'solid'
            page.keyboard.press('Enter')
            expect(page.locator('main h1')).to_have_text(title)
            expect(page.locator('.harbor-home')).to_have_count(0)
            expect(pulse).to_have_count(0, timeout=1800)
            checks.append(f'{theme}: pointer light, pass-through hit target, repeated categories, Space/Enter and immediate named tool')

            # Catalogue uses the same visible response and still opens the tool.
            page.get_by_role('button', name='Alle Werkzeuge', exact=True).click()
            catalogue = page.locator('.chooser-tool').first
            title = catalogue.locator('strong').inner_text()
            catalogue.scroll_into_view_if_needed()
            box = catalogue.bounding_box()
            page.mouse.move(box['x'] + box['width']/2, box['y'] + box['height']/2)
            page.mouse.down()
            expect(pulse).to_have_count(1)
            unobstructed(page, catalogue)
            page.mouse.up()
            expect(page.locator('main h1')).to_have_text(title)
            page.locator('.harbor-desktop-nav').get_by_role('button', name='Start', exact=True).click()

            # Reduced motion and forced colors keep interaction but suppress light.
            page.emulate_media(reduced_motion='reduce')
            categories.get_by_role('button', name='Seiten', exact=True).click()
            expect(pulse).to_have_count(0)
            expect(categories.get_by_role('button', name='Seiten')).to_have_attribute('aria-pressed', 'true')
            assert page.locator('.harbor-tool-card').first.evaluate('el => getComputedStyle(el).transform') == 'none'
            page.emulate_media(reduced_motion='no-preference', forced_colors='active')
            categories.get_by_role('button', name='Empfohlen', exact=True).click()
            expect(pulse).to_have_count(0)
            tile = page.locator('.harbor-tool-card').first
            tab_to(page, tile)
            assert tile.evaluate('el => getComputedStyle(el).outlineStyle') == 'solid'
            page.emulate_media(forced_colors='none')
            checks.append(f'{theme}: catalogue activation, reduced motion and high-contrast keyboard focus')
            context.close()

            for width in (320, 390):
                touch = browser.new_context(viewport={'width':width, 'height':844}, device_scale_factor=2,
                    is_mobile=True, has_touch=True, reduced_motion='no-preference')
                touch.add_init_script(f'localStorage.setItem("moinpdf-theme", "{theme}")')
                mobile = touch.new_page()
                ready(mobile)
                no_overflow(mobile)
                expect(mobile.locator('.harbor-mobile-nav')).to_be_visible()
                mobile.screenshot(path=str(out/f'hafenlicht-mobile-{width}-{theme}.png'), full_page=True)
                category = mobile.locator('.harbor-categories').get_by_role('button', name='Umwandeln', exact=True)
                assert category.bounding_box()['height'] >= 44
                category.tap()
                expect(category).to_have_attribute('aria-pressed', 'true')
                expect(mobile.locator('.harbor-light-echo')).to_have_count(1)
                no_overflow(mobile)
                expect(mobile.locator('.harbor-light-echo')).to_have_count(0, timeout=1800)
                tile = mobile.locator('.harbor-tool-card').first
                title = tile.locator('strong').inner_text()
                tile.tap()
                expect(mobile.locator('main h1')).to_have_text(title)
                no_overflow(mobile)
                mobile.locator('.harbor-mobile-nav').get_by_role('button', name='Start', exact=True).tap()
                expect(mobile.locator('.harbor-home')).to_be_visible()
                # Scrolling cancels a pending finger-down effect.
                category = mobile.locator('.harbor-categories button').first
                category.scroll_into_view_if_needed()
                category.dispatch_event('pointerdown', {'button':0, 'isPrimary':True, 'pointerType':'touch'})
                expect(mobile.locator('.harbor-light-echo')).to_have_count(1)
                category.dispatch_event('pointercancel', {'pointerType':'touch'})
                expect(mobile.locator('.harbor-light-echo')).to_have_count(0)
                touch.close()
                checks.append(f'{width}px {theme}: true touch context, 44px categories, tap feedback, tool navigation, gesture cancellation, no overflow')
        assert not errors, errors
    finally:
        (out/'hafenlicht-verification.json').write_text(json.dumps({'checks':checks, 'errors':errors}, indent=2))
        browser.close()
print('PASS:', len(checks), 'Hafenlicht interaction and layout checks')
