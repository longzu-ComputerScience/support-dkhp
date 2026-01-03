// ===== Storage keys
const KEY_CODES = "support_dkhp_codes_v2";
const KEY_THEME = "support_dkhp_theme_v2";
const KEY_MODE = "support_dkhp_mode_v2";         // once | loop
const KEY_INTERVAL = "support_dkhp_interval_v2"; // ms
const KEY_SORT = "support_dkhp_sort_v2";
const KEY_FILTER = "support_dkhp_filter_v2";
const KEY_Q = "support_dkhp_q_v2";

const WEB_SRC = "support-dkhp-web";
const EXT_SRC = "support-dkhp-ext";

// ===== Elements
const elCodes = document.getElementById("codes");
const btnScan = document.getElementById("btnScan");
const btnSave = document.getElementById("btnSave");
const btnClear = document.getElementById("btnClear");

const btnTheme = document.getElementById("btnTheme");
const btnCsv = document.getElementById("btnCsv");
const btnCopy = document.getElementById("btnCopy");
const btnPing = document.getElementById("btnPing");
const btnClearLog = document.getElementById("btnClearLog");

const elModeOnce = document.getElementById("modeOnce");
const elModeLoop = document.getElementById("modeLoop");
const elInterval = document.getElementById("interval");
const elSort = document.getElementById("sort");
const elFilter = document.getElementById("filter");
const elQ = document.getElementById("q");

const elChipConn = document.getElementById("chipConn");
const elChipState = document.getElementById("chipState");
const elChipTime = document.getElementById("chipTime");

const elPillCount = document.getElementById("pillCount");
const elPillRows = document.getElementById("pillRows");
const elTbody = document.getElementById("tbody");
const elRaw = document.getElementById("raw");
const elLog = document.getElementById("log");

const stWatch = document.getElementById("stWatch");
const stFound = document.getElementById("stFound");
const stHas = document.getElementById("stHas");
const stBest = document.getElementById("stBest");

// ===== State
let lastResult = null;
let running = false;
let runToken = 0;
let loopTimer = null;

// ===== Utils
function nowStr() {
  try { return new Date().toLocaleTimeString(); } catch { return ""; }
}
function fmtTime(ts) {
  try { return new Date(ts).toLocaleString(); } catch { return "—"; }
}
function escapeHtml(s) {
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
function normalizeCodes(text) {
  return text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
}
function logLine(s) {
  const line = `[${nowStr()}] ${s}`;
  const div = document.createElement("div");
  div.textContent = line;
  elLog.prepend(div);
  // giới hạn log
  while (elLog.childElementCount > 80) elLog.removeChild(elLog.lastChild);
}

function setChip(el, text, tone = "neutral") {
  el.textContent = text;
  el.style.color =
    tone === "ok" ? "#b8ffd7" :
    tone === "bad" ? "#ffb2b2" :
    tone === "warn" ? "#ffe7a6" :
    "";
}

function setConn(ok) {
  setChip(elChipConn, ok ? "Bridge: OK" : "Bridge: OFF", ok ? "ok" : "bad");
}

function setState(text, tone = "neutral") {
  setChip(elChipState, text, tone);
}

function setButtonMode(isRunning) {
  if (isRunning) {
    btnScan.classList.remove("primary");
    btnScan.classList.add("stop");
    btnScan.innerHTML = `<span class="btnIcon">🛑</span><span>Dừng</span>`;
  } else {
    btnScan.classList.remove("stop");
    btnScan.classList.add("primary");
    btnScan.innerHTML = `<span class="btnIcon">⚡</span><span>Quét</span>`;
  }
}

function setCounts() {
  const n = normalizeCodes(elCodes.value).length;
  elPillCount.textContent = `${n} lines`;
}

function modeGet() { return localStorage.getItem(KEY_MODE) || "once"; }
function modeSet(v) { localStorage.setItem(KEY_MODE, v); updateModeUI(); }
function updateModeUI() {
  const m = modeGet();
  elModeOnce.classList.toggle("active", m === "once");
  elModeLoop.classList.toggle("active", m === "loop");
}

function getIntervalMs() { return Number(localStorage.getItem(KEY_INTERVAL) || elInterval.value || 2000); }
function setIntervalMs(ms) { localStorage.setItem(KEY_INTERVAL, String(ms)); elInterval.value = String(ms); }

// ===== Bridge
function pingBridge(timeoutMs = 700) {
  return new Promise((resolve) => {
    let done = false;

    function onMsg(e) {
      const msg = e.data;
      if (msg?.source === EXT_SRC && msg.type === "PONG") {
        done = true;
        window.removeEventListener("message", onMsg);
        resolve(true);
      }
    }

    window.addEventListener("message", onMsg);
    window.postMessage({ source: WEB_SRC, type: "PING" }, "*");

    setTimeout(() => {
      if (done) return;
      window.removeEventListener("message", onMsg);
      resolve(false);
    }, timeoutMs);
  });
}

function scanViaBridge(classes, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const requestId = crypto.randomUUID();
    let finished = false;

    function onMsg(e) {
      const msg = e.data;
      if (!msg || msg.source !== EXT_SRC) return;
      if (msg.type !== "SCAN_RESULT") return;
      if (msg.requestId !== requestId) return;

      finished = true;
      window.removeEventListener("message", onMsg);
      resolve(msg.result);
    }

    window.addEventListener("message", onMsg);

    window.postMessage(
      { source: WEB_SRC, type: "SCAN", requestId, classes },
      "*"
    );

    setTimeout(() => {
      if (finished) return;
      window.removeEventListener("message", onMsg);
      resolve({ ok: false, error: "Timeout: extension không phản hồi. Hãy reload extension + reload web UI + mở tab DKHP." });
    }, timeoutMs);
  });
}

