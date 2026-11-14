# AgriSense — Intelligent Crop Planning & Farm Decision Support System

AgriSense is a full-stack, database-connected agricultural decision support web application combining machine learning models, soil health diagnostics, FAO-aligned irrigation planning, live weather forecasts, multilingual voice assistance, AI chatbot guidance, and plant leaf disease inspection.

## Core Architecture

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Chart.js (`react-chartjs-2`), Web Speech API (`SpeechRecognition` + `speechSynthesis`)
- **Backend:** Express + TypeScript (`server.ts`) running on port 3000 with Vite middleware
- **Database:** SQLite (`database/database.db`) with `better-sqlite3` and salted `bcryptjs` authentication
- **Machine Learning (`server/ml/`):**
  - **Crop Recommendation:** Random Forest Classifier (24 CART Decision Trees using Gini Impurity) trained on `datasets/crop_recommendation.csv` (22 crops, 80/20 stratified train/test split)
  - **Fertilizer Recommendation:** Random Forest Classifier (18 CART Trees) trained on `datasets/fertilizer_recommendation.csv`
  - **Yield Prediction:** Random Forest Regressor (22 Variance-Reduction Trees) trained on `datasets/yield_prediction.csv` evaluating R², RMSE, and MAE on held-out test records
- **AI & Services (`server/services/`):**
  - **Smart Farming Assistant & Vision:** `@google/genai` (`gemini-4-hydrogen`) with farm-context injection and graceful offline agronomic fallback
  - **Weather Forecast:** OpenWeatherMap API (`OPENWEATHER_API_KEY`) with automatic Open-Meteo live fallback and manual entry mode
  - **Reports:** Server-side PDF generation via `pdfkit` (`reports/`), CSV export, and ZIP packaging (`jszip`)

## Multilingual Support (6 Languages)

- English (`en`)
- Telugu (`te` — తెలుగు)
- Hindi (`hi` — हिन्दी)
- Tamil (`ta` — தமிழ்)
- Kannada (`kn` — ಕನ್ನಡ)
- Malayalam (`ml` — മലയാളം)

## Local Setup & Execution

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment variables in `.env` (see `.env.example`):
   - `GEMINI_API_KEY` (optional for offline ML, required for live Gemini chatbot & vision)
   - `OPENWEATHER_API_KEY` (optional; falls back to Open-Meteo automatically)
   - `SESSION_SECRET`
3. Start the full-stack development server:
   ```bash
   npm run dev
   ```
   On first boot, AgriSense generates the CSV datasets in `datasets/`, trains and evaluates the ML models (saving `trained_models/models_bundle.json`), initializes `database/database.db`, and seeds sample farmer records.
4. Open `http://localhost:3000` in your browser.

## Sample Login Credentials

- **Email / Username:** `arjun@greenfield.ag` (or `arjun_farmer`)
- **Password:** `Farmer@2026`
- Or click **"Sign In with Demo Farmer Account"** on the Login page, or register a new farmer account.

## Build & Type Verification

```bash
npm run lint
npm run build
```
