import React, { useEffect, useState } from 'react';
import { Cpu, Database, Globe, ShieldCheck } from 'lucide-react';
import { AgroBarChart } from '../components/Charts';

export const AboutPage: React.FC = () => {
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    fetch('/api/ml-metrics')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setMetrics(d))
      .catch(() => {});
  }, []);

  const importanceEntries = metrics?.cropModel?.featureImportances
    ? Object.entries(metrics.cropModel.featureImportances as Record<string, number>)
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0D3B26]">
          About AgriSense — Intelligent Crop Planning & Farm Decision Support
        </h1>
        <p className="text-sm text-emerald-900/75 mt-1 max-w-3xl">
          An end-to-end agricultural decision support architecture combining supervised machine learning, FAO crop water balance modeling, live meteorological APIs, multilingual speech interaction, and multimodal leaf diagnostics.
        </p>
      </div>

      {metrics && (
        <div className="grid md:grid-cols-3 gap-5">
          <div className="rounded-xl bg-white border border-emerald-200/80 p-5 space-y-2">
            <div className="flex items-center gap-2 text-emerald-800 text-xs font-semibold">
              <Cpu className="h-4 w-4" /> Crop Classification Model
            </div>
            <div className="font-display text-lg font-bold text-[#0D3B26]">{metrics.cropModel.algorithm}</div>
            <div className="font-mono text-sm text-emerald-900 space-y-1 pt-1 tabular-nums">
              <div>Test Accuracy: {metrics.cropModel.metrics.accuracy}%</div>
              <div>Macro F1 Score: {metrics.cropModel.metrics.macroF1}%</div>
              <div>
                Split: {metrics.cropModel.metrics.trainSamples} train / {metrics.cropModel.metrics.testSamples} test ({metrics.cropModel.classesCount} crops)
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white border border-emerald-200/80 p-5 space-y-2">
            <div className="flex items-center gap-2 text-emerald-800 text-xs font-semibold">
              <Database className="h-4 w-4" /> Fertilizer Decision Model
            </div>
            <div className="font-display text-lg font-bold text-[#0D3B26]">{metrics.fertilizerModel.algorithm}</div>
            <div className="font-mono text-sm text-emerald-900 space-y-1 pt-1 tabular-nums">
              <div>Test Accuracy: {metrics.fertilizerModel.metrics.accuracy}%</div>
              <div>Macro F1 Score: {metrics.fertilizerModel.metrics.macroF1}%</div>
              <div>
                Split: {metrics.fertilizerModel.metrics.trainSamples} train / {metrics.fertilizerModel.metrics.testSamples} test ({metrics.fertilizerModel.classesCount} classes)
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white border border-emerald-200/80 p-5 space-y-2">
            <div className="flex items-center gap-2 text-emerald-800 text-xs font-semibold">
              <Globe className="h-4 w-4" /> Yield Regression Model
            </div>
            <div className="font-display text-lg font-bold text-[#0D3B26]">{metrics.yieldModel.algorithm}</div>
            <div className="font-mono text-sm text-emerald-900 space-y-1 pt-1 tabular-nums">
              <div>R² Score: {metrics.yieldModel.metrics.r2}</div>
              <div>RMSE: {metrics.yieldModel.metrics.rmse} t/ha · MAE: {metrics.yieldModel.metrics.mae} t/ha</div>
              <div>
                Split: {metrics.yieldModel.metrics.trainSamples} train / {metrics.yieldModel.metrics.testSamples} test
              </div>
            </div>
          </div>
        </div>
      )}

      {importanceEntries.length > 0 && (
        <div className="rounded-xl bg-white border border-emerald-200/80 p-5">
          <h2 className="font-display text-base font-bold text-[#0D3B26] mb-1">
            Crop Model Feature Importances (Gini Reduction)
          </h2>
          <p className="text-xs text-emerald-800/75 mb-4">Relative contribution of each soil and climate parameter</p>
          <div className="h-56">
            <AgroBarChart
              labels={importanceEntries.map(([k]) => k)}
              values={importanceEntries.map(([, v]) => v)}
              datasetLabel="Importance"
              unit="%"
            />
          </div>
        </div>
      )}

      <div className="rounded-xl bg-[#F0FDF4] border border-emerald-200 p-5 space-y-2 text-sm text-emerald-950">
        <div className="flex items-center gap-2 font-display font-bold text-[#0D3B26]">
          <ShieldCheck className="h-5 w-5 text-emerald-700" />
          <span>Responsible Agronomy & Scientific Boundaries</span>
        </div>
        <p className="leading-relaxed">
          All machine learning predictions, indicative soil health scores, and leaf disease screens are decision-support estimates designed to assist agricultural planning. Farmers should confirm exact bulk chemical dosages and persistent crop pathology with certified soil testing laboratories and regional agricultural extension officers.
        </p>
      </div>
    </div>
  );
};
