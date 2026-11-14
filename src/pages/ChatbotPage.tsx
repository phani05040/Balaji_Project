import React, { useEffect, useRef, useState } from 'react';
import { Bot, Globe, Mic, MicOff, Send, Trash2, Volume2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getSpeechLocale, LANGUAGES } from '../i18n/translations';
import { LanguageCode } from '../types';

interface ChatMsg {
  id?: number;
  role: 'user' | 'assistant';
  message: string;
  language?: string;
  created_at?: string;
}

const QUICK_PROMPTS = [
  'Which crop should I grow?',
  'How can I improve soil fertility?',
  'Which fertilizer is suitable for maize?',
  'How much irrigation is required?',
  'How can I increase crop yield?',
  'What should I do during heavy rainfall?',
  'How can I manage common crop diseases?',
];

export const ChatbotPage: React.FC = () => {
  const { activeBundle, apiFetch, language, setLanguage, speakText, tr } = useApp();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const [notice, setNotice] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const loadHistory = async () => {
    const res = await apiFetch('/api/chat');
    if (res.ok) {
      const data = await res.json();
      setMessages(data.messages || []);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  const sendMessage = async (text: string, autoSpeak = false) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setNotice('');
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', message: trimmed }]);
    setSending(true);
    try {
      const res = await apiFetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: trimmed,
          language,
          farmId: activeBundle?.farm.id || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, { role: 'assistant', message: data.reply, language: data.language }]);
        if (autoSpeak) speakText(data.reply);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', message: 'Unable to process your question right now. Please try again.' },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', message: 'Network error contacting Smart Farming Assistant.' },
      ]);
    } finally {
      setSending(false);
    }
  };

  const clearHistory = async () => {
    await apiFetch('/api/chat', { method: 'DELETE' });
    setMessages([]);
  };

  const startVoiceInput = () => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setNotice('Voice recognition is unavailable in this browser. Type your question below.');
      return;
    }
    const rec = new SpeechRec();
    rec.lang = getSpeechLocale(language);
    rec.interimResults = false;
    setListening(true);
    setNotice('');
    rec.onresult = (e: any) => {
      const spoken = e.results?.[0]?.[0]?.transcript || '';
      setListening(false);
      if (spoken) sendMessage(spoken, true);
    };
    rec.onerror = () => {
      setListening(false);
      setNotice('Microphone access denied or interrupted. Please type your message.');
    };
    rec.onend = () => setListening(false);
    rec.start();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0D3B26]">Smart Farming Assistant</h1>
          <p className="text-sm text-emerald-900/75 mt-0.5">
            Context-aware multilingual AI advisor grounded in your active farm soil and climate measurements.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5">
            <Globe className="h-3.5 w-3.5 text-emerald-700" />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as LanguageCode)}
              className="text-xs font-medium text-[#0D3B26] bg-transparent focus:outline-none"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label} ({l.nativeLabel})
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={clearHistory}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-emerald-200 text-xs font-semibold text-emerald-900 hover:bg-emerald-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Clear History</span>
          </button>
        </div>
      </div>

      {activeBundle && (
        <div className="rounded-lg bg-[#F0FDF4] border border-emerald-200 px-4 py-2.5 text-xs text-emerald-900">
          Context Loaded: <strong>{activeBundle.farm.farmName}</strong> ({activeBundle.farm.location}) · Crop:{' '}
          <strong>{activeBundle.cropRecommendation.displayName}</strong> · NPK{' '}
          <span className="font-mono">
            {activeBundle.farm.nitrogen}-{activeBundle.farm.phosphorus}-{activeBundle.farm.potassium}
          </span>{' '}
          · pH <span className="font-mono">{activeBundle.farm.ph}</span>
        </div>
      )}

      {/* Quick Prompts */}
      <div className="flex flex-wrap gap-2">
        {QUICK_PROMPTS.map((q) => (
          <button
            key={q}
            onClick={() => sendMessage(q)}
            className="px-3 py-1.5 rounded-lg bg-white border border-emerald-200 text-xs font-medium text-[#0D3B26] hover:bg-[#F0FDF4] hover:border-emerald-400 transition-colors"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Chat Thread */}
      <div className="rounded-xl bg-white border border-emerald-200/80 flex flex-col h-[480px]">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-2 text-emerald-900/70">
              <Bot className="h-8 w-8 text-emerald-700" />
              <div className="font-display font-semibold text-[#0D3B26]">Ask Smart Farming Assistant</div>
              <p className="text-sm">
                Ask any question about crop selection, NPK fertilizer balance, irrigation timing, yield improvement, or leaf diseases in your chosen language.
              </p>
            </div>
          )}

          {messages.map((m, idx) => (
            <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-[#0D3B26] text-white'
                    : 'bg-[#F0FDF4] border border-emerald-200 text-[#112419]'
                }`}
              >
                <div className="whitespace-pre-wrap">{m.message}</div>
                {m.role === 'assistant' && (
                  <div className="mt-2 pt-1.5 border-t border-emerald-200/70 flex justify-end">
                    <button
                      onClick={() => speakText(m.message)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800 hover:underline"
                    >
                      <Volume2 className="h-3.5 w-3.5" />
                      <span>{tr('speakBtn')}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex justify-start">
              <div className="rounded-xl bg-[#F0FDF4] border border-emerald-200 px-4 py-3 text-xs text-emerald-800">
                Preparing agronomic guidance...
              </div>
            </div>
          )}
        </div>

        {notice && (
          <div className="px-4 py-2 bg-amber-50 border-t border-amber-200 text-xs text-amber-900">{notice}</div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="border-t border-emerald-100 p-3 flex items-center gap-2"
        >
          <button
            type="button"
            onClick={startVoiceInput}
            className={`p-2.5 rounded-lg border transition-colors shrink-0 ${
              listening
                ? 'bg-red-600 text-white border-red-600'
                : 'bg-[#F0FDF4] text-[#0D3B26] border-emerald-200 hover:bg-emerald-100'
            }`}
            title={tr('micBtn')}
          >
            {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={listening ? tr('listeningLabel') : 'Type or speak your farming question...'}
            className="flex-1 px-3.5 py-2 text-sm rounded-lg border border-emerald-200 focus:outline-none focus:border-emerald-700"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-700 text-white text-sm font-semibold hover:bg-emerald-800 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};
