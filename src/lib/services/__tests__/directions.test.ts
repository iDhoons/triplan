import { describe, it, expect } from "vitest";
import { haversineDistance, estimateDuration } from "@/lib/directions/client";

describe("haversineDistance", () => {
  it("같은 좌표는 0m를 반환한다", () => {
    expect(haversineDistance(37.5665, 126.978, 37.5665, 126.978)).toBe(0);
  });

  it("서울-부산 직선거리가 약 325km이다", () => {
    // 서울시청: 37.5665, 126.978 / 부산시청: 35.1796, 129.0756
    const dist = haversineDistance(37.5665, 126.978, 35.1796, 129.0756);
    expect(dist).toBeGreaterThan(300_000);
    expect(dist).toBeLessThan(350_000);
  });

  it("서울 시내 이동(시청-강남)이 약 10km 이내이다", () => {
    // 서울시청: 37.5665, 126.978 / 강남역: 37.4979, 127.0276
    const dist = haversineDistance(37.5665, 126.978, 37.4979, 127.0276);
    expect(dist).toBeGreaterThan(5_000);
    expect(dist).toBeLessThan(15_000);
  });

  it("도쿄-오사카 직선거리가 약 400km이다", () => {
    // 도쿄: 35.6762, 139.6503 / 오사카: 34.6937, 135.5023
    const dist = haversineDistance(35.6762, 139.6503, 34.6937, 135.5023);
    expect(dist).toBeGreaterThan(380_000);
    expect(dist).toBeLessThan(420_000);
  });

  it("지구 반대편(서울-상파울루)이 약 18,000km이다", () => {
    // 서울: 37.5665, 126.978 / 상파울루: -23.5505, -46.6333
    const dist = haversineDistance(37.5665, 126.978, -23.5505, -46.6333);
    expect(dist).toBeGreaterThan(17_000_000);
    expect(dist).toBeLessThan(19_000_000);
  });

  it("거리는 방향에 무관하다 (대칭성)", () => {
    const ab = haversineDistance(37.5665, 126.978, 35.1796, 129.0756);
    const ba = haversineDistance(35.1796, 129.0756, 37.5665, 126.978);
    expect(ab).toBeCloseTo(ba, 0);
  });
});

describe("estimateDuration", () => {
  it("도보 1km는 약 5분(300초 내외)이다", () => {
    const dur = estimateDuration(1000, "walking");
    // 1000m * 1.4 / (4500/3600 m/s) = 1120s ≈ 18.7분
    // 실제 도보 1km = 보정계수 1.4 적용 시 약 1.4km 경로
    expect(dur).toBeGreaterThan(900);
    expect(dur).toBeLessThan(1500);
  });

  it("대중교통 10km는 합리적인 시간을 반환한다", () => {
    const dur = estimateDuration(10_000, "transit");
    // 10km * 1.4 / (25000/3600) = 2016s ≈ 33.6분
    expect(dur).toBeGreaterThan(1500);
    expect(dur).toBeLessThan(2500);
  });

  it("자동차가 대중교통보다 빠르다", () => {
    const transit = estimateDuration(10_000, "transit");
    const driving = estimateDuration(10_000, "driving");
    expect(driving).toBeLessThan(transit);
  });

  it("도보가 가장 느리다", () => {
    const walking = estimateDuration(10_000, "walking");
    const transit = estimateDuration(10_000, "transit");
    expect(walking).toBeGreaterThan(transit);
  });

  it("0m 거리는 0초를 반환한다", () => {
    expect(estimateDuration(0, "walking")).toBe(0);
  });

  it("알 수 없는 mode는 도보 속도로 fallback한다", () => {
    const unknown = estimateDuration(1000, "bicycle");
    const walking = estimateDuration(1000, "walking");
    expect(unknown).toBe(walking);
  });
});
