import React, { useState } from 'react';
import { FlaskConical, RefreshCw } from 'lucide-react';
import { ActiveFarmBanner } from '../components/ActiveFarmBanner';
import { useApp } from '../context/AppContext';

const CROP_OPTIONS = [
  'rice', 'maize', 'chickpea', 'kidneybeans', 'pigeonpeas', 'mungbean',
  'blackgram', 'lentil', 'pomegranate', 'banana', 'mango', 'grapes',
  'watermelon', 'muskmelon', 'apple', 'orange', 'papaya', 'coconut', 'cotton', 'jute', 'coffee',
];

export const FertilizerPage: React.FC = () => {
  const { activeBundle, setActiveBundle, apiFetch, tr, translateDynamic } = useApp();
  const [updatingCrop, setUpdatingCrop] = useState(false);
  const [translatedExp, setTranslatedExp] = useState('');
  const [translating, setTranslating] = useState(false);

  const recomputeForCrop = async (cropName: string) => {
    if (!activeBundle) return;
    setUpdatingCrop(true);
    setTranslatedExp('');
    try {
      const res = await apiFetch(`/api/farms/${activeBundle.farm.id}/recompute`, {
        method: 'POST',
        body: JSON.stringify({ cropName }),
      });
      if (res.ok) setActiveBundle(await res.json());
    } finally {
      setUpdatingCrop(false);
    }
  };

  const fert = activeBundle?.fertilizerRecommendation;

  const handleTranslate = async () => {
    if (!fert) return;
    setTranslating(true);
    const [tExp] = await translateDynamic([fert.explanation]);
    setTranslatedExp(tExp);
    setTranslating(false);
  };

  const statusColor = (status: string) => {
    if (status === 'Optimal') return 'text-emerald-800';
    if (status === 'Deficient' || status === 'Acidic') return 'text-amber-700 font-semibold';
    return 'text-red-700 font-semibold';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0D3B26]">{tr('navFertilizer')}</h1>
          <p className="text-sm text-emerald-900/75 mt-0.5">
            Automated nutrient gap diagnosis and organic/chemical alternatives using your active farm soil profile.
          </p>
        </div>
        {fert && (
          <div className="flex items-center gap-2 shrink-0">
            <label className="text-xs font-medium text-emerald-900">Evaluate Crop:</label>
            <select
              value={fert.crop}
              disabled={updatingCrop}
              onChange={(e) => recomputeForCrop(e.target.value)}
              className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-sm font-medium text-[#0D3B26] capitalize"
            >
              {CROP_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {updatingCrop && <RefreshCw className="h-4 w-4 animate-spin text-emerald-700" />}
          </div>
        )}
      </div>

      <ActiveFarmBanner
        onTranslate={handleTranslate}
        translating={translating}
        readAloudText={fert ? `${fert.recommendedFertilizer}. ${translatedExp || fert.explanation}` : undefined}
      />

      {fert && (
        <>
          <div className="rounded-xl bg-[#F0FDF4] border border-emerald-300 p-6 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-[#0D3B26] text-white flex items-center justify-center shrink-0">
                  <FlaskConical className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-medium text-emerald-800 capitalize">
                    Target Crop: {fert.crop} · Model Confidence {fert.confidenceScore}%
                  </div>
                  <h2 className="font-display text-xl font-bold text-[#0D3B26]">{fert.recommendedFertilizer}</h2>
                </div>
              </div>
            </div>
            <p className="text-sm text-emerald-950 leading-relaxed">{translatedExp || fert.explanation}</p>
          </div>

          {/* Nutrient Imbalance Table */}
          <div className="rounded-xl bg-white border border-emerald-200/80 overflow-hidden">
            <div className="px-5 py-4 border-b border-emerald-100">
              <h3 className="font-display text-base font-bold text-[#0D3B26]">Soil Nutrient & pH Diagnostic</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#F5F8F6] text-xs text-emerald-900">
                  <tr>
                    <th className="text-left px-5 py-3 font-semibold">Parameter</th>
                    <th className="text-right px-5 py-3 font-semibold">Measured Value</th>
                    <th className="text-right px-5 py-3 font-semibold">Crop Target Range</th>
                    <th className="text-left px-5 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-100">
                  <tr>
                    <td className="px-5 py-3 font-medium text-[#0D3B26]">Nitrogen (N)</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums">{fert.nutrientStatus.nitrogen.value} kg/ha</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums">{fert.nutrientStatus.nitrogen.targetRange}</td>
                    <td className={`px-5 py-3 ${statusColor(fert.nutrientStatus.nitrogen.status)}`}>{fert.nutrientStatus.nitrogen.status}</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-3 font-medium text-[#0D3B26]">Phosphorus (P)</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums">{fert.nutrientStatus.phosphorus.value} kg/ha</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums">{fert.nutrientStatus.phosphorus.targetRange}</td>
                    <td className={`px-5 py-3 ${statusColor(fert.nutrientStatus.phosphorus.status)}`}>{fert.nutrientStatus.phosphorus.status}</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-3 font-medium text-[#0D3B26]">Potassium (K)</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums">{fert.nutrientStatus.potassium.value} kg/ha</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums">{fert.nutrientStatus.potassium.targetRange}</td>
                    <td className={`px-5 py-3 ${statusColor(fert.nutrientStatus.potassium.status)}`}>{fert.nutrientStatus.potassium.status}</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-3 font-medium text-[#0D3B26]">Soil pH</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums">{fert.nutrientStatus.ph.value}</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums">{fert.nutrientStatus.ph.targetRange}</td>
                    <td className={`px-5 py-3 ${statusColor(fert.nutrientStatus.ph.status)}`}>{fert.nutrientStatus.ph.status}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <div className="rounded-xl bg-white border border-emerald-200/80 p-5 space-y-3">
              <h3 className="font-display text-base font-bold text-[#0D3B26]">Chemical Fertilizer Options</h3>
              <ul className="space-y-2 text-sm text-emerald-950/85">
                {fert.chemicalAlternatives.map((item, i) => (
                  <li key={i}>· {item}</li>
                ))}
              </ul>
              <div className="pt-3 border-t border-emerald-100">
                <h4 className="text-xs font-semibold text-[#0D3B26] mb-1.5">Application Best Practices</h4>
                <ul className="space-y-1 text-xs text-emerald-900/80">
                  {fert.applicationGuidance.map((g, i) => (
                    <li key={i}>· {g}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="rounded-xl bg-white border border-emerald-200/80 p-5 space-y-3">
              <h3 className="font-display text-base font-bold text-[#0D3B26]">Organic & Bio-Fertilizer Alternatives</h3>
              <ul className="space-y-2 text-sm text-emerald-950/85">
                {fert.organicAlternatives.map((item, i) => (
                  <li key={i}>· {item}</li>
                ))}
              </ul>
              <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-950 leading-relaxed">
                {fert.responsibleUsageNote}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
