const path = require("node:path");
const { spawn } = require("node:child_process");

const ROOT_DIR = path.resolve(__dirname, "..");

async function main() {
  const steps = [];

  try {
    await runStep("Frontend regressions", steps, () =>
      runCommand(
        process.execPath,
        [
          "--experimental-strip-types",
          "--test",
          "--test-reporter=spec",
          "app/tests/regression.test.ts"
        ],
        {
          cwd: ROOT_DIR,
          env: {
            ...process.env,
            NODE_NO_WARNINGS: "1"
          }
        }
      )
    );

    await runStep("Backend regressions", steps, () =>
      runCommand(
        "cargo",
        ["test", "--manifest-path", "src-tauri/Cargo.toml", "--quiet"],
        { cwd: ROOT_DIR }
      )
    );

    console.log(`\nCompleted ${steps.length} regression suites.`);
    console.log("REGRESSION TESTS PASSED");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    if (steps.length > 0) {
      console.error(`Last completed step: ${steps[steps.length - 1].replace("[OK] ", "")}`);
    }
    console.error("\nREGRESSION TESTS FAILED");
    process.exitCode = 1;
  }
}

async function runStep(label, steps, action) {
  console.log(`Running ${label}...`);
  await action();
  const statusLine = `[OK] ${label}`;
  steps.push(statusLine);
  console.log(statusLine);
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT_DIR,
      env: process.env,
      stdio: "inherit",
      ...options
    });

    child.on("error", (error) => {
      reject(new Error(`[FAIL] Command: ${command} ${args.join(" ")}\n${error.message}`));
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`[FAIL] Command: ${command} ${args.join(" ")} exited with code ${code}.`));
    });
  });
}

void main();
