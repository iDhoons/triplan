import { describe, it, expect } from "vitest";
import { isAllowedDomain } from "../index";

// ─── isAllowedDomain ────────────────────────────────────

describe("isAllowedDomain", () => {
  it("허용된 도메인 통과", () => {
    expect(isAllowedDomain("https://booking.com/hotel/test")).toBe(true);
    expect(isAllowedDomain("https://www.booking.com/hotel/test")).toBe(true);
    expect(isAllowedDomain("https://agoda.com/hotel")).toBe(true);
    expect(isAllowedDomain("https://www.agoda.com/hotel")).toBe(true);
    expect(isAllowedDomain("https://airbnb.com/rooms/123")).toBe(true);
    expect(isAllowedDomain("https://airbnb.co.kr/rooms/123")).toBe(true);
    expect(isAllowedDomain("https://yanolja.com/hotel/123")).toBe(true);
    expect(isAllowedDomain("https://goodchoice.kr/hotel")).toBe(true);
    expect(isAllowedDomain("https://trip.com/hotels")).toBe(true);
    expect(isAllowedDomain("https://expedia.com/hotel")).toBe(true);
    expect(isAllowedDomain("https://hotels.com/hotel")).toBe(true);
  });

  it("서브도메인도 허용", () => {
    expect(isAllowedDomain("https://m.booking.com/hotel")).toBe(true);
    expect(isAllowedDomain("https://ko.trip.com/hotels")).toBe(true);
  });

  it("허용되지 않은 도메인 차단", () => {
    expect(isAllowedDomain("https://evil.com")).toBe(false);
    expect(isAllowedDomain("https://google.com")).toBe(false);
    expect(isAllowedDomain("https://naver.com")).toBe(false);
  });

  it("도메인 우회 시도 차단", () => {
    // booking.com이 경로에 있지만 호스트가 다른 경우
    expect(isAllowedDomain("https://evil.com/booking.com")).toBe(false);
    // 비슷한 도메인
    expect(isAllowedDomain("https://fakebooking.com/hotel")).toBe(false);
    expect(isAllowedDomain("https://notbooking.com/hotel")).toBe(false);
  });
});
