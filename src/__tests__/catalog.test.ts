import { describe, it, expect } from "vitest";
import { resolveUrl } from "@/core/catalog";

describe("resolveUrl", () => {
  it("joins same-origin cdn base", () => {
    expect(resolveUrl("/cdn", "alpine.iso")).toBe("/cdn/alpine.iso");
  });
  it("normalizes trailing slash on base", () => {
    expect(resolveUrl("/cdn/", "a/b.img")).toBe("/cdn/a/b.img");
  });
});
