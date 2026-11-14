import React, { useState } from 'react';
import { Globe, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getSpeechLocale, LANGUAGES } from '../i18n/translations';
import { LanguageCode } from '../types';

const SAMPLE_VOICE_GREETING: Record<LanguageCode, string> = {
  en: 'Welcome to AgriSense. Your soil profile and crop recommendations are ready for voice playback.',
  te: 'అగ్రిసెన్స్‌కు స్వాగతం. మీ నేల వివరాలు మరియు పంట సిఫార్సులు వినడానికి సిద్ధంగా ఉన్నాయి.',
  hi: 'एग्रीसेंस में आपका स्वागत है। आपकी मिट्टी की जानकारी और फसल सुझाव सुनने के लिए तैयार हैं।',
  ta: 'அக்ரிசென்ஸிற்கு வரவேற்கிறோம். உங்கள் மண் விவரங்கள் மற்றும் பயிர் பரிந்துரைகள் தயாராக உள்ளன.',
  kn: 'ಅಗ್ರಿಸೆನ್ಸ್‌ಗೆ ಸ್ವಾಗತ. ನಿಮ್ಮ ಮಣ್ಣಿನ ವಿವರಗಳು ಮತ್ತು ಬೆಳೆ ಶಿಫಾರಸುಗಳು ಕೇಳಲು ಸಿದ್ಧವಾಗಿವೆ.',
  ml: 'അഗ്രിസെൻസിലേക്ക് സ്വാഗതം. നിങ്ങളുടെ മണ്ണ് വിവരങ്ങളും വിള നിർദ്ദേശങ്ങളും തയ്യാറാണ്.',
  mr: 'अ‍ॅग्रीसेन्समध्ये आपले स्वागत आहे. तुमची माती माहिती आणि पीक सल्ला ऐकण्यासाठी तयार आहे.',
  bn: 'অ্যাগ্রিসেন্সে আপনাকে স্বাগতম। আপনার মাটির তথ্য এবং ফসলের পরামর্শ শোনার জন্য প্রস্তুত।',
  gu: 'એગ્રીસેન્સમાં આપનું સ્વાગત છે. તમારી માટીની વિગતો અને પાક ભલામણ સાંભળવા માટે તૈયાર છે.',
  pa: 'ਐਗਰੀਸੈਂਸ ਵਿੱਚ ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ। ਤੁਹਾਡੀ ਮਿੱਟੀ ਦੀ ਜਾਣਕਾਰੀ ਅਤੇ ਫ਼ਸਲ ਸਲਾਹ ਸੁਣਨ ਲਈ ਤਿਆਰ ਹੈ।',
};

