import { beforeEach, describe, expect, it, vi } from "vitest";

const checkRateLimitMock = vi.fn();
const getDirectionsMock = vi.fn();

vi.mock("@/lib/api/guards", () => ({
  withAuth: (handler: (request: Request, ctx: { user: { id: string } }) => Promise<Response>) => {
    return (request: Request) => handler(request, { user: { id: "user-1" } });
  },
  checkRateLimit: (...args: unknown[]) => checkRateLimitMock(...args),
}));

vi.mock("@/lib/directions/client", () => ({
  getDirections: (...args: unknown[]) => getDirectionsMock(...args),
}));

vi.mock("@/lib/api/error-response", () => ({
  errorResponse: (code: string, message: string) =>
    new Response(
      JSON.stringify({
        success: false,
        error: message,
      }),
      {
        status: code === "BAD_REQUEST" ? 400 : code === "RATE_LIMITED" ? 429 : 500,
        headers: { "Content-Type": "application/json" },
      }
    ),
}));

import { GET } from "../route";

describe("GET /api/directions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_PLACES_API_KEY = "test-key";
    checkRateLimitMock.mockResolvedValue(true);
    getDirectionsMock.mockResolvedValue({
      duration_seconds: 600,
      distance_meters: 1200,
      duration_text: "약 10분",
      distance_text: "1.2km",
      summary: null,
      estimated: false,
      used_mode: "transit",
    });
  });

  it("departureTime 쿼리를 getDirections로 전달한다", async () => {
    const departureTime = "2026-04-09T08:00:00.000Z";
    const req = new Request(
      `http://localhost/api/directions?origin=37.5665,126.9780&destination=37.5700,126.9900&mode=transit&departureTime=${encodeURIComponent(departureTime)}`
    );

    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(checkRateLimitMock).toHaveBeenCalledWith("directions", "user-1", { maxRequests: 30 });
    expect(getDirectionsMock).toHaveBeenCalledWith(
      "37.5665,126.9780",
      "37.5700,126.9900",
      "transit",
      "test-key",
      departureTime
    );
  });

  it("departureTime이 없으면 undefined를 전달한다", async () => {
    const req = new Request(
      "http://localhost/api/directions?origin=37.5665,126.9780&destination=37.5700,126.9900&mode=walking"
    );

    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(getDirectionsMock).toHaveBeenCalledWith(
      "37.5665,126.9780",
      "37.5700,126.9900",
      "walking",
      "test-key",
      undefined
    );
  });
});
