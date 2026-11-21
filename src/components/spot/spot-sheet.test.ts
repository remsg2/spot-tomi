import { describe, expect, it } from "vitest";
import { isDemoPhoto } from "./spot-sheet";

describe("isDemoPhoto", () => {
  it("reconnaît les photos des stickers de démo", () => {
    expect(
      isDemoPhoto(
        "https://x.supabase.co/storage/v1/object/public/spot-photos/de300000-0000-4000-8000-000000000001/demo-0b6c7a2e-3f1d-4c5e-9a8b-1c2d3e4f5a6b.webp",
      ),
    ).toBe(true);
  });

  it("laisse passer les vraies photos", () => {
    expect(
      isDemoPhoto(
        "https://x.supabase.co/storage/v1/object/public/spot-photos/00000000-0000-4000-8000-00000000000a/0b6c7a2e-3f1d-4c5e-9a8b-1c2d3e4f5a6b.webp",
      ),
    ).toBe(false);
  });
});
