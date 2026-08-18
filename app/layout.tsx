import type { Metadata } from "next";
import { Urbanist } from "next/font/google";
import "./globals.css";
import { SplashProvider } from "@/components/splash/SplashProvider";
import { BuildSignature } from "@/components/BuildSignature";
import { normalizeAbsoluteUrl } from "@/utils/url";

const urbanist = Urbanist({
  variable: "--font-urbanist",
  subsets: ["latin"],
  display: "swap",
});

const metadataBaseUrl = normalizeAbsoluteUrl(process.env.NEXT_PUBLIC_APP_URL);
const metadataBase = metadataBaseUrl ? new URL(metadataBaseUrl) : undefined;

export const metadata: Metadata = {
  metadataBase,
  manifest: "/manifest.webmanifest",
  title: {
    default: "Scuib Chat",
    template: "%s | Scuib Chat",
  },
  description: "Chat with the gifted ones",
  applicationName: "Scuib Chat",
  alternates: metadataBase
    ? {
        canonical: "/",
      }
    : undefined,
  openGraph: {
    type: "website",
    siteName: "Scuib Chat",
    title: "Scuib Chat",
    description: "Chat with the gifted ones",
    url: metadataBase ? "/" : undefined,
  },
  twitter: {
    card: "summary",
    title: "Scuib Chat",
    description: "Chat with the gifted ones",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${urbanist.variable} h-full`}>
      <body suppressHydrationWarning className="min-h-full flex flex-col font-sans antialiased">
        <BuildSignature />
        <SplashProvider>{children}</SplashProvider>
      </body>
    </html>
  );
}
