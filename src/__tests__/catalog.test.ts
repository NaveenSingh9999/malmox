import { describe, it, expect } from "vitest";
import { resolveUrl } from "@/core/catalog";
import type { Manifest } from "@/core/types";

const m = { baseUrls: { releases: "https://example.com/r/" } } as unknown as Manifest;

describe("resolveUrl", () => {
  it("joins release base with relative path", () => {
    expect(resolveUrl(m, "x.img.gz")).toBe("https://example.com/r/x.img.gz");
  });
  it("passes absolute urls through", () => {
    expect(resolveUrl(m, "https://cdn.example.org/a.iso")).toBe(
      "https://cdn.example.org/a.iso",
    );
  });
});
