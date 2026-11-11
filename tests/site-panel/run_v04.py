# v0.4.0 checks: service show / hide chips, stage progress chips, Snags & RFIs open-first + closed folded, notes filter
import asyncio, os
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(); pg = await (await b.new_context(viewport={'width': 1280, 'height': 900})).new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto('file://' + os.path.join(HERE, 'harness.html')); await pg.wait_for_timeout(900)
    print('stage chips:', await pg.eval_on_selector_all('.st-stage', 'e=>e.map(x=>x.innerText)'))
    print('service chips:', await pg.eval_on_selector_all('[data-svc]', 'e=>e.map(x=>x.innerText.replace(/\\n/g," "))'))
    first = await pg.get_attribute('[data-svc]', 'data-svc'); n0 = await pg.locator('.st-dev').count()
    await pg.click('[data-svc="%s"]' % first); await pg.wait_for_timeout(150)
    print('hide', first, '→ devices', n0, '→', await pg.locator('.st-dev').count(), '| chip off:', await pg.get_attribute('[data-svc="%s"]' % first, 'aria-pressed'))
    await pg.screenshot(path=os.path.join(HERE, 'site-devices-v04.png'))
    await pg.click('[data-svc="*"]'); await pg.wait_for_timeout(150); print('show all → devices', await pg.locator('.st-dev').count())
    await pg.click('[data-tab="snags"]'); await pg.wait_for_timeout(150); print('snags:', (await pg.inner_text('#stBody'))[:300].replace('\n', ' | '))
    await pg.screenshot(path=os.path.join(HERE, 'site-snags-v04.png'))
    await pg.click('[data-tab="notes"]'); await pg.wait_for_timeout(150); print('note filters:', await pg.eval_on_selector_all('[data-nf]', 'e=>e.map(x=>x.innerText.replace(/\\n/g," "))'))
    print('errors:', [e for e in errs if 'ServiceWorker' not in e]); await b.close()
asyncio.run(main())
