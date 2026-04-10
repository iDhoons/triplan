import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeTravelInfoForSchedule } from "@/lib/services/travel-info";

function createSupabaseMock(scheduleData: unknown) {
  const scheduleQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: scheduleData }),
  };

  const scheduleItemsUpdateEq = vi.fn().mockResolvedValue({ error: null });
  const scheduleItemsQuery = {
    update: vi.fn().mockReturnValue({
      eq: scheduleItemsUpdateEq,
    }),
  };

  const from = vi.fn((table: string) => {
    if (table === "schedules") return scheduleQuery;
    if (table === "schedule_items") return scheduleItemsQuery;
    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    supabase: { from } as unknown,
    scheduleItemsQuery,
    scheduleItemsUpdateEq,
  };
}

describe("computeTravelInfoForSchedule", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("이전 아이템 start_time이 있으면 departureTime을 포함해 directions를 호출한다", async () => {
    const scheduleDate = "2026-05-01";
    const scheduleId = "schedule-1";

    const { supabase, scheduleItemsQuery, scheduleItemsUpdateEq } = createSupabaseMock({
      id: scheduleId,
      date: scheduleDate,
      items: [
        {
          id: "item-1",
          sort_order: 1,
          start_time: "09:30:00",
          travel_mode: null,
          travel_duration_seconds: null,
          place: { latitude: 37.5665, longitude: 126.978 },
        },
        {
          id: "item-2",
          sort_order: 2,
          start_time: null,
          travel_mode: "transit",
          travel_duration_seconds: null,
          place: { latitude: 37.5700, longitude: 126.9900 },
        },
      ],
    });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          duration_seconds: 700,
          distance_meters: 1500,
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await computeTravelInfoForSchedule(supabase as never, scheduleId);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl] = fetchMock.mock.calls[0] as [string];
    const url = new URL(calledUrl, "http://localhost");

    expect(url.pathname).toBe("/api/directions");
    expect(url.searchParams.get("origin")).toBe("37.5665,126.978");
    expect(url.searchParams.get("destination")).toBe("37.57,126.99");
    expect(url.searchParams.get("mode")).toBe("transit");
    expect(url.searchParams.get("departureTime")).toBe(
      new Date(`${scheduleDate}T09:30:00`).toISOString()
    );

    expect(scheduleItemsQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        travel_duration_seconds: 700,
        travel_distance_meters: 1500,
        travel_mode: "transit",
      })
    );
    expect(scheduleItemsUpdateEq).toHaveBeenCalledWith("id", "item-2");
  });

  it("이전 아이템 start_time이 없으면 departureTime 없이 호출한다", async () => {
    const scheduleId = "schedule-2";

    const { supabase } = createSupabaseMock({
      id: scheduleId,
      date: "2026-05-02",
      items: [
        {
          id: "item-1",
          sort_order: 1,
          start_time: null,
          travel_mode: null,
          travel_duration_seconds: null,
          place: { latitude: 37.5001, longitude: 127.0001 },
        },
        {
          id: "item-2",
          sort_order: 2,
          start_time: null,
          travel_mode: "walking",
          travel_duration_seconds: null,
          place: { latitude: 37.5002, longitude: 127.0002 },
        },
      ],
    });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          duration_seconds: 300,
          distance_meters: 200,
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await computeTravelInfoForSchedule(supabase as never, scheduleId);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl] = fetchMock.mock.calls[0] as [string];
    const url = new URL(calledUrl, "http://localhost");
    expect(url.searchParams.get("departureTime")).toBeNull();
  });
});
