# Local file storage

`storage/data/` เป็นพื้นที่ bytes ของ backend และถูก Git ignore ไม่ใช่ browser localStorage/IndexedDB

Compose mount เป็น `/data/securelab` โดย backend/worker ทำงาน UID 10001 และ migration service จัดเตรียม owner ของ directory เมื่อพัฒนาโดยตรงให้ตั้ง STORAGE_ROOT เป็น absolute path ใต้ workspace

```text
{STORAGE_ROOT}/exams/{examId}/{studentId}/{submissionId}/versions/{versionId}/{uploadId}
```

ทุกส่วนเป็น server-generated UUID Original/submitted filename อยู่ metadata เท่านั้น Rename ไม่ย้าย path ไม่เปลี่ยน uploadId/sequence/extension/bytes

- Temporary transfers อยู่ `.incoming/`
- Orphan ที่ไม่มี acknowledged metadata และเก่ากว่าช่วงปลอดภัยย้ายไป `.quarantine/`
- Acknowledged/FINAL files ไม่ถูก automatic cleanup
- Workspace นี้อาจมี screenshots, test artifacts และ local bootstrap secret ที่ ignore ไว้ด้วย ห้ามนำไฟล์เหล่านี้เข้า Git

READY ต้องมี committed actual size, SHA-256 และ received timestamp จึงแสดงว่าส่งสำเร็จ Retry READY คืน receipt เดิมไม่ overwrite ไฟล์ FINAL แก้/ลบไม่ได้ การ reopen ใช้คนละ version

`securelab quarantine-orphans` ค่าเริ่มต้น safety age 24 ชั่วโมง ข้าม active receivers และ paths ที่ database อ้างอิง ตรวจ --help ก่อนใช้ ไม่ใช่ backup หรือ retention policy สำหรับ FINAL

ระบบไม่ execute/import/compile/extract uploaded files ไม่เปิด root เป็น public static directory SHA-256 ตรวจ bytes ที่รับไว้ ไม่รับรองว่าไฟล์โปรแกรมปลอดภัยหรือเป็น WORM
