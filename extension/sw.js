function normalizeArr(arr) {
  return (Array.isArray(arr) ? arr : [])
    .map(s => String(s).trim())
    .filter(Boolean);
}

function pickTab(tabs) {
  const active = tabs.find(t => t.active);
  return active || tabs[0] || null;
}

async function findDkhpTabsInCurrentWindow() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  return tabs.filter(t => typeof t.url === "string" && t.url.startsWith("https://dkhp.uit.edu.vn/"));
}

function scanTab(tabId, classes, sendResponse) {
  chrome.tabs.sendMessage(tabId, { type: "SCAN", classes }, (res) => {
    const err = chrome.runtime.lastError;
    if (err) {
      sendResponse({
        ok: false,
        error: "Không nhận được phản hồi từ tab DKHP. Hãy reload tab DKHP và reload extension.",
        detail: err.message
      });
      return;
    }
    sendResponse(res);
  });
}

// UI Bridge -> SW
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "SCAN_UI") return;

  const classes = normalizeArr(msg.classes);

  (async () => {
    const dkhpTabs = await findDkhpTabsInCurrentWindow();
    const tab = pickTab(dkhpTabs);

    if (!tab?.id) {
      sendResponse({ ok: false, error: "Chưa mở tab DKHP (dkhp.uit.edu.vn) trong cửa sổ hiện tại." });
      return;
    }

    scanTab(tab.id, classes, sendResponse);
  })();

  return true;
});
