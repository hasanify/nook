import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const version = process.argv[2];
if (!version) {
  console.error("Usage: node scripts/bump-version.mjs <version>");
  process.exit(1);
}

// 1. Update package.json
const pkgPath = path.resolve("package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
pkg.version = version;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
console.log(`Updated package.json to ${version}`);

// 2. Update package-lock.json if it exists
const pkgLockPath = path.resolve("package-lock.json");
if (fs.existsSync(pkgLockPath)) {
  const pkgLock = JSON.parse(fs.readFileSync(pkgLockPath, "utf-8"));
  pkgLock.version = version;
  if (pkgLock.packages && pkgLock.packages[""]) {
    pkgLock.packages[""].version = version;
  }
  fs.writeFileSync(pkgLockPath, JSON.stringify(pkgLock, null, 2) + "\n");
  console.log(`Updated package-lock.json to ${version}`);
}

// 3. Update src-tauri/tauri.conf.json
const tauriConfPath = path.resolve("src-tauri/tauri.conf.json");
const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, "utf-8"));
tauriConf.version = version;
fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + "\n");
console.log(`Updated src-tauri/tauri.conf.json to ${version}`);

// 4. Update src-tauri/Cargo.toml
const cargoPath = path.resolve("src-tauri/Cargo.toml");
let cargoToml = fs.readFileSync(cargoPath, "utf-8");
cargoToml = cargoToml.replace(/^version\s*=\s*"[^"]+"/m, `version = "${version}"`);
fs.writeFileSync(cargoPath, cargoToml);
console.log(`Updated src-tauri/Cargo.toml to ${version}`);

// 5. Update src-tauri/Cargo.lock
try {
  execSync("cargo check --manifest-path src-tauri/Cargo.toml", { stdio: "inherit" });
  console.log(`Updated src-tauri/Cargo.lock to ${version}`);
} catch (err) {
  console.error("Failed to update src-tauri/Cargo.lock:", err);
  process.exit(1);
}
