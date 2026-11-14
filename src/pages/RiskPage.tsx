import React, { useState } from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { ActiveFarmBanner } from '../components/ActiveFarmBanner';
import { useApp } from '../context/AppContext';

export const RiskPage: React.FC = () => {
  const { activeBundle, tr, translateDynamic } = useApp();
  const [translatedSummary, setTranslatedSummary] = useState('');
  const [translating, setTranslating] = useState(false);

  const risk = activeBundle?.riskAssessment;

  const handleTranslate = async () => {
    if (!risk) return;
    setTranslating(true);
    const [tSum] = await translateDynamic([risk.managementSummary]);
    setTranslatedSummary(tSum);
    setTranslating(false);
  };

  const levelStyles = (lvl: string) => {
    if (lvl === 'HIGH') return 'text-red-800 bg-red-50 border-red-200';
    if (lvl === 'MODERATE') return 'text-amber-900 bg-amber-50 border-amber-200';
    return 'text-emerald-900 bg-emerald-50 border-emerald-200';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0D3B26]">{tr('navRisk')}</h1>
        <p className="text-sm text-emerald-900/75 mt-0.5">
          Evaluates rainfall extremes, thermal stress, soil fertility, nutrient deficiencies, pH suitability, and water stress.
        </p>
      </div>

      <ActiveFarmBanner
        onTranslate={handleTranslate}
        translating={translating}
        readAloudText={risk ? `Overall agricultural risk is ${risk.overallLevel}. ${translatedSummary || risk.managementSummary}` : undefined}
      />

      {risk && (
        <>
          <div className="rounded-xl bg-[#F0FDF4] border border-emerald-300 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-xl bg-[#0D3B26] text-white flex items-center justify-center shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <div className="text-xs font-medium text-emerald-800">
                  Risk Index: <span className="font-mono">{risk.riskScore}/100</span>
                </div>
                <h2 className="font-display text-xl font-bold text-[#0D3B26]">
                  Overall Risk Level: {risk.overallLevel}
                </h2>
                <p className="text-sm text-emerald-950 mt-1">{translatedSummary || risk.managementSummary}</p>
              </div>
            </div>
            <div className={`px-4 py-2 rounded-lg border text-sm font-bold font-mono shrink-0 ${levelStyles(risk.overallLevel)}`}>
              {risk.overallLevel} RISK
            </div>
          </div>

          {/* 8-Factor Table */}
          <div className="rounded-xl bg-white border border-emerald-200/80 overflow-hidden">
            <div className="px-5 py-4 border-b border-emerald-100">
              <h3 className="font-display text-base font-bold text-[#0D3B26]">8-Factor Agricultural Risk Breakdown</h3>
            </div>
            <div className="divide-y divide-emerald-100">
              {risk.factors.map((f, i) => (
                <div key={i} className="p-4 sm:px-5 grid md:grid-cols-12 gap-3 items-start text-sm">
                  <div className="md:col-span-3 font-semibold text-[#0D3B26]">{f.factor}</div>
                  <div className="md:col-span-2">
                    <span className={`inline-block px-2.5 py-0.5 rounded border text-xs font-mono font-semibold ${levelStyles(f.level)}`}>
                      {f.level}
                    </span>
                  </div>
                  <div className="md:col-span-4 text-emerald-950/85">{f.reason}</div>
                  <div className="md:col-span-3 text-xs text-emerald-900 bg-[#F5F8F6] rounded-lg p-2.5">
                    <strong>Action:</strong> {f.correctiveAction}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-white border border-emerald-200/80 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-700" />
              <h3 className="font-display text-base font-bold text-[#0D3B26]">Preventive Risk Management Practices</h3>
            </div>
            <ul className="grid sm:grid-cols-2 gap-2.5 text-sm text-emerald-950/85">
              {risk.preventivePractices.map((p, i) => (
                <li key={i} className="p-3 rounded-lg bg-[#F5F8F6]">
                  · {p}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
};
