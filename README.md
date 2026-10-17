# KrishiGuide AI — full-stack app (Sociothon '26)

**Smarter agriculture for small farmers.** A FastAPI + SQLite backend and a modular, installable
(PWA) web app that helps a farmer decide *what to grow, what to grow next, when to do what, how much
water it needs, and which government schemes to look at* — with every score explained in plain language.

> Planning support only. There is **no trained ML model**: ranking is transparent, rule-based and
> explainable. Always confirm decisions with a local KVK / agriculture officer.

---

## Quick start (one command)

Requires **Python 3.10+**.

| OS | Command |
|---|---|
| Windows | double-click **`start.bat`** (or run it in a terminal) |
| macOS / Linux | `./start.sh` |

Then open **http://127.0.0.1:8000** — the FastAPI server serves both the API and the web app, so
there is nothing else to run. Interactive API docs: http://127.0.0.1:8000/docs

<details><summary>Manual steps</summary>

```bash
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r backend/requirements.txt
cd backend && python -m uvicorn app.main:app --reload   # UI + API on :8000
```
You can also serve `frontend/` separately (`python -m http.server 8080` inside `frontend/`);
the app auto-detects the API on `localhost:8000`, or use `http://localhost:8080/?api=http://HOST:PORT`.
</details>

To try it on a phone on the same Wi-Fi: `HOST=0.0.0.0 ./start.sh`, then open `http://<your-PC-ip>:8000`.
(Installing as a PWA needs HTTPS or `localhost`; the app itself works over plain HTTP.)

## What's inside

| Screen | What it does |
|---|---|
| **Crop planner** | Farm profile → ranked crops (season, soil, water, budget, priority, district context) with reasons, cost band, details, save plan |
| **Rotation planner** | "What next after soybean?" — family alternation, legume nitrogen credit, root-depth, water recovery rules |
| **Crop journey** | Dated week-by-week schedule from a sowing date with tick-able tasks (progress saved on device) + **water budget** (litres, tanker loads, per week) |
| **Farm signals** | 7-day Open-Meteo forecast → rule-based field advisories (rain, heat, frost, harvest) + optional official Agmarknet mandi prices |
| **Profit simulator** | Best / expected / worst what-if from *your* yield and price assumptions |
| **Govt. schemes** | Short checklist → PM-KISAN, PMFBY, KCC, Soil Health Card, PM-KUSUM, e-NAM, SMAM, Mahila Kisan with document lists and official links |
| **Ask KrishiGuide** | Farming assistant: rule-based by default, **LLM-grounded** when you set an API key. Voice input (mic) and optional spoken replies |
| **Saved plans & account** | Phone-OTP sign-in (dev mode) → plans belong to the account |

Also: English / हिन्दी / मराठी interface · responsive down to phone width · print-friendly · installable PWA ·
**works offline** after the first visit (UI shell cached; crop ranking is recomputed on-device with the
same rules — a parity test guarantees it matches the server).

## Project layout

```
krishi_guide/
├── start.sh / start.bat          one-command launcher
├── backend/
│   ├── app/main.py               API routes + all scoring/rotation/advisory rules
│   ├── app/data_adapters.py      Open-Meteo weather, data.gov.in Agmarknet
│   ├── app/llm.py                optional OpenAI-compatible assistant
│   ├── data/crops.json           13-crop catalogue (rotation/water/calendar metadata)
│   └── tests/test_app.py         API tests
├── frontend/                     no build step — plain ES modules
│   ├── index.html · css/app.css · manifest.webmanifest · service-worker.js · icons/
│   └── js/  main.js (router, state, i18n) · api.js · i18n.js · offline.js · views/*.js
├── tests/                        frontend structure, JS↔Python parity, real-browser E2E
└── KrishiGuide_AI_Sociothon26_Presentation.pptx · build_presentation.js · MVP_SCOPE.md · DEMO_SCRIPT.md
```

## Configuration (environment variables, all optional)

| Variable | Purpose |
|---|---|
| `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL` | Turns the assistant into an LLM answer grounded on the crop catalogue + farm profile. Any OpenAI-compatible endpoint (OpenAI, Groq, Z.ai GLM, Ollama…). Example: `LLM_BASE_URL=https://api.openai.com/v1`, `LLM_MODEL=gpt-4o-mini` |
| `DATA_GOV_IN_API_KEY` | Enables live Agmarknet mandi prices (`AGMARKNET_RESOURCE_ID` overrides the dataset). Without it the API says "unavailable" — prices are never invented |
| `KRISHI_DB` | Path of the SQLite file (default `backend/data/krishiguide.sqlite3`, created on first run) |
| `HOST` / `PORT` | Used by `start.sh` |

