import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { getSpeechLocale, t } from '../i18n/translations';
import { FarmBundle, LanguageCode, PageId, User } from '../types';

interface AppContextValue {
  user: User | null;
  token: string | null;
  authLoading: boolean;
  page: PageId;
  setPage: (p: PageId) => void;
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  tr: (key: string) => string;
  activeBundle: FarmBundle | null;
  setActiveBundle: (bundle: FarmBundle | null) => void;
  savedFarms: any[];
  refreshFarms: () => Promise<void>;
  selectFarmById: (farmId: number) => Promise<void>;
  switchCropForActiveFarm: (cropName: string) => Promise<void>;
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  loginUser: (user: User, token: string) => void;
  logoutUser: () => Promise<void>;
  speechRate: number;
  setSpeechRate: (r: number) => void;
  speakText: (text: string, overrideLang?: LanguageCode) => Promise<void>;
  stopSpeaking: () => void;
  isSpeaking: boolean;
  translateDynamic: (texts: string[]) => Promise<string[]>;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('agrisense_token'));
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [page, setPageState] = useState<PageId>(() => {
    const saved = localStorage.getItem('agrisense_page') as PageId | null;
    return saved || 'home';
  });
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    return (localStorage.getItem('agrisense_lang') as LanguageCode) || 'en';
  });
  const [speechRate, setSpeechRate] = useState<number>(() => {
    const saved = Number(localStorage.getItem('agrisense_speech_rate'));
    return Number.isFinite(saved) && saved >= 0.6 && saved <= 1.5 ? saved : 1.0;
  });
  const [activeBundle, setActiveBundle] = useState<FarmBundle | null>(null);
  const [savedFarms, setSavedFarms] = useState<any[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const apiFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const headers = new Headers(options.headers || {});
      const activeToken = localStorage.getItem('agrisense_token') || token;
      if (activeToken) {
        headers.set('Authorization', `Bearer ${activeToken}`);
      }
      if (!(options.body instanceof FormData) && !headers.has('Content-Type') && options.method && options.method !== 'GET') {
        headers.set('Content-Type', 'application/json');
      }
      return fetch(url, { ...options, headers });
    },
    [token]
  );

  const setPage = useCallback((p: PageId) => {
    setPageState(p);
    localStorage.setItem('agrisense_page', p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const selectFarmById = useCallback(
    async (farmId: number) => {
      const res = await apiFetch(`/api/farms/${farmId}/bundle`);
      if (res.ok) {
        const bundle = (await res.json()) as FarmBundle;
        setActiveBundle(bundle);
      }
    },
    [apiFetch]
  );

  const switchCropForActiveFarm = useCallback(
    async (cropName: string) => {
      if (!activeBundle) return;
      const res = await apiFetch(`/api/farms/${activeBundle.farm.id}/recompute`, {
        method: 'POST',
        body: JSON.stringify({ cropName }),
      });
      if (res.ok) {
        const updated = (await res.json()) as FarmBundle;
        setActiveBundle(updated);
      }
    },
    [activeBundle, apiFetch]
  );

  const refreshFarms = useCallback(async () => {
    const res = await apiFetch('/api/farms');
    if (!res.ok) return;
    const data = await res.json();
    const list = data.farms || [];
    setSavedFarms(list);
    if (list.length > 0 && !activeBundle) {
      await selectFarmById(list[0].id);
    }
  }, [apiFetch, activeBundle, selectFarmById]);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('agrisense_token');
      if (!storedToken) {
        setAuthLoading(false);
        return;
      }
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          if (data.user?.preferredLanguage) {
            const l = data.user.preferredLanguage as LanguageCode;
            setLanguageState(l);
            localStorage.setItem('agrisense_lang', l);
          }
          const farmsRes = await fetch('/api/farms', {
            headers: { Authorization: `Bearer ${storedToken}` },
          });
          if (farmsRes.ok) {
            const fd = await farmsRes.json();
            const list = fd.farms || [];
            setSavedFarms(list);
            if (list.length > 0) {
              const bRes = await fetch(`/api/farms/${list[0].id}/bundle`, {
                headers: { Authorization: `Bearer ${storedToken}` },
              });
              if (bRes.ok) setActiveBundle(await bRes.json());
            }
          }
        } else {
          localStorage.removeItem('agrisense_token');
          setToken(null);
        }
      } catch {
        // Keep graceful offline state
      } finally {
        setAuthLoading(false);
      }
    };
    initAuth();
  }, []);

  const loginUser = useCallback(
    (u: User, tok: string) => {
      localStorage.setItem('agrisense_token', tok);
      setToken(tok);
      setUser(u);
      if (u.preferredLanguage) {
        setLanguageState(u.preferredLanguage);
        localStorage.setItem('agrisense_lang', u.preferredLanguage);
      }
      setPage('dashboard');
      setTimeout(() => {
        fetch('/api/farms', { headers: { Authorization: `Bearer ${tok}` } })
          .then((r) => (r.ok ? r.json() : null))
          .then((fd) => {
            if (fd?.farms?.length) {
              setSavedFarms(fd.farms);
              fetch(`/api/farms/${fd.farms[0].id}/bundle`, { headers: { Authorization: `Bearer ${tok}` } })
                .then((br) => (br.ok ? br.json() : null))
                .then((b) => b && setActiveBundle(b));
            }
          });
      }, 50);
    },
    [setPage]
  );

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  const logoutUser = useCallback(async () => {
    stopSpeaking();
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    localStorage.removeItem('agrisense_token');
    setToken(null);
    setUser(null);
    setActiveBundle(null);
    setSavedFarms([]);
    setPage('home');
  }, [apiFetch, setPage, stopSpeaking]);

  const setLanguage = useCallback(
    (lang: LanguageCode) => {
      setLanguageState(lang);
      localStorage.setItem('agrisense_lang', lang);
      if (user && token) {
        apiFetch('/api/auth/preferences', {
          method: 'PATCH',
          body: JSON.stringify({ preferredLanguage: lang }),
        }).catch(() => {});
      }
    },
    [user, token, apiFetch]
  );

  const tr = useCallback((key: string) => t(language, key), [language]);

  const speakText = useCallback(
    async (text: string, overrideLang?: LanguageCode) => {
      const targetLang = overrideLang || language;
      if (!text.trim()) return;
      stopSpeaking();
      setIsSpeaking(true);

      let spokenText = text;

      // 1. Try Gemini multilingual neural TTS (/api/tts) for reliable audio in all 10 languages
      if (token || localStorage.getItem('agrisense_token')) {
        try {
          const res = await apiFetch('/api/tts', {
            method: 'POST',
            body: JSON.stringify({ text, language: targetLang }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.spokenText) spokenText = data.spokenText;
            if (data.available && data.audioBase64) {
              const audio = new Audio(`data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`);
              audio.playbackRate = speechRate;
              audioRef.current = audio;
              audio.onended = () => setIsSpeaking(false);
              audio.onerror = () => setIsSpeaking(false);
              await audio.play();
              return;
            }
          }
        } catch {
          // Fall back to browser Web Speech Synthesis
        }
      }

      // 2. Browser Web Speech Synthesis fallback with explicit matching locale voice selection
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const locale = getSpeechLocale(targetLang);
        const utterance = new SpeechSynthesisUtterance(spokenText);
        utterance.lang = locale;
        utterance.rate = speechRate;
        const voices = window.speechSynthesis.getVoices();
        const exactVoice =
          voices.find((v) => v.lang.toLowerCase() === locale.toLowerCase()) ||
          voices.find((v) => v.lang.toLowerCase().startsWith(targetLang.toLowerCase()));
        if (exactVoice) utterance.voice = exactVoice;
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
      } else {
        setIsSpeaking(false);
      }
    },
    [language, speechRate, token, apiFetch, stopSpeaking]
  );

  const translateDynamic = useCallback(
    async (texts: string[]): Promise<string[]> => {
      if (language === 'en' || texts.length === 0) return texts;
      try {
        const res = await apiFetch('/api/translate', {
          method: 'POST',
          body: JSON.stringify({ texts, targetLanguage: language }),
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.translations)) return data.translations;
        }
      } catch {
        // fallback to original
      }
      return texts;
    },
    [language, apiFetch]
  );

  useEffect(() => {
    localStorage.setItem('agrisense_speech_rate', String(speechRate));
  }, [speechRate]);

  return (
    <AppContext.Provider
      value={{
        user,
        token,
        authLoading,
        page,
        setPage,
        language,
        setLanguage,
        tr,
        activeBundle,
        setActiveBundle,
        savedFarms,
        refreshFarms,
        selectFarmById,
        switchCropForActiveFarm,
        apiFetch,
        loginUser,
        logoutUser,
        speechRate,
        setSpeechRate,
        speakText,
        stopSpeaking,
        isSpeaking,
        translateDynamic,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
