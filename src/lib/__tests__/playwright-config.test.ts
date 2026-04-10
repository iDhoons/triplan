import { describe, expect, it } from "vitest";

import config from "../../../playwright.config";

describe("playwright webServer config", () => {
  it("기본 webServer command가 webpack 경로를 사용한다", () => {
    const webServer = Array.isArray(config.webServer)
      ? config.webServer[0]
      : config.webServer;

    expect(webServer).toBeDefined();
    expect(webServer?.command).toContain("next dev --webpack");
    expect(webServer?.command).not.toContain("--turbopack");
  });
});
