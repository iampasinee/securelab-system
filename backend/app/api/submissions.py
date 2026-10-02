from uuid import UUID
import io
import tempfile
import zipfile

from fastapi import APIRouter, Depends, Request, Query
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import select

from app.api.dependencies import database, current_user, student, staff
from app.core.errors import fail, missing
from app.models import submissions, submission_versions, submission_files, users
from app.repositories.base import get, rows
from app.schemas.submissions import AttemptStart, FileIntent, FileRename
from app.services import submissions as service, exams, storage
from app.services.audit import audit
from app.services.common import paginate, search_pattern


router = APIRouter(tags=['submissions', 'files'])


@router.post('/exams/{identifier}/attempts')
def attempt(identifier: UUID, payload: AttemptStart, actor=Depends(student), db=Depends(database)):
    return service.start_attempt(db, actor, identifier, payload)


@router.get('/exams/{identifier}/submissions/archive')
def archive(identifier: UUID, actor=Depends(staff), db=Depends(database)):
    exams.require_exam(db, actor, identifier)
    selected = list(db.scalars(select(submissions.c.latest_final_version_id).where(submissions.c.exam_id == identifier, submissions.c.latest_final_version_id.is_not(None))))
    files = rows(db, select(submission_files).where(submission_files.c.version_id.in_(selected), submission_files.c.state == 'ready').order_by(submission_files.c.version_id, submission_files.c.upload_sequence))
    paths = [(file, storage.verify_stored_file(db, actor, file)) for file in files]
    audit(db, actor, 'submission.archive_download', 'exam', identifier, {'count': len(files), 'versionIds': [str(value) for value in selected]})
    # Spool to disk to bound memory. Uploaded archives are copied as bytes, never extracted.
    output = tempfile.TemporaryFile()
    with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_STORED, allowZip64=True) as archive_file:
        for file, path in paths:
            archive_file.write(path, arcname=f'{file["version_id"]}/{file["submission_name"]}')
    output.seek(0)
    def chunks():
        try:
            while chunk := output.read(256 * 1024):
                yield chunk
        finally:
            output.close()
    return StreamingResponse(chunks(), media_type='application/octet-stream', headers={'Content-Disposition': f'attachment; filename="exam-{identifier}.zip"', 'X-Content-Type-Options': 'nosniff'})


@router.get('/exams/{identifier}/submissions')
def submission_list(identifier: UUID, q: str | None = None, student_id: UUID | None = Query(default=None, alias='studentId'),
                    page: int = Query(default=1, ge=1), page_size: int = Query(default=10, alias='pageSize', ge=1, le=100), actor=Depends(staff), db=Depends(database)):
    exam = exams.require_exam(db, actor, identifier, freeze_due=True)
    statement = select(submissions).where(submissions.c.exam_id == identifier)
    if student_id:
        statement = statement.where(submissions.c.student_id == student_id)
    if q:
        statement = statement.where(submissions.c.student_id.in_(select(users.c.id).where(users.c.full_name.ilike(search_pattern(q), escape='\\'))))
    return paginate(db, statement.order_by(submissions.c.student_id, submissions.c.id), page, page_size, lambda row: service.root_dto(db, row, actor, exam))


@router.get('/submissions/{identifier}')
def root_detail(identifier: UUID, actor=Depends(current_user), db=Depends(database)):
    root, exam = service.require_root(db, actor, identifier)
    return service.root_dto(db, root, actor, exam)


@router.get('/submissions/{identifier}/versions')
def versions(identifier: UUID, page: int = Query(default=1, ge=1), page_size: int = Query(default=10, alias='pageSize', ge=1, le=100), actor=Depends(current_user), db=Depends(database)):
    root, exam = service.require_root(db, actor, identifier)
    statement = select(submission_versions).where(submission_versions.c.submission_id == identifier)
    if actor['role'] != 'student':
        statement = statement.where(submission_versions.c.state == 'final')
    return paginate(db, statement.order_by(submission_versions.c.version_number.desc()), page, page_size, lambda row: service.version_dto(db, row, exam))


@router.get('/submissions/{identifier}/versions/{version_id}')
def version_detail(identifier: UUID, version_id: UUID, actor=Depends(current_user), db=Depends(database)):
    _, exam, version = service.require_version(db, actor, identifier, version_id)
    return service.version_dto(db, version, exam)


@router.post('/submissions/{identifier}/versions/{version_id}/files', status_code=201)
def file_intent(identifier: UUID, version_id: UUID, payload: FileIntent, actor=Depends(student), db=Depends(database)):
    return service.file_intent(db, actor, identifier, version_id, payload)


@router.put('/submission-files/{upload_id}/content')
async def content(upload_id: UUID, request: Request, actor=Depends(student)):
    return await storage.receive(request, actor, upload_id)


@router.patch('/submission-files/{upload_id}')
def rename(upload_id: UUID, payload: FileRename, actor=Depends(student), db=Depends(database)):
    return service.rename_file(db, actor, upload_id, payload)


@router.delete('/submission-files/{upload_id}', status_code=204)
def remove(upload_id: UUID, actor=Depends(student), db=Depends(database)):
    service.remove_file(db, actor, upload_id)


@router.get('/submission-files/{upload_id}/content')
def download(upload_id: UUID, actor=Depends(current_user), db=Depends(database)):
    root, exam, version, file = service.require_file(db, actor, upload_id)
    if file['state'] != 'ready':
        missing()
    path = storage.verify_stored_file(db, actor, file)
    audit(db, actor, 'submission.file_download', 'submission_file', upload_id, {'examId': str(exam['id']), 'versionId': str(version['id'])})
    return FileResponse(path, media_type='application/octet-stream', filename=file['submission_name'], headers={'X-Content-Type-Options': 'nosniff'})


@router.post('/submissions/{identifier}/versions/{version_id}/finalize')
def finalize(identifier: UUID, version_id: UUID, actor=Depends(student), db=Depends(database)):
    return service.finalize(db, actor, identifier, version_id)
