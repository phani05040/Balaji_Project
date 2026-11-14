import React, { useEffect, useState } from 'react';
import { Download, FileSpreadsheet, FileText, FolderArchive } from 'lucide-react';
import { AgroLineChart } from '../components/Charts';
import { useApp } from '../context/AppContext';

export const HistoryPage: React.FC = () => {
  const { savedFarms, refreshFarms, selectFarmById, activeBundle, token, setPage, tr } = useApp();
  const [downloading, setDownloading] = useState('');

  useEffect(() => {
    refreshFarms();
  }, []);

  const downloadFile = async (url: string, fallbackName: string, key: string) => {
    setDownloading(key);
    try {
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = fallbackName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
    } finally {
      setDownloading('');
    }
  };

  const ordered = [...savedFarms].reverse();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0D3B26]">{tr('navHistory')}</h1>
          <p className="text-sm text-emerald-900/75 mt-0.5">
            Track soil changes across analyses, reload past farm plans, and export official PDF or CSV reports.
          </p>
        </div>
        <button
          onClick={() => downloadFile('/api/reports/export-zip', 'agrisense_farm_package.zip', 'zip')}
          disabled={downloading === 'zip'}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0D3B26] text-white text-xs font-semibold hover:bg-emerald-900 self-start"
        >
          <FolderArchive className="h-4 w-4" />
          <span>{downloading === 'zip' ? 'Packaging...' : 'Download Datasets & Farm ZIP'}</span>
        </button>
      </div>

      {ordered.length > 0 && (
        <div className="rounded-xl bg-white border border-emerald-200/80 p-5">
          <h2 className="font-display text-base font-bold text-[#0D3B26] mb-1">Soil NPK & Health Trend</h2>
          <p className="text-xs text-emerald-800/75 mb-4">Historical progression across saved farm soil analyses</p>
          <div className="h-60">
            <AgroLineChart
              labels={ordered.map((f) => `${f.farm_name}`)}
              datasets={[
                { label: 'Nitrogen (kg/ha)', data: ordered.map((f) => f.nitrogen), borderColor: '#15803D' },
                { label: 'Phosphorus (kg/ha)', data: ordered.map((f) => f.phosphorus), borderColor: '#0F766E' },
                { label: 'Potassium (kg/ha)', data: ordered.map((f) => f.potassium), borderColor: '#D97706' },
                { label: 'Soil Health Score', data: ordered.map((f) => f.soil_health_score), borderColor: '#0D3B26' },
              ]}
            />
          </div>
        </div>
      )}

      <div className="rounded-xl bg-white border border-emerald-200/80 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#F5F8F6] text-xs text-emerald-900">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Farm Plot</th>
              <th className="text-right px-4 py-3 font-semibold">Area</th>
              <th className="text-right px-4 py-3 font-semibold">NPK / pH</th>
              <th className="text-left px-4 py-3 font-semibold">Crop & Fertilizer</th>
              <th className="text-right px-4 py-3 font-semibold">Yield</th>
              <th className="text-left px-4 py-3 font-semibold">Risk / Irr.</th>
              <th className="text-right px-4 py-3 font-semibold">Actions & Reports</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-emerald-100">
            {savedFarms.map((f) => {
              const isActive = activeBundle?.farm.id === f.id;
              return (
                <tr key={f.id} className={isActive ? 'bg-[#F0FDF4]' : 'hover:bg-[#F5F8F6]/60'}>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-[#0D3B26]">{f.farm_name}</div>
                    <div className="text-xs text-emerald-800/75">{f.location}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{f.area_acres} ac</td>
                  <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
                    {f.nitrogen}-{f.phosphorus}-{f.potassium} · pH {f.ph}
                  </td>
                  <td className="px-4 py-3">
                    <div className="capitalize font-medium text-[#0D3B26]">{f.recommended_crop || '—'}</div>
                    <div className="text-xs text-emerald-800/75">{f.recommended_fertilizer || '—'}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {f.yield_tonnes_per_ha ? `${f.yield_tonnes_per_ha} t/ha` : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono">
                    {f.risk_level || '—'} · {f.irrigation_level || '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        onClick={async () => {
                          await selectFarmById(f.id);
                          setPage('crop');
                        }}
                        className="px-2.5 py-1 rounded bg-white border border-emerald-300 text-xs font-semibold text-[#0D3B26] hover:bg-emerald-50"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => downloadFile(`/api/reports/${f.id}/pdf`, `agrisense_farm_${f.id}.pdf`, `pdf-${f.id}`)}
                        disabled={downloading === `pdf-${f.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800"
                        title={tr('downloadPdfBtn')}
                      >
                        <FileText className="h-3.5 w-3.5" />
                        <span>PDF</span>
                      </button>
                      <button
                        onClick={() => downloadFile(`/api/reports/${f.id}/csv`, `agrisense_farm_${f.id}.csv`, `csv-${f.id}`)}
                        disabled={downloading === `csv-${f.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#F0FDF4] border border-emerald-300 text-[#0D3B26] text-xs font-semibold hover:bg-emerald-100"
                        title={tr('downloadCsvBtn')}
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5" />
                        <span>CSV</span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {savedFarms.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-emerald-900/70">
                  No farm analyses recorded yet. Run your first analysis in Crop Planner.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
