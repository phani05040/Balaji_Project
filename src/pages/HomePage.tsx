import React from 'react';
import {
  ArrowRight,
  BarChart3,
  Bot,
  CloudSun,
  Droplets,
  FlaskConical,
  Leaf,
  Sprout,
} from 'lucide-react';
import { MEDIA_ASSETS } from '../assets/media';
import { useApp } from '../context/AppContext';

export const HomePage: React.FC = () => {
  const { user, setPage, tr } = useApp();

  const modules = [
    {
      icon: Sprout,
      title: 'ML Crop Recommendation',
      desc: 'Random Forest classification trained on soil NPK, pH, rainfall, humidity, and temperature across 22 crops.',
      target: 'crop' as const,
    },
    {
      icon: FlaskConical,
      title: 'Fertilizer & Soil Health',
      desc: 'Detects NPK deficiencies and pH imbalances with chemical and organic fertilization alternatives.',
      target: 'fertilizer' as const,
    },
    {
      icon: Droplets,
      title: 'Irrigation & Risk Planning',
      desc: 'Calculates crop water coefficients, rainfall deficits, LOW/MODERATE/HIGH demand, and 8-factor agricultural risks.',
      target: 'irrigation' as const,
    },
    {
      icon: BarChart3,
      title: 'Yield & Profit Modeling',
      desc: 'Regression yield estimates in tonnes/ha and quintals/acre linked to cultivation cost and ROI calculation.',
      target: 'yield' as const,
    },
    {
      icon: Bot,
      title: 'Multilingual Voice & AI Assistant',
      desc: 'Speak or chat in English, Telugu, Hindi, Tamil, Kannada, or Malayalam with farm-context awareness.',
      target: 'chatbot' as const,
    },
    {
      icon: Leaf,
      title: 'Plant Disease Inspection',
      desc: 'Upload leaf photos for visual blight and blast screening with calibrated confidence and preventive care.',
      target: 'disease' as const,
    },
  ];

  return (
    <div className="space-y-10">
      {/* Hero Split */}
      <section className="rounded-2xl bg-white border border-emerald-200/80 overflow-hidden">
        <div className="grid lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-7 p-7 sm:p-10 flex flex-col justify-center space-y-6">
            <div className="text-xs font-medium text-emerald-800 tracking-wide">
              Precision Agronomy · Machine Learning · Multilingual Voice DSS
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#0D3B26] text-balance leading-tight">
              {tr('heroTitle')}
            </h1>
            <p className="text-base text-emerald-950/75 leading-relaxed max-w-2xl">
              {tr('heroSubtitle')}
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                onClick={() => setPage(user ? 'crop' : 'login')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-700 text-white text-sm font-semibold hover:bg-emerald-800 transition-colors whitespace-nowrap"
              >
                <span>{user ? tr('getStarted') : 'Sign In & Start Planning'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage(user ? 'dashboard' : 'register')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#F0FDF4] border border-emerald-300 text-[#0D3B26] text-sm font-semibold hover:bg-emerald-100 transition-colors whitespace-nowrap"
              >
                <span>{user ? tr('exploreDashboard') : 'Create Farmer Account'}</span>
              </button>
            </div>
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-emerald-100 text-sm">
              <div>
                <div className="font-mono text-xl font-bold text-[#0D3B26] tabular-nums">22 Crops</div>
                <div className="text-xs text-emerald-800/75">Random Forest Classifier</div>
              </div>
              <div>
                <div className="font-mono text-xl font-bold text-[#0D3B26] tabular-nums">6 Languages</div>
                <div className="text-xs text-emerald-800/75">Voice & Text Support</div>
              </div>
              <div>
                <div className="font-mono text-xl font-bold text-[#0D3B26] tabular-nums">PDF + CSV</div>
                <div className="text-xs text-emerald-800/75">Exportable Farm Reports</div>
              </div>
            </div>
          </div>
          <div className="lg:col-span-5 relative min-h-[280px] lg:min-h-full bg-emerald-950">
            <img
              src={MEDIA_ASSETS.heroSmartFarm}
              alt="Terraced green farmland with solar weather station at sunrise"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* Capabilities Grid */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-2xl font-bold text-[#0D3B26]">Integrated Farm Decision Modules</h2>
            <p className="text-sm text-emerald-900/75 mt-1">
              Enter your farm and soil data once—every planning module reuses it automatically.
            </p>
          </div>
          <button
            onClick={() => setPage('about')}
            className="text-sm font-semibold text-emerald-800 hover:underline whitespace-nowrap"
          >
            View ML Methodology
          </button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.title}
                onClick={() => setPage(user ? m.target : 'login')}
                className="text-left rounded-xl bg-white border border-emerald-200/80 p-5 hover:border-emerald-500 transition-colors flex flex-col justify-between gap-3"
              >
                <div className="space-y-2.5">
                  <div className="h-9 w-9 rounded-lg bg-[#F0FDF4] border border-emerald-200 flex items-center justify-center text-emerald-800">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="font-display text-base font-semibold text-[#0D3B26]">{m.title}</h3>
                  <p className="text-sm text-emerald-950/75 leading-relaxed">{m.desc}</p>
                </div>
                <span className="text-xs font-semibold text-emerald-700 inline-flex items-center gap-1">
                  Open module <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Soil to Harvest Workflow */}
      <section className="rounded-2xl bg-white border border-emerald-200/80 overflow-hidden">
        <div className="grid md:grid-cols-12 items-stretch">
          <div className="md:col-span-5 min-h-[240px] bg-emerald-900">
            <img
              src={MEDIA_ASSETS.cropShowcaseSoil}
              alt="Healthy young green maize and rice seedlings sprouting in fertile soil"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="md:col-span-7 p-7 sm:p-9 space-y-5">
            <h2 className="font-display text-2xl font-bold text-[#0D3B26]">End-to-End Season Workflow</h2>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div className="p-3.5 rounded-lg bg-[#F0FDF4] border border-emerald-200/80">
                <div className="font-semibold text-[#0D3B26]">01. Soil & Weather Intake</div>
                <p className="text-emerald-950/75 mt-1">Input NPK, pH, and acreage, or auto-fill climate using live district weather forecasts.</p>
              </div>
              <div className="p-3.5 rounded-lg bg-[#F0FDF4] border border-emerald-200/80">
                <div className="font-semibold text-[#0D3B26]">02. ML Advisory Suite</div>
                <p className="text-emerald-950/75 mt-1">Receive crop suitability rankings, fertilizer gaps, irrigation demand, and yield estimates.</p>
              </div>
              <div className="p-3.5 rounded-lg bg-[#F0FDF4] border border-emerald-200/80">
                <div className="font-semibold text-[#0D3B26]">03. Voice & Disease Support</div>
                <p className="text-emerald-950/75 mt-1">Ask Smart Farming Assistant in 6 Indian languages and screen crop leaves for blight.</p>
              </div>
              <div className="p-3.5 rounded-lg bg-[#F0FDF4] border border-emerald-200/80">
                <div className="font-semibold text-[#0D3B26]">04. Economics & PDF Export</div>
                <p className="text-emerald-950/75 mt-1">Estimate profit/ROI, track seasonal tasks, and download printable PDF or CSV reports.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-emerald-800/80">
              <CloudSun className="h-4 w-4 shrink-0" />
              <span>All machine learning predictions operate reliably even when external weather or AI APIs are offline.</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
