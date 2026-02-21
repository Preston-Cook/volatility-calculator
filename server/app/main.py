from app.volatility import build_results_csv, extract_unique_tickers
from app.models import JobStatus
from app.jobs import Job, delete_job, get_job, put_job, update_job
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from typing import Iterable, Tuple
import logging
import threading
import uuid

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_FILES = 1
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024


async def _validate_and_read_files(files: Iterable[UploadFile]) -> list[Tuple[str, bytes]]:
    file_list = list(files)
    if len(file_list) != MAX_FILES:
        raise HTTPException(
            status_code=400, detail="Please upload exactly 1 CSV file.")

    result: list[Tuple[str, bytes]] = []
    for f in file_list:
        filename = f.filename or ""
        if not filename.lower().endswith(".csv"):
            raise HTTPException(
                status_code=400, detail=f"Invalid file type: {filename}")

        data = await f.read()
        if not data:
            raise HTTPException(
                status_code=400, detail=f"Empty file: {filename}")
        if len(data) > MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=400, detail=f"File too large: {filename} (max 5 MB)")

        result.append((filename, data))

    return result


def _process_job(job_id: str, files: list[Tuple[str, bytes]]) -> None:
    try:
        log.info("[%s] Job started", job_id[:8])
        update_job(job_id, state="running",
                   message="Reading uploaded files...")

        tickers = extract_unique_tickers(files)
        log.info("[%s] Found %d unique tickers: %s", job_id[:8], len(
            tickers), ", ".join(tickers[:10]) + (" ..." if len(tickers) > 10 else ""))
        update_job(
            job_id,
            message=f"Found {len(tickers)} unique tickers",
            total=len(tickers),
            completed=0,
            tickers=tickers,
        )

        log.info("[%s] Calculating volatility...", job_id[:8])
        update_job(job_id, message="Calculating volatility...")

        def progress_cb(completed: int, total: int, symbol: str, vol: float | None, skipped: bool) -> None:
            if skipped:
                log.warning("[%s] %-6s  SKIPPED  (%d/%d)",
                            job_id[:8], symbol, completed, total)
            else:
                log.info("[%s] %-6s  vol=%.2f%%  (%d/%d)",
                         job_id[:8], symbol, vol, completed, total)
            update_job(
                job_id,
                message=f"Progress: {completed}/{total} complete",
                completed=completed,
                total=total,
            )

        result_bytes = build_results_csv(tickers, progress_cb=progress_cb)
        log.info("[%s] Done — results ready", job_id[:8])
        update_job(
            job_id,
            state="done",
            message="Processing complete!",
            completed=len(tickers),
            total=len(tickers),
            result_csv_bytes=result_bytes,
        )
    except Exception as exc:
        log.error("[%s] Job failed: %s", job_id[:8], exc)
        update_job(
            job_id,
            state="error",
            message="Processing failed",
            error=str(exc),
        )


@app.post("/api/volatility/jobs", response_model=JobStatus, status_code=201)
async def create_volatility_job(files: list[UploadFile] = File(...)) -> JobStatus:
    data = await _validate_and_read_files(files)
    job_id = uuid.uuid4().hex
    job = Job(job_id=job_id, state="queued",
              message="Reading uploaded files...")
    put_job(job)

    log.info("[%s] Job created — files: %s", job_id[:8], [f[0] for f in data])
    worker = threading.Thread(
        target=_process_job, args=(job_id, data), daemon=True)
    worker.start()

    return JobStatus(
        job_id=job.job_id,
        state=job.state,
        message=job.message,
        total=job.total,
        completed=job.completed,
        error=job.error,
    )


@app.get("/api/volatility/jobs/{job_id}", response_model=JobStatus)
def get_volatility_job(job_id: str) -> JobStatus:
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return JobStatus(
        job_id=job.job_id,
        state=job.state,
        message=job.message,
        total=job.total,
        completed=job.completed,
        error=job.error,
    )


@app.get("/api/volatility/jobs/{job_id}/download")
def download_volatility_results(job_id: str) -> Response:
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.state != "done" or not job.result_csv_bytes:
        raise HTTPException(status_code=409, detail="Results not ready")

    data = job.result_csv_bytes
    delete_job(job_id)
    return Response(
        data,
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=Volatility_Results.csv"},
    )
