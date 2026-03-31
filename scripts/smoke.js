const fs = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { pathToFileURL } = require("node:url");

const ROOT_DIR = path.resolve(__dirname, "..");
const SMOKE_DIR = path.join(ROOT_DIR, ".smoke");
const FRONTEND_SMOKE_SCRIPT = path.join(SMOKE_DIR, "frontend-smoke.mjs");
const CHORDPRO_TEXT = `{title: Smoke Test}
{artist: Test}

[C]Hello [G]world
[F]This is a [C]test
`;
const RAW_TEXT = `Ultimate Guitar

  ${CHORDPRO_TEXT}
---
`;

async function main() {
  const steps = [];

  try {
    await prepareSmokeDir();

    const frontendResult = await runFrontendChecks();
    ensureParserResult(frontendResult.parser);
    steps.push("[OK] Parser");

    ensureCleaningResult(frontendResult.cleaning);
    steps.push("[OK] Cleaning");

    const backendResult = await runBackendChecks();
    ensurePreviewResult(backendResult);
    steps.push("[OK] Preview");

    ensureCacheResult(backendResult);
    steps.push("[OK] Cache");

    ensureExportResult(backendResult);
    steps.push("[OK] Export");

    console.log(steps.join("\n"));
    console.log("\nSMOKE TEST PASSED");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    console.error("\nSMOKE TEST FAILED");
    process.exitCode = 1;
  }
}

async function prepareSmokeDir() {
  await fs.rm(SMOKE_DIR, { recursive: true, force: true });
  await fs.mkdir(SMOKE_DIR, { recursive: true });
}

async function runFrontendChecks() {
  const parserModuleUrl = pathToFileURL(
    path.join(ROOT_DIR, "app/src/services/parser/ChordProParser.ts")
  ).href;
  const cleaningModuleUrl = pathToFileURL(
    path.join(ROOT_DIR, "app/src/services/cleaning/CleaningService.ts")
  ).href;

  const frontendScript = `import { ChordProParser } from ${JSON.stringify(parserModuleUrl)};
import { CleaningService } from ${JSON.stringify(cleaningModuleUrl)};

const chordPro = process.env.SMOKE_CHORDPRO_TEXT ?? "";
const rawText = process.env.SMOKE_RAW_TEXT ?? "";

const parser = new ChordProParser();
const song = parser.parse(chordPro);
const cleaning = new CleaningService();
const cleanedText = cleaning.clean(rawText);

console.log(JSON.stringify({
  parser: {
    title: song.metadata?.title ?? "",
    artist: song.metadata?.artist ?? "",
    sectionCount: Array.isArray(song.sections) ? song.sections.length : 0
  },
  cleaning: {
    cleanedText,
    length: cleanedText.length
  }
}));`;

  await fs.writeFile(FRONTEND_SMOKE_SCRIPT, frontendScript, "utf8");

  const { stdout } = await runCommand(
    process.execPath,
    ["--experimental-strip-types", FRONTEND_SMOKE_SCRIPT],
    {
      env: {
        ...process.env,
        NODE_NO_WARNINGS: "1",
        SMOKE_CHORDPRO_TEXT: CHORDPRO_TEXT,
        SMOKE_RAW_TEXT: RAW_TEXT
      }
    }
  );

  try {
    return JSON.parse(stdout.trim());
  } catch (error) {
    throw new Error(`[FAIL] Parser/Cleaning bridge: invalid JSON output.\n${stdout.trim()}`);
  }
}

async function runBackendChecks() {
  const { stdout } = await runCommand(
    "cargo",
    [
      "run",
      "--quiet",
      "--manifest-path",
      "src-tauri/Cargo.toml",
      "--bin",
      "smoke-runner",
      "--",
      SMOKE_DIR
    ],
    { cwd: ROOT_DIR }
  );

  try {
    return JSON.parse(stdout.trim());
  } catch (error) {
    throw new Error(`[FAIL] Backend smoke bridge: invalid JSON output.\n${stdout.trim()}`);
  }
}

function ensureParserResult(parserResult) {
  if (!parserResult || typeof parserResult !== "object") {
    throw new Error("[FAIL] Parser: parser result is missing.");
  }

  if (!parserResult.title || typeof parserResult.title !== "string") {
    throw new Error("[FAIL] Parser: parsed song title is missing.");
  }

  if (!Number.isInteger(parserResult.sectionCount) || parserResult.sectionCount <= 0) {
    throw new Error("[FAIL] Parser: parsed song sections are missing.");
  }
}

function ensureCleaningResult(cleaningResult) {
  if (!cleaningResult || typeof cleaningResult !== "object") {
    throw new Error("[FAIL] Cleaning: cleaning result is missing.");
  }

  if (!cleaningResult.cleanedText || typeof cleaningResult.cleanedText !== "string") {
    throw new Error("[FAIL] Cleaning: cleaned text is empty.");
  }
}

function ensurePreviewResult(backendResult) {
  if (!backendResult || typeof backendResult !== "object") {
    throw new Error("[FAIL] Preview: backend result is missing.");
  }

  if (!backendResult.previewPath || !backendResult.previewSize) {
    throw new Error("[FAIL] Preview: preview PDF was not generated.");
  }
}

function ensureCacheResult(backendResult) {
  if (!backendResult.secondPreviewPath || !backendResult.secondPreviewSize) {
    throw new Error("[FAIL] Cache: repeated preview did not return a valid PDF.");
  }
}

function ensureExportResult(backendResult) {
  if (!backendResult.exportPdfPath || !backendResult.exportPdfSize) {
    throw new Error("[FAIL] Export: PDF export failed.");
  }

  if (!backendResult.exportChoPath || !backendResult.exportChoSize) {
    throw new Error("[FAIL] Export: CHO export failed.");
  }
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT_DIR,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      ...options
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(new Error(`[FAIL] Command: ${command} ${args.join(" ")}\n${error.message}`));
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      const detail = stderr.trim() || stdout.trim() || `Exit code ${code}`;
      reject(new Error(detail.startsWith("[FAIL]") ? detail : `[FAIL] Command: ${detail}`));
    });
  });
}

void main();
