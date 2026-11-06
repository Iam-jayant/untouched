"use client";

import Link from "next/link";

const footerLinks = {
  Product: [
    { name: "Architecture", href: "#features" },
    { name: "How it Works", href: "#how-it-works" },
    { name: "Security", href: "#security" },
    { name: "Deposit Tiers", href: "#pricing" },
  ],
  Developers: [
    { name: "API Docs", href: "#developers" },
    { name: "GitHub", href: "https://github.com/Iam-jayant/touched" },
    { name: "Smart Contracts", href: "https://github.com/Iam-jayant/touched/tree/main/contracts" },
  ],
  Resources: [
    { name: "PC Dashboard", href: "/dashboard" },
    { name: "Mobile PWA", href: "/mobile" },
    { name: "Arc Testnet", href: "https://testnet.arcscan.org/" },
  ],
};

export function FooterSection() {
  return (
    <footer className="relative bg-black text-white">
      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="py-16 lg:py-20">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-12 lg:gap-8">
            <div className="col-span-2">
              <Link href="/" className="inline-flex items-center gap-2 mb-6">
                <span className="text-2xl font-display tracking-normal text-white">UNTOUCHED</span>
              </Link>

              <p className="text-white/50 leading-relaxed mb-8 max-w-xs text-sm">
                Your savings. Your AI API key&apos;s spending power. Separate by design. Built on Arc.
              </p>

              <div className="flex gap-6">
                {["GitHub", "Twitter", "Discord"].map((link) => (
                  <a
                    key={link}
                    href="#"
                    className="text-sm text-white/40 hover:text-white transition-colors"
                  >
                    {link}
                  </a>
                ))}
              </div>
            </div>

            {Object.entries(footerLinks).map(([title, links]) => (
              <div key={title}>
                <h3 className="text-sm font-medium text-white mb-6">{title}</h3>
                <ul className="space-y-4">
                  {links.map((link) => (
                    <li key={link.name}>
                      <a
                        href={link.href}
                        className="text-sm text-white/40 hover:text-white transition-colors"
                      >
                        {link.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="py-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-white/30">
            &copy; 2026 Untouched Protocol • Built with Arc Studio on Arc Testnet (5042002)
          </p>

          <div className="flex items-center gap-4 text-sm text-white/30">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#eca8d6]" />
              Vault & x402 Gateway Operational
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
