from dataclasses import dataclass, field
from typing import Dict, Optional, List
import threading


@dataclass
class Job:
    job_id: str
    state: str = "queued"
    message: str = "Queued"
    total: int = 0
    completed: int = 0
    error: Optional[str] = None
    result_csv_bytes: Optional[bytes] = None
    tickers: List[str] = field(default_factory=list)


_JOBS: Dict[str, Job] = {}
_LOCK = threading.Lock()


def put_job(job: Job) -> None:
    with _LOCK:
        _JOBS[job.job_id] = job


def get_job(job_id: str) -> Optional[Job]:
    with _LOCK:
        return _JOBS.get(job_id)


def update_job(job_id: str, **kwargs) -> None:
    with _LOCK:
        job = _JOBS[job_id]
        for k, v in kwargs.items():
            setattr(job, k, v)


def delete_job(job_id: str) -> None:
    with _LOCK:
        _JOBS.pop(job_id, None)
