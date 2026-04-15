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
const TITLELESS_CHORDPRO_TEXT = `{artist: Smoke Artist}
{comment: Intro}
[C] [G]
{start_of_tab}
E|--0--|
{end_of_tab}

[F]Late smoke line
`;
const RAW_TEXT = `Ultimate Guitar

  ${CHORDPRO_TEXT}
---
`;

async function main() {
  const steps = [];

  try {
    await prepareSmokeDir();

    await runStep("Parser", steps, async () => {
      const parserResult = await runParserCheck();
      ensureParserResult(parserResult);
    });

    await runStep("Cleaning", steps, async () => {
      const cleaningResult = await runCleaningCheck();
      ensureCleaningResult(cleaningResult);
    });

    await runStep("Display title derivation", steps, async () => {
      const displayTitleResult = await runDisplayTitleCheck();
      ensureDisplayTitleResult(displayTitleResult);
    });

    const backendResult = await runStep("Preview / export backend bridge", steps, async () => {
      return runBackendChecks();
    });

    await runStep("Preview", steps, async () => {
      ensurePreviewResult(backendResult);
    });

    await runStep("Cache", steps, async () => {
      ensureCacheResult(backendResult);
    });

    await runStep("Render style cache variant", steps, async () => {
      ensureRenderStyleVariantResult(backendResult);
    });

    await runStep("Export", steps, async () => {
      ensureExportResult(backendResult);
    });

    console.log(`\nCompleted ${steps.length} smoke checks.`);
    console.log("SMOKE TEST PASSED");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    if (steps.length > 0) {
      console.error(`Last completed step: ${steps[steps.length - 1].replace("[OK] ", "")}`);
    }
    console.error("\nSMOKE TEST FAILED");
    process.exitCode = 1;
  }
}

async function prepareSmokeDir() {
  await fs.rm(SMOKE_DIR, { recursive: true, force: true });
  await fs.mkdir(SMOKE_DIR, { recursive: true });
}

async function runParserCheck() {
  const parserModuleUrl = pathToFileURL(
    path.join(ROOT_DIR, "app/src/services/parser/ChordProParser.ts")
  ).href;

  return runFrontendCheck(
    `import { ChordProParser } from ${JSON.stringify(parserModuleUrl)};

const chordPro = process.env.SMOKE_CHORDPRO_TEXT ?? "";

const parser = new ChordProParser();
const song = parser.parse(chordPro);

console.log(JSON.stringify({
  title: song.metadata?.title ?? "",
  artist: song.metadata?.artist ?? "",
  sectionCount: Array.isArray(song.sections) ? song.sections.length : 0
}));`,
    {
      SMOKE_CHORDPRO_TEXT: CHORDPRO_TEXT
    },
    "Parser bridge"
  );
}

async function runCleaningCheck() {
  const cleaningModuleUrl = pathToFileURL(
    path.join(ROOT_DIR, "app/src/services/cleaning/CleaningService.ts")
  ).href;

  return runFrontendCheck(
    `import { CleaningService } from ${JSON.stringify(cleaningModuleUrl)};

const rawText = process.env.SMOKE_RAW_TEXT ?? "";

const cleaning = new CleaningService();
const cleanedText = cleaning.clean(rawText);

console.log(JSON.stringify({
  cleanedText,
  length: cleanedText.length
}));`,
    {
      SMOKE_RAW_TEXT: RAW_TEXT
    },
    "Cleaning bridge"
  );
}

async function runDisplayTitleCheck() {
  const parserModuleUrl = pathToFileURL(
    path.join(ROOT_DIR, "app/src/services/parser/ChordProParser.ts")
  ).href;
  const deriveDisplayTitleModuleUrl = pathToFileURL(
    path.join(ROOT_DIR, "app/src/domain/song/deriveDisplayTitle.ts")
  ).href;

  return runFrontendCheck(
    `import { ChordProParser } from ${JSON.stringify(parserModuleUrl)};
import { buildSongDisplayTitle, deriveDisplayTitle } from ${JSON.stringify(deriveDisplayTitleModuleUrl)};

const chordPro = process.env.SMOKE_TITLELESS_CHORDPRO_TEXT ?? "";
const fileName = process.env.SMOKE_TITLELESS_FILE_NAME ?? "";

const parser = new ChordProParser();
const song = parser.parse(chordPro);
const metadata = song.metadata ?? {};

console.log(JSON.stringify({
  title: deriveDisplayTitle(chordPro, metadata, fileName),
  displayTitle: buildSongDisplayTitle(chordPro, metadata, fileName)
}));`,
    {
      SMOKE_TITLELESS_CHORDPRO_TEXT: TITLELESS_CHORDPRO_TEXT,
      SMOKE_TITLELESS_FILE_NAME: "fallback-demo.cho"
    },
    "Display title bridge"
  );
}

async function runFrontendCheck(frontendScript, env, label) {
  await fs.writeFile(FRONTEND_SMOKE_SCRIPT, frontendScript, "utf8");

  const { stdout } = await runCommand(
    process.execPath,
    ["--experimental-strip-types", FRONTEND_SMOKE_SCRIPT],
    {
      env: {
        ...process.env,
        NODE_NO_WARNINGS: "1",
        ...env
      }
    }
  );

  try {
    return JSON.parse(stdout.trim());
  } catch (error) {
    throw new Error(`[FAIL] ${label}: invalid JSON output.\n${stdout.trim()}`);
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

function ensureDisplayTitleResult(displayTitleResult) {
  if (!displayTitleResult || typeof displayTitleResult !== "object") {
    throw new Error("[FAIL] Display title derivation: result is missing.");
  }

  if (displayTitleResult.title !== "Late smoke line") {
    throw new Error(
      `[FAIL] Display title derivation: expected "Late smoke line", received ${JSON.stringify(displayTitleResult.title)}.`
    );
  }

  if (displayTitleResult.displayTitle !== "Late smoke line - Smoke Artist") {
    throw new Error(
      `[FAIL] Display title derivation: expected display title "Late smoke line - Smoke Artist", received ${JSON.stringify(displayTitleResult.displayTitle)}.`
    );
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

function ensureRenderStyleVariantResult(backendResult) {
  if (!backendResult.variantPreviewPath || !backendResult.variantPreviewSize) {
    throw new Error("[FAIL] Render style cache variant: alternate preview did not return a valid PDF.");
  }

  if (backendResult.variantPreviewPath === backendResult.secondPreviewPath) {
    throw new Error("[FAIL] Render style cache variant: alternate render style reused the same cache path.");
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

async function runStep(label, steps, action) {
  console.log(`Running ${label}...`);
  const result = await action();
  const statusLine = `[OK] ${label}`;
  steps.push(statusLine);
  console.log(statusLine);
  return result;
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
