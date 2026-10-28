import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { getMessages } from "@/i18n";
import { I18nProvider } from "@/i18n/provider";
import "./globals.css";

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Inventory", template: "%s · Inventory" },
  description: "Stock, customers and orders for the godown and the counter",
};

export const viewport: Viewport = {
  themeColor: "#1d4ed8",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full text-base">
        <I18nProvider messages={getMessages()}>
          {children}
          <Toaster position="top-center" className="print:hidden" />
        </I18nProvider>
      </body>
    </html>
  );
}
