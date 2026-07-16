import { updateAiEngineSettings } from "../apps/api/src/modules/ai-engine-settings/ai-engine-settings.store";

async function run() {
  console.log("Updating AI settings...");
  const settings = updateAiEngineSettings({
    enabled: true,
    provider: "openai",
    model: "gpt-4o",
    apiKey: "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",
    timeoutMs: 90000,
    updatedBy: "system-test",
  });
  console.log("Updated settings successfully:", JSON.stringify(settings, null, 2));
}

run().catch(console.error);
