import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import {
  AlbumTile,
  AnimatedPointsBreakdown,
  ClusterBubble,
  Logo,
  MapMarker,
  PointsBlock,
  PointsBreakdown,
  PrimaryButton,
  PrimaryLink,
  ScoreCapsule,
  Sticker,
  TabBar,
  type PointLine,
} from "@/components/ui";
import { getPublicEnvResult } from "@/lib/env/server";
import { Replay } from "./replay";
import { YearColorPicker } from "./year-color-picker";

/*
 * Catalogue du design system, réservé au développement (absent en production).
 * Page interne : ses textes ne passent pas par src/i18n/fr.ts.
 * Données d'exemple : celles des maquettes (Ushuaïa, couleurs 2024 à 2026).
 */

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false, follow: false },
};

const EXAMPLE_YEARS = { 2024: "#F2C230", 2025: "#FF7A59", 2026: "#5B8DEF" } as const;

const USHUAIA: PointLine[] = [
  { key: "base", label: "Pays lointain", detail: "Argentine, points de base", points: 25, isBase: true, tone: "base" },
  { key: "first_country", label: "Premier sticker du pays", detail: "Personne avant toi en Argentine", points: 50, tone: "gold" },
  { key: "first_city", label: "Première ville", detail: "Ushuaïa", points: 15 },
  { key: "isolation", label: "Isolement", detail: "1 240 km du sticker le plus proche, plafond", points: 40 },
  { key: "home", label: "Loin de chez toi", detail: "13 000 km, +5 par 1 000 km", points: 65 },
];

const TOKENS = ["bg", "card", "soft", "text", "muted", "line", "map-water", "map-land", "band", "gold", "year"];

export default function DesignSystemPage() {
  return (
    <Suspense fallback={null}>
      <DevOnly>
        <main className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 py-8">
          <header className="flex flex-col gap-4">
            <Logo />
            <h1 className="font-display text-3xl font-normal">Design system</h1>
            <p className="max-w-2xl text-muted">
              Chaque composant en clair et en sombre. Choisir une couleur recolore toute la page
              par la seule variable <code>--year</code>.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <ThemeSwitcher />
              <YearColorPicker />
            </div>
          </header>
          <div className="grid gap-6 lg:grid-cols-2">
            <ThemePanel theme="light" title="Mode clair" />
            <ThemePanel theme="dark" title="Mode sombre" />
          </div>
        </main>
      </DevOnly>
    </Suspense>
  );
}

/** La configuration est lue au runtime : la même build sert en local et en production. */
async function DevOnly({ children }: { children: ReactNode }) {
  const env = await getPublicEnvResult();
  const appEnv = env.ok ? env.env.appEnv : env.appEnv;
  if (appEnv === "production") notFound();
  return children;
}

function ThemePanel({ theme, title }: { theme: "light" | "dark"; title: string }) {
  return (
    <section
      data-theme={theme}
      aria-labelledby={`panel-${theme}`}
      className="flex flex-col gap-8 rounded-[28px] border border-line bg-bg p-5 text-text sm:p-8"
    >
      <h2 id={`panel-${theme}`} className="font-display text-2xl font-normal">
        {title}
      </h2>

      <Demo title="Sticker">
        <div className="flex flex-wrap items-end gap-6">
          <Sticker size={200} band="2027" sub="@tomi_lechat" tilt={-3} label="Sticker 2027" />
          <Sticker size={128} band="+195" gold tilt={4} />
          <Sticker size={76} tilt={-4} />
        </div>
      </Demo>

      <Demo title="Une couleur par année">
        <div className="flex flex-wrap items-end gap-4">
          {Object.entries(EXAMPLE_YEARS).map(([year, color]) => (
            <Sticker key={year} size={96} band={year} color={color} />
          ))}
          <Sticker size={96} band="2027" />
        </div>
      </Demo>

      <Demo title="Marqueurs et regroupement">
        <div className="flex flex-wrap items-center gap-6">
          <MapMarker points={12} />
          <MapMarker points={45} />
          <MapMarker points={120} />
          <MapMarker points={85} gold />
          <MapMarker points={53} gold selected />
          <MapMarker points={30} color={EXAMPLE_YEARS[2025]} />
          <MapMarker points={90} pending />
          <ClusterBubble total={18} />
          <ClusterBubble
            total={355}
            colors={[EXAMPLE_YEARS[2024], EXAMPLE_YEARS[2025], EXAMPLE_YEARS[2026]]}
            years={[2024, 2025, 2026]}
          />
        </div>
      </Demo>

      <Demo title="Bloc de points">
        <div className="grid gap-4">
          <PointsBlock eyebrow="Rareté" label="Pays lointain" points={195} />
          <PointsBlock
            size="lg"
            eyebrow="Score total"
            signed={false}
            points={1435}
            badge={
              <span className="rounded-md bg-band px-2 py-0.5 text-xs font-bold text-white">
                2ᵉ au classement
              </span>
            }
          />
          <PointsBlock eyebrow="Rareté" label="Sans GPS dans la photo" points={0} pending />
        </div>
      </Demo>

      <Demo title="Détail des points">
        <div className="rounded-[22px] bg-card p-4">
          <PointsBreakdown lines={USHUAIA} />
        </div>
      </Demo>

      <Demo title="Sticker collé (animé)">
        <Replay label="Rejouer l'animation">
          <Sticker size={180} band="+195" gold tilt={6} animate />
          <AnimatedPointsBreakdown lines={USHUAIA} total={195} />
        </Replay>
      </Demo>

      <Demo title="Boutons">
        <div className="flex flex-wrap gap-3">
          <PrimaryButton>Coller le sticker</PrimaryButton>
          <PrimaryLink href="/">Voir sur la carte</PrimaryLink>
          <PrimaryButton disabled>Appliquer</PrimaryButton>
        </div>
      </Demo>

      <Demo title="En-tête">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Logo />
          <ScoreCapsule rank={2} score={1435} />
        </div>
      </Demo>

      <Demo title="Album">
        <div className="grid grid-cols-4 gap-2.5">
          <AlbumTile code="ARG" points={195} gold tilt={-3} />
          <AlbumTile code="FRA" points={312} color={EXAMPLE_YEARS[2024]} tilt={2} />
          <AlbumTile code="MAR" points={120} color={EXAMPLE_YEARS[2025]} gold tilt={-2} />
          <AlbumTile code="ISL" points={160} color={EXAMPLE_YEARS[2026]} tilt={1} />
          <AlbumTile variant="locked" code="JPN" points={25} />
          <AlbumTile variant="locked" code="NOR" points={10} />
          <AlbumTile variant="locked" code="BTN" points={60} />
          <AlbumTile variant="locked" code="PRK" points={150} />
        </div>
      </Demo>

      <Demo title="Barre d'onglets (mobile)">
        <div className="overflow-hidden rounded-[22px] border border-line pt-6">
          <TabBar responsive={false} />
        </div>
      </Demo>

      <Demo title="Jetons">
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {TOKENS.map((token) => (
            <li key={token} className="flex items-center gap-2 text-xs font-semibold">
              <span
                className="size-8 shrink-0 rounded-[10px] border border-line"
                style={{ background: `var(--${token})` }}
              />
              --{token}
            </li>
          ))}
        </ul>
      </Demo>
    </section>
  );
}

function Demo({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-extrabold tracking-[0.1em] text-muted uppercase">{title}</h3>
      {children}
    </div>
  );
}
