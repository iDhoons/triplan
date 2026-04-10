import React from "react";
import { describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "@/components/error-boundary";

describe("ErrorBoundary", () => {
  it("getDerivedStateFromError는 에러 상태를 활성화한다", () => {
    const error = new Error("boom");
    expect(ErrorBoundary.getDerivedStateFromError(error)).toEqual({
      hasError: true,
      error,
    });
  });

  it("에러 상태가 아니면 children을 렌더링한다", () => {
    const child = React.createElement("div", { id: "ok-child" }, "ok");
    const boundary = new ErrorBoundary({ children: child });

    const rendered = boundary.render() as React.ReactElement;
    expect(rendered).toBe(child);
  });

  it("기본 fallback은 alert 역할과 재시도 동작을 제공한다", () => {
    const boundary = new ErrorBoundary({
      children: React.createElement("div", null, "child"),
    });
    boundary.state = { hasError: true, error: new Error("테스트 에러") };

    boundary.setState = vi.fn((update: unknown) => {
      const patch =
        typeof update === "function"
          ? (update as (prev: unknown) => unknown)(boundary.state)
          : update;
      boundary.state = { ...boundary.state, ...(patch as Record<string, unknown>) };
    }) as unknown as typeof boundary.setState;

    const fallbackElement = boundary.render() as React.ReactElement;
    expect(typeof fallbackElement.type).toBe("function");

    const fallbackNode = (fallbackElement.type as (props: unknown) => React.ReactElement)(
      fallbackElement.props,
    ) as React.ReactElement<{ role?: string }>;

    expect(fallbackNode.props.role).toBe("alert");
    expect(JSON.stringify(fallbackNode)).toContain("다시 시도");

    (fallbackElement.props as { onReset: () => void }).onReset();
    expect(boundary.state).toEqual({ hasError: false, error: null });
  });
});
