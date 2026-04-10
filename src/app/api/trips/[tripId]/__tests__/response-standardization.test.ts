import { beforeEach, describe, expect, it, vi } from "vitest";

type GuardContext = {
  supabase: {
    from: (...args: unknown[]) => unknown;
    rpc?: (...args: unknown[]) => Promise<{ data: unknown; error: unknown }>;
  };
  role?: "admin" | "editor" | "viewer";
  tripId: string;
};

let guardContext: GuardContext;

vi.mock("@/lib/api/guards", () => ({
  withTripMember: (
    _getTripIdFromRequest: unknown,
    handler: (request: Request, context: GuardContext) => Promise<Response>,
  ) => {
    return async (request: Request) => handler(request, guardContext);
  },
}));

import { DELETE } from "../route";
import { GET as GET_STATS } from "../stats/route";
import { GET as GET_CHECKLIST_STATS } from "../checklist-stats/route";

describe("DEC-184 API 응답 표준화", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("DELETE /api/trips/[tripId]는 성공 시 { success, data } 형식을 반환한다", async () => {
    const deleteEq = vi.fn().mockResolvedValue({ error: null });
    const deleteQuery = { eq: deleteEq };
    const tripsQuery = {
      delete: vi.fn().mockReturnValue(deleteQuery),
    };
    const from = vi.fn((table: string) => {
      if (table === "trips") return tripsQuery;
      throw new Error(`Unexpected table: ${table}`);
    });

    guardContext = {
      tripId: "trip-1",
      role: "admin",
      supabase: { from },
    };

    const res = await DELETE(
      new Request("http://localhost/api/trips/trip-1", { method: "DELETE" }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      success: true,
      data: { deleted: true },
    });
    expect(from).toHaveBeenCalledWith("trips");
    expect(deleteEq).toHaveBeenCalledWith("id", "trip-1");
  });

  it("GET /api/trips/[tripId]/stats는 성공 시 { success, data } 형식을 반환한다", async () => {
    const membersEq = vi.fn().mockResolvedValue({
      data: [
        {
          user_id: "user-1",
          role: "admin",
          profile: { id: "user-1", display_name: "Alice", avatar_url: null },
        },
      ],
      error: null,
    });
    const tripMembersQuery = {
      select: vi.fn().mockReturnThis(),
      eq: membersEq,
    };

    const from = vi.fn((table: string) => {
      if (table === "trip_members") return tripMembersQuery;
      throw new Error(`Unexpected table: ${table}`);
    });

    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          user_id: "user-1",
          places: 2,
          votes: 1,
          checklist: 3,
          schedule: 4,
          total: 10,
        },
      ],
      error: null,
    });

    guardContext = {
      tripId: "trip-42",
      role: "viewer",
      supabase: { from, rpc },
    };

    const res = await GET_STATS(
      new Request("http://localhost/api/trips/trip-42/stats", { method: "GET" }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      success: true,
      data: {
        stats: [
          {
            user_id: "user-1",
            role: "admin",
            profile: { id: "user-1", display_name: "Alice", avatar_url: null },
            contributions: {
              places: 2,
              votes: 1,
              checklist: 3,
              schedule: 4,
              total: 10,
            },
          },
        ],
      },
    });
    expect(rpc).toHaveBeenCalledWith("get_contribution_stats", { _trip_id: "trip-42" });
  });

  it("GET /api/trips/[tripId]/checklist-stats는 성공 시 { success, data } 형식을 반환한다", async () => {
    const checklistEq = vi.fn().mockResolvedValue({
      data: [
        { assigned_to: "user-1", is_checked: true },
        { assigned_to: "user-1", is_checked: false },
        { assigned_to: null, is_checked: true },
      ],
      error: null,
    });
    const checklistItemsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: checklistEq,
    };

    const membersEq = vi.fn().mockResolvedValue({
      data: [
        {
          user_id: "user-1",
          profile: { id: "user-1", display_name: "Alice", avatar_url: null },
        },
      ],
      error: null,
    });
    const tripMembersQuery = {
      select: vi.fn().mockReturnThis(),
      eq: membersEq,
    };

    const from = vi.fn((table: string) => {
      if (table === "checklist_items") return checklistItemsQuery;
      if (table === "trip_members") return tripMembersQuery;
      throw new Error(`Unexpected table: ${table}`);
    });

    guardContext = {
      tripId: "trip-99",
      role: "viewer",
      supabase: { from },
    };

    const res = await GET_CHECKLIST_STATS(
      new Request("http://localhost/api/trips/trip-99/checklist-stats", {
        method: "GET",
      }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      success: true,
      data: {
        members: [
          {
            user_id: "user-1",
            profile: { id: "user-1", display_name: "Alice", avatar_url: null },
            total: 2,
            checked: 1,
          },
        ],
        unassigned: { total: 1, checked: 1 },
        summary: { total: 3, checked: 2 },
      },
    });
  });
});