// ===== Render helpers
function badgeForLeft(left) {
  if (left == null || Number.isNaN(left)) return `<span class="badge unk">unknown</span>`;
  const n = Number(left);
  if (n <= 0) return `<span class="badge bad">full</span>`;
  if (n <= 3) return `<span class="badge warn">low</span>`;
  return `<span class="badge ok">ok</span>`;
}

function asNumOrNull(x) {
  if (x == null) return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function normalizeItem(it) {
  // cho phép main.js trả chỉ {code,left} vẫn render được
  return {
    code: String(it?.code ?? ""),
    left: asNumOrNull(it?.left),
    enrolled: asNumOrNull(it?.enrolled),
    max: asNumOrNull(it?.max),
    raw: (it?.raw == null ? "" : String(it.raw))
  };
}

function applySearchFilterSort(items, inputOrder) {
  const q = (elQ.value || "").trim().toLowerCase();
  const filter = elFilter.value;
  const sort = elSort.value;

  let out = items;

  // Search
  if (q) {
    out = out.filter(x =>
      x.code.toLowerCase().includes(q) ||
      String(x.raw || "").toLowerCase().includes(q)
    );
  }

  // Filter
  out = out.filter(x => {
    const left = x.left;
    if (filter === "all") return true;
    if (filter === "unknown") return left == null;
    if (left == null) return false;
    if (filter === "has") return left > 0;
    if (filter === "full") return left === 0;
    return true;
  });

  // Sort
  const withIndex = out.map(x => ({ x, idx: inputOrder.get(x.code) ?? 1e9 }));
  if (sort === "input") {
    withIndex.sort((a,b) => a.idx - b.idx);
  } else if (sort === "left_desc") {
    withIndex.sort((a,b) => (b.x.left ?? -1e9) - (a.x.left ?? -1e9));
  } else if (sort === "left_asc") {
    withIndex.sort((a,b) => (a.x.left ?? 1e9) - (b.x.left ?? 1e9));
  } else if (sort === "code_asc") {
    withIndex.sort((a,b) => a.x.code.localeCompare(b.x.code));
  }
  return withIndex.map(o => o.x);
}

function render(result) {
  lastResult = result || null;
  elRaw.textContent = result ? JSON.stringify(result, null, 2) : "—";

  if (!result) {
    elChipTime.textContent = "—";
    elPillRows.textContent = "0 rows";
    elTbody.innerHTML = `<tr><td colspan="5" class="muted">Chưa có dữ liệu.</td></tr>`;
    stWatch.textContent = "0";
    stFound.textContent = "0";
    stHas.textContent = "0";
    stBest.textContent = "—";
    return;
  }

  elChipTime.textContent = fmtTime(result.ts || Date.now());

  if (result.ok === false) {
    setState("Error", "bad");
    logLine(`❌ Error: ${result.error || "Unknown"}`);
    elTbody.innerHTML = `<tr><td colspan="5" class="muted">${escapeHtml(result.error || "Unknown error")}</td></tr>`;
    return;
  }

  // Input order map (để sort theo thứ tự nhập)
  const inputList = normalizeCodes(elCodes.value);
  const inputOrder = new Map();
  inputList.forEach((c, i) => inputOrder.set(c, i));

  const itemsRaw = Array.isArray(result.items) ? result.items : [];
  const items = itemsRaw.map(normalizeItem).filter(x => x.code);

  const shown = applySearchFilterSort(items, inputOrder);

  elPillRows.textContent = `${shown.length} rows`;

  // Stats
  stWatch.textContent = String(inputList.length);
  stFound.textContent = String(items.length);
  const has = items.filter(x => x.left != null && x.left > 0).length;
  stHas.textContent = String(has);
  const best = items
    .filter(x => x.left != null)
    .sort((a,b) => (b.left ?? -1) - (a.left ?? -1))[0];
  stBest.textContent = best ? `${best.code} (${best.left})` : "—";

  if (!shown.length) {
    setState("OK", "ok");
    elTbody.innerHTML = `<tr><td colspan="5" class="muted">Không có dòng phù hợp (filter/search).</td></tr>`;
    return;
  }

  setState("OK", "ok");

  elTbody.innerHTML = shown.map(it => {
    const code = escapeHtml(it.code);
    const left = (it.left == null ? "—" : String(it.left));
    const enrolled = (it.enrolled == null ? "—" : String(it.enrolled));
    const max = (it.max == null ? "—" : String(it.max));
    const raw = escapeHtml(it.raw || "—");

    return `
      <tr>
        <td class="mono">${code}</td>
        <td>${badgeForLeft(it.left)} <span class="mono">${escapeHtml(left)}</span></td>
        <td class="mono">${escapeHtml(enrolled)}</td>
        <td class="mono">${escapeHtml(max)}</td>
        <td class="mono">${raw}</td>
      </tr>
    `;
  }).join("");
}

// ===== Scan control
function stopLoop() {
  running = false;
  runToken++;
  if (loopTimer) clearInterval(loopTimer);
  loopTimer = null;
  setButtonMode(false);
  setState("Stopped");
  logLine("⏹️ Stopped");
}

async function doOneScan(myToken) {
  if (!running || myToken !== runToken) return;

  const classes = normalizeCodes(elCodes.value);
  if (!classes.length) {
    setState("Nhập mã lớp trước", "warn");
    stopLoop();
    return;
  }

  const res = await scanViaBridge(classes);

  // nếu user bấm dừng trong lúc chờ response -> bỏ qua
  if (!running || myToken !== runToken) return;

  render(res);

  if (res?.ok === false) setState("Error", "bad");
  else setState("OK", "ok");
}

async function startScan() {
  const ok = await pingBridge();
  setConn(ok);

  if (!ok) {
    setState("Bridge OFF", "bad");
    logLine("⚠️ Bridge OFF (reload extension + reload web UI)");
    return;
  }

  const classes = normalizeCodes(elCodes.value);
  if (!classes.length) {
    setState("Nhập mã lớp trước", "warn");
    return;
  }

  running = true;
  const myToken = ++runToken;

  setButtonMode(true);
  setState("Scanning…");
  logLine(`🔎 Scan (${modeGet()}) — ${classes.length} codes`);

  await doOneScan(myToken);

  if (!running || myToken !== runToken) return;

  if (modeGet() === "loop") {
    const ms = getIntervalMs();
    loopTimer = setInterval(() => doOneScan(myToken), ms);
  } else {
    // once
    running = false;
    setButtonMode(false);
  }
}

// ===== Theme
function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(KEY_THEME, theme);
}
btnTheme.addEventListener("click", () => {
  const cur = document.documentElement.getAttribute("data-theme") || "dark";
  setTheme(cur === "dark" ? "light" : "dark");
});

