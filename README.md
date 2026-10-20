# TermsLens

A Manifest V3 Chrome extension that finds a site’s Terms & Conditions or Privacy Policy, summarizes what the text actually says, and flags risky clauses **only when it can quote supporting language**.

API keys never live in the extension. Optional Gemini analysis runs on a local backend at `http://127.0.0.1:8787`.

## What the MVP does

- Detects policy pages from the URL, title, headings, and on-page links
- Extracts readable policy text from the current page, or fetches a linked policy page
- Returns up to five grounded summary bullets
- Flags data collection, sharing/selling, auto-renewal, fees, tracking, sensitive permissions, and one-sided clauses
- Shows severity (`Low`, `Medium`, `High`) plus a verbatim excerpt
- Handles missing policies, unsupported Chrome pages, loading, and backend failures
- Uses Gemini when `GEMINI_API_KEY` is set, and falls back to heuristics if the API is missing, unavailable, or rate-limited

TermsLens does not invent findings. If a quote cannot be matched back to the extracted text, that item is dropped.

## Project layout

```text
manifest.json          Chrome extension manifest (V3)
popup/                 Scan UI
options/               Backend URL and local-only mode
src/                   Detector, extractor, content script, service worker
backend/               Local analysis API (Gemini + heuristic fallback)
demo/sample-policy.html  Fixture page for testing
```

## Load the extension in Chrome

1. Open Chrome and go to `chrome://extensions`
2. Turn on **Developer mode**
3. Click **Load unpacked**
4. Select this folder: `C:\Users\saksh\TermsLens`
5. Pin TermsLens from the puzzle-piece menu

## Run the local backend on Windows

1. Install [Node.js 18+](https://nodejs.org/) if needed.
2. Open PowerShell:

```powershell
cd C:\Users\saksh\TermsLens\backend
copy .env.example .env
notepad .env
```

3. In `.env`, set **`GEMINI_API_KEY`** to your Gemini API key. Do not put the key in the extension, README, or chat.
4. Optional: leave `GEMINI_MODEL=gemini-3.5-flash-lite` (current free-tier-eligible text model).
5. Start the server:

```powershell
node server.js
```

6. Check [http://127.0.0.1:8787/health](http://127.0.0.1:8787/health). `geminiConfigured` should be `true` after the variable is set. The health response never includes the key.

If `GEMINI_API_KEY` is unset, `/analyze` still works with on-device heuristics.

Open extension **Settings** if you need to change the backend URL. Default is `http://127.0.0.1:8787`.

No extra npm packages are required.

## How to test

Automated backend tests (no live Gemini call):

```powershell
cd C:\Users\saksh\TermsLens\backend
node test.js
```

End-to-end with the extension:

1. Start the backend with `node server.js`.
2. Load the unpacked extension as above.
3. Open [http://127.0.0.1:8787/demo](http://127.0.0.1:8787/demo).
4. Click the TermsLens icon.
5. Confirm:
   - A five-point summary
   - High-severity flags for sharing/selling, auto-renewal, and cancellation fees
   - A quoted excerpt under each flag
   - Engine label `gemini` when the key is configured, otherwise `heuristic`
6. Also try:
   - `chrome://extensions` → **Unsupported page**
   - A random blog post with no legal links → **No policy found**
   - Stop the backend and scan again → heuristic fallback warning

To confirm Gemini without exposing the key: after setting `GEMINI_API_KEY`, reload `/health` and check `"engine":"gemini"`. Then scan the demo page and look for `gemini` in the popup summary card.

## Privacy

- No account, analytics, or identity collection
- The extension only sends policy text to the backend URL you configure
- `GEMINI_API_KEY` stays in `backend/.env`, which is gitignored
- On-device mode (Settings) never leaves the browser

## Notes

This is a working MVP, not a legal opinion. Summaries can miss clauses, especially on heavily scripted pages or PDFs. Use the quoted evidence to verify anything important.
