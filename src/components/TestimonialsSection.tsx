import React from 'react';

export const TestimonialsSection: React.FC = () => {
  const testimonials = [
    {
      quote: "I had a working tycoon drop system in ten minutes instead of a weekend of YouTube tutorials. It matched the folder structure I already had.",
      author: "jayrblx",
      role: "Tycoon dev · 1.2M visits",
      initials: "JR"
    },
    {
      quote: "The debug feature alone is worth it. I paste the red error text from Output and it explains the exact nil check issue and rewrites the script safely.",
      author: "lumen_studio",
      role: "Solo dev · Obby Creator",
      initials: "LM"
    },
    {
      quote: "My whole team uses Squeeze so our scripts follow consistent modern Luau conventions and safe DataStore pcall wrappers instead of messy hacks.",
      author: "tinkerco",
      role: "4-person studio",
      initials: "TK"
    }
  ];

  return (
    <section className="py-24 bg-[#FFFDF6]">
      <div className="max-w-[1180px] mx-auto px-6">
        
        {/* Section Header */}
        <div className="max-w-[640px] mb-14">
          <span className="font-mono text-xs uppercase font-bold tracking-widest text-[#FF6B4A]">
            From the stand
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B120D] mt-3 tracking-tight">
            What creators are building with it
          </h2>
        </div>

        {/* Tickets Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t, idx) => (
            <div
              key={idx}
              className="ticket-edge relative bg-[#FFFDF6] border border-[#0B120D]/15 rounded-xl p-7 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow"
            >
              <p className="text-sm sm:text-[14.5px] leading-relaxed text-[#0B120D]/80 italic">
                “{t.quote}”
              </p>

              <div className="mt-6 pt-4 border-t border-[#0B120D]/10 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#FFC93C] flex items-center justify-center font-display font-bold text-xs text-[#0B120D] shadow-sm">
                  {t.initials}
                </div>
                <div>
                  <div className="font-bold text-xs text-[#0B120D] font-mono">{t.author}</div>
                  <div className="text-[11px] text-[#0B120D]/50 font-mono">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};
