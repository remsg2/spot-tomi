import { describe, expect, it } from "vitest";
import { checkPasted, defaultEdition, defaultPastedOn, localDay, pastedTakenAt, type EditionOption } from "./pasted";

const editions: EditionOption[] = [
  { year: 2026, name: "Édition 2026", colorHex: "#5B8DEF", isCurrent: true },
  { year: 2025, name: "Édition 2025", colorHex: "#FF7A59", isCurrent: false },
  { year: 2024, name: "Édition 2024", colorHex: "#F2C230", isCurrent: false },
];
const today = new Date(2026, 10, 21, 15, 0);

describe("defaultPastedOn", () => {
  it("reprend le jour de la photo, sinon aujourd'hui", () => {
    expect(defaultPastedOn("2025-08-03T09:12:00", today)).toBe("2025-08-03");
    expect(defaultPastedOn(null, today)).toBe(localDay(today));
    expect(localDay(today)).toBe("2026-11-21");
  });
});

describe("defaultEdition", () => {
  it("propose l'édition la plus récente compatible avec l'année du collage", () => {
    expect(defaultEdition(editions, "2026-11-21")).toBe(2026);
    expect(defaultEdition(editions, "2025-08-03")).toBe(2025);
    expect(defaultEdition(editions, "2023-05-01")).toBe(2024);
    expect(defaultEdition([], "2026-01-01")).toBeNull();
  });
});

describe("checkPasted", () => {
  it("refuse une date future, mal formée ou antérieure à l'édition", () => {
    expect(checkPasted("2026-11-21", 2026, today)).toBeNull();
    expect(checkPasted("2026-11-22", 2026, today)).toBe("future");
    expect(checkPasted("2025-12-31", 2026, today)).toBe("before_edition");
    expect(checkPasted("2025-12-31", 2025, today)).toBeNull();
    expect(checkPasted("pas une date", 2026, today)).toBe("invalid");
  });
});

describe("pastedTakenAt", () => {
  it("garde l'heure de la photo si le jour est le sien, sinon midi UTC", () => {
    expect(pastedTakenAt("2025-08-03", "2025-08-03T07:12:00.000Z", "2025-08-03")).toBe("2025-08-03T07:12:00.000Z");
    expect(pastedTakenAt("2025-08-05", "2025-08-03T07:12:00.000Z", "2025-08-03")).toBe("2025-08-05T12:00:00.000Z");
    expect(pastedTakenAt("2025-08-05", null, null)).toBe("2025-08-05T12:00:00.000Z");
  });
});
