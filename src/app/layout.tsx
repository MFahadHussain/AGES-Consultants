import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

import { BRAND } from "@/lib/config/branding";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "AGES Consultants ERP",
    template: "%s | AGES Consultants",
  },
  description: "Accounting & Financial Management System by AGES Consultants",
  applicationName: "AGES Consultants ERP",
  authors: [{ name: "AGES Consultants" }],
  keywords: ["ERP", "Accounting", "Finance", "AGES Consultants"],
  openGraph: {
    title: "AGES Consultants ERP",
    description: "Accounting & Financial Management System",
    siteName: "AGES Consultants ERP",
    images: [{ url: "/og-image.png" }],
  },
  twitter: {
    title: "AGES Consultants ERP",
    description: "Accounting & Financial Management System",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
