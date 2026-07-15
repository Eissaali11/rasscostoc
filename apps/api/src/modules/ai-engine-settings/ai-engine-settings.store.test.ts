import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, it } from "vitest";

describe("ai-engine-settings.store", () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-settings-"));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
    process.env.AI_SETTINGS_SECRET = "test-secret-for-unit";
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("encrypts api key and returns masked public view", async () => {
    const {
      updateAiEngineSettings,
      toPublicSettings,
      decryptApiKey,
      loadAiEngineSettings,
      getActiveVisionCredentials,
    } = await import("./ai-engine-settings.store");

    const saved = updateAiEngineSettings({
      enabled: true,
      provider: "gemini",
      model: "gemini-2.0-flash",
      apiKey: "AIzaSyTestKey1234567890",
      updatedBy: "admin-1",
    });

    assert.equal(saved.enabled, true);
    assert.equal(saved.hasApiKey, true);
    assert.ok(saved.apiKeyEncrypted?.startsWith("v1:"));

    const pub = toPublicSettings(saved);
    assert.equal(pub.hasApiKey, true);
    assert.ok(pub.apiKeyMasked?.includes("••••"));
    assert.notEqual(pub.apiKeyMasked, "AIzaSyTestKey1234567890");

    const plain = decryptApiKey(loadAiEngineSettings().apiKeyEncrypted);
    assert.equal(plain, "AIzaSyTestKey1234567890");

    const creds = getActiveVisionCredentials();
    assert.equal(creds.enabled, true);
    assert.equal(creds.provider, "gemini");
    assert.equal(creds.apiKey, "AIzaSyTestKey1234567890");
  });

  it("keeps existing key when apiKey omitted", async () => {
    const { updateAiEngineSettings, decryptApiKey, loadAiEngineSettings } =
      await import("./ai-engine-settings.store");

    updateAiEngineSettings({ apiKey: "keep-me-secret-key-001" });
    updateAiEngineSettings({ enabled: false, model: "gemini-2.5-pro" });

    const plain = decryptApiKey(loadAiEngineSettings().apiKeyEncrypted);
    assert.equal(plain, "keep-me-secret-key-001");
    assert.equal(loadAiEngineSettings().enabled, false);
    assert.equal(loadAiEngineSettings().model, "gemini-2.5-pro");
  });
});
