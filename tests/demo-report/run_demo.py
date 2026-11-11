import asyncio, os, json, base64
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(); pg = await b.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: m.type == 'error' and errs.append(m.text))
    await pg.goto(os.environ.get('DEMO_URL', 'http://localhost:8765/site/tests/demo-report/demo.html')); await pg.wait_for_timeout(400)
    model = json.load(open(os.path.join(HERE, 'demo-model.json')))
    b64 = await pg.evaluate('m => window.renderDemo(m)', model)
    out = os.path.join(HERE, 'site-visit-demo.pdf'); open(out, 'wb').write(base64.b64decode(b64)); print('pdf', os.path.getsize(out), 'errors', errs); await b.close()
asyncio.run(main())
