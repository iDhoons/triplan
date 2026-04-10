import { describe, expect, it } from "vitest";
import { createdResponse, successResponse } from "@/lib/api/response";

describe("API response helpers", () => {
  it("successResponse는 기본 200 상태와 표준 payload를 반환한다", async () => {
    const res = successResponse({ hello: "world" });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      success: true,
      data: { hello: "world" },
    });
  });

  it("successResponse는 전달된 상태 코드를 사용한다", async () => {
    const res = successResponse({ accepted: true }, 202);

    expect(res.status).toBe(202);
    await expect(res.json()).resolves.toEqual({
      success: true,
      data: { accepted: true },
    });
  });

  it("createdResponse는 201 상태와 표준 payload를 반환한다", async () => {
    const res = createdResponse({ id: "resource-1" });

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({
      success: true,
      data: { id: "resource-1" },
    });
  });
});
