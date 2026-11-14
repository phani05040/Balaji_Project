import React, { useState } from 'react';
import { Lock, Mail, MapPin, Sprout, User as UserIcon } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { LANGUAGES } from '../i18n/translations';
import { LanguageCode } from '../types';

export const AuthPage: React.FC<{ mode: 'login' | 'register' }> = ({ mode }) => {
  const { setPage, loginUser } = useApp();
  const [identifier, setIdentifier] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [location, setLocation] = useState('Guntur, Andhra Pradesh');
  const [preferredLanguage, setPreferredLanguage] = useState<LanguageCode>('en');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submitAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body =
        mode === 'login'
          ? { identifier, password }
          : { fullName, username, email, password, location, preferredLanguage };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Authentication failed.');
      } else {
        loginUser(data.user, data.token);
      }
    } catch {
      setError('Unable to connect to authentication server.');
    } finally {
      setLoading(false);
    }
  };

  const loginDemo = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: 'arjun@greenfield.ag', password: 'Farmer@2026' }),
      });
      const data = await res.json();
      if (res.ok) loginUser(data.user, data.token);
      else setError(data.error || 'Demo login failed.');
    } catch {
      setError('Server connection failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto my-6 rounded-2xl bg-white border border-emerald-200/80 p-7 sm:p-9 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-[#0D3B26] text-white flex items-center justify-center shrink-0">
          <Sprout className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0D3B26]">
            {mode === 'login' ? 'Farmer Sign In' : 'Create Farmer Account'}
          </h1>
          <p className="text-sm text-emerald-900/75">
            {mode === 'login'
              ? 'Access your saved soil analyses, ML crop plans, and farm history.'
              : 'Register to save farm records, seasonal calendars, and PDF reports.'}
          </p>
        </div>
      </div>

      {/* Mode Switch Tabs */}
      <div className="grid grid-cols-2 gap-1 p-1 bg-[#F0FDF4] rounded-lg border border-emerald-200">
        <button
          type="button"
          onClick={() => {
            setError('');
            setPage('login');
          }}
          className={`py-2 text-sm font-semibold rounded-md transition-colors ${
            mode === 'login' ? 'bg-white text-[#0D3B26] shadow-sm' : 'text-emerald-800 hover:text-[#0D3B26]'
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => {
            setError('');
            setPage('register');
          }}
          className={`py-2 text-sm font-semibold rounded-md transition-colors ${
            mode === 'register' ? 'bg-white text-[#0D3B26] shadow-sm' : 'text-emerald-800 hover:text-[#0D3B26]'
          }`}
        >
          Register
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-sm text-red-800">
          {error}
        </div>
      )}

      <form onSubmit={submitAuth} className="space-y-4">
        {mode === 'login' ? (
          <div>
            <label className="block text-sm font-medium text-[#0D3B26] mb-1">Email or Username</label>
            <div className="relative">
              <Mail className="h-4 w-4 text-emerald-700 absolute left-3 top-3" />
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="arjun@greenfield.ag or arjun_farmer"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-emerald-200 focus:outline-none focus:border-emerald-700"
              />
            </div>
          </div>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-sm font-medium text-[#0D3B26] mb-1">Full Name</label>
                <div className="relative">
                  <UserIcon className="h-4 w-4 text-emerald-700 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Srinivas Rao"
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-emerald-200 focus:outline-none focus:border-emerald-700"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#0D3B26] mb-1">Username</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="srinivas_farm"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-emerald-200 focus:outline-none focus:border-emerald-700"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#0D3B26] mb-1">Email Address</label>
              <div className="relative">
                <Mail className="h-4 w-4 text-emerald-700 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="farmer@example.com"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-emerald-200 focus:outline-none focus:border-emerald-700"
                />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-sm font-medium text-[#0D3B26] mb-1">District / Location</label>
                <div className="relative">
                  <MapPin className="h-4 w-4 text-emerald-700 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-emerald-200 focus:outline-none focus:border-emerald-700"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#0D3B26] mb-1">Preferred Language</label>
                <select
                  value={preferredLanguage}
                  onChange={(e) => setPreferredLanguage(e.target.value as LanguageCode)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-emerald-200 bg-white focus:outline-none focus:border-emerald-700"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label} ({l.nativeLabel})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}

        <div>
          <label className="block text-sm font-medium text-[#0D3B26] mb-1">Password</label>
          <div className="relative">
            <Lock className="h-4 w-4 text-emerald-700 absolute left-3 top-3" />
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-emerald-200 focus:outline-none focus:border-emerald-700"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-lg bg-emerald-700 text-white text-sm font-semibold hover:bg-emerald-800 transition-colors disabled:opacity-60"
        >
          {loading ? 'Please wait...' : mode === 'login' ? 'Sign In to Dashboard' : 'Create Account'}
        </button>
      </form>

      {mode === 'login' && (
        <div className="pt-4 border-t border-emerald-100 space-y-2.5">
          <div className="text-xs text-emerald-900/75">
            Sample Farmer Credentials: <span className="font-mono">arjun@greenfield.ag</span> · <span className="font-mono">Farmer@2026</span>
          </div>
          <button
            type="button"
            onClick={loginDemo}
            disabled={loading}
            className="w-full py-2 rounded-lg bg-[#F0FDF4] border border-emerald-300 text-[#0D3B26] text-sm font-semibold hover:bg-emerald-100 transition-colors"
          >
            Sign In with Demo Farmer Account
          </button>
        </div>
      )}
    </div>
  );
};
