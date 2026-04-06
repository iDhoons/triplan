import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchWithRetry } from "../fetch-with-retry";

/**
 * fetchWithRetry 단위 테스트
 * - 성공 케이스: 첫 시도 성공
 * - 재시도 케이스: 5xx → 재시도 → 성공
 * - 비재시도 케이스: 4xx는 즉시 반환
 * - 소진 케이스: maxRetries 초과 시 마지막 응답/에러 반환
 */

// fetch를 모킹 (vi.fn()은 generic 없이 선언하고 mockResolvedValueOnce로 타입 추론)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFetch = vi.fn<(...args: any[]) => Promise<Response>>();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mockFetch);
  // setTimeout을 fake timer로 대체해 backoff delay를 건너뜀
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function makeResponse(status: number, body = ""): Response {
  return new Response(body, { status });
}

describe("fetchWithRetry", () => {
  describe("성공 케이스", () => {
    it("첫 시도에 성공하면 재시도하지 않는다", async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, "ok"));

      const res = await fetchWithRetry("https://example.com/api");

      expect(res.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("4xx — 재시도 안 함", () => {
    it("401은 즉시 반환한다 (재시도 없음)", async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(401));

      const resPromise = fetchWithRetry("https://example.com/api");
      await vi.runAllTimersAsync();
      const res = await resPromise;

      expect(res.status).toBe(401);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("404는 즉시 반환한다 (재시도 없음)", async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(404));

      const resPromise = fetchWithRetry("https://example.com/api");
      await vi.runAllTimersAsync();
      const res = await resPromise;

      expect(res.status).toBe(404);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("5xx — 재시도", () => {
    it("500 → 성공: 2번 호출", async () => {
      mockFetch
        .mockResolvedValueOnce(makeResponse(500))
        .mockResolvedValueOnce(makeResponse(200, "ok"));

      const resPromise = fetchWithRetry("https://example.com/api", {}, { maxRetries: 1 });
      await vi.runAllTimersAsync();
      const res = await resPromise;

      expect(res.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("503 → 503: maxRetries 소진 시 마지막 응답 반환", async () => {
      mockFetch
        .mockResolvedValueOnce(makeResponse(503))
        .mockResolvedValueOnce(makeResponse(503));

      const resPromise = fetchWithRetry("https://example.com/api", {}, { maxRetries: 1 });
      await vi.runAllTimersAsync();
      const res = await resPromise;

      expect(res.status).toBe(503);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("네트워크 에러 — 재시도", () => {
    it("네트워크 에러 → 성공: 2번 호출", async () => {
      mockFetch
        .mockRejectedValueOnce(new TypeError("fetch failed"))
        .mockResolvedValueOnce(makeResponse(200));

      const resPromise = fetchWithRetry("https://example.com/api", {}, { maxRetries: 1 });
      await vi.runAllTimersAsync();
      const res = await resPromise;

      expect(res.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("네트워크 에러 지속 시 마지막 에러를 throw한다", async () => {
      const networkError = new TypeError("fetch failed");
      mockFetch.mockRejectedValue(networkError);

      // rejects 핸들러를 먼저 연결한 뒤 타이머를 전진시켜야
      // Unhandled Rejection 경고를 피할 수 있다.
      const expectation = expect(
        fetchWithRetry("https://example.com/api", {}, { maxRetries: 1 })
      ).rejects.toThrow("fetch failed");

      await vi.runAllTimersAsync();
      await expectation;

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("baseDelayMs — backoff 타이밍", () => {
    it("재시도 전에 baseDelayMs 만큼 대기한다", async () => {
      mockFetch
        .mockResolvedValueOnce(makeResponse(500))
        .mockResolvedValueOnce(makeResponse(200));

      const resPromise = fetchWithRetry(
        "https://example.com/api",
        {},
        { maxRetries: 1, baseDelayMs: 1000 }
      );

      // 1000ms 전에는 아직 두 번째 fetch가 안 됨
      await vi.advanceTimersByTimeAsync(999);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // 1000ms 후엔 재시도 완료
      await vi.advanceTimersByTimeAsync(1);
      await resPromise;
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
