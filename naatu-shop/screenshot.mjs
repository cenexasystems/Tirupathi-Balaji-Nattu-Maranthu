import { chromium } from 'playwright';

const OUT = 'C:/Users/motis/AppData/Local/Temp';
const browser = await chromium.launch({ headless: true });

const dCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const dPage = await dCtx.newPage();
await dPage.goto('http://localhost:5173/products', { waitUntil: 'networkidle', timeout: 30000 });
await dPage.waitForTimeout(2000);

// Open Agarbatti modal via ADD button
const dAddBtns = dPage.locator('button:has-text("ADD")');
const dCnt = await dAddBtns.count();
for (let i = 0; i < dCnt; i++) {
  const btn = dAddBtns.nth(i);
  const par = btn.locator('../../../..');
  const t = await par.textContent().catch(() => '');
  if (t.includes('Agarbatti') && t.includes('55')) {
    await btn.scrollIntoViewIfNeeded();
    await btn.click();
    break;
  }
}
await dPage.waitForTimeout(2000);

// Screenshot after modal opens (chips already shown, no need to click one)
await dPage.screenshot({ path: OUT + '/07_desktop_modal.png' });
console.log('✓ 07_desktop_modal.png');

await dCtx.close();
await browser.close();
