import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * /api/places/share 통합 테스트
 * 인증 체크, Rate limit, 중복 감지, 입력 검증을 검증한다.
 *
 * 전략: Supabase 서버 클라이언트를 모킹하여 HTTP 핸들러를 직접 호출.
 * next/server의 after()는 no-op으로 처리 (풍부화는 별도 단위 테스트).
 */

// ─── Mocks ───────────────────────────────────────────────

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
      from: mockFrom,
    })
  ),
}));

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>(
    "next/server"
  );
  return {
    ...actual,
    after: vi.fn(), // 풍부화 콜백은 테스트에서 무시
  };
});

// ─── Route import (mocks 설정 후) ────────────────────────

import { POST } from "../route";

// ─── Helpers ─────────────────────────────────────────────

function makeRequest(body: unknown, method = "POST"): Request {
  return new Request("http://localhost/api/places/share", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** supabase.from() 체인 빌더 */
function mockChain(result: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  return chain;
}

// ─── Tests ───────────────────────────────────────────────

describe("POST /api/places/share", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── 인증 체크 ────────────────────────────────────────

  describe("인증 체크", () => {
    it("인증되지 않은 요청은 401을 반환한다", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });

      const res = await POST(
        makeRequest({ url: "https://booking.com/hotel/123", trip_id: "trip-1" })
      );

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe("Unauthorized");
    });
  });

  // ─── 입력 검증 ────────────────────────────────────────

  describe("입력 검증", () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-1" } },
      });
    });

    it("trip_id가 없으면 400을 반환한다", async () => {
      const res = await POST(
        makeRequest({ url: "https://booking.com/hotel/123" })
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe("url(또는 input)과 trip_id가 필요합니다");
    });

    it("url/input이 없으면 400을 반환한다", async () => {
      const res = await POST(makeRequest({ trip_id: "trip-1" }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe("url(또는 input)과 trip_id가 필요합니다");
    });

    it("유효하지 않은 URL/텍스트(빈 입력)는 400을 반환한다", async () => {
      // 멤버십 체크 이전에 resolveInput이 error를 반환하는 케이스
      // resolveInput('')은 { type: 'error' }를 반환
      const res = await POST(makeRequest({ url: "", trip_id: "trip-1" }));
      expect(res.status).toBe(400);
    });

    it("JSON이 아닌 body는 400을 반환한다", async () => {
      const req = new Request("http://localhost/api/places/share", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "not json",
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });

  // ─── Rate Limit ───────────────────────────────────────

  describe("Rate Limit", () => {
    it("10회 초과 요청은 429를 반환한다", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "rl-test-user" } },
      });

      // 멤버 체크 — 모든 요청을 통과시킴
      const memberChain = mockChain({ data: { role: "editor" }, error: null });
      const dupChain = mockChain({ data: null, error: null });
      const insertChain = mockChain({ data: { id: "place-new" }, error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === "trip_members") return memberChain;
        if (table === "places") return { ...dupChain, insert: () => insertChain };
        return mockChain({ data: null, error: null });
      });

      // 10번은 통과해야 함
      for (let i = 0; i < 10; i++) {
        const res = await POST(
          makeRequest({
            url: `https://booking.com/hotel/${i}`,
            trip_id: "trip-1",
          })
        );
        // Rate limit이 아니어야 함 (429가 아니면 됨)
        expect(res.status).not.toBe(429);
      }

      // 11번째는 차단
      const res = await POST(
        makeRequest({ url: "https://booking.com/hotel/11", trip_id: "trip-1" })
      );
      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe("요청이 너무 많습니다. 잠시 후 다시 시도해주세요.");
    });
  });

  // ─── 멤버십 체크 ──────────────────────────────────────

  describe("멤버십 체크", () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-not-member" } },
      });
    });

    it("여행 멤버가 아니면 403을 반환한다", async () => {
      const memberChain = mockChain({ data: null, error: null });
      mockFrom.mockImplementation(() => memberChain);

      const res = await POST(
        makeRequest({
          url: "https://booking.com/hotel/abc",
          trip_id: "trip-no-access",
        })
      );

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe("해당 여행에 접근할 수 없습니다");
    });
  });

  // ─── 중복 감지 ────────────────────────────────────────

  describe("중복 감지", () => {
    const userId = "user-dup-check";

    beforeEach(() => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: userId } },
      });
    });

    it("같은 URL이 이미 존재하면 duplicate:true와 200을 반환한다", async () => {
      const memberChain = mockChain({ data: { role: "editor" }, error: null });
      const dupChain = mockChain({
        data: { id: "existing-place", name: "도쿄 타워" },
        error: null,
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === "trip_members") return memberChain;
        if (table === "places") return dupChain;
        return mockChain({ data: null, error: null });
      });

      const res = await POST(
        makeRequest({
          url: "https://booking.com/hotel/dup-url",
          trip_id: "trip-dup",
        })
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.duplicate).toBe(true);
      expect(body.place_id).toBe("existing-place");
      expect(body.name).toBe("도쿄 타워");
    });

    it("body.input을 body.url 대신 사용할 수 있다 (하위 호환)", async () => {
      const memberChain = mockChain({ data: { role: "editor" }, error: null });
      // input 모드에서는 텍스트로 처리되므로 duplicate 체크 없이 삽입
      const insertResult = { data: { id: "new-place" }, error: null };
      const insertChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(insertResult),
      };
      const placesChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnValue(insertChain),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      mockFrom.mockImplementation((table: string) => {
        if (table === "trip_members") return memberChain;
        if (table === "places") return placesChain;
        return mockChain({ data: null, error: null });
      });

      const res = await POST(
        makeRequest({ input: "도쿄 스카이트리", trip_id: "trip-1" })
      );

      expect(res.status).toBe(201);
    });
  });

  // ─── 성공 케이스 ──────────────────────────────────────

  describe("성공 케이스", () => {
    const userId = "user-success";

    beforeEach(() => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: userId } },
      });
    });

    it("새 URL을 201과 place_id로 저장한다", async () => {
      const memberChain = mockChain({ data: { role: "editor" }, error: null });
      const dupChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      const insertResult = { data: { id: "new-place-id" }, error: null };
      const insertChain = {
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(insertResult),
      };
      const placesChain = {
        ...dupChain,
        insert: vi.fn().mockReturnValue(insertChain),
      };

      mockFrom.mockImplementation((table: string) => {
        if (table === "trip_members") return memberChain;
        if (table === "places") return placesChain;
        return mockChain({ data: null, error: null });
      });

      const res = await POST(
        makeRequest({
          url: "https://booking.com/hotel/new-hotel",
          trip_id: "trip-1",
        })
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.place_id).toBe("new-place-id");
      expect(body.enriched).toBe(false);
    });

    it("insert 실패 시 500을 반환한다", async () => {
      const memberChain = mockChain({ data: { role: "editor" }, error: null });
      const dupChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      const insertResult = { data: null, error: new Error("DB error") };
      const insertChain = {
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(insertResult),
      };
      const placesChain = {
        ...dupChain,
        insert: vi.fn().mockReturnValue(insertChain),
      };

      mockFrom.mockImplementation((table: string) => {
        if (table === "trip_members") return memberChain;
        if (table === "places") return placesChain;
        return mockChain({ data: null, error: null });
      });

      const res = await POST(
        makeRequest({
          url: "https://booking.com/hotel/fail-hotel",
          trip_id: "trip-1",
        })
      );

      expect(res.status).toBe(500);
    });
  });
});
