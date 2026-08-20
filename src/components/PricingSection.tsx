import React from 'react';
import { User } from '../types';
import { Check, Sparkles, Zap, ShieldCheck } from 'lucide-react';

interface PricingSectionProps {
  user: User | null;
  onSelectPlan: (planId: 'free' | 'pro' | 'studio') => void;
  onOpenAuth: (mode: 'login' | 'register') => void;
  isUpgrading?: boolean;
}

export const PricingSection: React.FC<PricingSectionProps> = ({
  user,
  onSelectPlan,
  onOpenAuth,
  isUpgrading,
}) => {
  const plans = [
    {
      id: 'free' as const,
      name: 'Sip',
      price: '$0',
      period: '/mo',
      desc: 'For trying Squeeze out on a single Roblox place.',
      features: [
        '25 generations / month',
        'Basic script generation & edits',
        'Interactive error debugger',
        'Community Discord support'
      ],
      cta: user?.plan === 'free' ? 'Current plan' : 'Start free',
      featured: false,
    },
    {
      id: 'pro' as const,
      name: 'Pitcher',
      price: '$14',
      period: '/mo',
      desc: 'For active solo developers shipping games regularly.',
      features: [
        'Unlimited generations (500 soft cap)',
        'Hierarchy-aware Explorer edits',
        'UI generation from sketches',
        'Safe DataStore with auto-pcall',
        'Priority queue during peak hours'
      ],
      cta: user?.plan === 'pro' ? 'Current plan' : 'Start building',
      featured: true,
    },
    {
      id: 'studio' as const,
      name: 'Stand',
      price: '$39',
      period: '/mo',
      desc: 'For studios with multiple builders collaborating in a place.',
      features: [
        'Everything in Pitcher',
        'Up to 6 team seats',
        'Shared prompt & script history',
        'Studio API Key access',
        'Early access to new Luau models'
      ],
      cta: user?.plan === 'studio' ? 'Current plan' : 'Upgrade to Stand',
      featured: false,
    }
  ];

  const handlePlanClick = (planId: 'free' | 'pro' | 'studio') => {
    if (!user) {
      onOpenAuth('register');
      return;
    }
    onSelectPlan(planId);
  };

  return (
    <section id="pricing" className="py-24 bg-[#FFF8E7] border-t border-b border-[#0B120D]/10">
      <div className="max-w-[1180px] mx-auto px-6">
        
        {/* Section Header */}
        <div className="max-w-[640px] mb-14">
          <span className="font-mono text-xs uppercase font-bold tracking-widest text-[#FF6B4A]">
            Pick your size
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B120D] mt-3 tracking-tight">
            Simple pricing, cancel anytime
          </h2>
          <p className="mt-3.5 text-base sm:text-lg text-[#0B120D]/65 leading-relaxed">
            Every plan includes access to modern Luau generation and our instant Roblox error debugger.
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {plans.map((p) => {
            const isCurrent = user?.plan === p.id;
            return (
              <div
                key={p.id}
                className={`rounded-3xl p-8 flex flex-col justify-between transition-all duration-200 ${
                  p.featured
                    ? 'bg-[#0B120D] text-[#FFFDF6] border-2 border-[#0B120D] md:-translate-y-3 shadow-2xl relative'
                    : 'bg-[#FFFDF6] text-[#0B120D] border border-[#0B120D]/15'
                }`}
              >
                {p.featured && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#FFC93C] text-[#0B120D] text-xs font-mono font-bold uppercase rounded-full shadow-md">
                    Most Popular
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <span className={`font-mono text-xs uppercase font-bold tracking-widest ${
                      p.featured ? 'text-[#FFC93C]' : 'text-[#FF6B4A]'
                    }`}>
                      {p.name}
                    </span>
                    {isCurrent && (
                      <span className="px-2 py-0.5 rounded-full bg-[#A8E6B0]/20 text-[#A8E6B0] text-[10px] font-mono font-bold uppercase">
                        Active
                      </span>
                    )}
                  </div>

                  <div className="font-display text-4xl sm:text-5xl font-extrabold mt-3 flex items-baseline">
                    <span>{p.price}</span>
                    <span className={`text-sm font-body font-semibold ml-1 ${
                      p.featured ? 'text-[#FFFDF6]/60' : 'text-[#0B120D]/50'
                    }`}>
                      {p.period}
                    </span>
                  </div>

                  <p className={`mt-2.5 text-xs sm:text-sm leading-relaxed ${
                    p.featured ? 'text-[#FFFDF6]/70' : 'text-[#0B120D]/60'
                  }`}>
                    {p.desc}
                  </p>

                  {/* Feature Checklist */}
                  <ul className="mt-7 space-y-3 p-0 list-none text-xs sm:text-sm">
                    {p.features.map((feat, fIdx) => (
                      <li key={fIdx} className="flex items-start gap-2.5">
                        <Check className={`w-4 h-4 shrink-0 mt-0.5 ${
                          p.featured ? 'text-[#FFC93C]' : 'text-[#FF6B4A]'
                        }`} />
                        <span className={p.featured ? 'text-[#FFFDF6]/90' : 'text-[#0B120D]/80'}>
                          {feat}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Plan Button */}
                <div className="mt-8 pt-6 border-t border-current/10">
                  <button
                    onClick={() => handlePlanClick(p.id)}
                    disabled={isCurrent || isUpgrading}
                    className={`w-full py-3.5 rounded-full font-bold text-sm transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                      p.featured
                        ? 'btn-squeeze text-[#0B120D]'
                        : 'bg-transparent border border-[#0B120D]/20 hover:border-[#0B120D] text-[#0B120D]'
                    }`}
                  >
                    {isCurrent ? 'Current plan' : p.cta}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Stripe & Security Badge */}
        <div className="mt-12 text-center text-xs font-mono text-[#0B120D]/50 flex items-center justify-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#2A6B47]" />
          <span>Powered by Stripe Billing · 256-bit encryption · Cancel anytime</span>
        </div>

      </div>
    </section>
  );
};
