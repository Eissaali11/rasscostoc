import express from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { registerSduiFiltersRoutes } from "../../apps/api/src/modules/inventory/presentation/routes/sdui-filters.routes";

const app = express();
app.use(express.json());

// Register official nulip-inventory SDUI routes
registerSduiFiltersRoutes(app);

const PORT = 3005;

const configDir = path.resolve(process.cwd(), "config");
if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });

const configPath = path.resolve(configDir, "mobile-sdui-filters.json");
const privateKeyPath = path.resolve(configDir, "sdui_ed25519_private.key");

if (!fs.existsSync(privateKeyPath)) {
  const { privateKey } = crypto.generateKeyPairSync("ed25519");
  fs.writeFileSync(privateKeyPath, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
}

process.env.MOBILE_SDUI_FILTER_CONFIG_PATH = configPath;
process.env.MOBILE_SDUI_ED25519_PRIVATE_KEY_PATH = privateKeyPath;

app.listen(PORT, () => {
  console.log(`[Official Nulip Backend] Listening on http://localhost:${PORT}`);
});
