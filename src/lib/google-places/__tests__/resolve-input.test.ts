import { describe, it, expect } from "vitest";
import { resolveInput } from "../resolve-input";

describe("resolveInput", () => {
  // --- URL 감지 ---
  describe("URL 감지", () => {
    it("깨끗한 HTTPS URL을 인식한다", () => {
      const result = resolveInput("https://booking.com/hotel/123");
      expect(result).toEqual({
        type: "url",
        url: "https://booking.com/hotel/123",
        rawInput: "https://booking.com/hotel/123",
      });
    });

    it("HTTP URL도 인식한다", () => {
      const result = resolveInput("http://example.com/place");
      expect(result.type).toBe("url");
    });

    it("javascript: 프로토콜을 거부한다", () => {
      const result = resolveInput("javascript:alert(1)");
      expect(result.type).toBe("error");
      if (result.type === "error") {
        expect(result.reason).toContain("HTTP/HTTPS");
      }
    });

    it("data: 프로토콜을 거부한다", () => {
      const result = resolveInput("data:text/html,<script>alert(1)</script>");
      expect(result.type).toBe("error");
    });

    it("텍스트 속에 섞인 URL을 추출한다", () => {
      const input = "여기 맛집 추천! https://maps.app.goo.gl/abc123 꼭 가보세요";
      const result = resolveInput(input);
      expect(result.type).toBe("url");
      if (result.type === "url") {
        expect(result.url).toBe("https://maps.app.goo.gl/abc123");
      }
    });

    it("카카오톡 공유 텍스트에서 URL을 추출한다", () => {
      const input =
        "[광고] 🏨 호텔 특가! 80% 할인\nhttps://booking.com/hotel/tokyo-123\n2024-12-25 ~ 2024-12-28";
      const result = resolveInput(input);
      expect(result.type).toBe("url");
      if (result.type === "url") {
        expect(result.url).toContain("booking.com");
      }
    });

    it("괄호 안의 URL을 깨끗하게 추출한다", () => {
      const result = resolveInput("참고: (https://tripadvisor.com/place/123)");
      expect(result.type).toBe("url");
      if (result.type === "url") {
        expect(result.url).not.toContain(")");
      }
    });
  });

  // --- 프로토콜 없는 도메인 ---
  describe("프로토콜 없는 도메인 감지", () => {
    it("booking.com/... 을 URL로 인식한다", () => {
      const result = resolveInput("booking.com/hotel/tokyo-123");
      expect(result.type).toBe("url");
      if (result.type === "url") {
        expect(result.url).toBe("https://booking.com/hotel/tokyo-123");
      }
    });

    it("www.airbnb.com/rooms/... 을 URL로 인식한다", () => {
      const result = resolveInput("www.airbnb.com/rooms/456");
      expect(result.type).toBe("url");
      if (result.type === "url") {
        expect(result.url).toContain("https://");
      }
    });

    it("maps.app.goo.gl/... 을 URL로 인식한다", () => {
      const result = resolveInput("maps.app.goo.gl/xYz123");
      expect(result.type).toBe("url");
    });
  });

  // --- 장소명 추출 ---
  describe("장소명 추출", () => {
    it("일반 장소명을 그대로 반환한다", () => {
      const result = resolveInput("도쿄 스카이트리");
      expect(result).toEqual({
        type: "text",
        placeName: "도쿄 스카이트리",
        rawInput: "도쿄 스카이트리",
      });
    });

    it("광고 태그를 제거하고 장소명을 추출한다", () => {
      const result = resolveInput("[광고] 도쿄 센소지");
      expect(result.type).toBe("text");
      if (result.type === "text") {
        expect(result.placeName).not.toContain("[광고]");
        expect(result.placeName).toContain("센소지");
      }
    });

    it("이모지를 제거하고 장소명을 추출한다", () => {
      const result = resolveInput("🏨 신주쿠 프린스 호텔 ✨");
      expect(result.type).toBe("text");
      if (result.type === "text") {
        expect(result.placeName).toContain("신주쿠 프린스 호텔");
      }
    });

    it("가격/전화번호/날짜를 제거하고 장소명을 추출한다", () => {
      const input = "도쿄타워 150,000원 02-1234-5678 2024-12-25";
      const result = resolveInput(input);
      expect(result.type).toBe("text");
      if (result.type === "text") {
        expect(result.placeName).toContain("도쿄타워");
        expect(result.placeName).not.toContain("150,000원");
        expect(result.placeName).not.toContain("1234-5678");
      }
    });

    it("100자를 초과하는 장소명을 잘라낸다", () => {
      const longName = "가".repeat(150);
      const result = resolveInput(longName);
      expect(result.type).toBe("text");
      if (result.type === "text") {
        expect(result.placeName.length).toBeLessThanOrEqual(100);
      }
    });
  });

  // --- 에러 케이스 ---
  describe("에러 케이스", () => {
    it("빈 문자열은 에러를 반환한다", () => {
      const result = resolveInput("");
      expect(result.type).toBe("error");
    });

    it("공백만 있는 입력은 에러를 반환한다", () => {
      const result = resolveInput("   ");
      expect(result.type).toBe("error");
    });

    it("노이즈만 있는 입력(1자 미만)은 에러를 반환한다", () => {
      const result = resolveInput("[AD] #tag");
      expect(result.type).toBe("error");
    });

    it("500자 초과 입력은 잘라서 처리한다", () => {
      const longInput = "https://booking.com/" + "a".repeat(600);
      const result = resolveInput(longInput);
      // 500자로 잘려도 URL 부분은 살아있어야 함
      expect(result.type).toBe("url");
    });
  });

  // --- rawInput 보존 ---
  it("rawInput에 원본 입력을 항상 보존한다", () => {
    const raw = "  https://example.com  ";
    const result = resolveInput(raw);
    expect(result.rawInput).toBe(raw);
  });
});
