import React, { useEffect, useState } from 'react';
import { ActiveFarmBanner } from '../components/ActiveFarmBanner';
import { AgroBarChart } from '../components/Charts';
import { useApp } from '../context/AppContext';

const ALL_CROPS = [
  'rice', 'maize', 'chickpea', 'kidneybeans', 'pigeonpeas', 'mungbean',
  'blackgram', 'lentil', 'pomegranate', 'banana', 'mango', 'grapes',
  'watermelon', 'muskmelon', 'apple', 'orange', 'papaya', 'coconut', 'cotton', 'jute', 'coffee',
];

export const ComparisonPage: React.FC = () => {
  const { activeBundle, apiFetch, tr } = useApp();
  const [selectedCrops, setSelectedCrops] = useState<string[]>(['rice', 'maize', 'cotton', 'chickpea']);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const runComparison = async (cropsList = selectedCrops) => {
    if (!activeBundle) return;
    setLoading(true);
    try {
      const res = await apiFetch('/api/compare-crops', {
        method: 'POST',
        body: JSON.stringify({ farmId: activeBundle.farm.id, crops: cropsList }),
      });
      if (res.ok) {
        const data = await res.json();
        setRows(data.comparisons || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeBundle) {
      const defaults = activeBundle.cropRecommendation.alternatives.slice(0, 4).map((a) => a.crop);
      if (defaults.length >= 2) {
        setSelectedCrops(defaults);
        runComparison(defaults);
      } else {
        runComparison();
      }
    }
  }, [activeBundle?.farm.id]);

  const toggleCrop = (c: string) => {
    if (selectedCrops.includes(c)) {
      if (selectedCrops.length <= 2) return;
      setSelectedCrops(selectedCrops.filter((x) => x !== c));
    } else if (selectedCrops.length < 4) {
      setSelectedCrops([...selectedCrops, c]);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0D3B26]">{tr('navComparison')}</h1>
        <p className="text-sm text-emerald-900/75 mt-0.5">
          Compare up to 4 crops side by side on soil suitability, water demand, expected yield, expenses, and profitability.
        </p>
      </div>

      <ActiveFarmBanner />

      {activeBundle && (
        <>
          <div className="rounded-xl bg-white border border-emerald-200/80 p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-[#0D3B26]">Select 2–4 Crops to Compare</div>
              <button
                onClick={() => runComparison()}
                disabled={loading}
                className="px-4 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800"
              >
                {loading ? 'Comparing...' : 'Update Comparison'}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ALL_CROPS.map((c) => {
                const active = selectedCrops.includes(c);
                return (
                  <button
                    key={c}
                    onClick={() => toggleCrop(c)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize border transition-colors ${
                      active
                        ? 'bg-[#0D3B26] text-white border-[#0D3B26]'
                        : 'bg-[#F5F8F6] text-emerald-950 border-emerald-200 hover:border-emerald-400'
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          {rows.length > 0 && (
            <>
              <div className="rounded-xl bg-white border border-emerald-200/80 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#F5F8F6] text-xs text-emerald-900">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold">Crop</th>
                      <th className="text-right px-4 py-3 font-semibold">Suitability</th>
                      <th className="text-left px-4 py-3 font-semibold">Water Need</th>
                      <th className="text-right px-4 py-3 font-semibold">Expected Yield</th>
                      <th className="text-right px-4 py-3 font-semibold">Est. Cost (INR)</th>
                      <th className="text-right px-4 py-3 font-semibold">Est. Profit (INR)</th>
                      <th className="text-left px-4 py-3 font-semibold">Ideal Conditions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-100">
                    {rows.map((r) => (
                      <tr key={r.crop} className="hover:bg-[#F5F8F6]/60">
                        <td className="px-4 py-3 font-semibold text-[#0D3B26]">
                          {r.displayName}
                          <div className="text-xs font-normal text-emerald-800/75">
                            {r.season} · {r.durationDays}d
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-emerald-800">
                          {r.suitabilityScore}%
                        </td>
                        <td className="px-4 py-3 text-xs font-mono">
                          {r.waterRequirement} ({r.weeklyWaterMm} mm/wk)
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">
                          {r.yieldTonnesPerHa} t/ha
                          <div className="text-xs text-emerald-800/75">{r.totalQuintals} q total</div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">
                          {r.estimatedCostInr.toLocaleString('en-IN')}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-mono tabular-nums font-semibold ${
                            r.estimatedProfitInr >= 0 ? 'text-emerald-800' : 'text-red-700'
                          }`}
                        >
                          {r.estimatedProfitInr.toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3 text-xs text-emerald-950/80">{r.growingConditions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid lg:grid-cols-2 gap-5">
                <div className="rounded-xl bg-white border border-emerald-200/80 p-5">
                  <h3 className="font-display text-base font-bold text-[#0D3B26] mb-3">Suitability Score (%)</h3>
                  <div className="h-56">
                    <AgroBarChart
                      labels={rows.map((r) => r.displayName)}
                      values={rows.map((r) => r.suitabilityScore)}
                      datasetLabel="Suitability"
                      unit="%"
                    />
                  </div>
                </div>
                <div className="rounded-xl bg-white border border-emerald-200/80 p-5">
                  <h3 className="font-display text-base font-bold text-[#0D3B26] mb-3">Estimated Net Profit (INR)</h3>
                  <div className="h-56">
                    <AgroBarChart
                      labels={rows.map((r) => r.displayName)}
                      values={rows.map((r) => r.estimatedProfitInr)}
                      datasetLabel="Est. Profit"
                      unit="INR"
                      colors={rows.map((r) => (r.estimatedProfitInr >= 0 ? '#15803D' : '#DC2626'))}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};
