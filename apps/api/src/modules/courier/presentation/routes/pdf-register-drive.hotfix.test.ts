import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../../../app";
import { registerCourierRoutes } from "./courier.routes";

describe("Hotfix — Zero Local Storage PDF routes", () => {
  registerCourierRoutes(app);

  it("POST /api/courier/pdf/upload returns 410 Gone for any request, before auth or Multer run", async () => {
    const res = await request(app)
      .post("/api/courier/pdf/upload")
      .field("dummy", "1");

    expect(res.status).toBe(410);
    expect(res.body.code).toBe("ENDPOINT_GONE");
  });

  it("POST /api/courier/pdf/upload returns 410 even for a multipart request with an attached file field", async () => {
    const res = await request(app)
      .post("/api/courier/pdf/upload")
      .attach("file", Buffer.from("not a real pdf"), "test.pdf");

    expect(res.status).toBe(410);
  });

  it("POST /api/courier/pdf/register-drive rejects multipart with 415 before touching auth-gated logic", async () => {
    const res = await request(app)
      .post("/api/courier/pdf/register-drive")
      .field("drive_url", "https://drive.google.com/file/d/abc/view");

    expect(res.status).toBe(415);
    expect(res.body.code).toBe("UNSUPPORTED_MEDIA_TYPE");
  });

  it("POST /api/courier/pdf/register-drive rejects a JSON request without authentication (requireAuthOrInternal)", async () => {
    const res = await request(app)
      .post("/api/courier/pdf/register-drive")
      .set("Content-Type", "application/json")
      .send({ drive_url: "https://drive.google.com/file/d/abc/view", file_name: "report.pdf" });

    expect(res.status).toBe(401);
  });

  it("POST /api/courier/pdf/register-drive is registered as a real route, not the SPA catch-all", async () => {
    const res = await request(app)
      .post("/api/courier/pdf/register-drive")
      .set("Content-Type", "application/json")
      .send({ drive_url: "https://drive.google.com/file/d/abc/view", file_name: "report.pdf" });

    // The SPA catch-all always answers 200; a real (auth-gated) route answers 401
    // for an unauthenticated request. 401, not 200, proves this hit real route logic.
    expect(res.status).toBe(401);
    expect(res.status).not.toBe(200);
  });
});
