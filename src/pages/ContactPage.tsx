import React, { useState } from 'react';
import { Mail, MapPin, Phone, Send } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const ContactPage: React.FC = () => {
  const { user, tr } = useApp();
  const [name, setName] = useState(user?.fullName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [subject, setSubject] = useState('Agronomy & Soil Testing Inquiry');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [sending, setSending] = useState(false);

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setStatus(null);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus({ ok: true, text: data.message });
        setMessage('');
      } else {
        setStatus({ ok: false, text: data.error || 'Failed to submit message.' });
      }
    } catch {
      setStatus({ ok: false, text: 'Connection error submitting form.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0D3B26]">{tr('navContact')}</h1>
        <p className="text-sm text-emerald-900/75 mt-0.5">
          Reach out for agronomy dataset inquiries, local extension partnerships, or technical support.
        </p>
      </div>

      <div className="grid lg:grid-cols-12 gap-6 items-start">
        <form onSubmit={submitForm} className="lg:col-span-7 rounded-xl bg-white border border-emerald-200/80 p-6 space-y-4">
          <h2 className="font-display text-base font-bold text-[#0D3B26]">Send a Message</h2>

          {status && (
            <div
              className={`rounded-lg border px-4 py-3 text-sm ${
                status.ok
                  ? 'bg-[#F0FDF4] border-emerald-300 text-emerald-900'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              {status.text}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#0D3B26] mb-1">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-emerald-200 focus:outline-none focus:border-emerald-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#0D3B26] mb-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-emerald-200 focus:outline-none focus:border-emerald-700"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#0D3B26] mb-1">Subject</label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-emerald-200 focus:outline-none focus:border-emerald-700"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#0D3B26] mb-1">Message</label>
            <textarea
              rows={4}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your farm location, crop query, or feedback..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-emerald-200 focus:outline-none focus:border-emerald-700"
            />
          </div>

          <button
            type="submit"
            disabled={sending}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-700 text-white text-sm font-semibold hover:bg-emerald-800 disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            <span>{sending ? 'Submitting...' : 'Submit Inquiry'}</span>
          </button>
        </form>

        <div className="lg:col-span-5 rounded-xl bg-[#F0FDF4] border border-emerald-200 p-6 space-y-4">
          <h2 className="font-display text-base font-bold text-[#0D3B26]">Agricultural Support Desk</h2>
          <div className="space-y-3 text-sm text-emerald-950/85">
            <div className="flex items-start gap-2.5">
              <MapPin className="h-4 w-4 text-emerald-700 mt-0.5 shrink-0" />
              <span>AgriSense Agronomy Research Lab, Lam Farm Road, Guntur, Andhra Pradesh 522034</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Mail className="h-4 w-4 text-emerald-700 shrink-0" />
              <span>support@agrisense.ag</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Phone className="h-4 w-4 text-emerald-700 shrink-0" />
              <span className="font-mono">+91 1800-425-AGRI (Kisan Desk)</span>
            </div>
          </div>
          <div className="pt-3 border-t border-emerald-200 text-xs text-emerald-900/80 leading-relaxed">
            For emergency pest outbreaks or subsidized soil health card testing, contact your nearest Krishi Vigyan Kendra (KVK) alongside using AgriSense diagnostics.
          </div>
        </div>
      </div>
    </div>
  );
};