// ===== Buttons
btnScan.addEventListener("click", async () => {
  if (running) stopLoop();
  else await startScan();
});

btnSave.addEventListener("click", () => {
  const arr = normalizeCodes(elCodes.value);
  localStorage.setItem(KEY_CODES, JSON.stringify(arr));
  setState(`Saved (${arr.length})`, "ok");
  logLine(`💾 Saved ${arr.length} codes`);
});

btnClear.addEventListener("click", () => {
  elCodes.value = "";
  localStorage.removeItem(KEY_CODES);
  setCounts();
  stopLoop();
  render(null);
  logLine("🧹 Cleared codes");
});

btnPing.addEventListener("click", async () => {
  const ok = await pingBridge();
  setConn(ok);
  setState(ok ? "Bridge OK" : "Bridge OFF", ok ? "ok" : "bad");
  logLine(ok ? "🛰️ PONG (bridge ok)" : "🛰️ No PONG (bridge off)");
});

btnClearLog.addEventListener("click", () => {
  elLog.innerHTML = "";
  logLine("Log cleared");
});

btnCopy.addEventListener("click", async () => {
  if (!lastResult?.ok) return;
  const items = Array.isArray(lastResult.items) ? lastResult.items.map(normalizeItem) : [];
  const lines = items.map(x => `${x.code}\tleft=${x.left ?? "?"}\tenrolled=${x.enrolled ?? "?"}\tmax=${x.max ?? "?"}\traw=${x.raw ?? ""}`);
  try {
    await navigator.clipboard.writeText(lines.join("\n"));
    setState("Copied", "ok");
    logLine("📋 Copied results");
  } catch {
    setState("Copy failed", "bad");
    logLine("❌ Copy failed");
  }
});

