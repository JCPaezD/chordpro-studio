const { chromium } = require("@playwright/test");

const DEFAULT_URL = "http://[::1]:5173/";
const APP_URL = process.env.UI_METRICS_URL || DEFAULT_URL;
const MAX_ALIGNMENT_DELTA_PX = 1;
const MAX_HEIGHT_DELTA_PX = 0.5;

async function main() {
  let browser;

  try {
    browser = await launchInstalledBrowser();
    const page = await browser.newPage({ viewport: { width: 920, height: 600 } });

    await page.goto(APP_URL, { waitUntil: "networkidle", timeout: 10000 });
    const metrics = {
      songbook: await measureSongbookLayoutFixture(page),
      convert: await measureConvertLayoutFixture(page)
    };
    const failures = validateMetrics(metrics);

    console.log(JSON.stringify(metrics, null, 2));

    if (failures.length > 0) {
      throw new Error(`UI metrics failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
    }

    console.log("UI METRICS PASSED");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    console.error(`\nMake sure the app dev server is running at ${APP_URL}.`);
    console.error("Example: npm run dev");
    process.exitCode = 1;
  } finally {
    await browser?.close();
  }
}

async function launchInstalledBrowser() {
  const channels = (process.env.UI_METRICS_BROWSER || "chrome,msedge")
    .split(",")
    .map((channel) => channel.trim())
    .filter(Boolean);
  const errors = [];

  for (const channel of channels) {
    try {
      return await chromium.launch({ channel, headless: true });
    } catch (error) {
      errors.push(`${channel}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(`No installed browser channel could be launched.\n${errors.join("\n")}`);
}

async function measureSongbookLayoutFixture(page) {
  return page.evaluate(() => {
    const userScope = findScopeFromElement(".user-view");
    const headerScope = findScopeFromStyle(".editor-subtitle-value.is-surface");
    const paneScope = findScopeFromStyle(".editor-textarea");
    const listScope = findScopeFromStyle(".song-list");

    if (!userScope || !headerScope || !paneScope || !listScope) {
      throw new Error(
        `Missing scoped Vue attributes: ${JSON.stringify({ userScope, headerScope, paneScope, listScope })}`
      );
    }

    document.querySelector("#ui-metrics-fixture")?.remove();

    const root = document.createElement("div");
    root.id = "ui-metrics-fixture";
    root.className = "songbook-layout";
    root.setAttribute(userScope, "");
    Object.assign(root.style, {
      position: "absolute",
      left: "-10000px",
      top: "0",
      width: "880px",
      height: "260px"
    });

    root.innerHTML = `
      <aside class="song-list-panel" ${userScope}>
        <div class="song-list-header" ${userScope}>
          <div class="song-list-title-row" ${userScope}>
            <h3 ${userScope}>SongBook</h3>
            <span class="song-count-badge" ${userScope}>32</span>
          </div>
          <div class="song-list-header-actions" ${userScope}>
            <div class="song-sort-controls" ${userScope}>
              <button class="song-sort-button" ${userScope}>
                <span ${userScope}>Title</span>
                <span class="song-sort-direction visible" ${userScope}>↑</span>
              </button>
              <button class="song-sort-button active" ${userScope}>
                <span ${userScope}>Artist</span>
                <span class="song-sort-direction visible" ${userScope}>↑</span>
              </button>
            </div>
          </div>
        </div>
        <div class="song-list" ${listScope}>
          <button class="song-item selected" ${listScope}>
            <span class="song-item-icon" ${listScope}></span>
            <span class="song-item-copy" ${listScope}>
              <span class="song-item-title" ${listScope}>Tender</span>
              <span class="song-item-artist" ${listScope}>Blur</span>
            </span>
          </button>
        </div>
      </aside>
      <section class="editor-panel card-subsection" ${userScope}>
        <section class="editor-pane" ${paneScope} ${userScope}>
          <div class="editor-header" ${paneScope}>
            <div class="editor-header" ${headerScope}>
              <div class="editor-header-main" ${headerScope}>
                <div class="editor-header-copy" ${headerScope}>
                  <div class="editor-title-line" ${headerScope}>
                    <h3 ${headerScope}>Untitled</h3>
                  </div>
                  <div class="editor-subtitle-line has-subtitle-surface" ${headerScope}>
                    <p class="editor-subtitle-value is-surface" ${headerScope}>Unsaved draft</p>
                    <div class="editor-subtitle-actions" ${headerScope}>
                      <div class="action-toolbar compact songbook-file-toolbar" ${userScope}>
                        <button class="mini-button toolbar-button toolbar-icon-button" ${userScope}></button>
                        <button class="mini-button toolbar-button toolbar-icon-button" ${userScope}></button>
                        <button class="mini-button toolbar-button toolbar-icon-button" ${userScope}></button>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="editor-header-primary-actions" ${headerScope}>
                  <div class="songbook-editor-action-row" ${userScope}>
                    <span class="songbook-inline-dirty-badge" ${userScope}>Draft</span>
                    <div class="action-toolbar compact songbook-editor-toolbar" ${userScope}>
                      <button class="mini-button toolbar-button toolbar-icon-button" ${userScope}></button>
                      <button class="mini-button toolbar-button toolbar-icon-button" ${userScope}></button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="editor-body" ${paneScope}>
            <textarea class="editor-textarea editor-monospace" ${paneScope}></textarea>
          </div>
        </section>
      </section>
    `;

    document.body.appendChild(root);

    const metrics = {
      sortButton: rect(root, ".song-sort-button"),
      fileButton: rect(root, ".songbook-file-toolbar .toolbar-button"),
      editorActionButton: rect(root, ".songbook-editor-toolbar .toolbar-button"),
      countBadge: rect(root, ".song-count-badge"),
      dirtyBadge: rect(root, ".songbook-inline-dirty-badge"),
      songList: rect(root, ".song-list"),
      editorTextarea: rect(root, ".editor-textarea"),
      listTitle: rect(root, ".song-list-title-row h3"),
      editorTitle: rect(root, ".editor-title-line h3")
    };

    metrics.deltas = {
      sortVsFileTop: round(metrics.sortButton.top - metrics.fileButton.top),
      listVsTextareaTop: round(metrics.songList.top - metrics.editorTextarea.top),
      countVsDirtyHeight: round(metrics.countBadge.height - metrics.dirtyBadge.height),
      sortVsFileHeight: round(metrics.sortButton.height - metrics.fileButton.height),
      listTitleVsEditorTitleTop: round(metrics.listTitle.top - metrics.editorTitle.top)
    };

    root.remove();
    return metrics;

    function findScopeFromElement(selector) {
      const element = document.querySelector(selector);
      return Array.from(element?.attributes ?? [])
        .map((attribute) => attribute.name)
        .find((name) => /^data-v-/.test(name));
    }

    function findScopeFromStyle(selector) {
      const escapedSelector = selector.replace(".", "\\.");
      const regex = new RegExp(`${escapedSelector}\\[data-v-([a-f0-9]+)\\]`);
      for (const style of Array.from(document.querySelectorAll("style"))) {
        const match = style.textContent?.match(regex);
        if (match) {
          return `data-v-${match[1]}`;
        }
      }
      return "";
    }

    function rect(scope, selector) {
      const element = scope.querySelector(selector);
      if (!element) {
        throw new Error(`Missing fixture element: ${selector}`);
      }
      const rootRect = scope.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      return {
        top: round(elementRect.top - rootRect.top),
        bottom: round(elementRect.bottom - rootRect.top),
        height: round(elementRect.height),
        width: round(elementRect.width)
      };
    }

    function round(value) {
      return Math.round(value * 100) / 100;
    }
  });
}

async function measureConvertLayoutFixture(page) {
  return page.evaluate(() => {
    const userScope = findScopeFromElement(".user-view");
    const headerScope = findScopeFromStyle(".editor-subtitle-value.is-surface");
    const paneScope = findScopeFromStyle(".editor-textarea");

    if (!userScope || !headerScope || !paneScope) {
      throw new Error(`Missing scoped Vue attributes: ${JSON.stringify({ userScope, headerScope, paneScope })}`);
    }

    document.querySelector("#ui-metrics-convert-fixture")?.remove();

    const root = document.createElement("div");
    root.id = "ui-metrics-convert-fixture";
    root.className = "convert-layout split";
    root.setAttribute(userScope, "");
    Object.assign(root.style, {
      position: "absolute",
      left: "-10000px",
      top: "0",
      width: "880px",
      height: "260px"
    });

    root.innerHTML = `
      <section class="editor-column" ${userScope}>
        <div class="editor-heading convert-heading" ${userScope}>
          <div ${userScope}>
            <h3 ${userScope}>Original text</h3>
          </div>
          <div class="action-toolbar compact editor-toolbar" ${userScope}>
            <button class="mini-button toolbar-button toolbar-icon-button" ${userScope}></button>
            <button class="secondary-button toolbar-button toolbar-icon-button" ${userScope}></button>
          </div>
        </div>
        <textarea class="input-textarea editor-monospace" ${userScope}></textarea>
      </section>
      <section class="editor-column" ${userScope}>
        <section class="editor-pane" ${paneScope}>
          <div class="editor-header" ${paneScope}>
            <div class="editor-header" ${headerScope}>
              <div class="editor-header-main" ${headerScope}>
                <div class="editor-header-copy" ${headerScope}>
                  <div class="editor-title-line" ${headerScope}>
                    <h3 ${headerScope}>ChordPro source</h3>
                  </div>
                  <div class="editor-subtitle-line" ${headerScope}>
                    <p ${headerScope}>Unsaved changes</p>
                  </div>
                </div>
                <div class="editor-header-primary-actions" ${headerScope}>
                  <div class="convert-editor-action-row" ${userScope}>
                    <span class="convert-inline-dirty-badge" ${userScope}>Unsaved</span>
                    <div class="action-toolbar compact editor-toolbar" ${userScope}>
                      <button class="mini-button toolbar-button toolbar-icon-button" ${userScope}></button>
                      <button class="mini-button toolbar-button toolbar-icon-button" ${userScope}></button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="editor-body" ${paneScope}>
            <textarea class="editor-textarea editor-monospace" ${paneScope}></textarea>
          </div>
        </section>
      </section>
    `;

    document.body.appendChild(root);

    const metrics = {
      originalHeading: rect(root, ".convert-heading"),
      sourceHeader: rect(root, ".editor-pane > .editor-header"),
      originalActionButton: rect(root, ".convert-heading .editor-toolbar .toolbar-button"),
      sourceActionButton: rect(root, ".editor-header-primary-actions .editor-toolbar .toolbar-button"),
      sourceDirtyBadge: rect(root, ".convert-inline-dirty-badge"),
      originalTextarea: rect(root, ".input-textarea"),
      sourceTextarea: rect(root, ".editor-textarea"),
      originalTitle: rect(root, ".convert-heading h3"),
      sourceTitle: rect(root, ".editor-title-line h3")
    };

    metrics.deltas = {
      originalVsSourceTextareaTop: round(metrics.originalTextarea.top - metrics.sourceTextarea.top),
      originalVsSourceActionHeight: round(metrics.originalActionButton.height - metrics.sourceActionButton.height),
      originalVsSourceActionTop: round(metrics.originalActionButton.top - metrics.sourceActionButton.top),
      sourceDirtyVsSongbookBadgeHeight: round(metrics.sourceDirtyBadge.height - 24.8),
      originalVsSourceTitleTop: round(metrics.originalTitle.top - metrics.sourceTitle.top)
    };

    root.remove();
    return metrics;

    function findScopeFromElement(selector) {
      const element = document.querySelector(selector);
      return Array.from(element?.attributes ?? [])
        .map((attribute) => attribute.name)
        .find((name) => /^data-v-/.test(name));
    }

    function findScopeFromStyle(selector) {
      const escapedSelector = selector.replace(".", "\\.");
      const regex = new RegExp(`${escapedSelector}\\[data-v-([a-f0-9]+)\\]`);
      for (const style of Array.from(document.querySelectorAll("style"))) {
        const match = style.textContent?.match(regex);
        if (match) {
          return `data-v-${match[1]}`;
        }
      }
      return "";
    }

    function rect(scope, selector) {
      const element = scope.querySelector(selector);
      if (!element) {
        throw new Error(`Missing fixture element: ${selector}`);
      }
      const rootRect = scope.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      return {
        top: round(elementRect.top - rootRect.top),
        bottom: round(elementRect.bottom - rootRect.top),
        height: round(elementRect.height),
        width: round(elementRect.width)
      };
    }

    function round(value) {
      return Math.round(value * 100) / 100;
    }
  });
}

function validateMetrics(metrics) {
  const failures = [];
  const songbook = metrics.songbook;
  const convert = metrics.convert;

  checkDelta(failures, "Songbook filters and file actions top alignment", songbook.deltas.sortVsFileTop, MAX_ALIGNMENT_DELTA_PX);
  checkDelta(failures, "Songbook list and editor textarea top alignment", songbook.deltas.listVsTextareaTop, MAX_ALIGNMENT_DELTA_PX);
  checkDelta(failures, "Songbook count and dirty badge height", songbook.deltas.countVsDirtyHeight, MAX_HEIGHT_DELTA_PX);
  checkDelta(failures, "Songbook filters and file actions height", songbook.deltas.sortVsFileHeight, MAX_HEIGHT_DELTA_PX);

  if (songbook.editorActionButton.height < 30 || songbook.editorActionButton.height > 36) {
    failures.push(`Songbook editor action buttons should stay readable, got ${songbook.editorActionButton.height}px`);
  }

  checkDelta(failures, "Convert editor textareas top alignment", convert.deltas.originalVsSourceTextareaTop, MAX_ALIGNMENT_DELTA_PX);
  checkDelta(failures, "Convert editor action buttons height", convert.deltas.originalVsSourceActionHeight, MAX_HEIGHT_DELTA_PX);
  checkDelta(failures, "Convert editor action buttons top alignment", convert.deltas.originalVsSourceActionTop, MAX_ALIGNMENT_DELTA_PX);

  if (convert.originalActionButton.height < 30 || convert.originalActionButton.height > 36) {
    failures.push(`Convert editor action buttons should stay readable, got ${convert.originalActionButton.height}px`);
  }

  if (convert.sourceDirtyBadge.height < 24 || convert.sourceDirtyBadge.height > 26) {
    failures.push(`Convert dirty badge should match compact status controls, got ${convert.sourceDirtyBadge.height}px`);
  }

  return failures;
}

function checkDelta(failures, label, delta, maxAbsDelta) {
  if (Math.abs(delta) > maxAbsDelta) {
    failures.push(`${label}: ${delta}px exceeds ${maxAbsDelta}px`);
  }
}

main();
