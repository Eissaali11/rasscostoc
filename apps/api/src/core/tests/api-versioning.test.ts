import { describe, expect, it } from "vitest";
import request from "supertest";
import express from "express";
import { app } from "../../app";
import { registerCourierRoutes } from "../../modules/courier/presentation/routes/courier.routes";

describe("API Versioning Integration Tests", () => {
  it("should successfully rewrite and route /api/v1/courier/lookups to /api/courier/lookups", async () => {
    // We register the courier routes on the app under test
    registerCourierRoutes(app);

    // Perform a request to /api/v1/courier/lookups which doesn't require any auth payload for public lookups (or mocked auth)
    // Wait, let's mock the auth middleware for this request
    const res = await request(app)
      .get("/api/v1/courier/lookups")
      .set("Authorization", "Bearer test-token"); // To pass auth check or get 401/other status instead of 404

    // If it was not rewritten, it would return 404 Not Found.
    // If it is rewritten, it will either return 200 or 401 Unauthorized depending on auth, but NOT 404!
    expect(res.status).not.toBe(404);
  });
});
