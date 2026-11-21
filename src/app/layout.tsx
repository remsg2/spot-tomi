import type { Metadata, Viewport } from "next";
import { Archivo_Black, Inter } from "next/font/google";
import { Suspense, type CSSProperties } from "react";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { t } from "@/i18n/fr";
import { RuntimeEnv } from "@/lib/env/runtime-env";
import { getCurrentYearColor } from "@/lib/season";
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
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F3F1EB" },
    { media: "(prefers-color-scheme: dark)", color: "#0E0E10" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const yearColor = await getCurrentYearColor();

  return (
    // suppressHydrationWarning : next-themes pose data-theme avant l'hydratation.
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${inter.variable} ${archivoBlack.variable} h-full antialiased`}
      style={{ "--year": yearColor } as CSSProperties}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider>{children}</ThemeProvider>
        <Suspense fallback={null}>
          <RuntimeEnv />
        </Suspense>
      </body>
    </html>
  );
}
