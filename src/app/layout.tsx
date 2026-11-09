import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import { applyAppearance } from "@/lib/appearance";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-body" });
const outfit = Outfit({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-display" });

export const metadata: Metadata = { title: "Hookline", description: "Trend-aware reel scripts and a teleprompter." };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(${applyAppearance.toString()})()` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
