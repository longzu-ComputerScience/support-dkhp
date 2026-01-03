(() => {
  "use strict";

  function safeScan(classes) {
  // 1) Chuẩn hoá input
  const wanted = classes
    .map(s => String(s).trim())
    .filter(Boolean);

  // 2) Lấy tất cả row trên trang (đơn giản, hay dùng nhất)
  const rows = Array.from(document.querySelectorAll("tr"));

  // 3) Tạo map code -> info tìm được
  const found = new Map();

  // Regex tìm "đãĐK/tốiđa"
  const ratioRe = /(\d+)\s*\/\s*(\d+)/;

  // Duyệt row, match theo code
  for (const row of rows) {
    const text = (row.innerText || "").replace(/\s+/g, " ").trim();
    if (!text) continue;

    // Với mỗi code cần tìm, nếu row có chứa code đó thì parse
    for (const code of wanted) {
      if (found.has(code)) continue;        // đã bắt được rồi thì bỏ qua
      if (!text.includes(code)) continue;   // row không chứa mã lớp

      const m = text.match(ratioRe);
      if (!m) {
        // Có row chứa code nhưng không thấy "x/y"
        found.set(code, {
          code,
          left: null,
          enrolled: null,
          max: null,
          raw: "FOUND_BUT_NO_x/y"
        });
        continue;
      }

      const enrolled = Number(m[1]);
      const max = Number(m[2]);
      const left = max - enrolled;
      // Ghi nhận kết quả tìm được
      found.set(code, {
        code, 
        left,
        enrolled,
        max,
        raw: `${enrolled}/${max}`
      });
    }
  }

  // 4) Trả kết quả theo đúng thứ tự input
  return wanted.map(code => {
    if (found.has(code)) return found.get(code);

    return {
      code,
      left: null,
      enrolled: null,
      max: null,
      raw: "NOT_FOUND_ON_PAGE"
    };
  });
}


  window.__SUPPORT_DKHP_MAIN__ = {
    scan({ classes }) {
      try {
        const arr = (Array.isArray(classes) ? classes : [])
          .map(s => String(s).trim()).filter(Boolean);

        const items = safeScan(arr);

        // validate tối thiểu để không làm web lỗi
        const clean = (Array.isArray(items) ? items : []).map(x => ({
          code: String(x.code ?? ""),
          left: (x.left ?? null),
          enrolled: (x.enrolled ?? null),
          max: (x.max ?? null),
          raw: String(x.raw ?? "")
        }));

        return { ok: true, ts: Date.now(), items: clean };
      } catch (e) {
        return { ok: false, ts: Date.now(), error: String(e) };
      }
    }
  };
})();
