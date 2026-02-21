export type JobStatus = {
  job_id: string;
  state: "queued" | "running" | "done" | "error";
  message: string;
  total: number;
  completed: number;
  error?: string | null;
};

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export async function createJob(files: File[]): Promise<JobStatus> {
  const fd = new FormData();
  files.forEach((f) => fd.append("files", f));
  const res = await fetch(`${API_BASE}/api/volatility/jobs`, { method: "POST", body: fd });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getJob(jobId: string): Promise<JobStatus> {
  const res = await fetch(`${API_BASE}/api/volatility/jobs/${jobId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function downloadUrl(jobId: string) {
  return `${API_BASE}/api/volatility/jobs/${jobId}/download`;
}