## API summary

`GET /api/health` · `GET /api/crops` · `POST /api/recommendations` · `POST /api/rotation` ·
`GET /api/crops/{id}/timeline` · `GET /api/water-plan` · `GET /api/advisory` · `GET /api/weather` ·
`GET /api/mandi/prices` · `POST /api/simulator` · `GET /api/schemes` · `POST /api/schemes/eligibility` ·
`POST /api/assistant` · `POST /api/auth/request-otp|verify-otp|logout` · `GET /api/auth/me` ·
`POST|GET|DELETE /api/plans`

## Tests

```bash
# after start.sh / start.bat has created .venv (or create your own venv):
source .venv/bin/activate                 # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
python -m playwright install chromium     # one-time, for the browser test
python -m pytest -q
```

30 tests: backend API · frontend structure & i18n · **JS offline scorer ≡ Python scorer** over 541 profiles × 13 crops ·
**real-Chromium end-to-end** (labelled forms, profile persistence, 3 languages, journey progress, rotation, water,
simulator, schemes, assistant, OTP sign-in + plan ownership, offline reload, phone-width layout).
The browser test is skipped automatically if Playwright isn't installed.

## Troubleshooting

- **Badge says "API offline"** — the backend isn't running or is on another port. Start it with `start.bat` / `./start.sh`,
  or open the UI once with `?api=http://HOST:PORT` to point it at the right server.
- **Weather / mandi show "unavailable"** — needs internet (weather) or `DATA_GOV_IN_API_KEY` (mandi). This is by design.
- **OTP** — in dev mode the 6-digit code is printed in the terminal running the backend (no SMS is sent).
- **Old UI after an update** — hard-refresh once (Ctrl+F5); the service worker is network-first so it self-updates.
- **Voice** — needs a browser with the Web Speech API (Chrome/Edge) and microphone permission; Hindi/Marathi voices depend on the OS.

## Limitations (please keep these when presenting)

- No trained ML or generative model is used by default; the optional LLM assistant is only active when *you* configure a key, and it is prompted to stay within the catalogue and to refer farmers to a KVK.
- District scoring uses a small, explicit set of coarse associations — **not** validated crop-zoning data.
- Crop cost bands and profit scenarios are **illustrative**, not quotes or forecasts.
- OTP login is **development-only**: no SMS provider, no production-grade session hardening. Do not deploy it as real authentication without adding SMS delivery, HTTPS, rate limiting by IP and secure cookies. Anonymous plans are saved to a shared pool.
- Scheme results are official starting points, not eligibility decisions.
- IBM tools / IBM Bob were not used; the presentation says so. Update that slide only after real, documented use.

Do not use this app alone for planting, pesticide, fertilizer, insurance or financial decisions.

## Official references

Soil Health Card https://soilhealth.dac.gov.in · IMD agromet https://mausam.imd.gov.in/responsive/agromet_adv_ser_district_current_lo.php ·
ICAR advisories https://icar.gov.in/en/kharif-agro-advisory-farmers · AGMARKNET/e-NAM https://www.enam.gov.in/web/dashboard/agmarknet


## Buyer prices (hackathon feature)

Buyers register, post offers that auto-expire after their valid-until date, and farmers compare them in the **Buyer prices** sidebar item.

- Farmer side: filter by crop, buyer district and distance; the best price per crop is highlighted; every offer is shown next to the government MSP (`backend/data/msp.json`) and the latest mandi price (live from data.gov.in when `DATA_GOV_IN_API_KEY` is set).
- Trust: only buyers approved by the admin show by default; farmers can report an offer (3 reports hide it for review).
- Offline: the last seen offers are cached on the device.
- Env vars: `ADMIN_KEY` (admin password, default `krishi-admin`, **change it when deploying**), `KRISHI_SEED_DEMO=0` to turn off demo buyers/offers.
- Demo logins: buyer `9000000001` / `demo123` (verified), `9000000004` / `demo123` (pending). Admin tab key: `krishi-admin`.
- Storage: all SQL is in `backend/app/buyers.py`. On Render's free tier the SQLite disk resets on restart, so demo data is re-seeded each start; real accounts need a persistent database before production.
