"use client";

import { useEffect, useRef, useState } from "react";

const steps = [
  {
    number: "01",
    title: "Deposit",
    subtitle: "& connect wallet",
    description: "Lock $10–$250+ USDC in your protected vault. Instantly receive 14 days of projected yield in your API Battery to start using AI.",
    code: `// UntouchedVaultV2 on Arc (5042002)
await vault.depositNative({ value: parseUnits("50", 18) });
// Principal stays in the vault.
// 14 days of 5% APY is added to the yield battery.`,
  },
  {
    number: "02",
    title: "Prompt",
    subtitle: "via drop-in proxy",
    description: "Point Cursor, Claude Code, or the OpenAI SDK to Untouched. All prompts pass through deterministic spend policy - requests exceeding your limit are blocked instantly with HTTP 403.",
    code: `// OpenAI SDK drop-in replacement
const client = new OpenAI({
  baseURL: "https://untouched.dev/api/v1",
  apiKey: "unt_live_demo_key"
});
const res = await client.chat.completions.create({
  model: "gpt-4o-mini", // $0.001 x402 Nanopayment
  messages: [{ role: "user", content: "Search Arc" }]
});`,
  },
  {
    number: "03",
    title: "Withdraw",
    subtitle: "principal comes back",
    description: "Prompts spend the yield battery only. Withdraw returns your principal minus what that battery already covered.",
    code: `await vault.withdraw();
// Pays principal minus used yield.
// The position is closed.`,
  },
];

export function HowItWorksSection() {
  const [activeStep, setActiveStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section
      id="how-it-works"
      ref={sectionRef}
      className="relative py-24 lg:py-32 bg-[oklch(0.09_0.01_260)] text-white overflow-hidden"
    >
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-white/[0.02] blur-[100px] pointer-events-none" />

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12">
        {/* Header — titre + image cerisier */}
        <div className="relative mb-0 lg:mb-0 grid lg:grid-cols-2 gap-4 lg:gap-12 items-end">
          {/* Titre colonne gauche */}
          <div className="overflow-hidden pb-0 lg:pb-32">
            <div className={`transition-all duration-1000 ${isVisible ? "translate-x-0 opacity-100" : "-translate-x-12 opacity-0"}`}>
              <span className="inline-flex items-center gap-3 text-sm font-mono text-white/40 mb-8">
                <span className="w-12 h-px bg-white/20" />
                End-to-End Flow
              </span>
            </div>
            
            <h2 className={`text-6xl md:text-7xl lg:text-[128px] font-display tracking-tight leading-[0.85] transition-all duration-1000 delay-100 ${
              isVisible ? "translate-y-0 opacity-100" : "translate-y-16 opacity-0"
            }`}>
              <span className="block">Deposit.</span>
              <span className="block text-white/30">Prompt.</span>
              <span className="block text-white/10">Reconcile.</span>
            </h2>
          </div>

          {/* Image cerisier — se colle en bas sur les blocs */}
          <div className={`relative h-[320px] lg:h-[640px] overflow-hidden transition-all duration-1000 delay-200 ${
            isVisible ? "opacity-100" : "opacity-0"
          }`}>
            <img
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/tree-uAia6REvB137CQyHFCf0za3O6h2zKO.png"
              alt=""
              aria-hidden="true"
              className="absolute bottom-0 left-0 w-full h-full object-contain object-bottom"
            />
            {/* Fade sur le bord gauche */}
            <div className="absolute inset-0 bg-gradient-to-r from-[oklch(0.09_0.01_260)] via-transparent to-transparent pointer-events-none" />
          </div>
        </div>

        {/* Horizontal Steps Layout */}
        <div className="grid lg:grid-cols-3 gap-4">
          {steps.map((step, index) => (
            <button
              key={step.number}
              type="button"
              onClick={() => setActiveStep(index)}
              className={`relative text-left p-8 lg:p-12 border transition-all duration-500 ${
                activeStep === index 
                  ? "bg-[#000000] border-white/60" 
                  : "bg-[#000000] border-white/25 hover:border-white/50"
              }`}
            >
              {/* Step number with animated line */}
              <div className="flex items-center gap-4 mb-8">
                <span className={`text-4xl font-display transition-colors duration-300 ${
                  activeStep === index ? "text-[#eca8d6]" : "text-white/20"
                }`}>
                  {step.number}
                </span>
                <div className="flex-1 h-px bg-white/10 overflow-hidden">
                  {activeStep === index && (
                    <div className="h-full bg-[#eca8d6]/50 animate-progress" />
                  )}
                </div>
              </div>

              {/* Title */}
              <h3 className="text-3xl lg:text-4xl font-display mb-2">
                {step.title}
              </h3>
              <span className="text-xl text-white/40 font-display block mb-6">
                {step.subtitle}
              </span>

              {/* Description */}
              <p className={`text-white/60 leading-relaxed transition-opacity duration-300 ${
                activeStep === index ? "opacity-100" : "opacity-60"
              }`}>
                {step.description}
              </p>

              {/* Active indicator */}
              <div className={`absolute bottom-0 left-0 right-0 h-1 bg-[#eca8d6] transition-transform duration-500 origin-left ${
                activeStep === index ? "scale-x-100" : "scale-x-0"
              }`} />
            </button>
          ))}
        </div>

        {/* Code Preview - Large terminal */}
        <div className={`mt-8 p-8 bg-black/50 border border-white/10 rounded-lg transition-all duration-700 min-h-[280px] ${
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}>
          <div className="flex items-center gap-2 mb-4 pb-4 border-b border-white/10">
            <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
            <div className="w-3 h-3 rounded-full bg-green-500/50"></div>
            <span className="ml-4 text-xs font-mono text-white/40">
              {activeStep === 0 ? "deposit.ts" : activeStep === 1 ? "prompt.ts" : "reconcile.ts"}
            </span>
          </div>
          <pre className="text-sm font-mono text-white/70 leading-relaxed overflow-x-auto">
            <code>{steps[activeStep].code}</code>
          </pre>
        </div>
      </div>

      <style jsx>{`
        @keyframes progress {
          from { width: 0%; }
          to { width: 100%; }
        }
        .animate-progress {
          animation: progress 6s linear forwards;
        }
      `}</style>
    </section>
  );
}
