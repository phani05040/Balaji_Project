import React, { useEffect, useState } from 'react';
import { Leaf, ShieldAlert, Upload, Volume2 } from 'lucide-react';
import { MEDIA_ASSETS } from '../assets/media';
import { useApp } from '../context/AppContext';

interface DiseaseResult {
  diseaseId: string;
  crop: string;
  predictedDisease: string;
  confidence: number;
  explanation: string;
  preventiveMeasures: string[];
  organicAction: string;
  scopeDisclaimer: string;
  imagePath: string;
}

export const DiseasePage: React.FC = () => {
  const { apiFetch, language, speakText, tr } = useApp();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<DiseaseResult | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [error, setError] = useState('');

  const loadHistory = async () => {
    const res = await apiFetch('/api/disease/history');
    if (res.ok) {
      const data = await res.json();
      setHistory(data.scans || []);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const picked = e.target.files?.[0];
    if (!picked) return;
    if (picked.size > 5 * 1024 * 1024) {
      setError('Image must be 5 MB or smaller.');
      return;
    }
    setFile(picked);
    setPreviewUrl(URL.createObjectURL(picked));
  };

  const analyzeUploaded = async () => {
    if (!file) return;
    setAnalyzing(true);
    setError('');
    try {
      const form = new FormData();
      form.append('leafImage', file);
      form.append('language', language);
      const res = await apiFetch('/api/disease/analyze', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Analysis failed.');
      else {
        setResult(data);
        loadHistory();
      }
    } catch {
      setError('Unable to reach disease inspection service.');
    } finally {
      setAnalyzing(false);
    }
  };

  const analyzeSampleLeaf = async () => {
    setAnalyzing(true);
    setError('');
    setPreviewUrl(MEDIA_ASSETS.leafDiseaseSample);
    try {
      const res = await apiFetch('/api/disease/analyze', {
        method: 'POST',
        body: JSON.stringify({
          sampleImagePath: MEDIA_ASSETS.leafSampleServerPath,
          language,
        }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Sample analysis failed.');
      else {
        setResult(data);
        loadHistory();
      }
    } catch {
      setError('Unable to reach disease inspection service.');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0D3B26]">{tr('navDisease')}</h1>
        <p className="text-sm text-emerald-900/75 mt-0.5">
          Upload a crop leaf photograph to screen for supported leaf diseases with preventive agricultural guidance.
        </p>
      </div>

      <div className="grid lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 rounded-xl bg-white border border-emerald-200/80 p-5 space-y-4">
          <h2 className="font-display text-base font-bold text-[#0D3B26]">Upload Leaf Photograph</h2>

          <label className="block rounded-xl border-2 border-dashed border-emerald-300 bg-[#F5F8F6] p-6 text-center cursor-pointer hover:bg-[#F0FDF4] transition-colors">
            <Upload className="h-7 w-7 text-emerald-700 mx-auto mb-2" />
            <div className="text-sm font-semibold text-[#0D3B26]">
              {file ? file.name : 'Choose JPG, PNG, or WEBP leaf photo'}
            </div>
            <div className="text-xs text-emerald-800/75 mt-1">Maximum file size: 5 MB</div>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onFileSelect} className="hidden" />
          </label>

          {previewUrl && (
            <div className="rounded-xl overflow-hidden border border-emerald-200 aspect-[4/3] bg-emerald-950/5">
              <img src={previewUrl} alt="Selected crop leaf" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
            </div>
          )}

          {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-800">{error}</div>}

          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              onClick={analyzeUploaded}
              disabled={!file || analyzing}
              className="flex-1 py-2.5 px-4 rounded-lg bg-emerald-700 text-white text-sm font-semibold hover:bg-emerald-800 disabled:opacity-50"
            >
              {analyzing ? 'Inspecting Leaf...' : 'Analyze Uploaded Leaf'}
            </button>
            <button
              onClick={analyzeSampleLeaf}
              disabled={analyzing}
              className="py-2.5 px-4 rounded-lg bg-[#F0FDF4] border border-emerald-300 text-[#0D3B26] text-sm font-semibold hover:bg-emerald-100"
            >
              Test Sample Leaf
            </button>
          </div>
        </div>

        <div className="lg:col-span-7 space-y-5">
          {result ? (
            <div className="rounded-xl bg-[#F0FDF4] border border-emerald-300 p-6 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-xl bg-[#0D3B26] text-white flex items-center justify-center shrink-0">
                    <Leaf className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-emerald-800">
                      Crop Scope: {result.crop} · Confidence <span className="font-mono">{result.confidence}%</span>
                    </div>
                    <h2 className="font-display text-xl font-bold text-[#0D3B26]">{result.predictedDisease}</h2>
                  </div>
                </div>
                <button
                  onClick={() => speakText(`${result.predictedDisease}. ${result.explanation}`)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  <span>{tr('speakBtn')}</span>
                </button>
              </div>

              <p className="text-sm text-emerald-950 leading-relaxed">{result.explanation}</p>

              <div className="rounded-lg bg-white border border-emerald-200 p-4 space-y-2">
                <h3 className="text-sm font-semibold text-[#0D3B26]">Preventive Measures</h3>
                <ul className="space-y-1.5 text-sm text-emerald-950/85">
                  {result.preventiveMeasures.map((m, i) => (
                    <li key={i}>· {m}</li>
                  ))}
                </ul>
                {result.organicAction && (
                  <p className="text-xs text-emerald-900 pt-2 border-t border-emerald-100">
                    <strong>Organic & Bio-Control Note:</strong> {result.organicAction}
                  </p>
                )}
              </div>

              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-950 flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-amber-700" />
                <span>{result.scopeDisclaimer}</span>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-white border border-emerald-200/80 p-8 text-center text-sm text-emerald-900/75">
              Upload a leaf photograph or click <strong>Test Sample Leaf</strong> to run disease screening across supported tomato, potato, rice, and maize conditions.
            </div>
          )}

          {history.length > 0 && (
            <div className="rounded-xl bg-white border border-emerald-200/80 p-5 space-y-3">
              <h3 className="font-display text-base font-bold text-[#0D3B26]">Recent Leaf Scans</h3>
              <div className="divide-y divide-emerald-100 text-sm">
                {history.map((s) => (
                  <div key={s.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-[#0D3B26]">{s.predicted_disease}</div>
                      <div className="text-xs text-emerald-800/75">
                        {s.crop_name} · {s.created_at}
                      </div>
                    </div>
                    <span className="font-mono text-xs font-semibold text-emerald-800 tabular-nums">
                      {s.confidence}% conf
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
