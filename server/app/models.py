from pydantic import BaseModel
from typing import Optional


class JobStatus(BaseModel):
    job_id: str
    state: str  # queued | running | done | error
    message: str
    total: int
    completed: int
    error: Optional[str] = None
