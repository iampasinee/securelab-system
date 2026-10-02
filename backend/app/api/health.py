from fastapi import APIRouter

from app.schemas.health import HealthResponse

router = APIRouter()


@router.get('/health', response_model=HealthResponse, tags=['health'])
def health() -> HealthResponse:
    """Liveness only: no database connection or storage initialization."""
    return HealthResponse(status='ok', service='securelab-backend')
