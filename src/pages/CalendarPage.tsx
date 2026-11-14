import React, { useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, Circle } from 'lucide-react';
import { ActiveFarmBanner } from '../components/ActiveFarmBanner';
import { useApp } from '../context/AppContext';

export const CalendarPage: React.FC = () => {
  const { activeBundle, apiFetch, tr } = useApp();
  const [activities, setActivities] = useState<any[]>([]);
  const [cropName, setCropName] = useState(activeBundle?.cropRecommendation.recommendedCrop || 'rice');
  const [sowingDate, setSowingDate] = useState(new Date().toISOString().split('T')[0]);
  const [generating, setGenerating] = useState(false);

  const loadActivities = async () => {
    const url = activeBundle ? `/api/calendar?farmId=${activeBundle.farm.id}` : '/api/calendar';
    const res = await apiFetch(url);
    if (res.ok) {
      const d = await res.json();
      setActivities(d.activities || []);
    }
  };

  useEffect(() => {
    if (activeBundle) {
      setCropName(activeBundle.cropRecommendation.recommendedCrop);
    }
    loadActivities();
  }, [activeBundle?.farm.id]);

  const regenerateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBundle) return;
    setGenerating(true);
    try {
      const res = await apiFetch('/api/calendar/generate', {
        method: 'POST',
        body: JSON.stringify({ farmId: activeBundle.farm.id, cropName, sowingDate }),
      });
      if (res.ok) {
        const d = await res.json();
        setActivities(d.activities || []);
      }
    } finally {
      setGenerating(false);
    }
  };

  const toggleDone = async (id: number, current: number) => {
    const next = current ? 0 : 1;
    setActivities((prev) => prev.map((a) => (a.id === id ? { ...a, completed: next } : a)));
    await apiFetch(`/api/calendar/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed: Boolean(next) }),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0D3B26]">{tr('navCalendar')}</h1>
        <p className="text-sm text-emerald-900/75 mt-0.5">
          Crop-specific schedule covering land preparation, sowing, irrigation, fertilizer split doses, scouting, and harvest.
        </p>
      </div>

      <ActiveFarmBanner />

      {activeBundle && (
        <form
          onSubmit={regenerateSchedule}
          className="rounded-xl bg-white border border-emerald-200/80 p-5 flex flex-wrap items-end gap-4"
        >
          <div>
            <label className="block text-xs font-medium text-[#0D3B26] mb-1">Crop</label>
            <input
              type="text"
              value={cropName}
              onChange={(e) => setCropName(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-emerald-200 capitalize"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#0D3B26] mb-1">Planned Sowing Date</label>
            <input
              type="date"
              value={sowingDate}
              onChange={(e) => setSowingDate(e.target.value)}
              className="px-3 py-2 text-sm font-mono rounded-lg border border-emerald-200"
            />
          </div>
          <button
            type="submit"
            disabled={generating}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 text-white text-sm font-semibold hover:bg-emerald-800"
          >
            <CalendarDays className="h-4 w-4" />
            <span>{generating ? 'Generating...' : 'Generate Crop Calendar'}</span>
          </button>
        </form>
      )}

      <div className="rounded-xl bg-white border border-emerald-200/80 divide-y divide-emerald-100">
        {activities.length > 0 ? (
          activities.map((a) => (
            <div key={a.id} className="p-4 sm:px-5 flex items-start gap-3.5 hover:bg-[#F5F8F6]/60">
              <button
                onClick={() => toggleDone(a.id, a.completed)}
                className="mt-0.5 text-emerald-700 shrink-0"
                aria-label="Toggle completed"
              >
                {a.completed ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Circle className="h-5 w-5 text-emerald-300" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={`font-semibold text-sm ${a.completed ? 'line-through text-emerald-800/60' : 'text-[#0D3B26]'}`}>
                    {a.title}
                  </span>
                  <span className="text-xs font-mono text-emerald-800 tabular-nums">
                    {a.due_date} · {a.stage}
                  </span>
                </div>
                {a.notes && <p className="text-xs text-emerald-950/75 mt-1">{a.notes}</p>}
              </div>
            </div>
          ))
        ) : (
          <div className="p-8 text-center text-sm text-emerald-900/70">
            No farming tasks scheduled yet. Generate a calendar above after analyzing your farm.
          </div>
        )}
      </div>
    </div>
  );
};
