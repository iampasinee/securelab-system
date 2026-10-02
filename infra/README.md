# Infrastructure

Root `docker-compose.yml` มี PostgreSQL 17, migration service, backend และ worker จาก image เดียวกัน ใช้ named volume สำหรับฐานข้อมูลและ bind mount `storage/data` สำหรับ bytes จริง Migration owner และ application DB role แยก credentials กัน

ทำตาม [คู่มือ root](../README.md) แล้วรัน `docker compose config --quiet` และ `docker compose up --build --wait` Migration ต้องเสร็จก่อน backend/worker เริ่ม ไม่มี create_all startup และไม่มี seed overwrite อัตโนมัติ Ports bind localhost

Backend `/health` ตรวจ liveness แบบไม่ query DB ส่วน `/ready` ตรวจ DB/storage/JWT ให้ rebuild เมื่อ source backend เปลี่ยน Worker ทำ timeout finalization และ recovery โดยไม่พึ่ง browser

`test-compose.yml` เป็น PostgreSQL 17 แยกสำหรับ integration tests ที่ localhost:15432 ไม่มี mount ข้อมูล development Tests อนุญาตเฉพาะ database ที่ลงท้าย `_test`

`docker/`, `nginx/`, `scripts/` เป็นพื้นที่สำหรับ deployment ในอนาคต ยังไม่มี TLS, production reverse proxy, network enforcement หรือ frontend container ห้ามลบ volumes/containers ที่ไม่เกี่ยวข้อง
