import { updateAiEngineSettings } from "../apps/api/src/modules/ai-engine-settings/ai-engine-settings.store";

async function run() {
  console.log("Updating AI settings...");
  const settings = updateAiEngineSettings({
    enabled: true,
    provider: "openai",
    model: "gpt-4o",
    apiKey: process.env.OPENAI_API_KEY ?? "",
    timeoutMs: 90000,
    updatedBy: "system-test",
  });
  console.log("Updated settings successfully:", JSON.stringify(settings, null, 2));
}

run().catch(console.error);
