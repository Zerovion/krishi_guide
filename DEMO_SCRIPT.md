# 4-minute demo script — KrishiGuide AI

Start the app with `start.bat` / `./start.sh` and open http://127.0.0.1:8000. Check the top-right badge says **API connected**.

## 0:00–0:25 — Problem
"Crop decisions depend on season, soil, water, budget — and what was grown last season. KrishiGuide brings these into one explainable workflow. It is a student prototype and does not replace an agriculture officer."

## 0:25–1:05 — Crop planner
Enter a district (e.g. *Sangli, Maharashtra*), season, soil, water, acres, budget, priority → **Find suitable crops**. Open a card: show the plain-language reasons, input-cost band and cautions. Change the district to *Shimla* and show the ranking shift. Say clearly: rule-based and explainable, district effect is a coarse prototype heuristic.

## 1:05–1:45 — Rotation planner & crop journey
Rotation planner: pick *Soybean* → show legume/cereal logic and why long-duration sugarcane is excluded. Click **Plan this crop next** → Crop journey: dated week-by-week tasks, tick a few; open the **water budget** (litres, tanker loads, per week).

## 1:45–2:25 — Signals, simulator, schemes
Farm signals: live 7-day forecast and generated advisories (needs internet; if offline the app says so — nothing is invented). Profit simulator: best/expected/worst from your own yield and price. Govt. schemes: tick the checklist → ranked schemes with documents and official links.

## 2:25–3:05 — Language, voice, assistant
Switch to हिन्दी / मराठी. Ask the assistant "What should I grow after soybean?" — by mic or text. Mention it is rule-based by default and LLM-grounded only when a key is configured.

## 3:05–3:30 — Works without internet
Turn off Wi-Fi (or DevTools → Network → Offline) and reload: the app opens and still ranks crops on-device. Reconnect.

## 3:30–4:00 — Roadmap
"For a pilot we would validate one district's catalogue with a KVK, add SMS login and secure sessions, add timestamped official data, test with farmers, and evaluate any ML feature against this transparent baseline."

### Demo honesty reminders
- Weather is live only with internet; mandi prices only with a data.gov.in key — otherwise say "unavailable".
- Cost bands and profit scenarios are illustrative, not forecasts. District scoring is not validated zoning.
- Do not claim a trained ML model, or IBM tool use. OTP is a development flow (code shows in the server console).
