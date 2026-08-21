import React from 'react';
import { sound } from '../utils/audio';

interface FooterProps {
  onOpenStudioGuide: () => void;
  onScrollToTry: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenStudioGuide, onScrollToTry }) => {
  return (
    <footer>
      {/* CTA Band */}
      <section className="bg-[#FFC93C] text-[#0B120D] py-18 text-center border-b border-[#0B120D]/10">
        <div className="max-w-[1180px] mx-auto px-6">
          <span className="font-mono text-xs uppercase font-bold tracking-widest text-[#0B120D]/60">
            Ready when you are
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#0B120D] mt-3 tracking-tight">
            Your next game is one prompt away
          </h2>
          <p className="mt-3.5 text-base sm:text-lg max-w-[480px] mx-auto text-[#0B120D]/75 leading-relaxed">
            Install the companion plugin or copy Luau directly into Studio to test your first mechanic.
          </p>

          <div className="flex flex-wrap justify-center gap-3.5 mt-8">
            <button
              onClick={() => {
                sound.click();
                onOpenStudioGuide();
              }}
              className="btn-squeeze-dark font-bold text-sm px-6 py-3.5 rounded-full cursor-pointer active:scale-95"
            >
              Add to Roblox Studio
            </button>
            <button
              onClick={() => {
                sound.pop();
                onScrollToTry();
              }}
              className="px-6 py-3.5 rounded-full font-bold text-sm bg-transparent border-2 border-[#0B120D]/30 hover:border-[#0B120D] text-[#0B120D] transition-all cursor-pointer active:scale-95 hover:bg-black/5"
            >
              Try the live generator ↑
            </button>
          </div>
        </div>
      </section>

      {/* Main Footer */}
      <div className="bg-[#142019] text-[#FFFDF6]/60 pt-16 pb-12 text-sm border-t border-white/10">
        <div className="max-w-[1180px] mx-auto px-6">
          
          <div className="flex flex-wrap justify-between gap-10 pb-12 border-b border-white/10">
            {/* Brand Col */}
            <div className="max-w-[280px]">
              <a href="#" className="flex items-center gap-2.5 text-[#FFFDF6] no-underline">
                <span className="w-8 h-8 rounded-xl bg-[#FFC93C] flex items-center justify-center text-[#0B120D] text-base shadow-[0_3px_0_#F0A500]">
                  🍋
                </span>
                <span className="font-display font-bold text-2xl tracking-tight">Squeeze</span>
              </a>
              <p className="mt-3 text-xs leading-relaxed text-[#FFFDF6]/50">
                An AI building partner for Roblox creators, living right inside your development workflow.
              </p>
            </div>

            {/* Links Columns */}
            <div className="flex flex-wrap gap-12 sm:gap-16 font-mono text-xs">
              <div>
                <h4 className="text-[#FFFDF6]/40 uppercase tracking-wider font-bold mb-3.5">Product</h4>
                <ul className="space-y-2.5 p-0 list-none m-0">
                  <li><a href="#features" className="hover:text-[#FFC93C] transition-colors">Features</a></li>
                  <li><a href="#debugger" className="hover:text-[#FFC93C] transition-colors">Error Debugger</a></li>
                  <li><a href="#showcase" className="hover:text-[#FFC93C] transition-colors">Luau Showcase</a></li>
                  <li><a href="#pricing" className="hover:text-[#FFC93C] transition-colors">Pricing Plans</a></li>
                </ul>
              </div>

              <div>
                <h4 className="text-[#FFFDF6]/40 uppercase tracking-wider font-bold mb-3.5">Resources</h4>
                <ul className="space-y-2.5 p-0 list-none m-0">
                  <li><button onClick={() => { sound.click(); onOpenStudioGuide(); }} className="hover:text-[#FFC93C] transition-colors cursor-pointer bg-transparent border-0 p-0 text-inherit font-mono text-xs">Studio Plugin Guide</button></li>
                  <li><a href="#faq" className="hover:text-[#FFC93C] transition-colors">Roblox FAQ</a></li>
                  <li><a href="https://create.roblox.com/docs" target="_blank" rel="noreferrer" className="hover:text-[#FFC93C] transition-colors">Roblox Creator Docs</a></li>
                </ul>
              </div>

              <div>
                <h4 className="text-[#FFFDF6]/40 uppercase tracking-wider font-bold mb-3.5">Platform</h4>
                <ul className="space-y-2.5 p-0 list-none m-0">
                  <li><span className="text-[#A8E6B0] font-bold">● Status: Operational</span></li>
                  <li><span className="text-[#FFFDF6]/50">v1.4.0 Engine</span></li>
                  <li><span className="text-[#FFFDF6]/50">Gemini 3.7 / Claude Luau</span></li>
                </ul>
              </div>
            </div>

          </div>

          {/* Bottom Bar */}
          <div className="pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-mono text-[#FFFDF6]/40">
            <span>© 2026 Squeeze Labs. Not affiliated with Roblox Corporation.</span>
            <span>Made for builders, not bots. 🍋</span>
          </div>

        </div>
      </div>
    </footer>
  );
};

