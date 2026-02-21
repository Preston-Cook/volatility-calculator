import io
import math
import pandas as pd
import numpy as np
import yfinance as yf
from typing import Iterable, Tuple


def extract_unique_tickers(files: Iterable[Tuple[str, bytes]]) -> list[str]:
    tickers: set[str] = set()

    for filename, content in files:
        if not filename.lower().endswith(".csv"):
            raise ValueError(f"Invalid file type: {filename} (must be .csv)")

        df = pd.read_csv(io.BytesIO(content), header=0)
        # Spec: "Extract Column B (Ticker)" => column index 1 (skip header row)
        if df.shape[1] < 2:
            raise ValueError(f"{filename} does not have a Column B")

        col = df.iloc[:, 1].astype(str).str.strip().str.upper()
        col = col[col.notna() & (col != "")]

        tickers.update(col.tolist())

    return sorted(tickers)


def compute_90d_annualized_volatility_percent(symbol: str) -> float:
    # Fetch 90 days of data (use a bit extra in case of non-trading days)
    hist = yf.Ticker(symbol).history(period="120d")  # buffer > 90
    if hist is None or hist.empty or "Close" not in hist.columns:
        raise ValueError("No price data")

    closes = hist["Close"].dropna()
    if len(closes) < 30:
        raise ValueError("Insufficient data")

    # Use last 90 trading days (or last 90 entries)
    closes = closes.tail(90)
    rets = closes.pct_change().dropna()
    if rets.empty:
        raise ValueError("No returns")

    daily_std = float(np.std(rets, ddof=1))
    annualized = daily_std * math.sqrt(252) * 100.0
    return annualized


def build_results_csv(tickers: list[str], progress_cb=None) -> bytes:
    rows = []
    total = len(tickers)

    for i, sym in enumerate(tickers, start=1):
        vol: float | None = None
        skipped = False
        try:
            vol = compute_90d_annualized_volatility_percent(sym)
            rows.append((sym, round(vol, 2)))
        except Exception:
            # Spec: "Ticker fails: Skip and continue"
            skipped = True

        if progress_cb:
            progress_cb(i, total, sym, vol, skipped)

    out_df = pd.DataFrame(rows, columns=["Symbol", "Volatility"])
    out_df = out_df.sort_values("Volatility", ascending=False)
    buf = io.StringIO()
    out_df.to_csv(buf, index=False, float_format="%.2f")
    return buf.getvalue().encode("utf-8")
