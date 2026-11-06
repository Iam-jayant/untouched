import type { Metadata } from "next";
import { Instrument_Sans, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "@/styles/globals.css";
import ClientProviders from "@/components/providers/ClientProviders";
import { PwaRegister } from "@/components/providers/PwaRegister";
import { Toaster } from "sonner";

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-instrument-serif",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Untouched — Principal-Protected AI Gateway",
  description: "Deposit USDC, get an OpenAI-compatible API key. Your principal stays untouched — only yield pays for AI prompts via Circle Nanopayments on Arc Testnet.",
  keywords: ["AI", "API", "USDC", "Circle", "Arc", "InfrGate", "Chainlink", "DeFi", "Nanopayments"],
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Untouched",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${instrumentSans.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} dark`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Untouched" />
        <meta name="theme-color" content="#000000" />
      </head>
      <body className="antialiased bg-[#090A0F] text-white" suppressHydrationWarning>
        <PwaRegister />
        <Toaster position="top-center" richColors expand={true} />
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
