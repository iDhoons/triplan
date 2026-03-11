import { describe, it, expect } from "vitest";
import { parseUrl } from "../url-parser";

describe("parseUrl", () => {
  it("잘못된 URL은 unknown 반환", () => {
    expect(parseUrl("not-a-url")).toEqual({
      placeName: null,
      site: "unknown",
    });
  });

  it("Booking.com URL에서 호텔명 추출", () => {
    const result = parseUrl(
      "https://www.booking.com/hotel/jp/hotel-nikko-osaka.ko.html"
    );
    expect(result.site).toBe("booking");
    expect(result.placeName).toBe("hotel nikko osaka");
  });

  it("Agoda URL에서 호텔명 추출", () => {
    const result = parseUrl(
      "https://www.agoda.com/grand-hyatt-tokyo/hotel/tokyo-jp.html"
    );
    expect(result.site).toBe("agoda");
    expect(result.placeName).toBe("grand hyatt tokyo");
  });

  it("Airbnb URL: 이름 없이 사이트만 인식", () => {
    const result = parseUrl("https://www.airbnb.com/rooms/12345");
    expect(result.site).toBe("airbnb");
    expect(result.placeName).toBeNull();
  });

  it("Airbnb 한국 도메인 인식", () => {
    const result = parseUrl("https://www.airbnb.co.kr/rooms/12345");
    expect(result.site).toBe("airbnb");
  });

  it("Google Maps URL에서 장소명 추출", () => {
    const result = parseUrl(
      "https://www.google.com/maps/place/Tokyo+Tower/@35.6585805,139.7454329"
    );
    expect(result.site).toBe("google-maps");
    expect(result.placeName).toBe("Tokyo Tower");
  });

  it("Google Maps 한국 도메인", () => {
    const result = parseUrl(
      "https://www.google.co.kr/maps/place/%EC%84%9C%EC%9A%B8%ED%83%80%EC%9B%8C/@37.5"
    );
    expect(result.site).toBe("google-maps");
    expect(result.placeName).toBe("서울타워");
  });

  it("Trip.com URL에서 호텔명 추출", () => {
    const result = parseUrl(
      "https://www.trip.com/hotels/12345/grand-palace-hotel"
    );
    expect(result.site).toBe("trip");
    expect(result.placeName).toBe("grand palace hotel");
  });

  it("야놀자 URL: 사이트 인식", () => {
    const result = parseUrl("https://www.yanolja.com/hotel/12345");
    expect(result.site).toBe("yanolja");
  });

  it("여기어때 URL: 사이트 인식", () => {
    const result = parseUrl("https://www.goodchoice.kr/product/detail?id=123");
    expect(result.site).toBe("goodchoice");
  });

  it("인식 불가한 사이트는 unknown", () => {
    const result = parseUrl("https://random-site.com/page");
    expect(result.site).toBe("unknown");
    expect(result.placeName).toBeNull();
  });
});
