import { describe, expect, it } from "vitest";
import { isLegacyGooglePhotoUrl, placeImageUrl } from "@/lib/utils";

describe("placeImageUrl", () => {
  it("updates width for proxied photo URLs", () => {
    expect(
      placeImageUrl(
        "/api/places/photo?name=places%2Fabc%2Fphotos%2Fxyz&maxWidth=800",
        400
      )
    ).toBe("/api/places/photo?name=places%2Fabc%2Fphotos%2Fxyz&maxWidth=400");
  });

  it("converts legacy Google Places media URLs into proxy URLs", () => {
    expect(
      placeImageUrl(
        "https://places.googleapis.com/v1/places/abc/photos/xyz/media?maxWidthPx=1200&key=test",
        200
      )
    ).toBe("/api/places/photo?name=places%2Fabc%2Fphotos%2Fxyz&maxWidth=200");
  });

  it("returns non-proxy URLs unchanged", () => {
    const url = "https://example.com/image.jpg";
    expect(placeImageUrl(url, 400)).toBe(url);
  });
});

describe("isLegacyGooglePhotoUrl", () => {
  it("detects direct Google Places media URLs", () => {
    expect(
      isLegacyGooglePhotoUrl(
        "https://places.googleapis.com/v1/places/abc/photos/xyz/media?maxWidthPx=1200&key=test"
      )
    ).toBe(true);
  });

  it("detects temporary Googleusercontent photo URLs", () => {
    expect(
      isLegacyGooglePhotoUrl("https://lh3.googleusercontent.com/p/AF1QipExample=w800-h600-k-no")
    ).toBe(true);
  });

  it("ignores proxy URLs and unrelated hosts", () => {
    expect(
      isLegacyGooglePhotoUrl(
        "/api/places/photo?name=places%2Fabc%2Fphotos%2Fxyz&maxWidth=400"
      )
    ).toBe(false);
    expect(isLegacyGooglePhotoUrl("https://example.com/image.jpg")).toBe(false);
  });
});
