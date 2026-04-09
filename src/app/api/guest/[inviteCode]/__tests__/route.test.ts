import { beforeEach, describe, expect, it, vi } from "vitest";

const checkRateLimitMock = vi.fn();
const createClientMock = vi.fn();

vi.mock("@/lib/api/guards", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimitMock(...args),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

import { GET } from "../route";

function makeRequest(ip?: string) {
  const headers = new Headers();
  if (ip) headers.set("x-forwarded-for", ip);
  return new Request("http://localhost/api/guest/test", { headers });
}

function makeContext(inviteCode: string) {
  return { params: Promise.resolve({ inviteCode }) };
}

describe("GET /api/guest/[inviteCode]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    checkRateLimitMock.mockResolvedValue(true);
  });

  it("유효하지 않은 inviteCode는 400을 반환한다", async () => {
    const res = await GET(makeRequest("203.0.113.5"), makeContext("!bad"));

    expect(res.status).toBe(400);
    expect(checkRateLimitMock).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe("Invalid invite code");
  });

  it("rate limit 초과 시 429를 반환한다", async () => {
    checkRateLimitMock.mockResolvedValue(false);

    const res = await GET(makeRequest("198.51.100.2"), makeContext("valid_12345"));

    expect(checkRateLimitMock).toHaveBeenCalledWith("guest-invite", "198.51.100.2", {
      windowMs: 60_000,
      maxRequests: 15,
    });
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe("Too many requests");
  });

  it("invite_tokens 경로가 유효하면 places/schedules/member_count를 반환한다", async () => {
    const inviteTokensQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { trip_id: "trip-1", expires_at: "2099-01-01T00:00:00.000Z" },
        error: null,
      }),
    };
    const tripQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          title: "도쿄 여행",
          destination: "Tokyo",
          start_date: "2026-05-01",
          end_date: "2026-05-05",
        },
        error: null,
      }),
    };
    const placesQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: "place-1",
            name: "도쿄 타워",
            category: "attraction",
            image_urls: ["https://img.example.com/1.jpg"],
            address: "Minato",
            rating: 4.7,
          },
          {
            id: "place-2",
            name: "신주쿠 교엔",
            category: "park",
            image_urls: null,
            address: "Shinjuku",
            rating: 4.6,
          },
        ],
        error: null,
      }),
    };
    const schedulesQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: "sched-1",
            date: "2026-05-02",
            schedule_items: [
              { id: "item-2", title: "점심", sort_order: 2, place: null },
              {
                id: "item-1",
                title: "placeholder",
                sort_order: 1,
                place: { name: "아사쿠사", category: "attraction" },
              },
            ],
          },
        ],
        error: null,
      }),
    };
    const membersQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ count: 3, error: null }),
    };

    createClientMock.mockReturnValue({
      from: (table: string) => {
        if (table === "invite_tokens") return inviteTokensQuery;
        if (table === "trips") return tripQuery;
        if (table === "places") return placesQuery;
        if (table === "schedules") return schedulesQuery;
        if (table === "trip_members") return membersQuery;
        throw new Error(`Unexpected table: ${table}`);
      },
    });

    const res = await GET(makeRequest("203.0.113.1"), makeContext("guestToken_123"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.trip).toEqual({
      title: "도쿄 여행",
      destination: "Tokyo",
      start_date: "2026-05-01",
      end_date: "2026-05-05",
    });
    expect(body.places).toEqual([
      {
        id: "place-1",
        name: "도쿄 타워",
        category: "attraction",
        image_url: "https://img.example.com/1.jpg",
        address: "Minato",
        rating: 4.7,
      },
      {
        id: "place-2",
        name: "신주쿠 교엔",
        category: "park",
        image_url: null,
        address: "Shinjuku",
        rating: 4.6,
      },
    ]);
    expect(body.schedules).toEqual([
      {
        date: "2026-05-02",
        items: [
          { title: "아사쿠사", category: "attraction" },
          { title: "점심", category: null },
        ],
      },
    ]);
    expect(body.member_count).toBe(3);
  });

  it("invite token 만료 시 404를 반환한다", async () => {
    const inviteTokensQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { trip_id: "trip-1", expires_at: "2000-01-01T00:00:00.000Z" },
        error: null,
      }),
    };

    createClientMock.mockReturnValue({
      from: (table: string) => {
        if (table === "invite_tokens") return inviteTokensQuery;
        throw new Error(`Unexpected table: ${table}`);
      },
    });

    const res = await GET(makeRequest(), makeContext("expiredToken_1"));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe("Invite link has expired");
  });

  it("invite_tokens에 없으면 trips.invite_code로 fallback 조회한다", async () => {
    const inviteTokensQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const tripsByInviteCodeQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "trip-legacy" }, error: null }),
    };
    const tripQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          title: "레거시 초대",
          destination: "Seoul",
          start_date: "2026-06-01",
          end_date: "2026-06-02",
        },
        error: null,
      }),
    };
    const placesQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    const schedulesQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    const membersQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
    };

    let tripsCallCount = 0;
    createClientMock.mockReturnValue({
      from: (table: string) => {
        if (table === "invite_tokens") return inviteTokensQuery;
        if (table === "trips") {
          tripsCallCount += 1;
          return tripsCallCount === 1 ? tripsByInviteCodeQuery : tripQuery;
        }
        if (table === "places") return placesQuery;
        if (table === "schedules") return schedulesQuery;
        if (table === "trip_members") return membersQuery;
        throw new Error(`Unexpected table: ${table}`);
      },
    });

    const res = await GET(makeRequest(), makeContext("legacyInvite_123"));

    expect(res.status).toBe(200);
    expect(tripsByInviteCodeQuery.maybeSingle).toHaveBeenCalledTimes(1);
    const body = await res.json();
    expect(body.trip.title).toBe("레거시 초대");
  });
});
