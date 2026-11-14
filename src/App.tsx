import React, { useState } from 'react';
import { Globe, Menu } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { VoiceAssistantWidget } from './components/VoiceAssistantWidget';
import { AppProvider, useApp } from './context/AppContext';
import { LANGUAGES } from './i18n/translations';
import { AboutPage } from './pages/AboutPage';
import { AuthPage } from './pages/AuthPage';
import { CalendarPage } from './pages/CalendarPage';
import { ChatbotPage } from './pages/ChatbotPage';
import { ComparisonPage } from './pages/ComparisonPage';
import { ContactPage } from './pages/ContactPage';
import { CropPage } from './pages/CropPage';
import { DashboardPage } from './pages/DashboardPage';
import { DiseasePage } from './pages/DiseasePage';
import { FertilizerPage } from './pages/FertilizerPage';
import { HistoryPage } from './pages/HistoryPage';
import { HomePage } from './pages/HomePage';
import { IrrigationPage } from './pages/IrrigationPage';
import { ProfitPage } from './pages/ProfitPage';
import { RiskPage } from './pages/RiskPage';
import { VoiceSettingsPage } from './pages/VoiceSettingsPage';
import { YieldPage } from './pages/YieldPage';
import { LanguageCode, PageId } from './types';

const PAGE_LABELS: Record<PageId, string> = {
  home: 'navHome',
  login: 'navLogin',
  register: 'navRegister',
  dashboard: 'navDashboard',
  crop: 'navCrop',
  fertilizer: 'navFertilizer',
  irrigation: 'navIrrigation',
  yield: 'navYield',
  risk: 'navRisk',
  chatbot: 'navChatbot',
  voice: 'navVoice',
  disease: 'navDisease',
  comparison: 'navComparison',
  profit: 'navProfit',
  calendar: 'navCalendar',
  history: 'navHistory',
  about: 'navAbout',
  contact: 'navContact',
};

const MainShell: React.FC = () => {
  const { user, authLoading, page, setPage, language, setLanguage, tr } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);

  const protectedPages: PageId[] = [
    'dashboard',
    'crop',
    'fertilizer',
    'irrigation',
    'yield',
    'risk',
    'chatbot',
    'voice',
    'disease',
    'comparison',
    'profit',
    'calendar',
    'history',
  ];

  const renderPage = () => {
    if (authLoading) {
      return (
        <div className="rounded-xl bg-white border border-emerald-200 p-10 text-center text-sm text-emerald-800">
          Loading AgriSense workspace...
        </div>
      );
    }

    if (!user && protectedPages.includes(page)) {
      return <AuthPage mode="login" />;
    }

    switch (page) {
      case 'home':
        return <HomePage />;
      case 'login':
        return user ? <DashboardPage /> : <AuthPage mode="login" />;
      case 'register':
        return user ? <DashboardPage /> : <AuthPage mode="register" />;
      case 'dashboard':
        return <DashboardPage />;
      case 'crop':
        return <CropPage />;
      case 'fertilizer':
        return <FertilizerPage />;
      case 'irrigation':
        return <IrrigationPage />;
      case 'yield':
        return <YieldPage />;
      case 'risk':
        return <RiskPage />;
      case 'chatbot':
        return <ChatbotPage />;
      case 'voice':
        return <VoiceSettingsPage />;
      case 'disease':
        return <DiseasePage />;
      case 'comparison':
        return <ComparisonPage />;
      case 'profit':
        return <ProfitPage />;
      case 'calendar':
        return <CalendarPage />;
      case 'history':
        return <HistoryPage />;
      case 'about':
        return <AboutPage />;
      case 'contact':
        return <ContactPage />;
      default:
        return <HomePage />;
    }
  };

  return (
    <div className="min-h-screen flex bg-[#F5F8F6] text-[#112419]">
      <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Clean Top Workspace Header */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-emerald-200/80 px-4 sm:px-7 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-emerald-200 text-[#0D3B26] hover:bg-[#F0FDF4]"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="font-display font-bold text-[#0D3B26] whitespace-nowrap">{tr('brandName')}</span>
              <span className="text-emerald-400" aria-hidden="true">/</span>
              <span className="font-medium text-emerald-900 truncate">{tr(PAGE_LABELS[page] || 'navHome')}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-[#F5F8F6] px-2.5 py-1.5">
              <Globe className="h-3.5 w-3.5 text-emerald-800 shrink-0" />
              <select
                aria-label={tr('selectLanguage')}
                value={language}
                onChange={(e) => setLanguage(e.target.value as LanguageCode)}
                className="bg-transparent text-xs font-medium text-[#0D3B26] focus:outline-none"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.nativeLabel}
                  </option>
                ))}
              </select>
            </div>

            {user ? (
              <button
                onClick={() => setPage('crop')}
                className="hidden sm:inline-flex px-3.5 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 whitespace-nowrap shrink-0"
              >
                {tr('navCrop')}
              </button>
            ) : (
              <button
                onClick={() => setPage('login')}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 whitespace-nowrap shrink-0"
              >
                {tr('navLogin')}
              </button>
            )}
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-7 max-w-7xl w-full mx-auto">
          {renderPage()}
        </main>

        {/* Minimal Clean Footer */}
        <footer className="border-t border-emerald-200/70 bg-white px-4 sm:px-7 py-4 text-xs text-emerald-900/70 flex flex-wrap items-center justify-between gap-2">
          <span>AgriSense · Intelligent Crop Planning and Farm Decision Support System</span>
          <div className="flex items-center gap-4">
            <button onClick={() => setPage('about')} className="hover:text-[#0D3B26] hover:underline">
              {tr('navAbout')}
            </button>
            <button onClick={() => setPage('contact')} className="hover:text-[#0D3B26] hover:underline">
              {tr('navContact')}
            </button>
          </div>
        </footer>
      </div>

      <VoiceAssistantWidget />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainShell />
    </AppProvider>
  );
}
