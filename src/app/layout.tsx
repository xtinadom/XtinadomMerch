import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { metadataBaseUrl } from "@/lib/public-app-url";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const site = metadataBaseUrl();

export const metadata: Metadata = {
  metadataBase: site,
  title: {
    default: "Xtinadom — Merch",
    template: "%s · Xtinadom",
  },
  description: "Official merchandise for Xtinadom.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: site.origin,
    siteName: "Xtinadom",
    title: "Xtinadom — Merch",
    description: "Official merchandise for Xtinadom.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Xtinadom — Merch",
    description: "Official merchandise for Xtinadom.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-zinc-950 text-zinc-100">{children}</body>
    </html>
  );
}
