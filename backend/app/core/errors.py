from fastapi import HTTPException


def fail(code: str, message: str, status: int = 409) -> None:
    raise HTTPException(status_code=status, detail={'code': code, 'message': message})


def missing() -> None:
    fail('not_found', 'ไม่พบข้อมูลที่ร้องขอ', 404)
