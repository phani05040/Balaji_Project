import React, { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { ActiveFarmBanner } from '../components/ActiveFarmBanner';
import { AgroBarChart } from '../components/Charts';
import { useApp } from '../context/AppContext';

export const YieldPage: React.FC = () => {
  const { activeBundle, tr, translateDynamic } = useApp();
  const [translatedExp, setTranslatedExp] = useState('');
  const [translating, setTranslating] = useState(false);

  const y = activeBundle?.yieldPrediction;

  const handleTranslate = async () => {
    if (!y) return;
    setTranslating(true);
    const [tExp] = await translateDynamic([y.explanation]);
    setTranslatedExp(tExp);
    setTranslating(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0D3B26]">{tr('navYield')}</h1>
        <p className="text-sm text-emerald-900/75 mt-0.5">
          Machine learning regression yield estimates across your plot acreage with crop-to-crop yield comparison.
        </p>
      </div>

      <ActiveFarmBanner
        onTranslate={handleTranslate}
        translating={translating}
        readAloudText={y ? translatedExp || y.explanation : undefined}
      />

      {y && (
        <>
          <div className="rounded-xl bg-[#F0FDF4] border border-emerald-300 p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-[#0D3B26] text-white flex items-center justify-center">
                  <BarChart3 className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-xs font-medium text-emerald-800">
                    Random Forest Regressor · R² = {y.modelMetrics.r2} · RMSE = {y.modelMetrics.rmse} t/ha
                  </div>
                  <h2 className="font-display text-xl font-bold text-[#0D3B26]">
                    Expected Production for {y.displayName}
                  </h2>
                </div>
              </div>
            </div>

            <p className="text-sm text-emerald-950 leading-relaxed">{translatedExp || y.explanation}</p>

            <div className="grid sm:grid-cols-4 gap-4">
              <div className="rounded-lg bg-white border border-emerald-200 p-4">
                <div className="text-xs text-emerald-800">Yield Rate (Metric)</div>
                <div className="font-mono text-xl font-bold text-[#0D3B26] mt-1 tabular-nums">
                  {y.yieldTonnesPerHa} t/ha
                </div>
              </div>
              <div className="rounded-lg bg-white border border-emerald-200 p-4">
                <div className="text-xs text-emerald-800">Yield Rate (Per Acre)</div>
                <div className="font-mono text-xl font-bold text-[#0D3B26] mt-1 tabular-nums">
                  {y.yieldQuintalsPerAcre} q/ac
                </div>
              </div>
              <div className="rounded-lg bg-white border border-emerald-200 p-4">
                <div className="text-xs text-emerald-800">Total Production (Tonnes)</div>
                <div className="font-mono text-xl font-bold text-[#0D3B26] mt-1 tabular-nums">
                  {y.totalEstimatedTonnes} t
                </div>
              </div>
              <div className="rounded-lg bg-white border border-emerald-200 p-4">
                <div className="text-xs text-emerald-800">Total Production (Quintals)</div>
                <div className="font-mono text-xl font-bold text-[#0D3B26] mt-1 tabular-nums">
                  {y.totalEstimatedQuintals} q
                </div>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7 rounded-xl bg-white border border-emerald-200/80 p-5">
              <h3 className="font-display text-base font-bold text-[#0D3B26] mb-1">
                Predicted Yield Comparison Across Suitable Crops
              </h3>
              <p className="text-xs text-emerald-800/75 mb-4">Tonnes per hectare under your identical soil & weather profile</p>
              <div className="h-64">
                <AgroBarChart
                  labels={y.cropComparisons.map((c) => c.displayName)}
                  values={y.cropComparisons.map((c) => c.yieldTonnesPerHa)}
                  datasetLabel="Predicted Yield"
                  unit="t/ha"
                />
              </div>
            </div>

            <div className="lg:col-span-5 rounded-xl bg-white border border-emerald-200/80 p-5 space-y-3">
              <h3 className="font-display text-base font-bold text-[#0D3B26]">Key Yield Drivers</h3>
              <div className="divide-y divide-emerald-100">
                {y.limitingFactors.map((f, i) => (
                  <div key={i} className="py-2.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-[#0D3B26]">{f.factor}</span>
                      <span
                        className={`text-xs font-semibold ${
                          f.impact === 'Positive'
                            ? 'text-emerald-700'
                            : f.impact === 'Limiting'
                            ? 'text-amber-700'
                            : 'text-slate-600'
                        }`}
                      >
                        {f.impact}
                      </span>
                    </div>
                    <div className="text-xs text-emerald-900/75 mt-0.5 font-mono">{f.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
