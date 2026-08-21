import React, { useState } from 'react';
import { Mail, CheckCircle2, RefreshCw, AlertCircle } from 'lucide-react';
import { safeFetchJson } from '../utils/api';
import { sound } from '../utils/audio';

export const NewsletterSection: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@') || isLoading) return;

    sound.zap();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await safeFetchJson('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (!res.ok) {
        throw new Error(res.error || 'Failed to subscribe.');
      }

      sound.success();
      setSuccessMessage(res.data?.message || `✓ You're registered! We'll send updates to ${email}.`);
      setEmail('');
    } catch (err: any) {
      sound.error();
      setErrorMessage(err.message || 'Subscription failed. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="py-20 bg-[#FFF8E7] border-t border-[#0B120D]/10">
      <div className="max-w-[1180px] mx-auto px-6">
        <div className="max-w-[540px] mx-auto text-center bg-[#FFFDF6] border border-[#0B120D]/15 rounded-3xl p-8 sm:p-10 shadow-lg relative">
          
          <div className="w-12 h-12 rounded-2xl bg-[#FFC93C] text-[#0B120D] mx-auto flex items-center justify-center shadow-md mb-5">
            <Mail className="w-6 h-6" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0B120D] tracking-tight">
            Get notified when Squeeze updates
          </h2>

          <p className="mt-2.5 text-xs sm:text-sm text-[#0B120D]/65 leading-relaxed">
            Join 12,000+ Roblox creators receiving weekly Luau tips, new model drops, and Studio plugin updates.
          </p>

          {successMessage ? (
            <div className="mt-6 p-4 rounded-2xl bg-[#A8E6B0]/20 border border-[#A8E6B0]/40 text-[#2A6B47] text-xs font-mono font-bold flex items-center justify-center gap-2 animate-in zoom-in-95 duration-200">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          ) : (
            <form onSubmit={handleSubscribe} className="mt-6">
              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@robloxdev.com"
                  required
                  className="flex-1 bg-white border border-[#0B120D]/15 rounded-full px-5 py-3 text-sm text-[#0B120D] placeholder:text-[#0B120D]/35 focus:outline-none focus:border-[#FF6B4A] transition-colors font-body shadow-inner"
                />
                <button
                  type="submit"
                  disabled={isLoading || !email}
                  className="btn-squeeze font-bold text-sm px-6 py-3 rounded-full cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 shrink-0 active:scale-95"
                >
                  {isLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Subscribe</span>
                  )}
                </button>
              </div>

              {errorMessage && (
                <div className="mt-3 text-xs font-mono text-[#E85C4A] flex items-center justify-center gap-1.5 animate-in fade-in">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="mt-4 text-[11px] font-mono text-[#0B120D]/45">
                🔒 No spam. Unsubscribe with 1-click anytime.
              </div>
            </form>
          )}

        </div>
      </div>
    </section>
  );
};

