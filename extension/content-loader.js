(() => {
  "use strict";

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type !== "SCAN") return;

    try {
      const api = window.__SUPPORT_DKHP_MAIN__;
      if (!api?.scan) {
        sendResponse({ ok: false, error: "main.js chưa load hoặc thiếu scan()." });
        return;
      }
      sendResponse(api.scan({ classes: msg.classes || [] }));
    } catch (e) {
      sendResponse({ ok: false, error: String(e), ts: Date.now() });
    }
  });
})();
