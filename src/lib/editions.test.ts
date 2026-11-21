import { describe, expect, it } from "vitest";
import { editionVisualUrl, toEditionOptions, toEditionRows } from "./editions";

const row = (year: number, extra: Record<string, unknown> = {}) => ({
  year,
  name: `Édition ${year}`,
  color_hex: "#C57CB3",
  status: "active",
  is_current: false,
  selectable: true,
  visual_path: null,
  spot_count: 0,
  color_locked: false,
  ...extra,
});

describe("éditions", () => {
  it("visuel : celui de l'admin, sinon l'officiel, sinon aucun", () => {
    expect(editionVisualUrl(2026, "2026/a.webp", "https://x.supabase.co/")).toBe(
      "https://x.supabase.co/storage/v1/object/public/editions/2026/a.webp",
    );
    expect(editionVisualUrl(2026, null, "https://x.supabase.co")).toBe("/editions/2026.webp");
    expect(editionVisualUrl(2026, "2026/a.webp", null)).toBe("/editions/2026.webp");
    expect(editionVisualUrl(2031, null, "https://x.supabase.co")).toBeNull();
  });

  it("ignore les lignes invalides et trie de la plus récente à la plus ancienne", () => {
    expect(toEditionRows(null)).toEqual([]);
    expect(toEditionRows([row(2025), { year: "2026" }, row(2027), null]).map((r) => r.year)).toEqual([2027, 2025]);
  });

  it("ne propose que les éditions choisissables", () => {
    const options = toEditionOptions([row(2025), row(2026, { is_current: true }), row(2027, { selectable: false })]);
    expect(options).toEqual([
      { year: 2026, name: "Édition 2026", colorHex: "#C57CB3", isCurrent: true, visualUrl: "/editions/2026.webp" },
      { year: 2025, name: "Édition 2025", colorHex: "#C57CB3", isCurrent: false, visualUrl: "/editions/2025.webp" },
    ]);
  });
});
