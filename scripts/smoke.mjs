#!/usr/bin/env node
// Smoke-check harness for Snívať. Node 18+, zero dependencies, stdout only.
// Usage: node scripts/smoke.mjs [baseUrl] [--typecheck]
//   baseUrl defaults to https://snivat.vercel.app
//   --typecheck runs `npx tsc --noEmit` before the HTTP checks.
// Exits 1 if any check fails, 0 otherwise.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const DEFAULT_BASE_URL = "https://snivat.vercel.app";
const REQUEST_TIMEOUT_MS = 15000;
const RETRY_DELAY_MS = 2000;

const ROUTES = [
  { path: "/", expect: 200 },
  { path: "/manifest.webmanifest", expect: 200 },
  { path: "/sw.js", expect: 200 },
  { path: "/offline.html", expect: 200 },
  { path: "/auth/signin", expect: 200 },
];

function parseArgs(argv) {
  let baseUrl = null;
  let typecheck = false;
  for (const arg of argv.slice(2)) {
    if (arg === "--typecheck") typecheck = true;
    else if (arg === "--help" || arg === "-h") {
      console.log("Usage: node scripts/smoke.mjs [baseUrl] [--typecheck]");
      process.exit(0);
    } else if (arg.startsWith("--")) {
      console.error(`Unknown flag: ${arg}`);
      process.exit(2);
    } else baseUrl = arg;
  }
  return { baseUrl: baseUrl || DEFAULT_BASE_URL, typecheck };
}

function runTypecheck() {
  console.log("[1/2] Typecheck: tsc --noEmit");
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const localTsc = path.join(repoRoot, "node_modules", "typescript", "bin", "tsc");
  let res;
  if (existsSync(localTsc)) {
    res = spawnSync(process.execPath, [localTsc, "--noEmit"], {
      stdio: "inherit",
      cwd: repoRoot,
    });
  } else {
    console.log("(local typescript not found, falling back to npx)");
    res = spawnSync("npx", ["tsc", "--noEmit"], {
      stdio: "inherit",
      shell: process.platform === "win32",
      cwd: repoRoot,
    });
  }
  if (res.status !== 0) {
    console.log("Typecheck FAILED");
    return false;
  }
  console.log("Typecheck passed\n");
  return true;
}

async function fetchWithRetry(url) {
  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (res.status >= 500 && attempt === 1) {
        lastError = new Error(`HTTP ${res.status}`);
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }
      return { ok: true, status: res.status };
    } catch (err) {
      lastError = err;
      if (attempt === 1) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }
    }
  }
  const reason =
    lastError && lastError.name === "TimeoutError"
      ? "timeout"
      : String(lastError && lastError.message ? lastError.message : lastError);
  return { ok: false, status: 0, error: reason };
}

function pad(str, width) {
  return str.length >= width ? str : str + " ".repeat(width - str.length);
}

async function main() {
  const { baseUrl, typecheck } = parseArgs(process.argv);

  let base;
  try {
    base = new URL(baseUrl);
  } catch {
    console.error(`Invalid baseUrl: ${baseUrl}`);
    process.exit(2);
  }
  base.pathname = base.pathname.replace(/\/+$/, "");
  const origin = base.toString().replace(/\/+$/, "");

  if (typecheck) {
    if (!runTypecheck()) process.exit(1);
  }

  console.log(`[${typecheck ? 2 : 1}/2] HTTP smoke: ${origin}`);
  const rows = [];
  for (const route of ROUTES) {
    const result = await fetchWithRetry(origin + route.path);
    rows.push({
      route: route.path,
      expected: String(route.expect),
      actual: result.ok ? String(result.status) : "-",
      pass: result.ok && result.status === route.expect,
      note: result.error || "",
    });
  }

  const wRoute = Math.max(...rows.map((r) => r.route.length), "route".length);
  const wExpected = "expected".length;
  const wActual = "actual".length;
  console.log(
    `${pad("route", wRoute)}  ${pad("expected", wExpected)}  ${pad("actual", wActual)}  result`
  );
  let failures = 0;
  for (const r of rows) {
    if (!r.pass) failures++;
    const label = r.pass ? "PASS" : "FAIL";
    const suffix = r.note ? ` (${r.note})` : "";
    console.log(
      `${pad(r.route, wRoute)}  ${pad(r.expected, wExpected)}  ${pad(r.actual, wActual)}  ${label}${suffix}`
    );
  }
  console.log(`${rows.length - failures}/${rows.length} passed`);

  if (failures > 0) {
    console.log("Smoke check FAILED");
    process.exit(1);
  }
  console.log("Smoke check PASSED");
}

main();
