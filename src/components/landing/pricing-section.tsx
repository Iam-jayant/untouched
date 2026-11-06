"use client";

import { useState, useEffect, useRef } from "react";
import { Check, Zap } from "lucide-react";

const plans = [
  {
    name: "Starter Deposit",
    description: "For light terminal & quick faucet testing",
    price: 10,
    features: [
      "$0.0192 instant 14-day yield battery",
      "~19 routine AI prompts on Day 1",
      "Arc Marketplace x402 tool access",
      "Per-call spend cap",
      "Instant principal-first withdrawal",
    ],
    cta: "Deposit $10",
    highlight: false,
  },
  {
    name: "Developer Vault",
    description: "Ideal daily driver for Cursor & coding agents",
    price: 50,
    badge: "DEFAULT DEMO TIER",
    features: [
      "$0.0959 instant 14-day yield battery",
      "~95 routine AI prompts on Day 1",
      "Heavy models billed from the yield battery",
      "Mobile Companion PWA remote control",
      "Automated Chainlink CRE yield refill",
      "Full x402 EIP-3009 receipt inspector",
    ],
    cta: "Launch with $50",
    highlight: true,
  },
  {
    name: "Custom Whale Vault",
    description: "For heavy multi-agent & Deep Research workflows",
    price: null,
    priceRange: "$100–$250+",
    features: [
      "$0.1918 to $0.4795+ instant yield battery",
      "190 to 480+ prompts per 14-day cycle",
      "Configurable per-call spend slider",
      "Configurable per-call spend limit",
      "Zero gas bleed (Vault G2 gas buffer)",
    ],
    cta: "Choose Custom Amount",
    highlight: false,
  },
];

export function PricingSection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

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

  return (
    <section id="pricing" ref={sectionRef} className="relative py-32 lg:py-40">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="grid lg:grid-cols-12 gap-8 mb-20">
          <div className="lg:col-span-7">
            <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-8">
              <span className="w-12 h-px bg-foreground/30" />
              Zero Monthly Fees
            </span>
            <h2 className={`text-6xl md:text-7xl lg:text-[128px] font-display tracking-tight leading-[0.9] transition-all duration-1000 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}>
              Deposit once.
              <br />
              <span className="text-muted-foreground">Spend your yield.</span>
            </h2>
          </div>
        </div>

        <div className="relative">
          <div className="grid lg:grid-cols-3 gap-4 lg:gap-0">
            {plans.map((plan, index) => (
              <div
                key={plan.name}
                className={`relative bg-background border transition-all duration-700 ${
                  plan.highlight 
                    ? "border-foreground lg:-mx-2 lg:z-10 lg:scale-105" 
                    : "border-foreground/10 lg:first:-mr-2 lg:last:-ml-2"
                } ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                {/* Popular badge */}
                {plan.badge && (
                  <div className="absolute -top-4 left-8 right-8 flex justify-center">
                    <span className="inline-flex items-center gap-2 px-4 py-2 bg-foreground text-background text-xs font-mono uppercase tracking-widest">
                      <Zap className="w-3 h-3" />
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div className="p-8 lg:p-10">
                  <div className="mb-8 pb-8 border-b border-foreground/10">
                    <span className="font-mono text-xs text-muted-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h3 className="text-2xl lg:text-3xl font-display mt-2">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
                  </div>

                  <div className="mb-8">
                    {plan.price !== null ? (
                      <>
                        <div className="flex items-baseline gap-2">
                          <span className="text-5xl lg:text-6xl font-display">
                            ${plan.price}
                          </span>
                          <span className="text-muted-foreground text-sm">USDC</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2 font-mono">
                          100% withdrawable principal
                        </p>
                      </>
                    ) : (
                      <>
                        <span className="text-4xl font-display">{plan.priceRange}</span>
                        <p className="text-xs text-muted-foreground mt-2 font-mono">
                          Linearly scaled yield credit
                        </p>
                      </>
                    )}
                  </div>

                  <ul className="space-y-3 mb-10">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <Check className="w-4 h-4 text-[#eca8d6] mt-0.5 shrink-0" />
                        <span className="text-sm text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <a
                    href="/dashboard"
                    className={`w-full py-4 flex items-center justify-center gap-2 text-sm font-medium transition-all group ${
                      plan.highlight
                        ? "bg-foreground text-background hover:bg-foreground/90"
                        : "border border-foreground/20 text-foreground hover:border-foreground hover:bg-foreground/5"
                    }`}
                  >
                    {plan.cta}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom note */}
        <div className={`mt-20 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8 pt-12 border-t border-foreground/10 transition-all duration-1000 delay-500 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}>
          <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#eca8d6]" />
              0% subscription fees
            </span>
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#eca8d6]" />
              100% non-custodial principal
            </span>
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#eca8d6]" />
              Instant early exit
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
