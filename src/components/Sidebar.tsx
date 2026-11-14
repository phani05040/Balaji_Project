import React from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bot,
  Calculator,
  CalendarDays,
  CloudSun,
  Droplets,
  FlaskConical,
  History,
  Home,
  Info,
  LayoutDashboard,
  Leaf,
  LogIn,
  LogOut,
  Mail,
  Mic,
  Sprout,
  UserPlus,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MEDIA_ASSETS } from '../assets/media';
import { PageId } from '../types';

interface NavGroup {
  groupKey: string;
  requiresAuth?: boolean;
  guestOnly?: boolean;
  items: Array<{ id: PageId; labelKey: string; icon: React.ComponentType<{ className?: string }> }>;
}

const NAV_GROUPS: NavGroup[] = [
  {
    groupKey: 'groupOverview',
    items: [
      { id: 'home', labelKey: 'navHome', icon: Home },
      { id: 'dashboard', labelKey: 'navDashboard', icon: LayoutDashboard },
    ],
  },
  {
    groupKey: 'groupAdvisory',
    requiresAuth: true,
    items: [
      { id: 'crop', labelKey: 'navCrop', icon: Sprout },
      { id: 'fertilizer', labelKey: 'navFertilizer', icon: FlaskConical },
      { id: 'irrigation', labelKey: 'navIrrigation', icon: Droplets },
      { id: 'yield', labelKey: 'navYield', icon: BarChart3 },
      { id: 'risk', labelKey: 'navRisk', icon: AlertTriangle },
    ],
  },
  {
    groupKey: 'groupIntelligence',
    requiresAuth: true,
    items: [
      { id: 'chatbot', labelKey: 'navChatbot', icon: Bot },
      { id: 'voice', labelKey: 'navVoice', icon: Mic },
      { id: 'disease', labelKey: 'navDisease', icon: Leaf },
    ],
  },
  {
    groupKey: 'groupManagement',
    requiresAuth: true,
    items: [
      { id: 'comparison', labelKey: 'navComparison', icon: Activity },
      { id: 'profit', labelKey: 'navProfit', icon: Calculator },
      { id: 'calendar', labelKey: 'navCalendar', icon: CalendarDays },
      { id: 'history', labelKey: 'navHistory', icon: History },
    ],
  },
  {
    groupKey: 'groupInfo',
    items: [
      { id: 'about', labelKey: 'navAbout', icon: Info },
      { id: 'contact', labelKey: 'navContact', icon: Mail },
    ],
  },
];

export const Sidebar: React.FC<{ mobileOpen: boolean; onCloseMobile: () => void }> = ({
  mobileOpen,
  onCloseMobile,
}) => {
  const { user, page, setPage, tr, logoutUser } = useApp();

  const handleNav = (id: PageId) => {
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
    if (!user && protectedPages.includes(id)) {
      setPage('login');
    } else {
      setPage(id);
    }
    onCloseMobile();
  };

  const content = (
    <div className="flex h-full flex-col bg-[#0D3B26] text-emerald-50">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-emerald-900/80">
        <button
          onClick={() => handleNav('home')}
          className="flex items-center gap-2.5 text-left focus:outline-none"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <Sprout className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap">
              {tr('brandName')}
            </div>
            <div className="text-[11px] text-emerald-200/80 truncate max-w-[160px]">
              Crop & Farm DSS
            </div>
          </div>
        </button>
        <button
          onClick={onCloseMobile}
          className="lg:hidden rounded-md p-1.5 text-emerald-200 hover:bg-emerald-900/60"
          aria-label="Close navigation"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter((item) => {
            if (!user && group.requiresAuth) return false;
            if (!user && item.id === 'dashboard') return false;
            return true;
          });
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.groupKey}>
              <div className="px-3 mb-1.5 text-[11px] font-semibold tracking-wider text-emerald-300/75 uppercase">
                {tr(group.groupKey)}
              </div>
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const active = page === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNav(item.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-emerald-700/90 text-white'
                          : 'text-emerald-100/85 hover:bg-emerald-900/60 hover:text-white'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{tr(item.labelKey)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {!user && (
          <div>
            <div className="px-3 mb-1.5 text-[11px] font-semibold tracking-wider text-emerald-300/75 uppercase">
              Account
            </div>
            <div className="space-y-0.5">
              <button
                onClick={() => handleNav('login')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  page === 'login' ? 'bg-emerald-700/90 text-white' : 'text-emerald-100/85 hover:bg-emerald-900/60'
                }`}
              >
                <LogIn className="h-4 w-4 shrink-0" />
                <span>{tr('navLogin')}</span>
              </button>
              <button
                onClick={() => handleNav('register')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  page === 'register' ? 'bg-emerald-700/90 text-white' : 'text-emerald-100/85 hover:bg-emerald-900/60'
                }`}
              >
                <UserPlus className="h-4 w-4 shrink-0" />
                <span>{tr('navRegister')}</span>
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Farmer Profile Footer */}
      {user ? (
        <div className="border-t border-emerald-900/80 p-3.5 space-y-2.5">
          <div className="flex items-center gap-2.5 px-1">
            <img
              src={MEDIA_ASSETS.farmerAvatar}
              alt={user.fullName}
              referrerPolicy="no-referrer"
              className="h-9 w-9 rounded-full object-cover border border-emerald-500/40 shrink-0"
            />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white truncate">{user.fullName}</div>
              <div className="text-xs text-emerald-200/75 truncate">{user.location}</div>
            </div>
          </div>
          <button
            onClick={logoutUser}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-emerald-950/70 text-emerald-100 hover:bg-emerald-900 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>{tr('navLogout')}</span>
          </button>
        </div>
      ) : (
        <div className="border-t border-emerald-900/80 p-4 text-xs text-emerald-200/80 flex items-center gap-2">
          <CloudSun className="h-4 w-4 shrink-0 text-emerald-300" />
          <span>Sign in to access ML Soil & Crop Planning</span>
        </div>
      )}
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-64 shrink-0 h-screen sticky top-0 border-r border-emerald-950/20">
        {content}
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-68 max-w-[82vw] h-full shadow-xl">{content}</div>
          <div className="flex-1 bg-black/50" onClick={onCloseMobile} />
        </div>
      )}
    </>
  );
};
