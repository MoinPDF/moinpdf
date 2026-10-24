from playwright.sync_api import expect

def settings(page, advanced=False):
    mobile=page.locator('#mobile-editor-format')
    sheet=page.locator('dialog.editor-settings-sheet')
    if mobile.is_visible() and not sheet.is_visible():
        mobile.click();expect(sheet).to_be_visible()
    if advanced:
        group=page.locator('.editor-advanced-workflows')
        if group.get_attribute('open') is None:group.locator(':scope > summary').click()

def canvas(page):
    sheet=page.locator('dialog.editor-settings-sheet[open]')
    if sheet.count():
        sheet.get_by_role('button',name='Zurück zur PDF',exact=True).click()
        expect(sheet).to_have_count(0)

def geometry(page,label,value):
    settings(page)
    group=page.locator('.editor-secondary-options')
    if group.get_attribute('open') is None:group.locator(':scope > summary').click()
    field=page.get_by_label(label,exact=True);field.fill(str(value));field.press('Tab')
    canvas(page)
