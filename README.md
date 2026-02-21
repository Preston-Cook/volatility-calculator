# Stock Volatility Calculator

Upload 2 CSV files, calculate 90-day historical volatility for each ticker, and download a clean results CSV.

## Features
- Drag-and-drop CSV uploads (exactly 2 files, 5 MB max each)
- Unique ticker extraction from Column B
- 90-day annualized volatility calculation
- Progress status messages and downloadable results
- No permanent data storage

## Local Development

### Server (FastAPI)
```
cd server
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Client (Vite + React)
```
cd client
pnpm install
pnpm dev
```

Open http://localhost:5173/ in your browser.

## Output Format
Downloaded file name: Volatility_Results.csv

```
Symbol,Volatility
AAPL,23.45
GSL,52.33
```

## Notes
- Volatility uses 90 trading days of closing prices from Yahoo Finance.
- Results are sorted A-Z with 2 decimal places.
- Tickers that fail to fetch are skipped.

## Deployment
- PythonAnywhere: run the FastAPI server with uvicorn
- Replit: run server and client (or serve built client) in separate processes
- Local: follow the steps above
