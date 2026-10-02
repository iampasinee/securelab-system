const { chromium } = require('@playwright/test');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://localhost:3001');
  await page.getByLabel('อีเมลมหาวิทยาลัย').fill('admin.dev@itm.kmutnb.ac.th');
  await page.getByLabel('รหัสผ่าน', { exact: true }).fill(readFileSync(resolve('../storage/data/.bootstrap-password'), 'utf8').trim());
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click();
  try {
    await page.getByRole('heading', { name: 'ภาพรวมระบบ SecureLab', exact: true }).waitFor({ timeout: 20000 });
    console.log('Admin API login and overview rendered.');
    await page.screenshot({ path: resolve('../storage/data/ui-smoke-admin.png'), fullPage: true });
    const navigation = page.getByRole('navigation', { name: 'เมนูผู้ดูแลระบบ' });
    for (const name of ['จัดการผู้ใช้งาน', 'นักศึกษา', 'อาจารย์', 'ผู้ดูแลระบบ', 'จัดการคณะและกลุ่มเรียน', 'จัดการรายวิชาและตอนเรียน', 'ห้องสอบและเครื่องคอมพิวเตอร์', 'จัดการข้อมูลใบหน้าอ้างอิง', 'ความปลอดภัยและการตรวจจับ', 'บันทึกประวัติระบบ', 'ข้อมูลผู้ดูแลระบบ']) {
      await navigation.getByRole('button', { name, exact: true }).click();
      await page.waitForTimeout(250);
      if (errors.length) throw new Error('Browser runtime error on ' + name + ': ' + errors.join(', '));
      console.log('Admin view rendered:', name);
    }
  } catch (error) {
    console.log('Visible page text:', (await page.locator('body').innerText()).slice(0, 2500));
    throw error;
  } finally {
    console.log('Browser errors:', errors);
    await browser.close();
  }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
