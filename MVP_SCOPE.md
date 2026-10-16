# KrishiGuide AI — MVP scope and presentation alignment

## Current MVP (full-stack)

| Presentation section | What the app implements | Current boundary |
|---|---|---|
| Problem: small-farmer decisions | One workflow: crop choice → rotation → dated crop journey → water budget → schemes | Pilot geography is not validated yet |
| Proposed solution | Farm profile, ranked crops with reasons, cost bands, rotation planner, journey calendar, profit what-ifs | Scores/costs are illustrative |
| Regional / language access | English, Hindi, Marathi UI; voice input and optional spoken replies (browser Web Speech API) | UI labels are translated; long advisory text and crop data stay English |
| Architecture | Browser PWA (ES modules) → FastAPI → SQLite + rule engine; Open-Meteo weather; optional data.gov.in Agmarknet; optional LLM | OTP is dev-only; no SMS provider |
| AI role | Transparent rule-based ranking; optional **LLM assistant grounded on the catalogue + farm profile** (only if an API key is configured) | No trained/ML model; the LLM is not validated agronomy |
| Trusted information | Live 7-day forecast → rule-based advisories; official links (Soil Health Card, IMD, ICAR, AGMARKNET/e-NAM); optional official mandi feed | Mandi prices need an API key; never fabricated |
| Offline / low connectivity | PWA shell cached; crop catalogue cached; ranking recomputed on-device with identical rules (parity-tested) | Weather, schemes, assistant, saved plans need network |
| Safety | Cautions, verify-with-KVK prompts, no pesticide/fertilizer dosing advice | Not professional agronomic advice |

## Before submitting

- Add the actual team-member details on presentation slide 2 and replace certificate placeholders on slide 3.
- **Re-read the presentation slides against this table** — earlier wording such as "no server / no database / links only" is out of date now.
- Confirm that the selected Sociothon problem statement is accepted for the team.
- Do not claim use of IBM tools or IBM Bob unless the team has actually used them and documented it.
- If evaluators require a true AI/ML component, implement and test one using verified data; do not relabel the rules as machine learning. If you enable the LLM assistant, describe it exactly as that: an LLM grounded on the app's catalogue.
