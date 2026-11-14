import React, { useState } from 'react';
import { CloudSun, RotateCcw, Sprout, Volume2, Languages } from 'lucide-react';
import { AgroBarChart } from '../components/Charts';
import { useApp } from '../context/AppContext';
import { FarmBundle, WeatherInfo } from '../types';

const SUPPORTED_CROPS = [
  'rice', 'maize', 'chickpea', 'kidneybeans', 'pigeonpeas', 'mothbeans', 'mungbean',
  'blackgram', 'lentil', 'pomegranate', 'banana', 'mango', 'grapes',
  'watermelon', 'muskmelon', 'apple', 'orange', 'papaya', 'coconut', 'cotton', 'jute', 'coffee',
];

export const CropPage: React.FC = () => {
  const { user, activeBundle, setActiveBundle, refreshFarms, apiFetch, tr, language, speakText, translateDynamic, setPage } = useApp();

  const [farmName, setFarmName] = useState(activeBundle?.farm.farmName || 'South Field Plot');
  const [location, setLocation] = useState(activeBundle?.farm.location || user?.location || 'Guntur, Andhra Pradesh');
  const [targetCrop, setTargetCrop] = useState<string>('auto');
  const [customCrop, setCustomCrop] = useState<string>('');
  const [areaAcres, setAreaAcres] = useState(String(activeBundle?.farm.areaAcres ?? 3.5));
  const [nitrogen, setNitrogen] = useState(String(activeBundle?.farm.nitrogen ?? 80));
  const [phosphorus, setPhosphorus] = useState(String(activeBundle?.farm.phosphorus ?? 45));
  const [potassium, setPotassium] = useState(String(activeBundle?.farm.potassium ?? 38));
  const [ph, setPh] = useState(String(activeBundle?.farm.ph ?? 6.5));
  const [temperature, setTemperature] = useState(String(activeBundle?.farm.temperature ?? 25.5));
  const [humidity, setHumidity] = useState(String(activeBundle?.farm.humidity ?? 78));
  const [rainfall, setRainfall] = useState(String(activeBundle?.farm.rainfall ?? 195));

  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [translatedNotes, setTranslatedNotes] = useState<{ exp: string; guide: string } | null>(null);
  const [translating, setTranslating] = useState(false);

  const clearForm = () => {
    setFarmName('');
    setLocation('');
    setTargetCrop('auto');
    setCustomCrop('');
    setAreaAcres('');
    setNitrogen('');
    setPhosphorus('');
    setPotassium('');
    setPh('');
    setTemperature('');
    setHumidity('');
    setRainfall('');
    setWeather(null);
    setError('');
  };

  const fetchWeather = async () => {
    setWeatherLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/api/weather?location=${encodeURIComponent(location || 'Guntur')}`);
      if (res.ok) {
        const w = (await res.json()) as WeatherInfo;
        setWeather(w);
        if (w.available && w.current) {
          setTemperature(String(w.current.temperature));
          setHumidity(String(w.current.humidity));
          setRainfall(String(w.current.rainfall));
        }
      }
    } catch {
      setError('Weather service unreachable. You can enter temperature, humidity, and rainfall manually.');
    } finally {
      setWeatherLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    setTranslatedNotes(null);
    const resolvedCrop = targetCrop === 'custom' ? customCrop.trim().toLowerCase() : targetCrop;

    try {
      const res = await apiFetch('/api/farms', {
        method: 'POST',
        body: JSON.stringify({
          farmName,
          location,
          targetCrop: resolvedCrop || 'auto',
          areaAcres: Number(areaAcres),
          nitrogen: Number(nitrogen),
          phosphorus: Number(phosphorus),
          potassium: Number(potassium),
          ph: Number(ph),
          temperature: Number(temperature),
          humidity: Number(humidity),
          rainfall: Number(rainfall),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Unable to process farm analysis.');
      } else {
        setActiveBundle(data as FarmBundle);
        await refreshFarms();
      }
    } catch {
      setError('Network error submitting soil analysis.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTranslate = async () => {
    if (!activeBundle) return;
    setTranslating(true);
    const [exp, guide] = await translateDynamic([
      activeBundle.cropRecommendation.explanation,
      activeBundle.cropRecommendation.cultivationGuide.guide,
    ]);
    setTranslatedNotes({ exp, guide });
    setTranslating(false);
  };

  const rec = activeBundle?.cropRecommendation;
  const health = activeBundle?.soilHealth;
  const evaluatedCrop = activeBundle?.fertilizerRecommendation?.crop || rec?.recommendedCrop;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0D3B26]">{tr('navCrop')}</h1>
          <p className="text-sm text-emerald-900/75 mt-0.5">
            Enter your soil and climate details to predict the best crop—or select/enter your own crop to evaluate Fertilizer, Irrigation, Yield, and Risk for it.
          </p>
        </div>
        {rec && (
          <div className="flex items-center gap-2 shrink-0">
            {language !== 'en' && (
              <button
                onClick={handleTranslate}
                disabled={translating}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-emerald-300 text-xs font-semibold text-emerald-900 hover:bg-emerald-50"
              >
                <Languages className="h-3.5 w-3.5" />
                <span>{translating ? tr('translatingLabel') : tr('translatePageBtn')}</span>
              </button>
            )}
            <button
              onClick={() => speakText(translatedNotes?.exp || rec.explanation)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800"
            >
              <Volume2 className="h-3.5 w-3.5" />
              <span>{tr('speakBtn')}</span>
            </button>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* Intake Form */}
        <form onSubmit={handleSubmit} className="lg:col-span-5 rounded-xl bg-white border border-emerald-200/80 p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-base font-bold text-[#0D3B26]">Farm, Crop & Soil Inputs</h2>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={clearForm}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-emerald-200 text-xs font-medium text-emerald-900 hover:bg-emerald-50"
                title="Clear all form fields"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Clear</span>
              </button>
              <button
                type="button"
                onClick={fetchWeather}
                disabled={weatherLoading}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#F0FDF4] border border-emerald-300 text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
              >
                <CloudSun className="h-3.5 w-3.5" />
                <span>{weatherLoading ? 'Fetching...' : tr('fetchWeatherBtn')}</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-800">{error}</div>
          )}

          {weather && (
            <div
              className={`rounded-lg border px-3 py-2.5 text-xs ${
                weather.available
                  ? 'bg-[#F0FDF4] border-emerald-200 text-emerald-950'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              <div className="font-semibold">
                {weather.available
                  ? `${weather.resolvedName} (${weather.provider}) · ${weather.current?.condition}`
                  : 'Live Weather Unavailable — Manual Entry Enabled'}
              </div>
              <p className="mt-1 opacity-90">{weather.cropPlanningImpact}</p>
            </div>
          )}

          {/* Explicit Crop Selection / Entry */}
          <div className="rounded-lg bg-[#F5F8F6] border border-emerald-200 p-3 space-y-2.5">
            <label className="block text-xs font-semibold text-[#0D3B26]">
              Planned Crop (Auto-Predict via ML or Enter Specific Crop)
            </label>
            <select
              value={targetCrop}
              onChange={(e) => setTargetCrop(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-emerald-300 bg-white font-medium text-[#0D3B26] capitalize focus:outline-none focus:border-emerald-700"
            >
              <option value="auto">Auto-Recommend Best Crop (ML Random Forest)</option>
              {SUPPORTED_CROPS.map((c) => (
                <option key={c} value={c}>
                  Evaluate Specific Crop: {c}
                </option>
              ))}
              <option value="custom">Enter Custom Crop Name...</option>
            </select>
            {targetCrop === 'custom' && (
              <input
                type="text"
                required
                value={customCrop}
                onChange={(e) => setCustomCrop(e.target.value)}
                placeholder="Type crop name (e.g., maize, cotton, rice)"
                className="w-full px-3 py-2 text-sm rounded-lg border border-emerald-300 bg-white focus:outline-none focus:border-emerald-700"
              />
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-[#0D3B26] mb-1">{tr('fieldFarmName')}</label>
              <input
                type="text"
                required
                value={farmName}
                onChange={(e) => setFarmName(e.target.value)}
                placeholder="e.g., East Canal Field"
                className="w-full px-3 py-2 text-sm rounded-lg border border-emerald-200 focus:outline-none focus:border-emerald-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#0D3B26] mb-1">{tr('fieldLocation')}</label>
              <input
                type="text"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., Guntur, Andhra Pradesh"
                className="w-full px-3 py-2 text-sm rounded-lg border border-emerald-200 focus:outline-none focus:border-emerald-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-[#0D3B26] mb-1">{tr('fieldArea')}</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                required
                value={areaAcres}
                onChange={(e) => setAreaAcres(e.target.value)}
                placeholder="3.5"
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-emerald-200 focus:outline-none focus:border-emerald-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#0D3B26] mb-1">{tr('fieldPh')}</label>
              <input
                type="number"
                step="0.1"
                min="3"
                max="10"
                required
                value={ph}
                onChange={(e) => setPh(e.target.value)}
                placeholder="6.5"
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-emerald-200 focus:outline-none focus:border-emerald-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#0D3B26] mb-1">{tr('fieldNitrogen')}</label>
              <input
                type="number"
                min="0"
                max="300"
                required
                value={nitrogen}
                onChange={(e) => setNitrogen(e.target.value)}
                placeholder="80"
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-emerald-200 focus:outline-none focus:border-emerald-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#0D3B26] mb-1">{tr('fieldPhosphorus')}</label>
              <input
                type="number"
                min="0"
                max="300"
                required
                value={phosphorus}
                onChange={(e) => setPhosphorus(e.target.value)}
                placeholder="45"
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-emerald-200 focus:outline-none focus:border-emerald-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#0D3B26] mb-1">{tr('fieldPotassium')}</label>
              <input
                type="number"
                min="0"
                max="350"
                required
                value={potassium}
                onChange={(e) => setPotassium(e.target.value)}
                placeholder="38"
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-emerald-200 focus:outline-none focus:border-emerald-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#0D3B26] mb-1">{tr('fieldTemp')}</label>
              <input
                type="number"
                step="0.1"
                required
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                placeholder="25.5"
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-emerald-200 focus:outline-none focus:border-emerald-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#0D3B26] mb-1">{tr('fieldHumidity')}</label>
              <input
                type="number"
                step="1"
                min="5"
                max="100"
                required
                value={humidity}
                onChange={(e) => setHumidity(e.target.value)}
                placeholder="78"
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-emerald-200 focus:outline-none focus:border-emerald-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#0D3B26] mb-1">{tr('fieldRainfall')}</label>
              <input
                type="number"
                step="1"
                min="0"
                max="3500"
                required
                value={rainfall}
                onChange={(e) => setRainfall(e.target.value)}
                placeholder="195"
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-emerald-200 focus:outline-none focus:border-emerald-700"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-lg bg-emerald-700 text-white text-sm font-semibold hover:bg-emerald-800 transition-colors disabled:opacity-60"
          >
            {submitting ? 'Running Random Forest Models...' : tr('saveAnalysis')}
          </button>
        </form>

        {/* Results Panel */}
        <div className="lg:col-span-7 space-y-5">
          {rec && health ? (
            <>
              {/* Recommended Crop Card */}
              <div className="rounded-xl bg-[#F0FDF4] border border-emerald-300 p-6 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-xl bg-[#0D3B26] text-white flex items-center justify-center shrink-0">
                      <Sprout className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-emerald-800">
                        Top ML Crop Recommendation · Test Accuracy {rec.modelMetrics.accuracy}%
                      </div>
                      <h2 className="font-display text-2xl font-bold text-[#0D3B26]">{rec.displayName}</h2>
                      {evaluatedCrop && evaluatedCrop !== rec.recommendedCrop && (
                        <div className="text-xs font-semibold text-emerald-900 mt-0.5 capitalize">
                          Downstream modules currently evaluating your selected crop: {evaluatedCrop}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-2xl font-bold text-emerald-800 tabular-nums">
                      {rec.confidenceScore}%
                    </div>
                    <div className="text-xs text-emerald-800/80">Suitability Score</div>
                  </div>
                </div>

                <p className="text-sm text-emerald-950 leading-relaxed">
                  {translatedNotes?.exp || rec.explanation}
                </p>

                <ul className="space-y-1.5 text-sm text-emerald-950/90">
                  {rec.reasons.map((r, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-emerald-700 font-bold">·</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>

                <div className="pt-3 border-t border-emerald-200 flex flex-wrap gap-2">
                  <button
                    onClick={() => setPage('fertilizer')}
                    className="px-3 py-1.5 rounded-lg bg-white border border-emerald-300 text-xs font-semibold text-[#0D3B26] hover:bg-emerald-50"
                  >
                    View Fertilizer Advice
                  </button>
                  <button
                    onClick={() => setPage('irrigation')}
                    className="px-3 py-1.5 rounded-lg bg-white border border-emerald-300 text-xs font-semibold text-[#0D3B26] hover:bg-emerald-50"
                  >
                    View Irrigation Plan
                  </button>
                  <button
                    onClick={() => setPage('yield')}
                    className="px-3 py-1.5 rounded-lg bg-white border border-emerald-300 text-xs font-semibold text-[#0D3B26] hover:bg-emerald-50"
                  >
                    View Yield Prediction
                  </button>
                  <button
                    onClick={() => setPage('risk')}
                    className="px-3 py-1.5 rounded-lg bg-white border border-emerald-300 text-xs font-semibold text-[#0D3B26] hover:bg-emerald-50"
                  >
                    View Risk Analysis
                  </button>
                </div>
              </div>

              {/* Alternatives Chart */}
              <div className="rounded-xl bg-white border border-emerald-200/80 p-5 space-y-3">
                <h3 className="font-display text-base font-bold text-[#0D3B26]">
                  Top 5 Suitable Crops Comparison
                </h3>
                <div className="h-56">
                  <AgroBarChart
                    horizontal
                    labels={rec.alternatives.map((a) => a.displayName)}
                    values={rec.alternatives.map((a) => a.suitabilityScore)}
                    datasetLabel="Suitability"
                    unit="%"
                    colors={['#15803D', '#16A34A', '#22C55E', '#65A30D', '#84CC16']}
                  />
                </div>
              </div>

              {/* Cultivation Guide + Soil Health Score */}
              <div className="grid sm:grid-cols-2 gap-5">
                <div className="rounded-xl bg-white border border-emerald-200/80 p-5 space-y-2.5">
                  <h3 className="font-display text-base font-bold text-[#0D3B26]">Cultivation Guidance</h3>
                  <div className="text-xs text-emerald-800">
                    {rec.cultivationGuide.season} · {rec.cultivationGuide.durationDays} days · Spacing {rec.cultivationGuide.spacing}
                  </div>
                  <p className="text-sm text-emerald-950/85 leading-relaxed">
                    {translatedNotes?.guide || rec.cultivationGuide.guide}
                  </p>
                  <div className="text-xs text-emerald-900/75 pt-1">
                    <strong>Harvest indicator:</strong> {rec.cultivationGuide.harvestSigns}
                  </div>
                </div>

                <div className="rounded-xl bg-white border border-emerald-200/80 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-base font-bold text-[#0D3B26]">Indicative Soil Health</h3>
                    <span className="font-mono text-lg font-bold text-[#0D3B26] tabular-nums">
                      {health.score}/100 · {health.rating}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2 rounded bg-[#F5F8F6]">N Index: {health.breakdown.nitrogenScore}%</div>
                    <div className="p-2 rounded bg-[#F5F8F6]">P Index: {health.breakdown.phosphorusScore}%</div>
                    <div className="p-2 rounded bg-[#F5F8F6]">K Index: {health.breakdown.potassiumScore}%</div>
                    <div className="p-2 rounded bg-[#F5F8F6]">pH Index: {health.breakdown.phScore}%</div>
                  </div>
                  <ul className="text-xs text-emerald-950/80 space-y-1">
                    {health.suggestions.map((s, i) => (
                      <li key={i}>· {s}</li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-emerald-800/75">{health.disclaimer}</p>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-xl bg-white border border-emerald-200/80 p-8 text-center text-sm text-emerald-900/75">
              Submit your farm and soil readings on the left to generate ML crop suitability rankings, soil health scores, and seasonal guidance.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
