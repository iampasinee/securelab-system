/* Explicit development-only integration check; does not import browser mock data. */
const { chromium, expect } = require('@playwright/test');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { randomUUID, randomBytes, createHash } = require('node:crypto');
const assert = require('node:assert/strict');
const base = process.env.SECURELAB_E2E_URL || 'http://localhost:3001';
const backend = process.env.SECURELAB_E2E_API || 'http://127.0.0.1:8000/api/v1';
if (process.env.SECURELAB_E2E_WRITE !== '1') throw new Error('Set SECURELAB_E2E_WRITE=1 to explicitly create development test records and reset seed account passwords');
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname) || !['localhost', '127.0.0.1'].includes(new URL(backend).hostname)) throw new Error('This check only supports a local development environment');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const contexts = [];
  const errors = [];
  const newPage = async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Bangkok', acceptDownloads: true });
    contexts.push(context); const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    return page;
  };
  const request = async (path, token, method = 'GET', body, idempotent = false) => {
    const response = await fetch(backend + path, { method, headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(idempotent ? { 'Idempotency-Key': randomUUID() } : {}),
    }, body: body ? JSON.stringify(body) : undefined });
    if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${await response.text()}`);
    return response.status === 204 ? null : response.json();
  };
  const login = async (page, email, password) => {
    await page.goto(base);
    await page.getByLabel('อีเมลมหาวิทยาลัย').fill(email);
    await page.getByLabel('รหัสผ่าน', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click();
  };
  try {
    const adminPassword = readFileSync(resolve('../storage/data/.bootstrap-password'), 'utf8').trim();
    const token = (await request('/auth/login', null, 'POST', { email: 'admin.dev@itm.kmutnb.ac.th', password: adminPassword })).accessToken;
    const users = (await request('/users?pageSize=100', token)).items;
    const teacher = users.find((user) => user.email === 'teacher.seed@itm.kmutnb.ac.th');
    const student = users.find((user) => user.email === 's6701011500167@email.kmutnb.ac.th');
    assert(teacher && student, 'Run the explicit curated seed first');
    const floors = (await request('/rooms/floors', token)).items;
    const physical = await request('/rooms/physical-rooms', token, 'POST', { floorId: floors[0].id, suffix: `E2E-${Date.now()}` });
    let room = await request('/rooms/exam-rooms', token, 'POST', { physicalRoomId: physical.id });
    room = await request(`/rooms/exam-rooms/${room.id}/layout`, token, 'PUT', { rows: 1, columns: 2, expectedVersion: room.rowVersion });
    for (const seat of room.seats) {
      const suffix = randomBytes(3); const id = randomUUID();
      await request('/devices', token, 'POST', { computerCode: `E2E-${id}`, serialNumber: `E2E-${id}`, seatId: seat.id,
        ipAddress: `10.${suffix[0]}.${suffix[1]}.${Math.max(1, suffix[2])}`, macAddress: `02:ee:${randomBytes(4).toString('hex').match(/../g).join(':')}` });
    }
    const admin = await newPage(); await login(admin, 'admin.dev@itm.kmutnb.ac.th', adminPassword);
    await admin.getByRole('heading', { name: 'ภาพรวมระบบ SecureLab' }).waitFor();
    const activate = async (user) => {
      await admin.getByRole('button', { name: 'ออกลิงก์ตั้งรหัสผ่าน', exact: true }).click();
      const modal = admin.getByRole('dialog', { name: 'ออกลิงก์ตั้งรหัสผ่าน' });
      await modal.getByLabel('บัญชี').selectOption(user.id);
      await modal.getByRole('button', { name: 'ออกลิงก์', exact: true }).click();
      const field = modal.getByLabel('ลิงก์ตั้งรหัสผ่าน'); await expect(field).not.toHaveValue('');
      const link = await field.inputValue();
      await modal.getByRole('button', { name: 'ปิดหน้าต่าง' }).click();
      const page = await newPage(); await page.goto(link);
      const password = `SecureLab${randomBytes(12).toString('hex')}1`;
      await page.getByLabel('รหัสผ่านใหม่', { exact: true }).fill(password);
      await page.getByLabel('ยืนยันรหัสผ่าน', { exact: true }).fill(password);
      await page.getByRole('button', { name: 'ยืนยันตั้งรหัสผ่าน' }).click();
      await expect(page.getByRole('status')).toContainText('ตั้งรหัสผ่านแล้ว');
      assert(!page.url().includes('token='), 'Activation token must be removed from browser URL');
      await page.getByLabel('รหัสผ่าน', { exact: true }).fill(password);
      await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click();
      return page;
    };
    const teacherPage = await activate(teacher);
    await teacherPage.getByRole('navigation', { name: 'เมนูอาจารย์ผู้สอน' }).waitFor();
    const studentPage = await activate(student);
    await studentPage.getByRole('heading', { name: 'การสอบของฉัน' }).waitFor();
    console.log('Admin-issued activation and both role logins passed.');
    const navigation = teacherPage.getByRole('navigation', { name: 'เมนูอาจารย์ผู้สอน' });
    for (const name of ['จัดการรายวิชา & กลุ่มเรียน', 'ติดตามการสอบ', 'คลังไฟล์คำตอบ', 'จัดการสอบ']) {
      await navigation.getByRole('button', { name, exact: true }).click(); await teacherPage.waitForTimeout(300);
      assert.deepEqual(errors, []); console.log('Teacher view rendered:', name);
    }
    await teacherPage.getByRole('button', { name: 'สร้างการสอบ', exact: true }).click();
    const section = (await request('/sections?pageSize=100', token)).items.find((item) => item.primaryTeacherId === teacher.id);
    await teacherPage.getByLabel(/^รายวิชา \*/).selectOption(section.courseId);
    await teacherPage.getByLabel(/^Section \*/).selectOption(section.id);
    const name = `ทดสอบครบวงจร ${Date.now()}`;
    await teacherPage.getByLabel('ชื่อการสอบ *', { exact: true }).fill(name);
    await teacherPage.getByRole('button', { name: 'ถัดไป', exact: true }).click();
    await teacherPage.getByRole('button', { name: 'ถัดไป', exact: true }).click();
    const starts = new Date(Date.now() + 5 * 60_000);
    const ends = new Date(starts.getTime() + 30 * 60_000);
    const local = (date) => new Date(date.getTime() + 7 * 3600_000).toISOString();
    await teacherPage.getByLabel('วันที่สอบ *', { exact: true }).fill(local(starts).slice(0, 10));
    await teacherPage.getByLabel('เวลาเริ่ม *', { exact: true }).fill(local(starts).slice(11, 16));
    await teacherPage.getByLabel('เวลาสิ้นสุด *', { exact: true }).fill(local(ends).slice(11, 16));
    await teacherPage.getByRole('button').filter({ hasText: room.roomCode }).click();
    await teacherPage.getByRole('button', { name: 'ถัดไป', exact: true }).click();
    await teacherPage.getByRole('button', { name: 'ถัดไป', exact: true }).click();
    // Complete the four policy substeps; this preserves allow/block resource semantics.
    for (let index = 0; index < 3; index++) await teacherPage.getByRole('button', { name: 'ถัดไป', exact: true }).click();
    await teacherPage.getByRole('button', { name: 'ไปตรวจสอบและบันทึก', exact: true }).click();
    const createdResponse = teacherPage.waitForResponse((response) => response.url().endsWith('/api/v1/exams') && response.request().method() === 'POST');
    await teacherPage.getByRole('button', { name: 'สร้างการสอบ', exact: true }).click();
    const response = await createdResponse;
    assert.equal(response.status(), 201, await response.text());
    let exam = await response.json();
    assert.equal(exam.sectionId, section.id);
    console.log('Six-step Teacher exam wizard persisted a stable Section ID.');
    // Move the upcoming schedule forward through its normal API to exercise worker/start.
    const begin = new Date(Date.now() + 3000).toISOString();
    const finish = new Date(Date.now() + 20 * 60_000).toISOString();
    const payload = {
      sectionId: exam.sectionId, roomId: exam.roomId, name: exam.name, examType: exam.examType, mode: exam.mode,
      startsAt: begin, endsAt: finish, maxFileSizeBytes: exam.maxFileSizeBytes, requiredFileCount: exam.requiredFileCount,
      filenamePattern: exam.filenamePattern, acceptedExtensions: exam.acceptedExtensions, instructions: exam.instructions,
      policy: exam.policy, rules: exam.rules.map(({ text, isCustom }) => ({ text, isCustom })), expectedVersion: exam.rowVersion,
    };
    exam = await request(`/exams/${exam.id}`, token, 'PATCH', payload);
    await request(`/exams/${exam.id}/seat-assignments/auto`, token, 'POST', { expectedVersion: exam.rowVersion }, true);
    await studentPage.reload();
    await studentPage.getByRole('button').filter({ hasText: name }).click();
    await studentPage.getByLabel('ฉันอ่านและยอมรับกฎการสอบฉบับนี้แล้ว').check();
    await expect(studentPage.getByRole('button', { name: 'เริ่มสอบ', exact: true })).toBeEnabled({ timeout: 15000 });
    await studentPage.getByRole('button', { name: 'เริ่มสอบ', exact: true }).click();
    await studentPage.getByRole('heading', { name: 'ไฟล์ที่เตรียมส่ง' }).waitFor();
    const bytes = Buffer.from('%PDF-1.4\nUntrusted test data; never execute.\n');
    await studentPage.locator('input[type=file]').setInputFiles({ name: 'answer.pdf', mimeType: 'application/pdf', buffer: bytes });
    await expect(studentPage.getByRole('button', { name: 'เสร็จสิ้นและส่งไฟล์' })).toBeEnabled({ timeout: 15000 });
    await studentPage.reload();
    await studentPage.getByRole('button').filter({ hasText: name }).click();
    await expect(studentPage.getByRole('button', { name: 'เสร็จสิ้นและส่งไฟล์' })).toBeEnabled({ timeout: 15000 });
    await studentPage.getByRole('button', { name: 'เสร็จสิ้นและส่งไฟล์' }).click();
    await studentPage.getByRole('dialog').getByRole('button', { name: 'เสร็จสิ้นและส่งไฟล์', exact: true }).click();
    await studentPage.getByRole('heading', { name: 'รับงาน FINAL แล้ว · ครั้งที่ 1' }).waitFor();
    await expect(studentPage.getByText(`SHA-256: ${createHash('sha256').update(bytes).digest('hex')}`, { exact: true })).toBeVisible();
    console.log('Student actual bytes, refresh/resume, FINAL receipt and SHA-256 passed.');
    await navigation.getByRole('button', { name: 'คลังไฟล์คำตอบ' }).click();
    await teacherPage.getByRole('button').filter({ hasText: name }).click();
    const archivePromise = teacherPage.waitForEvent('download');
    await teacherPage.getByRole('button', { name: 'ดาวน์โหลดทั้งหมด (.zip)' }).click();
    const archive = await archivePromise; assert.equal(await archive.failure(), null);
    const stream = await archive.createReadStream(); const parts = []; for await (const chunk of stream) parts.push(chunk);
    assert(Buffer.concat(parts).subarray(0, 2).equals(Buffer.from('PK')));
    await teacherPage.getByRole('button', { name: 'ประวัติการส่ง' }).click();
    await expect(teacherPage.getByRole('dialog', { name: 'ประวัติการส่งทุกครั้ง' })).toContainText('ครั้งที่ 1');
    await teacherPage.getByRole('dialog').getByRole('button', { name: 'ปิดหน้าต่าง' }).click();
    await navigation.getByRole('button', { name: 'ติดตามการสอบ', exact: true }).click();
    await teacherPage.locator('article').filter({ hasText: name }).getByRole('button', { name: 'ดูรายละเอียด' }).click();
    await teacherPage.getByRole('heading', { name, exact: true }).waitFor();
    await teacherPage.getByRole('button', { name: 'ปรับเวลาทั้งการสอบ', exact: true }).click();
    const timeModal = teacherPage.getByRole('dialog', { name: 'ปรับเวลาทั้งการสอบ' });
    await timeModal.getByLabel('เหตุผล').fill('ตรวจการปรับเวลาทั้งการสอบผ่านหน้าจอ');
    const timeResponse = teacherPage.waitForResponse((response) => response.url().endsWith(`/exams/${exam.id}/time-adjustments`));
    await timeModal.getByRole('button', { name: 'ยืนยัน', exact: true }).click();
    assert.equal((await timeResponse).status(), 200);
    await expect(timeModal).not.toBeVisible();
    await teacherPage.getByRole('button', { name: 'เปิดรับส่งใหม่', exact: true }).click();
    const reopenModal = teacherPage.getByRole('dialog', { name: 'เปิดรับส่งใหม่' });
    await reopenModal.getByLabel(/^ระยะเวลาเปิดรับใหม่/).fill('5');
    await reopenModal.getByLabel('ขอบเขต').selectOption('student');
    await reopenModal.getByLabel(/^นักศึกษา/).selectOption(student.id);
    await reopenModal.getByLabel('เหตุผล').fill('ตรวจประวัติการส่งในสภาพแวดล้อมพัฒนา');
    const reopenResponse = teacherPage.waitForResponse((response) => response.url().endsWith(`/exams/${exam.id}/submission-reopens`));
    await reopenModal.getByRole('button', { name: 'ยืนยัน', exact: true }).click();
    assert.equal((await reopenResponse).status(), 200);
    await expect(reopenModal).not.toBeVisible();
    console.log('Teacher monitoring, whole-exam time adjustment and per-student reopen UI passed.');
    await studentPage.getByLabel('ยอมรับกฎการสอบฉบับปัจจุบัน').check({ timeout: 15000 });
    await studentPage.getByRole('button', { name: 'เริ่มการส่งครั้งใหม่' }).click();
    await expect(studentPage.getByText(/การส่งครั้งที่ 2 · เวลาที่เหลือ/)).toBeVisible();
    await studentPage.getByRole('button', { name: 'ครั้งที่ 1 · FINAL', exact: true }).click();
    await studentPage.waitForTimeout(5500);
    await expect(studentPage.getByRole('heading', { name: 'รับงาน FINAL แล้ว · ครั้งที่ 1' })).toBeVisible();
    assert.deepEqual(errors, []);
    for (const page of [admin, teacherPage, studentPage]) {
      const keys = await page.evaluate(() => Object.keys(localStorage));
      assert(!keys.some((key) => ['securelab_students', 'securelab_courses', 'securelab_exams', 'securelab_mock_auth_users_v1'].includes(key)), 'API mode must not populate mock storage');
    }
    await studentPage.screenshot({ path: resolve('../storage/data/ui-cross-flow-receipt.png'), fullPage: true });
    console.log('Teacher real ZIP download and reopen preserving FINAL history passed. Browser errors: []');
  } finally { await browser.close(); }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
