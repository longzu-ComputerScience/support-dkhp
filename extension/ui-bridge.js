(() => {
  "use strict";

  const WEB_SRC = "support-dkhp-web";
  const EXT_SRC = "support-dkhp-ext";

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const msg = event.data;
    if (!msg || msg.source !== WEB_SRC) return;

    // Web ping để biết bridge đã inject
    if (msg.type === "PING") {
      window.postMessage({ source: EXT_SRC, type: "PONG" }, "*");
      return;
    }

    // Web yêu cầu quét
    if (msg.type !== "SCAN") return;

    const requestId = msg.requestId || null;
    const classes = Array.isArray(msg.classes) ? msg.classes : [];

    chrome.runtime.sendMessage({ type: "SCAN_UI", classes }, (res) => {
      const err = chrome.runtime.lastError;
      const payload = err ? { ok: false, error: err.message } : res;

      window.postMessage(
        {
          source: EXT_SRC,
          type: "SCAN_RESULT",
          requestId,
          result: payload
        },
        "*"
      );
    });
  });

  console.log("[Support-DKHP] ui-bridge injected");
})();
