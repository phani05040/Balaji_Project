import React, { useState } from 'react';
import { Globe, Mic, MicOff, Send, Volume2, VolumeX, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getSpeechLocale, LANGUAGES } from '../i18n/translations';
import { LanguageCode } from '../types';

export const VoiceAssistantWidget: React.FC = () => {
  const { user, language, setLanguage, activeBundle, apiFetch, speakText, stopSpeaking, isSpeaking, tr } = useApp();
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [question, setQuestion] = useState('');
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);
  const [speechNotice, setSpeechNotice] = useState('');

  if (!user) return null;

  const speechSupported =
    typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const askAssistant = async (text: string) => {
    if (!text.trim()) return;
    setLoading(true);
    setSpeechNotice('');
    try {
      const res = await apiFetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: text,
          language,
          farmId: activeBundle?.farm.id || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setReply(data.reply);
        await speakText(data.reply, language);
      } else {
        setReply('Unable to reach assistant right now. Please try again.');
      }
    } catch {
      setReply('Connection error while contacting Smart Farming Assistant.');
    } finally {
      setLoading(false);
    }
  };

  const startListening = () => {
    if (!speechSupported) {
      setSpeechNotice('Browser speech recognition is unavailable here. Please type your farming question below.');
      return;
    }
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SpeechRec();
    rec.lang = getSpeechLocale(language);
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    setListening(true);
    setSpeechNotice('');

    rec.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      setQuestion(transcript);
      setListening(false);
      if (transcript) askAssistant(transcript);
    };
    rec.onerror = () => {
      setListening(false);
      setSpeechNotice('Microphone capture was interrupted or denied. You can type your question directly.');
    };
    rec.onend = () => setListening(false);
    rec.start();
  };

  return (
    <div className="fixed bottom-5 right-5 z-40">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#0D3B26] text-white text-sm font-medium shadow-lg hover:bg-emerald-900 transition-colors"
        >
          <Mic className="h-4 w-4 text-emerald-300" />
          <span className="whitespace-nowrap">Voice Assistant ({LANGUAGES.find((l) => l.code === language)?.nativeLabel})</span>
        </button>
      ) : (
        <div className="w-[340px] sm:w-[390px] rounded-xl bg-white border border-emerald-200 shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-[#0D3B26] text-white">
            <div className="flex items-center gap-2">
              <Mic className="h-4 w-4 text-emerald-300" />
              <span className="font-display text-sm font-semibold">AI Voice Assistant</span>
            </div>
            <button
              onClick={() => {
                stopSpeaking();
                setOpen(false);
              }}
              className="p-1 rounded hover:bg-emerald-900"
              aria-label="Close voice assistant"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-4 space-y-3">
            {/* Voice Language Selector */}
            <div className="flex items-center justify-between gap-2 rounded-lg bg-[#F5F8F6] border border-emerald-200 px-3 py-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0D3B26]">
                <Globe className="h-3.5 w-3.5 text-emerald-700" />
                Voice Language
              </span>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as LanguageCode)}
                className="bg-white border border-emerald-300 rounded px-2 py-1 text-xs font-medium text-[#0D3B26] focus:outline-none"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label} ({l.nativeLabel})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={startListening}
                disabled={listening || loading}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  listening
                    ? 'bg-red-600 text-white'
                    : 'bg-emerald-700 text-white hover:bg-emerald-800'
                }`}
              >
                {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                <span>{listening ? tr('listeningLabel') : tr('micBtn')}</span>
              </button>
              {isSpeaking ? (
                <button
                  onClick={stopSpeaking}
                  className="px-3 py-2.5 rounded-lg bg-amber-100 text-amber-900 text-sm font-medium hover:bg-amber-200"
                  title="Stop speaking"
                >
                  <VolumeX className="h-4 w-4" />
                </button>
              ) : (
                reply && (
                  <button
                    onClick={() => speakText(reply, language)}
                    className="px-3 py-2.5 rounded-lg bg-emerald-50 text-emerald-800 text-sm font-medium hover:bg-emerald-100 border border-emerald-200"
                    title={tr('speakBtn')}
                  >
                    <Volume2 className="h-4 w-4" />
                  </button>
                )
              )}
            </div>

            {speechNotice && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {speechNotice}
              </p>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                askAssistant(question);
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask: Which crop is suitable for my soil?"
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-emerald-200 focus:outline-none focus:border-emerald-600"
              />
              <button
                type="submit"
                disabled={loading || !question.trim()}
                className="px-3 py-2 rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50"
                aria-label="Send question"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>

            {loading && <div className="text-xs text-emerald-700">Analyzing your active farm profile...</div>}

            {reply && (
              <div className="rounded-lg bg-[#F0FDF4] border border-emerald-200 p-3 text-sm text-emerald-950 leading-relaxed max-h-48 overflow-y-auto">
                {reply}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
