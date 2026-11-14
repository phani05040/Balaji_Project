import React, { useState } from 'react';
import { Volume2, Languages, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';

const CROP_OPTIONS = [
  'rice', 'maize', 'chickpea', 'kidneybeans', 'pigeonpeas', 'mothbeans', 'mungbean',
  'blackgram', 'lentil', 'pomegranate', 'banana', 'mango', 'grapes',
  'watermelon', 'muskmelon', 'apple', 'orange', 'papaya', 'coconut', 'cotton', 'jute', 'coffee',
];

export const ActiveFarmBanner: React.FC<{
  onTranslate?: () => void;
  translating?: boolean;
  readAloudText?: string;
}> = ({ onTranslate, translating, readAloudText }) => {
  const {
    activeBundle,
    savedFarms,
    selectFarmById,
    switchCropForActiveFarm,
    setPage,
    language,
    tr,
    speakText,
    isSpeaking,
    stopSpeaking,
  } = useApp();
  const [switchingCrop, setSwitchingCrop] = useState(false);

  if (!activeBundle) {
    return (
      <div className="rounded-xl bg-[#F0FDF4] border border-emerald-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-base font-semibold text-[#0D3B26]">No Farm Analysis Selected</h3>
          <p className="text-sm text-emerald-900/80 mt-1">{tr('noFarmPrompt')}</p>
        </div>
        <button
          onClick={() => setPage('crop')}
          className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800 whitespace-nowrap shrink-0"
        >
          {tr('navCrop')}
        </button>
      </div>
    );
  }

  const activeCrop = activeBundle.fertilizerRecommendation?.crop || activeBundle.cropRecommendation.recommendedCrop;

  const handleCropChange = async (cropName: string) => {
    setSwitchingCrop(true);
    try {
      await switchCropForActiveFarm(cropName);
    } finally {
      setSwitchingCrop(false);
    }
  };

  return (
    <div className="rounded-xl bg-[#F0FDF4] border border-emerald-200 px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-[#0D3B26]">{tr('activeFarmLabel')}:</span>
          {savedFarms.length > 1 ? (
            <select
              value={activeBundle.farm.id}
              onChange={(e) => selectFarmById(Number(e.target.value))}
              className="rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-sm font-medium text-[#0D3B26] focus:outline-none focus:border-emerald-700"
            >
              {savedFarms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.farm_name} — {f.location} ({f.area_acres} ac)
                </option>
              ))}
            </select>
          ) : (
            <span className="font-medium text-emerald-950">
              {activeBundle.farm.farmName} · {activeBundle.farm.location}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="font-semibold text-[#0D3B26]">Crop:</span>
          <select
            value={activeCrop}
            disabled={switchingCrop}
            onChange={(e) => handleCropChange(e.target.value)}
            className="rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-sm font-medium text-[#0D3B26] capitalize focus:outline-none focus:border-emerald-700"
          >
            {CROP_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {switchingCrop && <RefreshCw className="h-3.5 w-3.5 animate-spin text-emerald-700" />}
        </div>

        <span className="text-xs font-mono tabular-nums text-emerald-800">
          N {activeBundle.farm.nitrogen} · P {activeBundle.farm.phosphorus} · K {activeBundle.farm.potassium} · pH {activeBundle.farm.ph} · {activeBundle.farm.areaAcres} ac
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {language !== 'en' && onTranslate && (
          <button
            onClick={onTranslate}
            disabled={translating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-emerald-300 text-xs font-medium text-emerald-900 hover:bg-emerald-50 whitespace-nowrap"
          >
            <Languages className="h-3.5 w-3.5" />
            <span>{translating ? tr('translatingLabel') : tr('translatePageBtn')}</span>
          </button>
        )}
        {readAloudText && (
          <button
            onClick={() => (isSpeaking ? stopSpeaking() : speakText(readAloudText))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-medium hover:bg-emerald-800 whitespace-nowrap"
          >
            <Volume2 className="h-3.5 w-3.5" />
            <span>{isSpeaking ? 'Stop Audio' : tr('speakBtn')}</span>
          </button>
        )}
      </div>
    </div>
  );
};
