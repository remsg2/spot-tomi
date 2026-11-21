import { describe, expect, it } from "vitest";
import { parseZone, zoneParam } from "./queries";

describe("zone d'un classement", () => {
  it("lit continent:XX et pays:XX, et rien d'autre", () => {
    expect(parseZone("continent:europe")).toEqual({ kind: "continent", code: "europe" });
    expect(parseZone(["pays:fr", "pays:it"])).toEqual({ kind: "country", code: "FR" });
    expect(parseZone("continent:atlantide")).toBeNull();
    expect(parseZone("pays:FRA")).toBeNull();
    expect(parseZone("ville:Paris")).toBeNull();
    expect(parseZone(undefined)).toBeNull();
    expect(parseZone("  ")).toBeNull();
  });

  it("aller-retour avec l'URL", () => {
    expect(zoneParam({ kind: "country", code: "JP" })).toBe("pays:JP");
    expect(parseZone(zoneParam({ kind: "continent", code: "asie" }))).toEqual({ kind: "continent", code: "asie" });
  });
});
