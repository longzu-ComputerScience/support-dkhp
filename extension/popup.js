const ta = document.getElementById("classes");
const out = document.getElementById("out");

function normalize(text) {
  return text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
}

document.getElementById("scan").addEventListener("click", () => {
  out.textContent = "Đang quét…";
  const classes = normalize(ta.value);

  chrome.runtime.sendMessage({ type: "SCAN_INTERNAL", classes }, (res) => {
    const err = chrome.runtime.lastError;
    if (err) {
      out.textContent = "Lỗi: " + err.message;
      return;
    }
    out.textContent = JSON.stringify(res, null, 2);
  });
});
