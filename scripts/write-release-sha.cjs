#!/usr/bin/env node
//
// Writes dist/RELEASE_SHA after a successful build. This is the only
// source of truth pre-deploy-guard.sh's release-sha check trusts -- it is
// always derived fresh from `git rev-parse HEAD`, never from a
// caller-supplied environment variable, so it cannot be spoofed by
// setting an arbitrary value before running the build.
//
// Exits non-zero (failing the build) if the SHA cannot be determined or
// dist/ does not exist yet.

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

let sha;
try {
  sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
} catch (err) {
  console.error("write-release-sha: failed to determine git HEAD SHA:", err.message);
  process.exit(1);
}

if (!/^[0-9a-f]{40}$/.test(sha)) {
  console.error(`write-release-sha: git rev-parse HEAD returned an invalid SHA: "${sha}"`);
  process.exit(1);
}

const distDir = path.resolve(__dirname, "..", "dist");
if (!fs.existsSync(distDir)) {
  console.error("write-release-sha: dist/ does not exist -- the build must run before this script.");
  process.exit(1);
}

fs.writeFileSync(path.join(distDir, "RELEASE_SHA"), sha + "\n", { encoding: "utf8" });
console.log(`write-release-sha: wrote dist/RELEASE_SHA = ${sha}`);
