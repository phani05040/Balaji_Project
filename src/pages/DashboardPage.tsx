import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CloudRain,
  Droplets,
  Sprout,
  Thermometer,
  Users,
  Wind,
} from 'lucide-react';
import { AgroBarChart, AgroDoughnutChart } from '../components/Charts';
import { useApp } from '../context/AppContext';
import { DashboardSummary } from '../types';

export const DashboardPage: React.FC = () => {
  const { user, activeBundle, apiFetch, setPage, tr } = useApp();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await apiFetch('/api/dashboard/summary');
        if (res.ok) {
          setSummary(await res.json());
        } else {
          setError('Failed to load dashboard metrics.');
        }
      } catch {
        setError('Connection error loading dashboard.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [apiFetch]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-white border border-emerald-200/70 animate-pulse p-5" />
          ))}
        </div>
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="h-72 rounded-xl bg-white border border-emerald-200/70 animate-pulse" />
          <div className="h-72 rounded-xl bg-white border border-emerald-200/70 animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 p-6 text-sm text-red-800">
        {error || 'Unable to load dashboard.'}
      </div>
    );
  }

  const cropLabels = summary.topCrops.map((c) => c.crop.charAt(0).toUpperCase() + c.crop.slice(1));
  const cropCounts = summary.topCrops.map((c) => c.count);

  const fertLabels = summary.fertilizerStats.map((f) => f.fertilizer);
  const fertCounts = summary.fertilizerStats.map((f) => f.count);

  const irrLabels = summary.irrigationStats.map((i) => i.level);
  const irrCounts = summary.irrigationStats.map((i) => i.count);

  const riskLabels = summary.riskStats.map((r) => r.level);
  const riskCounts = summary.riskStats.map((r) => r.count);

  return (
    <div className="space-y-6">
      {/* Welcome & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl bg-white border border-emerald-200/80 p-5">
        <div>
          <div className="text-xs font-medium text-emerald-800">
            {tr('welcomeBack')}, {user?.fullName} · {user?.location}
          </div>
          <h1 className="font-display text-2xl font-bold text-[#0D3B26] mt-0.5">
            Agricultural Decision Dashboard
          </h1>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setPage('crop')}
            className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-sm font-semibold hover:bg-emerald-800 transition-colors whitespace-nowrap"
          >
            New Soil Analysis
          </button>
          {activeBundle && (
            <button
              onClick={() => setPage('history')}
              className="px-4 py-2 rounded-lg bg-[#F0FDF4] border border-emerald-300 text-[#0D3B26] text-sm font-semibold hover:bg-emerald-100 transition-colors whitespace-nowrap"
            >
              Export Report
            </button>
          )}
        </div>
      </div>

      {/* 4 Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl bg-white border border-emerald-200/80 p-5">
          <div className="flex items-center justify-between text-xs font-medium text-emerald-800/80">
            <span>{tr('totalFarmers')}</span>
            <Users className="h-4 w-4 text-emerald-700" />
          </div>
          <div className="font-mono text-2xl font-bold text-[#0D3B26] mt-2 tabular-nums">
            {summary.totalFarmers}
          </div>
          <div className="text-xs text-emerald-800/70 mt-1">Active SQLite accounts</div>
        </div>

        <div className="rounded-xl bg-white border border-emerald-200/80 p-5">
          <div className="flex items-center justify-between text-xs font-medium text-emerald-800/80">
            <span>{tr('totalFarms')}</span>
            <Sprout className="h-4 w-4 text-emerald-700" />
          </div>
          <div className="font-mono text-2xl font-bold text-[#0D3B26] mt-2 tabular-nums">
            {summary.totalFarms}
          </div>
          <div className="text-xs text-emerald-800/70 mt-1">
            {summary.userFarmsCount} logged in your account
          </div>
        </div>

        <div className="rounded-xl bg-white border border-emerald-200/80 p-5">
          <div className="flex items-center justify-between text-xs font-medium text-emerald-800/80">
            <span>{tr('avgYield')}</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
          </div>
          <div className="font-mono text-2xl font-bold text-[#0D3B26] mt-2 tabular-nums">
            {summary.avgPredictedYieldTha} <span className="text-sm font-normal">t/ha</span>
          </div>
          <div className="text-xs font-mono text-emerald-800/70 mt-1 tabular-nums">
            {summary.avgPredictedYieldQac} quintals/acre
          </div>
        </div>

        <div className="rounded-xl bg-white border border-emerald-200/80 p-5">
          <div className="flex items-center justify-between text-xs font-medium text-emerald-800/80">
            <span>{tr('soilHealth')}</span>
            <AlertTriangle className="h-4 w-4 text-emerald-700" />
          </div>
          <div className="font-mono text-2xl font-bold text-[#0D3B26] mt-2 tabular-nums">
            {activeBundle ? `${activeBundle.farm.soilHealthScore}/100` : '—'}
          </div>
          <div className="text-xs text-emerald-800/70 mt-1">
            {activeBundle ? `${activeBundle.soilHealth.rating} · Indicative score` : 'Analyze a farm to compute'}
          </div>
        </div>
      </div>

      {/* Primary Charts Row */}
      <div className="grid lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 rounded-xl bg-white border border-emerald-200/80 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-base font-bold text-[#0D3B26]">{tr('topCropTitle')}</h2>
              <p className="text-xs text-emerald-800/75">Aggregated from database farm analyses</p>
            </div>
            <span className="text-xs font-mono text-emerald-800 tabular-nums">
              RF Accuracy: {summary.mlSummary.cropAccuracy}%
            </span>
          </div>
          <div className="h-64">
            {cropLabels.length > 0 ? (
              <AgroBarChart
                labels={cropLabels}
                values={cropCounts}
                datasetLabel="Farms Recommended"
                unit="farms"
              />
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-emerald-800/70">
                No crop recommendations logged yet.
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 rounded-xl bg-white border border-emerald-200/80 p-5">
          <div className="mb-4">
            <h2 className="font-display text-base font-bold text-[#0D3B26]">{tr('fertSummaryTitle')}</h2>
            <p className="text-xs text-emerald-800/75">
              Classifier Accuracy: <span className="font-mono tabular-nums">{summary.mlSummary.fertilizerAccuracy}%</span>
            </p>
          </div>
          <div className="h-64">
            {fertLabels.length > 0 ? (
              <AgroDoughnutChart labels={fertLabels} values={fertCounts} />
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-emerald-800/70">
                No fertilizer data yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Irrigation, Risk & Live Weather */}
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="rounded-xl bg-white border border-emerald-200/80 p-5">
          <h2 className="font-display text-base font-bold text-[#0D3B26] mb-1">{tr('irrigationStatsTitle')}</h2>
          <p className="text-xs text-emerald-800/75 mb-4">Seasonal water demand categories</p>
          <div className="h-52">
            <AgroDoughnutChart
              labels={irrLabels.length ? irrLabels : ['MODERATE']}
              values={irrCounts.length ? irrCounts : [1]}
              colors={['#0F766E', '#D97706', '#DC2626']}
            />
          </div>
        </div>

        <div className="rounded-xl bg-white border border-emerald-200/80 p-5">
          <h2 className="font-display text-base font-bold text-[#0D3B26] mb-1">{tr('riskStatsTitle')}</h2>
          <p className="text-xs text-emerald-800/75 mb-4">8-factor environmental & soil risk index</p>
          <div className="h-52">
            <AgroBarChart
              labels={riskLabels.length ? riskLabels : ['LOW']}
              values={riskCounts.length ? riskCounts : [1]}
              datasetLabel="Assessments"
              colors={riskLabels.map((l) =>
                l === 'HIGH' ? '#DC2626' : l === 'MODERATE' ? '#D97706' : '#16A34A'
              )}
            />
          </div>
        </div>

        {/* Weather Panel */}
        <div className="rounded-xl bg-[#F0FDF4] border border-emerald-200 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-[#0D3B26]">{tr('weatherTitle')}</h2>
              <span className="text-xs font-mono text-emerald-800">{summary.weather.provider}</span>
            </div>
            <div className="text-xs text-emerald-800/80 mt-0.5">{summary.weather.resolvedName}</div>

            {summary.weather.available && summary.weather.current ? (
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="rounded-lg bg-white border border-emerald-200/80 p-3">
                  <div className="flex items-center gap-1.5 text-xs text-emerald-800">
                    <Thermometer className="h-3.5 w-3.5" /> Temp
                  </div>
                  <div className="font-mono text-lg font-bold text-[#0D3B26] mt-1 tabular-nums">
                    {summary.weather.current.temperature}°C
                  </div>
                </div>
                <div className="rounded-lg bg-white border border-emerald-200/80 p-3">
                  <div className="flex items-center gap-1.5 text-xs text-emerald-800">
                    <Droplets className="h-3.5 w-3.5" /> Humidity
                  </div>
                  <div className="font-mono text-lg font-bold text-[#0D3B26] mt-1 tabular-nums">
                    {summary.weather.current.humidity}%
                  </div>
                </div>
                <div className="rounded-lg bg-white border border-emerald-200/80 p-3">
                  <div className="flex items-center gap-1.5 text-xs text-emerald-800">
                    <CloudRain className="h-3.5 w-3.5" /> Est. Rain
                  </div>
                  <div className="font-mono text-lg font-bold text-[#0D3B26] mt-1 tabular-nums">
                    {summary.weather.current.rainfall} mm
                  </div>
                </div>
                <div className="rounded-lg bg-white border border-emerald-200/80 p-3">
                  <div className="flex items-center gap-1.5 text-xs text-emerald-800">
                    <Wind className="h-3.5 w-3.5" /> Wind
                  </div>
                  <div className="font-mono text-lg font-bold text-[#0D3B26] mt-1 tabular-nums">
                    {summary.weather.current.windSpeedKmh} km/h
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3 mt-3">
                {summary.weather.cropPlanningImpact}
              </p>
            )}
          </div>
          <p className="text-xs text-emerald-950/80 mt-3 leading-relaxed">
            {summary.weather.cropPlanningImpact}
          </p>
        </div>
      </div>

      {/* Recent Activities */}
      <div className="rounded-xl bg-white border border-emerald-200/80 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-base font-bold text-[#0D3B26]">{tr('recentActivitiesTitle')}</h2>
          <button
            onClick={() => setPage('calendar')}
            className="text-xs font-semibold text-emerald-700 hover:underline"
          >
            Open Farming Calendar
          </button>
        </div>
        {summary.recentActivities.length > 0 ? (
          <div className="divide-y divide-emerald-100">
            {summary.recentActivities.map((act) => (
              <div key={act.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-mono text-emerald-800 tabular-nums shrink-0">{act.dueDate}</span>
                  <span className="font-medium text-[#0D3B26] truncate">{act.title}</span>
                </div>
                <div className="text-xs text-emerald-800/80 shrink-0">
                  {act.cropName} · {act.stage} · {act.completed ? 'Completed' : 'Scheduled'}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-emerald-900/70">Run a crop recommendation to generate your seasonal calendar.</p>
        )}
      </div>
    </div>
  );
};
