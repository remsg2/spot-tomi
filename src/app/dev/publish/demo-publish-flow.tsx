"use client";

import { useMemo } from "react";
import { PublishFlow } from "@/components/publish/publish-flow";
import type { Estimate, PublishInput, PublishResult } from "@/lib/publish/contract";
import type { EstimateRequest, PublishServices } from "@/lib/publish/services";
import type { EditionOption } from "@/lib/publish/pasted";
import { statusFor } from "@/lib/publish/status";

/*
 * Doublures des services serveur : le parcours réel (lecture EXIF,
 * réencodage, écrans) sans Supabase. Le WebP « envoyé » et l'entrée de
 * publish-spot sont exposés à Playwright (e2e/publication.spec.ts).
 */

const DEMO_USER = "00000000-0000-4000-8000-000000000001";

export type DemoUpload = { path: string; type: string; size: number; base64: string };

declare global {
  interface Window {
    /** Photo « envoyée » (la miniature est gardée à part). */
    __spotTomiUpload?: DemoUpload;
    __spotTomiThumbUpload?: DemoUpload;
    __spotTomiPublishInput?: PublishInput;
  }
}

const LINES = [
  { ruleKey: "base", label: "Sticker publié", detail: "Points de base", points: 100 },
  { ruleKey: "rarity", label: "Lieu touristique", detail: "Site touristique ou historique à proximité", points: 20 },
];
const TOTAL = 120;

/** Éditions de démonstration : l'année en cours et les deux précédentes. */
export function demoEditions(now = new Date()): EditionOption[] {
  const year = now.getFullYear();
  return [
    { year, name: `Édition ${year}`, colorHex: "#5DB043", isCurrent: true },
    { year: year - 1, name: `Édition ${year - 1}`, colorHex: "#FF7A59", isCurrent: false },
    { year: year - 2, name: `Édition ${year - 2}`, colorHex: "#F2C230", isCurrent: false },
  ];
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function yearOf(year: number | null | undefined, takenAt: string | null | undefined): number {
  if (year) return year;
  return takenAt ? new Date(takenAt).getUTCFullYear() : new Date().getUTCFullYear();
}

function colorOf(year: number): string {
  return demoEditions().find((edition) => edition.year === year)?.colorHex ?? "#9A9A94";
}

function estimate(request: EstimateRequest): Estimate {
  const year = yearOf(request.year, request.takenAt);
  return {
    pointsTotal: TOTAL,
    status: statusFor(),
    year,
    colorHex: colorOf(year),
    countryIso2: "AR",
    countryNameFr: "Argentine",
    isFirstInCountry: true,
    category: "touristique",
    categoryLabel: "Lieu touristique",
    blocked: null,
    nearest: { id: "00000000-0000-4000-8000-0000000000aa", name: "Panneau du bout du monde", distanceM: 120, mine: false },
    lines: LINES,
  };
}

function result(input: PublishInput): PublishResult {
  const status = statusFor();
  const year = yearOf(input.year, input.takenAt);
  return {
    spot: {
      id: crypto.randomUUID(),
      name: input.name,
      city: "Ushuaïa",
      countryNameFr: "Argentine",
      year,
      colorHex: colorOf(year),
      status,
      pointsTotal: TOTAL,
      isFirstInCountry: true,
      isExceptional: false,
    },
    lines: LINES,
    rank: { before: 3, after: 2 },
  };
}

export function DemoPublishFlow() {
  const services = useMemo<PublishServices>(
    () => ({
      async estimate(request) {
        await delay(120);
        return estimate(request);
      },
      async upload(path, photo) {
        const bytes = new Uint8Array(await photo.arrayBuffer());
        const upload = { path, type: photo.type, size: bytes.length, base64: toBase64(bytes) };
        if (path.endsWith(".thumb.webp")) window.__spotTomiThumbUpload = upload;
        else window.__spotTomiUpload = upload;
      },
      async publish(input) {
        await delay(150);
        window.__spotTomiPublishInput = input;
        return result(input);
      },
    }),
    [],
  );
  const editions = useMemo(() => demoEditions(), []);
  return <PublishFlow userId={DEMO_USER} services={services} editRadius={200} editions={editions} />;
}
