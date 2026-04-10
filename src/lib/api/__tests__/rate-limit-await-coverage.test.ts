import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const API_DIR = join(process.cwd(), "src/app/api");

function findRouteFiles(dir: string, base = ""): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const relativePath = base ? `${base}/${entry}` : entry;
    if (statSync(fullPath).isDirectory()) {
      files.push(...findRouteFiles(fullPath, relativePath));
    } else if (entry === "route.ts") {
      files.push(relativePath);
    }
  }
  return files;
}

describe("Rate limiter await coverage", () => {
  const routeFiles = findRouteFiles(API_DIR);

  for (const relPath of routeFiles) {
    const routeName = relPath.replace("/route.ts", "");

    it(`${routeName}에서 checkRateLimit 호출은 await 되어야 한다`, () => {
      const content = readFileSync(join(API_DIR, relPath), "utf-8");
      const matches = [...content.matchAll(/checkRateLimit\s*\(/g)];

      if (matches.length === 0) {
        expect(true).toBe(true);
        return;
      }

      for (const match of matches) {
        const index = match.index ?? 0;
        const prefix = content.slice(Math.max(0, index - 120), index);
        const isAwaited = /await\s*$/.test(prefix);

        expect(
          isAwaited,
          `${routeName}에 await 없는 checkRateLimit 호출이 있습니다.`
        ).toBe(true);
      }
    });
  }
});
