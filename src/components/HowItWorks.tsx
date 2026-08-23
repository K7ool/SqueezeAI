import React from 'react';

export const HowItWorks: React.FC = () => {
  return (
    <section id="how" className="py-24 bg-[#FFFDF6]">
      <div className="max-w-[1180px] mx-auto px-6">
        {/* Section Header */}
        <div className="max-w-[640px] mb-14">
          <span className="font-mono text-xs uppercase font-bold tracking-widest text-[#FF6B4A]">
            The order of operations
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B120D] mt-3 tracking-tight">
            From idea to playable in three steps
          </h2>
          <p className="mt-3.5 text-base sm:text-lg text-[#0B120D]/65 leading-relaxed">
            Squeeze is built specifically for Roblox Studio's architecture, so nothing you generate requires manual boilerplate rework.
          </p>
        </div>

        {/* 3 Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 border border-[#0B120D]/15 rounded-3xl overflow-hidden bg-white shadow-sm">
          
          {/* Step 1 */}
          <div className="p-8 sm:p-9 border-b md:border-b-0 md:border-r border-[#0B120D]/15 flex flex-col justify-between">
            <div>
              <span className="font-mono text-sm font-extrabold text-[#FF6B4A]">01</span>
              <h3 className="text-xl font-bold text-[#0B120D] mt-3">Describe the mechanic</h3>
              <p className="mt-2.5 text-sm sm:text-[15px] text-[#0B120D]/65 leading-relaxed">
                Type what you want in plain English — “a leaderboard that saves across sessions with pcall” or “a shop GUI opening on click”.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#0B120D]/10 text-xs font-mono text-[#0B120D]/50">
              ✓ Natural language input
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-8 sm:p-9 border-b md:border-b-0 md:border-r border-[#0B120D]/15 flex flex-col justify-between">
            <div>
              <span className="font-mono text-sm font-extrabold text-[#FF6B4A]">02</span>
              <h3 className="text-xl font-bold text-[#0B120D] mt-3">Squeeze writes the Luau</h3>
              <p className="mt-2.5 text-sm sm:text-[15px] text-[#0B120D]/65 leading-relaxed">
                It incorporates modern Luau typing, <code className="text-xs bg-[#FFF8E7] px-1 py-0.5 rounded text-[#5C4A12]">task.wait</code>, safe DataStore retries, and clean RemoteEvent wiring.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#0B120D]/10 text-xs font-mono text-[#0B120D]/50">
              ✓ Studio-optimized Luau
            </div>
          </div>

          {/* Step 3 */}
          <div className="p-8 sm:p-9 flex flex-col justify-between">
            <div>
              <span className="font-mono text-sm font-extrabold text-[#FF6B4A]">03</span>
              <h3 className="text-xl font-bold text-[#0B120D] mt-3">Drop it in and playtest</h3>
              <p className="mt-2.5 text-sm sm:text-[15px] text-[#0B120D]/65 leading-relaxed">
                Copy or export the script directly into ServerScriptService, StarterPlayer, or ReplicatedStorage and test it immediately in Studio!
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#0B120D]/10 text-xs font-mono text-[#0B120D]/50">
              ✓ Ready for Explorer
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
