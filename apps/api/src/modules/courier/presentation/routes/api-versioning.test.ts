import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../../../app";
import { registerCourierRoutes } from "./courier.routes";

describe("API Versioning Integration Tests", () => {
  it("should successfully rewrite and route /api/v1/courier/lookups to /api/courier/lookups", async () => {
    registerCourierRoutes(app);

    const res = await request(app)
      .get("/api/v1/courier/lookups")
      .set("Authorization", "Bearer test-token");

    expect(res.status).not.toBe(404);
  });
});
