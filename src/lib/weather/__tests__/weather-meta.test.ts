import { describe, it, expect } from "vitest";
import { getWeatherMeta } from "../types";

describe("getWeatherMeta", () => {
  it("코드 0은 맑음을 반환한다", () => {
    const meta = getWeatherMeta(0);
    expect(meta.label).toBe("맑음");
    expect(meta.icon).toBe("☀️");
  });

  it("코드 3은 흐림을 반환한다", () => {
    const meta = getWeatherMeta(3);
    expect(meta.label).toBe("흐림");
  });

  it("코드 65는 강한 비를 반환한다", () => {
    const meta = getWeatherMeta(65);
    expect(meta.label).toBe("강한 비");
  });

  it("코드 73은 눈을 반환한다", () => {
    const meta = getWeatherMeta(73);
    expect(meta.label).toBe("눈");
  });

  it("코드 95는 뇌우를 반환한다", () => {
    const meta = getWeatherMeta(95);
    expect(meta.label).toBe("뇌우");
  });

  it("존재하지 않는 코드(999)는 알 수 없음을 반환한다", () => {
    const meta = getWeatherMeta(999);
    expect(meta.label).toBe("알 수 없음");
    expect(meta.icon).toBe("❓");
  });

  it("존재하지 않는 코드(-1)도 안전하게 처리한다", () => {
    const meta = getWeatherMeta(-1);
    expect(meta.label).toBe("알 수 없음");
  });

  it("모든 정의된 코드가 label과 icon을 가진다", () => {
    const codes = [0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99];
    for (const code of codes) {
      const meta = getWeatherMeta(code);
      expect(meta.label).toBeTruthy();
      expect(meta.icon).toBeTruthy();
      expect(meta.label).not.toBe("알 수 없음");
    }
  });
});
