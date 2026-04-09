import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.fn();
const nanoidMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

vi.mock("nanoid", () => ({
  nanoid: (...args: unknown[]) => nanoidMock(...args),
}));

import { DELETE, GET, POST } from "../route";

function makeRequest(
  method: "GET" | "POST" | "DELETE",
  options?: { body?: unknown; origin?: string; tripId?: string },
) {
  const headers = new Headers();
  headers.set("origin", options?.origin ?? "https://app.example.com");
  if (options?.body !== undefined) headers.set("Content-Type", "application/json");
  const tripId = options?.tripId ?? "trip-1";

  return new Request(`http://localhost/api/trips/${tripId}/invite-token`, {
    method,
    headers,
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

function buildMemberQuery(role: string | null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: role ? { role } : null, error: null }),
  };
}

describe("POST/GET/DELETE /api/trips/[tripId]/invite-token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nanoidMock.mockReturnValue("generatedInviteToken");
  });

  it("POST: 인증되지 않은 요청은 401을 반환한다", async () => {
    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
      from: vi.fn(),
    });

    const res = await POST(makeRequest("POST"));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe("Unauthorized");
  });

  it("POST: admin/editor가 아니면 403을 반환한다", async () => {
    const memberQuery = buildMemberQuery("viewer");

    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      from: (table: string) => {
        if (table === "trip_members") return memberQuery;
        throw new Error(`Unexpected table: ${table}`);
      },
    });

    const res = await POST(makeRequest("POST"));

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe("Viewer는 이 작업을 수행할 수 없습니다");
  });

  it("POST: editor는 7일 만료 토큰을 생성하고 201을 반환한다", async () => {
    const memberQuery = buildMemberQuery("editor");
    const inviteTokensQuery = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: "invite-1",
          token: "generatedInviteToken",
          expires_at: "2026-04-16T00:00:00.000Z",
          created_at: "2026-04-09T00:00:00.000Z",
        },
        error: null,
      }),
    };

    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      from: (table: string) => {
        if (table === "trip_members") return memberQuery;
        if (table === "invite_tokens") return inviteTokensQuery;
        throw new Error(`Unexpected table: ${table}`);
      },
    });

    const res = await POST(
      makeRequest("POST", {
        origin: "https://trip.example.com",
        tripId: "trip-42",
      }),
    );

    expect(res.status).toBe(201);
    expect(nanoidMock).toHaveBeenCalledWith(21);
    expect(inviteTokensQuery.insert).toHaveBeenCalledTimes(1);

    const payload = inviteTokensQuery.insert.mock.calls[0][0] as {
      trip_id: string;
      token: string;
      created_by: string;
      expires_at: string;
    };
    expect(payload.trip_id).toBe("trip-42");
    expect(payload.token).toBe("generatedInviteToken");
    expect(payload.created_by).toBe("user-1");
    expect(new Date(payload.expires_at).getTime()).toBeGreaterThan(Date.now());

    const body = await res.json();
    expect(body).toEqual({
      id: "invite-1",
      token: "generatedInviteToken",
      url: "https://trip.example.com/join/generatedInviteToken",
      expires_at: "2026-04-16T00:00:00.000Z",
      created_at: "2026-04-09T00:00:00.000Z",
    });
  });

  it("GET: 여행 멤버는 활성 토큰 목록을 조회할 수 있다", async () => {
    const memberQuery = buildMemberQuery("viewer");
    const inviteTokensQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: "invite-1",
            token: "abc123",
            expires_at: "2026-04-16T00:00:00.000Z",
            created_at: "2026-04-09T00:00:00.000Z",
          },
        ],
        error: null,
      }),
    };

    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      from: (table: string) => {
        if (table === "trip_members") return memberQuery;
        if (table === "invite_tokens") return inviteTokensQuery;
        throw new Error(`Unexpected table: ${table}`);
      },
    });

    const res = await GET(
      makeRequest("GET", {
        origin: "https://trip.example.com",
        tripId: "trip-42",
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tokens).toEqual([
      {
        id: "invite-1",
        token: "abc123",
        url: "https://trip.example.com/join/abc123",
        expires_at: "2026-04-16T00:00:00.000Z",
        created_at: "2026-04-09T00:00:00.000Z",
      },
    ]);
  });

  it("DELETE: tokenId가 없으면 400을 반환한다", async () => {
    const memberQuery = buildMemberQuery("admin");

    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      from: (table: string) => {
        if (table === "trip_members") return memberQuery;
        if (table === "invite_tokens") return { delete: vi.fn(), eq: vi.fn() };
        throw new Error(`Unexpected table: ${table}`);
      },
    });

    const res = await DELETE(makeRequest("DELETE", { body: {} }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe("tokenId is required");
  });

  it("DELETE: admin/editor는 tokenId를 revoke할 수 있다", async () => {
    const memberQuery = buildMemberQuery("admin");
    const inviteTokensQuery = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn(),
    };
    inviteTokensQuery.eq.mockImplementation((column: string) => {
      if (column === "trip_id") return Promise.resolve({ error: null });
      return inviteTokensQuery;
    });

    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      from: (table: string) => {
        if (table === "trip_members") return memberQuery;
        if (table === "invite_tokens") return inviteTokensQuery;
        throw new Error(`Unexpected table: ${table}`);
      },
    });

    const res = await DELETE(
      makeRequest("DELETE", {
        body: { tokenId: "invite-1" },
        tripId: "trip-42",
      }),
    );

    expect(res.status).toBe(200);
    expect(inviteTokensQuery.delete).toHaveBeenCalledTimes(1);
    expect(inviteTokensQuery.eq).toHaveBeenNthCalledWith(1, "id", "invite-1");
    expect(inviteTokensQuery.eq).toHaveBeenNthCalledWith(2, "trip_id", "trip-42");
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
