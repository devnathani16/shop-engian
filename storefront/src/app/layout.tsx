import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import DPDPCookieBanner from "../components/DPDPCookieBanner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import Header from "@/components/Header";
import { ClerkProvider } from "@clerk/nextjs";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: "EaaS Storefront",
  description: "Dynamic storefront powered by EaaS",
};

import { CurrencyProvider } from "@/components/CurrencyProvider";

async function getAuthSettings(subdomain: string) {
  try {
    const res = await fetch(`http://127.0.0.1:8080/api/storefront/${subdomain}/auth-settings`, {
      cache: 'no-store'
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {}
  return { provider: 'default', public_key: '' };
}

async function getBaseCurrency(subdomain: string) {
  try {
    const res = await fetch(`http://127.0.0.1:8080/api/storefront/${subdomain}/catalog`, {
      cache: 'no-store'
    });
    if (res.ok) {
      const data = await res.json();
      if (data.shop && data.shop.currency) {
        return data.shop.currency;
      }
    }
  } catch (err) {}
  return 'USD';
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const subdomain = host.split('.')[0] || 'Store';
  const authSettings = await getAuthSettings(subdomain);
  const baseCurrency = await getBaseCurrency(subdomain);

  const LayoutContent = (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <CurrencyProvider subdomain={subdomain} baseCurrency={baseCurrency}>
          <Header authSettings={authSettings} subdomain={subdomain} />
          <div className="flex-1">
            {children}
          </div>
          <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
          <Script src="https://sdk.cashfree.com/js/v3/cashfree.js" strategy="afterInteractive" />
          <DPDPCookieBanner />
        </CurrencyProvider>
      </body>
    </html>
  );

  const clerkKey = authSettings.provider === 'clerk' && authSettings.public_key 
    ? authSettings.public_key 
    : 'pk_test_ZHVtbXktY2xlcmstcHVibGlzaGFibGUta2V5JA==';

  return (
    <ClerkProvider publishableKey={clerkKey}>
      {LayoutContent}
    </ClerkProvider>
  );
}