export const VoiceSettingsPage: React.FC = () => {
  const { language, setLanguage, speechRate, setSpeechRate, speakText, stopSpeaking, isSpeaking, tr } = useApp();
  const [micTranscript, setMicTranscript] = useState('');
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState('');

  const speechSupported =
    typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const testMic = () => {
    if (!speechSupported) {
      setMicError('Web Speech Recognition API is not available in this browser. Text input remains active across the app.');
      return;
    }
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SpeechRec();
    rec.lang = getSpeechLocale(language);
    rec.interimResults = false;
    setListening(true);
    setMicError('');
    rec.onresult = (e: any) => {
      const transcript = e.results?.[0]?.[0]?.transcript || '';
      setMicTranscript(transcript);
      setListening(false);
    };
    rec.onerror = () => {
      setListening(false);
      setMicError('Could not access microphone. Check browser microphone permissions.');
    };
    rec.onend = () => setListening(false);
    rec.start();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0D3B26]">{tr('navVoice')}</h1>
        <p className="text-sm text-emerald-900/75 mt-0.5">
          Choose from 10 supported agricultural voice & UI languages with neural multilingual audio playback and speech recognition.
        </p>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Language Selection (10 Languages) */}
        <div className="lg:col-span-7 rounded-xl bg-white border border-emerald-200/80 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Globe className="h-5 w-5 text-emerald-700" />
              <h2 className="font-display text-base font-bold text-[#0D3B26]">10 Voice & Interface Languages</h2>
            </div>
            <span className="text-xs font-mono text-emerald-800">Neural TTS + Web Speech</span>
          </div>
          <p className="text-sm text-emerald-950/75">
            Select a language to update menus, AI assistant replies, and spoken audio across the application, or click Speak to preview any voice immediately.
          </p>

          <div className="grid sm:grid-cols-2 gap-2.5">
            {LANGUAGES.map((l) => {
              const active = language === l.code;
              return (
                <div
                  key={l.code}
                  className={`p-3.5 rounded-xl border flex items-center justify-between gap-2 transition-colors ${
                    active
                      ? 'bg-[#F0FDF4] border-emerald-600 text-[#0D3B26]'
                      : 'bg-white border-emerald-200 text-emerald-950 hover:bg-[#F5F8F6]'
                  }`}
                >
                  <button
                    onClick={() => setLanguage(l.code)}
                    className="text-left flex-1 min-w-0"
                  >
                    <div className="font-semibold text-sm truncate">{l.nativeLabel}</div>
                    <div className="text-xs text-emerald-800/80 mt-0.5">
                      {l.label} · {l.speechLocale}
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      setLanguage(l.code);
                      speakText(SAMPLE_VOICE_GREETING[l.code], l.code);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-white border border-emerald-300 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 inline-flex items-center gap-1 shrink-0"
                    title={`Preview ${l.label} voice`}
                  >
                    <Volume2 className="h-3.5 w-3.5" />
                    <span>Speak</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Speech Synthesis & Microphone Test */}
        <div className="lg:col-span-5 rounded-xl bg-white border border-emerald-200/80 p-6 space-y-5">
          <div className="flex items-center gap-2.5">
            <Volume2 className="h-5 w-5 text-emerald-700" />
            <h2 className="font-display text-base font-bold text-[#0D3B26]">Voice Playback & Mic Check</h2>
          </div>

          <div className="rounded-lg bg-[#F0FDF4] border border-emerald-200 p-3.5 text-sm text-emerald-950">
            <div className="text-xs font-semibold text-emerald-800 mb-1">
              Active Voice Greeting ({LANGUAGES.find((l) => l.code === language)?.label})
            </div>
            {SAMPLE_VOICE_GREETING[language]}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <label className="font-medium text-[#0D3B26]">Speech Playback Speed</label>
              <span className="font-mono text-emerald-800">{speechRate.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.7"
              max="1.4"
              step="0.1"
              value={speechRate}
              onChange={(e) => setSpeechRate(Number(e.target.value))}
              className="w-full accent-emerald-700"
            />
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => speakText(SAMPLE_VOICE_GREETING[language], language)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 text-white text-sm font-semibold hover:bg-emerald-800"
            >
              <Volume2 className="h-4 w-4" />
              <span>Play Active Language ({getSpeechLocale(language)})</span>
            </button>
            {isSpeaking && (
              <button
                onClick={stopSpeaking}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-100 text-amber-900 text-sm font-semibold hover:bg-amber-200"
              >
                <VolumeX className="h-4 w-4" />
                <span>Stop</span>
              </button>
            )}
          </div>

          <div className="pt-4 border-t border-emerald-100 space-y-3">
            <div className="text-sm font-medium text-[#0D3B26]">Voice Recognition Test</div>
            <button
              onClick={testMic}
              disabled={listening}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                listening ? 'bg-red-600 text-white' : 'bg-[#F0FDF4] border border-emerald-300 text-[#0D3B26] hover:bg-emerald-100'
              }`}
            >
              {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              <span>{listening ? tr('listeningLabel') : 'Test Microphone Input'}</span>
            </button>

            {micError && <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">{micError}</div>}
            {micTranscript && (
              <div className="text-sm bg-[#F0FDF4] border border-emerald-200 rounded-lg p-3">
                <strong>Captured Speech:</strong> {micTranscript}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
