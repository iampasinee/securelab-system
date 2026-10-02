"""Quarantine unacknowledged files; never delete acknowledged or FINAL content."""
from datetime import timedelta
from pathlib import Path
from uuid import UUID, uuid4
import os

from sqlalchemy import select, text

from app.core.config import get_settings
from app.core.database import get_engine
from app.models import submission_files
from app.repositories.base import now
from app.services.storage import lock_number, storage_path


def quarantine_orphans(age_hours=24):
    root = get_settings().storage_root.resolve()
    if not root.exists():
        return 0
    cutoff = (now() - timedelta(hours=age_hours)).timestamp()
    moved = 0
    with get_engine().begin() as db:
        acknowledged = set(db.scalars(select(submission_files.c.storage_key).where(submission_files.c.storage_key.is_not(None))))
        candidates = list((root / '.incoming').glob('*.part')) if (root / '.incoming').exists() else []
        exam_directory = root / 'exams'
        if exam_directory.exists():
            candidates.extend(path for path in exam_directory.rglob('*') if path.is_file())
        for path in candidates:
            relative = path.relative_to(root).as_posix()
            if relative in acknowledged or path.is_symlink() or path.stat().st_mtime >= cutoff:
                continue
            try:
                upload_id = UUID(path.name.split('.', 1)[0])
            except ValueError:
                continue
            if not db.scalar(text('SELECT pg_try_advisory_xact_lock(:number)'), {'number': lock_number(upload_id)}):
                continue
            quarantine = root / '.quarantine'
            quarantine.mkdir(exist_ok=True)
            # Resolve and enforce containment before moving any computed path.
            source = storage_path(relative)
            destination = quarantine / f'{upload_id}.{uuid4()}'
            source.rename(destination)
            moved += 1
    return moved