btnCsv.addEventListener("click", () => {
  if (!lastResult?.ok) return;
  const items = Array.isArray(lastResult.items) ? lastResult.items.map(normalizeItem) : [];
  const header = "code,left,enrolled,max,raw";
  const rows = items.map(x => {
    const raw = String(x.raw ?? "").replaceAll('"','""');
    return `"${x.code}",${x.left ?? ""},${x.enrolled ?? ""},${x.max ?? ""},"${raw}"`;
  });
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "support-dkhp-results.csv";
  a.click();
  URL.revokeObjectURL(url);
  logLine("📄 Exported CSV");
});

// ===== Controls
elCodes.addEventListener("input", () => setCounts());

elSort.addEventListener("change", () => {
  localStorage.setItem(KEY_SORT, elSort.value);
  if (lastResult?.ok) render(lastResult);
});
elFilter.addEventListener("change", () => {
  localStorage.setItem(KEY_FILTER, elFilter.value);
  if (lastResult?.ok) render(lastResult);
});
elQ.addEventListener("input", () => {
  localStorage.setItem(KEY_Q, elQ.value);
  if (lastResult?.ok) render(lastResult);
});

elModeOnce.addEventListener("click", () => {
  modeSet("once");
  if (running) { stopLoop(); startScan(); }
});
elModeLoop.addEventListener("click", () => {
  modeSet("loop");
  if (running) { stopLoop(); startScan(); }
});

elInterval.addEventListener("change", () => {
  setIntervalMs(Number(elInterval.value));
  if (running && modeGet() === "loop") {
    // restart timer with new interval
    const t = runToken;
    if (loopTimer) clearInterval(loopTimer);
    loopTimer = setInterval(() => doOneScan(t), getIntervalMs());
    logLine(`⏱️ Interval = ${getIntervalMs()}ms`);
  }
});

// ===== Init
(function init() {
  // theme
  setTheme(localStorage.getItem(KEY_THEME) || "dark");

  // codes
  try {
    const raw = localStorage.getItem(KEY_CODES);
    const arr = raw ? JSON.parse(raw) : [];
    if (Array.isArray(arr) && arr.length) elCodes.value = arr.join("\n");
  } catch {}
  setCounts();

  // mode/interval
  modeSet(localStorage.getItem(KEY_MODE) || "once");
  const ms = Number(localStorage.getItem(KEY_INTERVAL) || 2000);
  setIntervalMs(ms);

  // sort/filter/q
  elSort.value = localStorage.getItem(KEY_SORT) || "input";
  elFilter.value = localStorage.getItem(KEY_FILTER) || "all";
  elQ.value = localStorage.getItem(KEY_Q) || "";

  // initial
  render(null);
  setState("Idle");
  logLine("Ready");

  // periodic ping to keep chip accurate
  setInterval(async () => {
    const ok = await pingBridge(450);
    setConn(ok);
  }, 3500);

  // first ping
  pingBridge().then(setConn);
})();
