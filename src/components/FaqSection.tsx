import React, { useState } from 'react';
import { Plus } from 'lucide-react';

export const FaqSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: "Is the code generator on this page actually real?",
      a: "Yes! The generator on this page connects directly to our server-side AI model (Gemini 3.7 / Claude) with a specialized system prompt for Roblox Luau. It outputs real, commented, and runnable Luau code that you can copy or download directly into your Studio place."
    },
    {
      q: "Does Squeeze work with an existing place, or only new ones?",
      a: "Both! You can generate standalone mechanics from scratch, or you can describe your existing Explorer folder structure (e.g. 'reference RemoteEvents in ReplicatedStorage.Events and leaderstats') so generated scripts link seamlessly with what you've already built."
    },
    {
      q: "What happens to the scripts I generate?",
      a: "All generated scripts are stored in your Squeeze account dashboard history. You can search, favorite, re-generate, copy to clipboard, or download them as .server.lua / .client.lua files whenever you need them."
    },
    {
      q: "How does Squeeze handle DataStores safely?",
      a: "Squeeze automatically wraps all DataStoreService calls (GetAsync, SetAsync, UpdateAsync) in safe pcall blocks, includes BindToClose game loop listeners for server shutdown safety, and handles player debounce tables to prevent race conditions and lost player stats."
    },
    {
      q: "How do I install the Roblox Studio Plugin?",
      a: "Click 'Studio Plugin' in the navigation bar to see the step-by-step installation guide. You can install the Squeeze Companion Plugin via the Roblox Creator Marketplace or paste the Squeeze Injector module into ServerScriptService."
    },
    {
      q: "Can I use generated scripts in commercial Roblox games?",
      a: "Yes! Any script you generate with Squeeze belongs entirely to you. You are free to use, modify, and publish it in commercial experiences, monetize gamepasses, and ship on the Roblox platform."
    }
  ];

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="faq" className="py-24 bg-[#FFFDF6]">
      <div className="max-w-[840px] mx-auto px-6">
        
        {/* Section Header */}
        <div className="mb-12">
          <span className="font-mono text-xs uppercase font-bold tracking-widest text-[#FF6B4A]">
            Before you ask
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B120D] mt-3 tracking-tight">
            Frequently asked questions
          </h2>
        </div>

        {/* FAQ Accordion List */}
        <div className="border-t border-[#0B120D]/15 divide-y divide-[#0B120D]/15">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div key={idx} className="py-5">
                <button
                  onClick={() => toggle(idx)}
                  className="w-full flex items-center justify-between text-left font-display text-lg sm:text-xl font-bold text-[#0B120D] hover:text-[#FF6B4A] transition-colors cursor-pointer bg-transparent border-0 p-0"
                >
                  <span>{faq.q}</span>
                  <span className={`w-6 h-6 flex items-center justify-center font-mono text-xl text-[#FF6B4A] transition-transform duration-200 shrink-0 ml-4 ${
                    isOpen ? 'rotate-45' : ''
                  }`}>
                    +
                  </span>
                </button>

                {isOpen && (
                  <div className="mt-3.5 text-sm sm:text-[15px] leading-relaxed text-[#0B120D]/70 font-body">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
