"use client";

import { useEffect, useRef, useState } from "react";

export function CtaSection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="relative py-24 lg:py-32 overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div
          className={`relative border border-foreground transition-all duration-1000 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <div className="relative z-10 px-8 lg:px-16 py-16 lg:py-24">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
              <div className="flex-1">
                <h2 className="text-6xl md:text-7xl lg:text-[72px] font-display tracking-tight mb-8 leading-[0.95]">
                  Ready to make your
                  <br />
                  principal Untouched?
                </h2>

                <p className="text-xl text-muted-foreground mb-12 leading-relaxed max-w-xl">
                  Test the live AI playground on your PC and pair the mobile companion for vault controls and gasless Arc nanopayments.
                </p>

                <div className="flex flex-col sm:flex-row items-start gap-4">
                  <a
                    href="/dashboard"
                    className="bg-foreground hover:bg-foreground/90 text-background px-8 h-14 text-base rounded-full flex items-center justify-center transition-colors"
                  >
                    Open PC Dashboard
                  </a>
                  <a
                    href="/mobile"
                    className="h-14 px-8 text-base rounded-full border border-foreground/20 hover:bg-foreground/5 flex items-center justify-center transition-colors"
                  >
                    Open Mobile PWA
                  </a>
                </div>

                <p className="text-sm text-muted-foreground mt-8 font-mono">
                  Pre-seeded with $50 demo vault (<code>unt_live_demo_key</code>) on Arc Testnet • Chain ID 5042002
                </p>
              </div>
            </div>
          </div>

          <div className="absolute top-0 right-0 w-32 h-32 border-b border-l border-foreground/10" />
          <div className="absolute bottom-0 left-0 w-32 h-32 border-t border-r border-foreground/10" />
        </div>
      </div>
    </section>
  );
}
