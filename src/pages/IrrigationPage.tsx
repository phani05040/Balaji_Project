import React, { useState } from 'react';
import { Droplets } from 'lucide-react';
import { ActiveFarmBanner } from '../components/ActiveFarmBanner';
import { useApp } from '../context/AppContext';

export const IrrigationPage: React.FC = () => {
  const { activeBundle, tr, translateDynamic } = useApp();
  const [translatedExp, setTranslatedExp] = useState('');
  const [translating, setTranslating] = useState(false);

  const irr = activeBundle?.irrigationPlan;

  const handleTranslate = async () => {
    if (!irr) return;
    setTranslating(true);
    const [tExp] = await translateDynamic([irr.explanation]);
    setTranslatedExp(tExp);
    setTranslating(false);
  };

  const levelBadgeClass =
    irr?.level === 'HIGH'
      ? 'bg-red-50 text-red-800 border-red-200'
      : irr?.level === 'MODERATE'
      ? 'bg-amber-50 text-amber-900 border-amber-200'
      : 'bg-emerald-100 text-emerald-900 border-emerald-300';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0D3B26]">{tr('navIrrigation')}</h1>
        <p className="text-sm text-emerald-900/75 mt-0.5">
          Water demand modeling computed automatically from your farm rainfall, humidity, temperature, and crop Kc coefficient.
        </p>
      </div>

      <ActiveFarmBanner
        onTranslate={handleTranslate}
        translating={translating}
        readAloudText={irr ? `Irrigation requirement is ${irr.level}. ${translatedExp || irr.explanation}` : undefined}
      />

      {irr && activeBundle && (
        <>
          <div className="rounded-xl bg-[#F0FDF4] border border-emerald-300 p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-[#0D3B26] text-white flex items-center justify-center">
                  <Droplets className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-xs font-medium text-emerald-800 capitalize">
                    Crop: {irr.crop} · Area: {activeBundle.farm.areaAcres} acres
                  </div>
                  <h2 className="font-display text-xl font-bold text-[#0D3B26]">
                    Irrigation Requirement: {irr.level}
                  </h2>
                </div>
              </div>
              <div className={`px-3.5 py-1.5 rounded-lg border text-sm font-bold font-mono ${levelBadgeClass}`}>
                {irr.level} DEMAND
              </div>
            </div>

            <p className="text-sm text-emerald-950 leading-relaxed">{translatedExp || irr.explanation}</p>

            <div className="grid sm:grid-cols-3 gap-4 pt-2">
              <div className="rounded-lg bg-white border border-emerald-200 p-4">
                <div className="text-xs text-emerald-800">Weekly Irrigation Need</div>
                <div className="font-mono text-xl font-bold text-[#0D3B26] mt-1 tabular-nums">
                  {irr.estimatedWeeklyMm} mm/week
                </div>
              </div>
              <div className="rounded-lg bg-white border border-emerald-200 p-4">
                <div className="text-xs text-emerald-800">Seasonal Water Deficit</div>
                <div className="font-mono text-xl font-bold text-[#0D3B26] mt-1 tabular-nums">
                  {irr.estimatedSeasonalMm} mm
                </div>
              </div>
              <div className="rounded-lg bg-white border border-emerald-200 p-4">
                <div className="text-xs text-emerald-800">Estimated Plot Volume</div>
                <div className="font-mono text-xl font-bold text-[#0D3B26] mt-1 tabular-nums">
                  {irr.estimatedTotalLitersPerWeek.toLocaleString()} L/wk
                </div>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <div className="rounded-xl bg-white border border-emerald-200/80 p-5 space-y-3">
              <h3 className="font-display text-base font-bold text-[#0D3B26]">Water Management Guidance</h3>
              <ul className="space-y-2 text-sm text-emerald-950/85">
                {irr.waterManagementAdvice.map((item, i) => (
                  <li key={i}>· {item}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl bg-white border border-emerald-200/80 p-5 space-y-3">
              <h3 className="font-display text-base font-bold text-[#0D3B26]">Recommended Water-Saving Techniques</h3>
              <ul className="space-y-2 text-sm text-emerald-950/85">
                {irr.waterSavingTechniques.map((item, i) => (
                  <li key={i}>· {item}</li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
