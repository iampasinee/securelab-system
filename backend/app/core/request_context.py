from contextvars import ContextVar

# Only server-generated correlation metadata; never retain a request body/token.
request_context: ContextVar[dict | None] = ContextVar('securelab_request_context', default=None)
