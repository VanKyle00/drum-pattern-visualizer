import { it, expect } from "vitest";
import { startServer } from "../server/service";
import path from "node:path";
it("allocates a free local port and shuts down cleanly", async () => {
  const server = await startServer({
    assets: path.resolve("dist"),
    jobsRoot: path.resolve(".render-jobs/service-test"),
    port: 0,
  });
  try {
    expect(server.origin).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    const session = await fetch(server.origin + "/api/session");
    expect(session.status).toBe(200);
    expect((await session.json()).token).toHaveLength(64);
    const denied = await fetch(server.origin + "/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(denied.status).toBe(403);
  } finally {
    await server.close();
  }
  await expect(fetch(server.origin + "/api/session")).rejects.toThrow();
});
