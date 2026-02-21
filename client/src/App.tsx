import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  TrendingUp,
  UploadCloud,
  X,
} from "lucide-react";

import { createJob, downloadUrl, getJob } from "./api";
import type { JobStatus } from "./api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const MAX_FILES = 1;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export default function App() {
  const [files, setFiles] = useState<File[]>([]);
  const [job, setJob] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const canCalculate = useMemo(
    () => files.length === MAX_FILES && !polling,
    [files, polling]
  );
  const progressPct = job?.total ? Math.round((job.completed / job.total) * 100) : 0;

  function removeFile(name: string) {
    setFiles((prev) => prev.filter((f) => f.name !== name));
    setError(null);
  }

  function applyFiles(incoming: FileList | File[]) {
    setError(null);
    const arr = Array.from(incoming);
    const csvOnly = arr.filter((f) => f.name.toLowerCase().endsWith(".csv"));
    const sizeOk = csvOnly.filter((f) => f.size <= MAX_FILE_SIZE_BYTES);

    if (arr.length !== csvOnly.length) {
      setError("Only .csv files are accepted.");
    } else if (csvOnly.length !== MAX_FILES) {
      setError(`Please select exactly ${MAX_FILES} CSV file.`);
    }

    const oversize = csvOnly.find((f) => f.size > MAX_FILE_SIZE_BYTES);
    if (oversize) {
      setError(`"${oversize.name}" exceeds the 5 MB limit.`);
    }

    setFiles(sizeOk.slice(0, MAX_FILES));
  }

  async function onCalculate() {
    setError(null);
    setJob(null);

    try {
      const created = await createJob(files);
      setJob(created);
      setPolling(true);

      const jobId = created.job_id;
      const interval = window.setInterval(async () => {
        try {
          const status = await getJob(jobId);
          setJob(status);
          if (status.state === "done" || status.state === "error") {
            window.clearInterval(interval);
            setPolling(false);
          }
        } catch (e: any) {
          window.clearInterval(interval);
          setPolling(false);
          setError(e?.message ?? "Polling failed.");
        }
      }, 800);
    } catch (e: any) {
      setError(e?.message ?? "Failed to start job.");
    }
  }

  function onReset() {
    setFiles([]);
    setJob(null);
    setError(null);
    setPolling(false);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top nav */}
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <TrendingUp className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold tracking-tight">Volatility Calculator</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10 space-y-8">

        {/* Hero */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">90-Day Historical Volatility</h1>
          <p className="text-sm text-muted-foreground max-w-xl">
            Upload two CSV files, extract tickers from column B, calculate annualized volatility, and download a TradePrep-ready results file.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">

          {/* Upload card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Step 1 — Upload Files</CardTitle>
              <CardDescription>Exactly {MAX_FILES} CSV file, max 5 MB.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); applyFiles(e.dataTransfer.files); }}
                className={cn(
                  "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors cursor-pointer",
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/60 hover:bg-accent/5"
                )}
                onClick={() => document.getElementById("file-input")?.click()}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <UploadCloud className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Drop files here or click to browse</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Final_L001_MMDDYYYY.csv
                  </p>
                </div>
                <input
                  id="file-input"
                  type="file"
                  accept=".csv"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && applyFiles(e.target.files)}
                />
              </div>

              {/* File list */}
              {files.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Selected ({files.length}/{MAX_FILES})
                  </p>
                  {files.map((file) => (
                    <div
                      key={file.name}
                      className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm"
                    >
                      <FileText className="h-4 w-4 shrink-0 text-primary" />
                      <span className="flex-1 truncate">{file.name}</span>
                      <button
                        onClick={() => removeFile(file.name)}
                        className="ml-1 rounded text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        aria-label="Remove file"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Error */}
              {error && (
                <Alert variant="destructive">
                  <div className='flex gap-2 items-center'>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </div>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Action + Status card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Step 2 — Calculate & Download</CardTitle>
              <CardDescription>Track progress and grab your results CSV.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">

              {/* Action button */}
              <div className="flex gap-2">
                <Button
                  
                  onClick={onCalculate}
                  disabled={!canCalculate}
                  className={`flex-1 ${!polling && 'cursor-pointer'}`}
                >
                  {polling ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Calculating…</>
                  ) : (
                    "Calculate Volatility"
                  )}
                </Button>
                {(job || error) && !polling && (
                  <Button variant="outline" onClick={onReset}>
                    Reset
                  </Button>
                )}
              </div>

              <Separator />

              {/* Status panel */}
              <div className="space-y-3">
                {/* State badge + message */}
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {!job && <div className="h-2 w-2 rounded-full bg-muted-foreground mt-1" />}
                    {job?.state === "queued" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    {job?.state === "running" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                    {job?.state === "done" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    {job?.state === "error" && <AlertTriangle className="h-4 w-4 text-destructive" />}
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">
                      {!job && "Waiting to start"}
                      {job?.state === "queued" && "Queued"}
                      {job?.state === "running" && "Processing"}
                      {job?.state === "done" && "Complete"}
                      {job?.state === "error" && "Failed"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {job ? job.message : "Upload files to begin."}
                    </p>
                  </div>
                  {job?.state === "done" && (
                    <Badge variant="secondary" className="ml-auto shrink-0">Done</Badge>
                  )}
                </div>

                {/* Progress bar */}
                {job && job.state !== "error" && (
                  <div className="space-y-1.5">
                    <Progress value={job.state === "done" ? 100 : progressPct} />
                    <p className="text-xs text-muted-foreground text-right">
                      {job.completed} / {job.total} tickers
                    </p>
                  </div>
                )}

                {/* Error detail */}
                {job?.state === "error" && job.error && (
                  <Alert variant="destructive">
                    <AlertDescription>{job.error}</AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Download */}
              {job?.state === "done" && (
                <Button asChild variant="outline" className="w-full">
                  <a
                    href={downloadUrl(job.job_id)}
                    onClick={() => setTimeout(onReset, 1500)}
                  >
                    <Download className="h-4 w-4" />
                    Download Volatility_Results.csv
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">How it works</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
              <li>Upload <span className="text-foreground font-medium">1 CSV file</span> — tickers are read from Column B automatically.</li>
              <li>Click <span className="text-foreground font-medium">Calculate Volatility</span> — we fetch 90 days of closing prices from Yahoo Finance per ticker.</li>
              <li>Volatility is annualized: <code className="rounded bg-muted px-1 py-0.5 text-xs">std_dev × √252 × 100</code></li>
              <li>Download <span className="text-foreground font-medium">Volatility_Results.csv</span> and import into TradePrep.</li>
            </ol>
          </CardContent>
        </Card>

      </main>
    </div>
  );
}