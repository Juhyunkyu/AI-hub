import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/components/auth-provider";
import { QueryProvider } from "@/providers/query-provider";
import { Navbar } from "@/components/navbar";
import { SiteFooter } from "@/components/site-footer";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { WebVitalsMonitor } from "@/components/performance/WebVitalsMonitor";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false, // Mono 폰트는 즉시 사용되지 않을 수 있으므로
});

export const metadata: Metadata = {
  title: "AI Hub",
  description: "AI 정보 공유/교류 허브",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-dvh bg-background text-foreground`}
      >
        <ThemeProvider>
          <QueryProvider>
            <AuthProvider>
              <WebVitalsMonitor />
              <ServiceWorkerRegister />
              <Navbar />
              <main className="mx-auto w-full max-w-6xl px-3 sm:px-4 md:px-6 py-0 md:py-6">
                {children}
              </main>
              <SiteFooter />
              <Toaster richColors position="top-right" />
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
