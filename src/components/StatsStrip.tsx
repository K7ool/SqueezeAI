import React from 'react';

export const StatsStrip: React.FC = () => {
  return (
    <div className="bg-[#1D2E24] text-[#FFFDF6] py-6 border-t border-b border-white/10">
      <div className="max-w-[1180px] mx-auto px-6 flex flex-wrap justify-between items-center gap-6">
        <div className="flex items-baseline gap-2.5 font-mono text-sm text-[#FFFDF6]/75">
          <span className="font-display text-2xl sm:text-3xl text-[#FFC93C] font-extrabold">40k+</span>
          <span>scripts generated weekly</span>
        </div>
        <div className="flex items-baseline gap-2.5 font-mono text-sm text-[#FFFDF6]/75">
          <span className="font-display text-2xl sm:text-3xl text-[#FFC93C] font-extrabold">2.1M</span>
          <span>lines of Luau shipped</span>
        </div>
        <div className="flex items-baseline gap-2.5 font-mono text-sm text-[#FFFDF6]/75">
          <span className="font-display text-2xl sm:text-3xl text-[#FFC93C] font-extrabold">9,800</span>
          <span>games built with Squeeze</span>
        </div>
        <div className="flex items-baseline gap-2.5 font-mono text-sm text-[#FFFDF6]/75">
          <span className="font-display text-2xl sm:text-3xl text-[#FFC93C] font-extrabold">4.8★</span>
          <span>creator satisfaction rating</span>
        </div>
      </div>
    </div>
  );
};
