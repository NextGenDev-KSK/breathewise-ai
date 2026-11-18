import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/components/app/AppProvider";
import { AppShell } from "@/components/app/AppShell";
import { ToastProvider } from "@/components/ui/Toast";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const display = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ["600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "BreatheWise AI: Urban Air Quality Assistant", template: "%s · BreatheWise AI" },
  description:
    "Understand the air. Make smarter choices. Breathe better. Explainable, location-aware clean-air guidance for urban households.",
  applicationName: "BreatheWise AI",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0a1222",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading request headers opts pages into dynamic rendering, which the per-request CSP nonce requires.
  await headers();
  return (
    <html lang="en-IN" className={`${inter.variable} ${display.variable}`}>
      <body>
        <ToastProvider>
          <AppProvider>
            <AppShell>{children}</AppShell>
          </AppProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
