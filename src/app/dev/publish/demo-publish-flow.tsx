"use client";

import { useMemo } from "react";
import { PublishFlow } from "@/components/publish/publish-flow";
import type { Estimate, PublishInput, PublishResult } from "@/lib/publish/contract";
import type { EstimateRequest, PublishServices } from "@/lib/publish/services";
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
    __spotTomiUpload?: DemoUpload;
    __spotTomiPublishInput?: PublishInput;
  }
}

const LINES = [
  { ruleKey: "base_country", label: "Pays lointain", detail: "Argentine, points de base", points: 25 },
  { ruleKey: "first_country", label: "Premier sticker du pays", detail: null, points: 50 },
  { ruleKey: "first_city", label: "Première ville", detail: "Ushuaïa", points: 15 },
  { ruleKey: "isolation", label: "Isolement", detail: "1 240 km du sticker le plus proche", points: 40 },
  { ruleKey: "home_distance", label: "Loin de chez toi", detail: "13 000 km", points: 65 },
];

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function yearOf(takenAt: string | null | undefined): number {
  return takenAt ? new Date(takenAt).getUTCFullYear() : new Date().getUTCFullYear();
}

function estimate(request: EstimateRequest): Estimate {
  return {
    pointsTotal: 195,
    status: statusFor(request.gpsSource, request.dateSource),
    year: yearOf(request.takenAt),
    colorHex: "#5DB043",
    countryIso2: "AR",
    countryNameFr: "Argentine",
    isFirstInCountry: true,
    blocked: null,
    lines: LINES,
  };
}

function result(input: PublishInput): PublishResult {
  const status = statusFor(input.gpsSource, input.dateSource);
  return {
    spot: {
      id: crypto.randomUUID(),
      name: input.name,
      city: "Ushuaïa",
      countryNameFr: "Argentine",
      year: yearOf(input.takenAt),
      colorHex: "#5DB043",
      status,
      pointsTotal: 195,
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
        window.__spotTomiUpload = { path, type: photo.type, size: bytes.length, base64: toBase64(bytes) };
      },
      async publish(input) {
        await delay(150);
        window.__spotTomiPublishInput = input;
        return result(input);
      },
    }),
    [],
  );
  return <PublishFlow userId={DEMO_USER} services={services} editRadius={200} />;
}
