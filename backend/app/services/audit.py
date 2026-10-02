from uuid import uuid4

from app.models import audit_logs
from app.repositories.base import create
from app.core.request_context import request_context


# Services select these values explicitly; never serialize a request body into audit.
ALLOWED_KEYS = {'fields', 'count', 'reason', 'studentId', 'sectionId', 'targetSectionId', 'examId', 'versionId', 'fileId', 'batchId',
                'previousEndAt', 'nextEndAt', 'source', 'failureCode', 'emailDigest', 'versionIds', 'purpose', 'sessionId', 'scope'}


def audit(db, actor, action, target_type, target_id=None, metadata=None, outcome='success', request=None):
    values = metadata or {}
    if not set(values).issubset(ALLOWED_KEYS):
        raise ValueError('Audit metadata contains an unapproved field')
    context = request_context.get() or {}
    peer = request.client.host if request and request.client else context.get('peer_ip')
    create(db, audit_logs, {
        'actor_id': actor['id'] if actor else None,
        'actor_role_snapshot': actor['role'] if actor else None,
        'action': action, 'target_type': target_type, 'target_id': target_id, 'outcome': outcome, 'metadata': values,
        'peer_ip': peer if peer not in ('testclient', 'localhost') else None,
        'session_id': actor.get('session_id') if actor else None,
        'request_id': getattr(request.state, 'request_id', uuid4()) if request else context.get('request_id') or uuid4(),
    })
