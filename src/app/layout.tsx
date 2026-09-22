import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: { default: "Interview Connect — Practice like it's the real interview", template: "%s · Interview Connect" },
  description:
    "Interview Connect combines AI-powered preparation with real interview experiences — AI and human interviewers, standardized AI grading and personalized feedback.",
};

export const viewport: Viewport = { themeColor: "#18191B", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-ink-900 focus:px-4 focus:py-2 focus:text-white">
          Skip to content
        </a>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
