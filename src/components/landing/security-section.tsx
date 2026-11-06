"use client";

import { useEffect, useState, useRef } from "react";
import { Shield, Lock, Eye, FileCheck } from "lucide-react";

const securityFeatures = [
  {
    icon: Shield,
    title: "Air-Gapped Agent Signer",
    description: "The API key only controls an isolated EOA pre-funded with yield credit. It has zero ERC-20 allowance over vault principal.",
  },
  {
    icon: Lock,
    title: "One position per wallet",
    description: "A stake adds to your principal and your yield battery. Nothing else is recorded, and the same wallet cannot open a second position.",
  },
  {
    icon: Eye,
    title: "Per-call spend cap",
    description: "Any prompt over your limit ($0.005 by default) is rejected immediately. The call costs $0 and your principal stays in the vault.",
  },
  {
    icon: FileCheck,
    title: "Principal-First Early Exit",
    description: "Withdraw anytime—even 5 minutes after depositing. The vault deducts only unpaid advance cents ($50 - $0.095 = $49.90), keeping the pool 100% solvent.",
  },
];

export function SecuritySection() {
  const [isVisible, setIsVisible] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);
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

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % securityFeatures.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section id="security" ref={sectionRef} className="relative py-32 lg:py-40 overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="mb-20">
          <span className={`inline-flex items-center gap-4 text-sm font-mono text-muted-foreground mb-8 transition-all duration-700 ${
            isVisible ? "opacity-100" : "opacity-0"
          }`}>
            <span className="w-12 h-px bg-foreground/20" />
            Cryptographic Guardrails
          </span>
          
          <h2 className={`text-6xl md:text-7xl lg:text-[128px] font-display tracking-tight leading-[0.9] mb-12 transition-all duration-1000 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}>
            Autonomous,
            <br />
            <span className="text-muted-foreground">never uncontrolled.</span>
          </h2>
          
          <div className={`transition-all duration-1000 delay-100 ${
            isVisible ? "opacity-100" : "opacity-0"
          }`}>
            <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl">
              Powered by Arc and Chainlink. Even if an autonomous coding agent enters an infinite loop, your underlying USDC principal cannot be touched.
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-6">
          <div className={`lg:col-span-7 relative p-8 lg:p-12 border border-foreground/10 min-h-[400px] overflow-hidden transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}>
            <div className="relative z-10">
              <span className="font-mono text-sm text-muted-foreground">Principal Solvency Guarantee</span>
              <div className="mt-8">
                <span className="text-7xl lg:text-8xl font-display">100%</span>
                <span className="block text-muted-foreground mt-2">Onchain solvency enforced via Principal-First Early Exit</span>
              </div>
            </div>
            
            <div className="absolute bottom-8 left-8 right-8 flex flex-wrap gap-2">
              {["Arc Testnet (5042002)", "Circle x402", "USDC principal vault", "Chainlink CRE"].map((cert, index) => (
                <span
                  key={cert}
                  className={`px-3 py-1 border border-foreground/10 text-xs font-mono text-muted-foreground transition-all duration-500 ${
                    isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                  }`}
                  style={{ transitionDelay: `${index * 100 + 300}ms` }}
                >
                  {cert}
                </span>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col gap-4">
            {securityFeatures.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className={`p-6 border transition-all duration-500 cursor-default ${
                    activeFeature === index 
                      ? "border-foreground/30 bg-foreground/[0.04]" 
                      : "border-foreground/10"
                  } ${isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"}`}
                  style={{ transitionDelay: `${index * 80}ms` }}
                  onClick={() => setActiveFeature(index)}
                  onMouseEnter={() => setActiveFeature(index)}
                >
                  <div className="flex items-start gap-4">
                    <div className={`shrink-0 w-10 h-10 flex items-center justify-center border transition-colors ${
                      activeFeature === index 
                        ? "border-foreground bg-foreground text-background" 
                        : "border-foreground/20"
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-medium mb-1">{feature.title}</h3>
                      <p className="text-sm text-muted-foreground">{feature.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
