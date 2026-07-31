import { describe, it, expect, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { registerSduiFiltersRoutes } from "./sdui-filters.routes";

describe("GET /api/mobile/v1/screens/custody/filters - SDUI Endpoint Tests", () => {
  let app: express.Express;
  let tempDir: string;
  let tempConfigPath: string;
  let tempPrivateKeyPath: string;
  let publicKeyHex: string;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    registerSduiFiltersRoutes(app);

    // Create temporary directory for test fixtures
    tempDir = path.join(process.cwd(), "scratch/sdui-test-" + Date.now());
    fs.mkdirSync(tempDir, { recursive: true });

    tempConfigPath = path.join(tempDir, "test_config.json");
    tempPrivateKeyPath = path.join(tempDir, "test_private.key");

    // Generate fixed test Ed25519 keypair
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
    const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" });
    fs.writeFileSync(tempPrivateKeyPath, privateKeyPem);

    const rawPub = publicKey.export({ type: "spki", format: "der" });
    publicKeyHex = rawPub.subarray(rawPub.length - 32).toString("hex");

    process.env.MOBILE_SDUI_FILTER_CONFIG_PATH = tempConfigPath;
    process.env.MOBILE_SDUI_ED25519_PRIVATE_KEY_PATH = tempPrivateKeyPath;
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    delete process.env.MOBILE_SDUI_FILTER_CONFIG_PATH;
    delete process.env.MOBILE_SDUI_ED25519_PRIVATE_KEY_PATH;
  });

  it("1. Returns 200 with valid Ed25519 signature & ETag header", async () => {
    const validConfig = {
      schemaVersion: 1,
      configVersion: 1,
      issuedAt: "2026-07-31T00:00:00Z",
      expiresAt: "2030-01-01T00:00:00Z",
      keyId: "ed25519-prod-key-1",
      minAppVersion: "1.0.0",
      screenId: "custody_screen",
      defaultFilterId: "all",
      filters: [
        {
          id: "all",
          label: "جميع العهد (موقع من السيرفر)",
          enabled: true,
          order: 1,
          icon: "inventory_2_outlined",
          colorHex: "#18B2B0",
          statuses: [],
        },
      ],
    };
    fs.writeFileSync(tempConfigPath, JSON.stringify(validConfig));

    const response = await request(app)
      .get("/api/mobile/v1/screens/custody/filters")
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.signature).toBeDefined();
    expect(response.headers.etag).toBeDefined();
    expect(response.body.data.filters[0].label).toBe("جميع العهد (موقع من السيرفر)");
  });

  it("2. Responds with 304 Not Modified when If-None-Match matches ETag", async () => {
    const validConfig = {
      schemaVersion: 1,
      configVersion: 1,
      issuedAt: "2026-07-31T00:00:00Z",
      expiresAt: "2030-01-01T00:00:00Z",
      keyId: "ed25519-prod-key-1",
      minAppVersion: "1.0.0",
      screenId: "custody_screen",
      defaultFilterId: "all",
      filters: [],
    };
    fs.writeFileSync(tempConfigPath, JSON.stringify(validConfig));

    const firstRes = await request(app)
      .get("/api/mobile/v1/screens/custody/filters")
      .expect(200);

    const etag = firstRes.headers.etag;

    await request(app)
      .get("/api/mobile/v1/screens/custody/filters")
      .set("If-None-Match", etag)
      .expect(304);
  });

  it("3. Returns 500 when config file is missing", async () => {
    if (fs.existsSync(tempConfigPath)) fs.unlinkSync(tempConfigPath);

    const res = await request(app)
      .get("/api/mobile/v1/screens/custody/filters")
      .expect(500);

    expect(res.body.error).toContain("missing");
  });

  it("4. Returns 500 when private signing key is missing", async () => {
    const validConfig = {
      schemaVersion: 1,
      configVersion: 1,
      issuedAt: "2026-07-31T00:00:00Z",
      expiresAt: "2030-01-01T00:00:00Z",
      keyId: "ed25519-prod-key-1",
      minAppVersion: "1.0.0",
      screenId: "custody_screen",
      defaultFilterId: "all",
      filters: [],
    };
    fs.writeFileSync(tempConfigPath, JSON.stringify(validConfig));
    if (fs.existsSync(tempPrivateKeyPath)) fs.unlinkSync(tempPrivateKeyPath);

    const res = await request(app)
      .get("/api/mobile/v1/screens/custody/filters")
      .expect(500);

    expect(res.body.error).toContain("signing key missing");
  });

  it("5. Returns 500 when filter count exceeds limit of 20", async () => {
    const oversizedConfig = {
      schemaVersion: 1,
      configVersion: 1,
      issuedAt: "2026-07-31T00:00:00Z",
      expiresAt: "2030-01-01T00:00:00Z",
      keyId: "ed25519-prod-key-1",
      minAppVersion: "1.0.0",
      screenId: "custody_screen",
      defaultFilterId: "all",
      filters: Array.from({ length: 25 }, (_, i) => ({
        id: `f_${i}`,
        label: `Filter ${i}`,
        enabled: true,
        order: i,
        icon: "inventory_2_outlined",
        colorHex: "#18B2B0",
        statuses: [],
      })),
    };
    fs.writeFileSync(tempConfigPath, JSON.stringify(oversizedConfig));

    const res = await request(app)
      .get("/api/mobile/v1/screens/custody/filters")
      .expect(500);

    expect(res.body.error).toContain("count exceeds limit");
  });

  it("6. Returns 500 when configuration is expired (expiresAt in past)", async () => {
    const expiredConfig = {
      schemaVersion: 1,
      configVersion: 1,
      issuedAt: "2020-01-01T00:00:00Z",
      expiresAt: "2020-06-01T00:00:00Z",
      keyId: "ed25519-prod-key-1",
      minAppVersion: "1.0.0",
      screenId: "custody_screen",
      defaultFilterId: "all",
      filters: [],
    };
    fs.writeFileSync(tempConfigPath, JSON.stringify(expiredConfig));

    const res = await request(app)
      .get("/api/mobile/v1/screens/custody/filters")
      .expect(500);

    expect(res.body.error).toContain("expired or invalid date");
  });

  it("7. Returns 500 when configuration issuedAt is in future", async () => {
    const futureConfig = {
      schemaVersion: 1,
      configVersion: 1,
      issuedAt: "2099-01-01T00:00:00Z",
      expiresAt: "2099-12-31T00:00:00Z",
      keyId: "ed25519-prod-key-1",
      minAppVersion: "1.0.0",
      screenId: "custody_screen",
      defaultFilterId: "all",
      filters: [],
    };
    fs.writeFileSync(tempConfigPath, JSON.stringify(futureConfig));

    const res = await request(app)
      .get("/api/mobile/v1/screens/custody/filters")
      .expect(500);

    expect(res.body.error).toContain("issuedAt invalid");
  });

  it("8. Returns 500 when keyId or minAppVersion is missing", async () => {
    const invalidKeyIdConfig = {
      schemaVersion: 1,
      configVersion: 1,
      issuedAt: "2026-07-31T00:00:00Z",
      expiresAt: "2030-01-01T00:00:00Z",
      // missing keyId
      minAppVersion: "1.0.0",
      screenId: "custody_screen",
      defaultFilterId: "all",
      filters: [],
    };
    fs.writeFileSync(tempConfigPath, JSON.stringify(invalidKeyIdConfig));

    const res = await request(app)
      .get("/api/mobile/v1/screens/custody/filters")
      .expect(500);

    expect(res.body.error).toContain("schema validation failed");
  });

  it("9. Returns 500 when payload exceeds 50KB limit", async () => {
    const hugeLabel = "X".repeat(52000);
    const oversizedPayload = {
      schemaVersion: 1,
      configVersion: 1,
      issuedAt: "2026-07-31T00:00:00Z",
      expiresAt: "2030-01-01T00:00:00Z",
      keyId: "ed25519-prod-key-1",
      minAppVersion: "1.0.0",
      screenId: "custody_screen",
      defaultFilterId: "all",
      filters: [],
      extraData: hugeLabel,
    };
    fs.writeFileSync(tempConfigPath, JSON.stringify(oversizedPayload));

    const res = await request(app)
      .get("/api/mobile/v1/screens/custody/filters")
      .expect(500);

    expect(res.body.error).toContain("payload size exceeds");
  });
});
