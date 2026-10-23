#!/usr/bin/env node
/**
 * Dependency audit gate for CI.
 *
 * Runs `npm audit --json` and fails (exit 1) on any high/critical advisory
 * that is not explicitly allowlisted below.
 *
 * ALLOWLIST POLICY: an advisory may be allowlisted only when (a) no patched
 * release exists, and (b) the vulnerable code path is not reachable with
 * attacker-controlled input in production. Every entry must name the GHSA,
 * the reason, and the condition for removal. Re-check on every lockfile
 * change; remove the entry the moment a patched release ships.
 *
 * Usage: node scripts/audit-gate.mjs [path-to-npm-audit-json]
 * With no argument it runs `npm audit --json` itself.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const ALLOWLIST = new Map([
  [
    "GHSA-vfj7-8cjw-p6xm",
    "braces <=3.0.3 stack-exhaustion DoS. No patched braces release exists " +
      "(latest is 3.0.3; micromatch 4.0.8 / tailwindcss / eslint-config-next all pin it). " +
      "Reachable only via build-time tooling (Tailwind content scanning, ESLint) " +
      "over glob patterns from this repo's own config — never over user input, " +
      "and braces is not loaded by the production Next.js runtime. " +
      "Remove when: a braces release >3.0.3 (or a micromatch/tailwind release that drops it) ships.",
  ],
]);

const BLOCKING = new Set(["high", "critical"]);

function loadAuditJson() {
  const file = process.argv[2];
  if (file) return JSON.parse(readFileSync(file, "utf8"));
  try {
    const out = execFileSync("npm", ["audit", "--json"], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    return JSON.parse(out);
  } catch (err) {
    // npm audit exits non-zero when vulnerabilities exist; its JSON is on stdout.
    if (err.stdout) {
      try {
        return JSON.parse(err.stdout.toString());
      } catch {
        /* fall through to failure below */
      }
    }
    console.error("audit-gate: could not obtain `npm audit --json` output; failing closed.");
    if (err.stderr) console.error(err.stderr.toString());
    process.exit(2);
  }
}

function advisoryIds(vuln) {
  const ids = [];
  for (const via of vuln.via ?? []) {
    if (via && typeof via === "object" && typeof via.url === "string") {
      const m = via.url.match(/GHSA-[a-z0-9-]+/i);
      if (m) ids.push(m[0]);
    }
  }
  return ids;
}

const report = loadAuditJson();
const vulns = report.vulnerabilities ?? {};
const blocking = [];
const allowed = [];

for (const [name, vuln] of Object.entries(vulns)) {
  if (!BLOCKING.has(vuln.severity)) continue;
  const ids = advisoryIds(vuln);
  if (ids.length === 0) continue; // wrapper entry; the leaf entry carries the advisory
  const unallowed = ids.filter((id) => !ALLOWLIST.has(id));
  if (unallowed.length > 0) {
    blocking.push(`${name} (${vuln.severity}): ${unallowed.join(", ")}`);
  } else {
    allowed.push(`${name} (${vuln.severity}): ${ids.join(", ")} — allowlisted`);
  }
}

for (const line of allowed) console.log(`audit-gate: ALLOWLISTED ${line}`);
if (blocking.length > 0) {
  console.error("audit-gate: blocking high/critical advisories found:");
  for (const line of blocking) console.error(`  - ${line}`);
  process.exit(1);
}
console.log("audit-gate: no blocking high/critical advisories.");
