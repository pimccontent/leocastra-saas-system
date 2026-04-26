import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

type SiteSettingsResponse = {
  title?: string | null;
  description?: string | null;
  faviconUrl?: string | null;
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fallbackTitle = "LeoCastra SaaS Web";
const fallbackDescription = "SaaS admin frontend for LeoCastra";

async function getSiteSettings(): Promise<SiteSettingsResponse | null> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001/api";
  try {
    const response = await fetch(`${baseUrl}/site/settings`, {
      next: { revalidate: 300 },
    });

    if (!response.ok) return null;
    return (await response.json()) as SiteSettingsResponse;
  } catch {
    return null;
  }
}

function toAbsoluteUrl(url: string): string | null {
  try {
    return new URL(url).toString();
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const siteSettings = await getSiteSettings();
  const title = siteSettings?.title?.trim() || fallbackTitle;
  const description = siteSettings?.description?.trim() || fallbackDescription;
  const favicon = siteSettings?.faviconUrl?.trim()
    ? toAbsoluteUrl(siteSettings.faviconUrl.trim())
    : null;

  return {
    title,
    description,
    ...(favicon
      ? {
          icons: {
            icon: [{ url: favicon }],
            shortcut: [{ url: favicon }],
            apple: [{ url: favicon }],
          },
        }
      : {}),
  };
}

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
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
