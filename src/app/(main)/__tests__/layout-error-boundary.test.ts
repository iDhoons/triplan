import React from "react";
import { describe, expect, it } from "vitest";
import MainLayout from "../layout";
import { AppShell } from "@/components/layout/app-shell";
import { ErrorBoundary } from "@/components/error-boundary";

describe("MainLayout", () => {
  it("AppShell 내부에 ErrorBoundary로 children을 감싼다", () => {
    const child = React.createElement("section", { id: "qa-child" }, "QA");

    const tree = MainLayout({ children: child }) as React.ReactElement<{ children: React.ReactElement<{ children: React.ReactNode }> }>;
    expect(tree.type).toBe(AppShell);

    const boundaryNode = tree.props.children;
    expect(boundaryNode.type).toBe(ErrorBoundary);
    expect(boundaryNode.props.children).toBe(child);
  });
});
