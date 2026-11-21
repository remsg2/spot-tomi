import type { Metadata, Viewport } from "next";
import { Archivo_Black, Inter } from "next/font/google";
import { Suspense } from "react";
import { ServiceWorker } from "@/components/pwa/service-worker";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { t } from "@/i18n/fr";
import { RuntimeEnv } from "@/lib/env/runtime-env";
import { YearColorStyle } from "@/lib/year-color-style";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const archivoBlack = Archivo_Black({
  variable: "--font-archivo-black",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: { default: t.app.name, template: `%s · ${t.app.name}` },
  description: t.app.description,
  applicationName: t.app.name,
  // PWA : le manifeste vient de src/app/manifest.ts ; iOS lit ces balises.
  appleWebApp: { capable: true, title: t.app.name, statusBarStyle: "default" },
  // Icônes dans la couleur de l'année en cours, rendues à la demande (src/lib/icons/app-icon.ts).
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48" },
      { url: "/icons/favicon-64.png", sizes: "64x64", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  formatDetection: { telephone: false },
  openGraph: { siteName: t.app.name, locale: "fr_FR", type: "website" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F3F1EB" },
    { media: "(prefers-color-scheme: dark)", color: "#0E0E10" },
  ],
  // Plein écran sur iPhone (encoche, barre d'accueil) : les marges utilisent safe-area-inset.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning : next-themes pose data-theme avant l'hydratation.
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${inter.variable} ${archivoBlack.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* Couleur de l'année : lue au runtime (jamais au build), voir src/lib/season.ts. */}
        <Suspense fallback={null}>
          <YearColorStyle />
        </Suspense>
        <ThemeProvider>{children}</ThemeProvider>
        <Suspense fallback={null}>
          <RuntimeEnv />
        </Suspense>
        <ServiceWorker />
      </body>
    </html>
  );
}
