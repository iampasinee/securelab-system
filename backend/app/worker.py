import logging
import time

from sqlalchemy import select, text

from app.core.config import get_settings
from app.core.database import get_engine
from app.models import submission_files, submission_versions, submissions, exam_sessions
from app.repositories.base import rows, get, change, now
from app.services import roster, submissions as service
from app.services.audit import audit
from app.services.storage import lock_number


logger = logging.getLogger('securelab.worker')


def run_once():
    with get_engine().begin() as db:
        roster.before_membership_change(db)
    with get_engine().connect() as db:
        ids = list(db.scalars(select(submission_versions.c.id).where(submission_versions.c.state == 'open').order_by(submission_versions.c.id)))
    for version_id in ids:
        with get_engine().begin() as db:
            roster.lock_offerings(db)
            peek = get(db, submission_versions, version_id)
            root = get(db, submissions, peek['submission_id'])
            exam = get(db, exam_sessions, root['exam_id'], lock=True)
            root = get(db, submissions, root['id'], lock=True)
            version = get(db, submission_versions, version_id, lock=True)
            if version['state'] != 'open':
                continue
            receiving = rows(db, select(submission_files).where(submission_files.c.version_id == version_id, submission_files.c.state == 'receiving').with_for_update())
            for file in receiving:
                acquired = db.scalar(text('SELECT pg_try_advisory_xact_lock(:number)'), {'number': lock_number(file['id'])})
                if acquired:
                    change(db, submission_files, file, {'state': 'failed', 'failure_code': 'receiver_disconnected'})
                    audit(db, None, 'upload.recovered_failure', 'submission_file', file['id'], {'examId': str(exam['id']), 'versionId': str(version_id), 'failureCode': 'receiver_disconnected'}, outcome='warning')
            if now() >= service.deadline(db, version, exam):
                service.finalize(db, None, root['id'], version_id, automatic=True)


def main():
    logging.basicConfig(level=logging.INFO)
    while True:
        try:
            run_once()
        except Exception:
            # Database driver exceptions can include parameters; do not print them.
            logger.error('Worker dependency unavailable; retrying durable work on the next cycle')
        time.sleep(get_settings().worker_interval_seconds)


if __name__ == '__main__':
    main()
