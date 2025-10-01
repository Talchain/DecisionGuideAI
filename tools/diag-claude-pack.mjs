import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";

function latestClaudeZip() {
  const out = execFileSync("bash", ["-lc","ls -1 docs/evidence/incoming/claude/claude_pack_*.zip 2>/dev/null | sort | tail -n1"], {encoding:"utf8"}).trim();
  if (!out) throw new Error("No Claude pack found in docs/evidence/incoming/claude/");
  return out;
}
function unzipText(zip, path) {
  return execFileSync("unzip", ["-p", zip, path], {encoding:"utf8"});
}
function unzipBuf(zip, path) {
  return execFileSync("unzip", ["-p", zip, path]);
}
function list(zip) {
  return execFileSync("unzip", ["-Z1", zip], {encoding:"utf8"}).trim().split("\n").filter(Boolean);
}
function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

const zip = latestClaudeZip();
const files = list(zip);
const manifestPath = files.find(f => f === "manifest.json") || files.find(f => f.endsWith("/manifest.json"));
if (!manifestPath) throw new Error("manifest.json not found inside pack");
const manifest = JSON.parse(unzipText(zip, manifestPath));
const checks = manifest.checksums || [];
const missing = [];
const mismatched = [];
for (const {path, sha256: want} of checks) {
  if (!files.includes(path)) { missing.push(path); continue; }
  const got = sha256(unzipBuf(zip, path));
  if (got !== want) mismatched.push({path, want, got});
}
const result = {
  zip,
  manifestPath,
  filesCount: files.length,
  checksCount: checks.length,
  missingCount: missing.length,
  mismatchedCount: mismatched.length,
  missing,
  mismatched,
  slos: manifest.slos ?? null,
  privacy: manifest.privacy ?? null,
};
console.log(JSON.stringify(result, null, 2));
