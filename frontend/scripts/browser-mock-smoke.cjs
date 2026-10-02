const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const persona of ['ผู้ดูแลระบบส่วนกลาง', 'อาจารย์คุมสอบ (ยืนยันสิทธิ์แล้ว)', 'นักศึกษา (เคยลงทะเบียนแล้ว)']) {
      const context = await browser.newContext();
      await context.addInitScript(() => localStorage.setItem('securelab-preservation-check', 'keep-browser-demo'));
      const page = await context.newPage(); const errors = []; const businessRequests = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('request', (request) => { if (request.url().includes('/api/v1/')) businessRequests.push(request.url()); });
      await page.goto(process.env.SECURELAB_MOCK_E2E_URL || 'http://localhost:3002');
      await expect(page.getByText('SecureLab Frontend Mockup', { exact: true })).toBeVisible();
      await page.getByRole('button').filter({ hasText: persona }).click();
      await page.waitForTimeout(500);
      assert.deepEqual(errors, []); assert.deepEqual(businessRequests, []);
      assert.equal(await page.evaluate(() => localStorage.getItem('securelab-preservation-check')), 'keep-browser-demo');
      console.log('Mock role preserved:', persona);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
