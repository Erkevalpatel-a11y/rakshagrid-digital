/* ============================================================
   RAKSHAGRID DIGITAL — dashboard.js
   Canvas-only charts (no external analytics). Reads local state.
   ============================================================ */
(function () {
  "use strict";

  var RG = window.RG, store = RG.store;
  function $(s, r) { return (r || document).querySelector(s); }

  function prep(canvas) {
    if (!canvas) return null;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = canvas.clientWidth || canvas.width;
    var h = canvas.clientHeight || canvas.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx: ctx, w: w, h: h };
  }

  var CATS = [
    { key: "identity", label: "Identity", color: "#3d8bff" },
    { key: "privacy", label: "Privacy", color: "#35d6ef" },
    { key: "password", label: "Password", color: "#24c07a" },
    { key: "browser", label: "Browser", color: "#ff9f45" },
    { key: "habits", label: "Habits", color: "#a98bff" }
  ];

  function drawCats(result) {
    var c = prep($("#chartCats"));
    if (!c) return;
    var ctx = c.ctx, w = c.w, h = c.h;
    var padL = 78, padR = 16, padT = 12, padB = 12;
    var rowH = (h - padT - padB) / CATS.length;
    var maxW = w - padL - padR;
    ctx.font = "12px Inter, system-ui, sans-serif";
    CATS.forEach(function (cat, i) {
      var y = padT + i * rowH + rowH / 2;
      var val = result ? result.cats[cat.key] : 0;
      /* label */
      ctx.fillStyle = "#97a5c6";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(cat.label, padL - 14, y);
      /* track */
      var barH = Math.min(14, rowH * 0.5);
      roundRect(ctx, padL, y - barH / 2, maxW, barH, barH / 2);
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fill();
      /* fill */
      var bw = maxW * (val / 100);
      if (bw > 0) {
        var grad = ctx.createLinearGradient(padL, 0, padL + maxW, 0);
        grad.addColorStop(0, cat.color);
        grad.addColorStop(1, "rgba(53,214,239,0.9)");
        roundRect(ctx, padL, y - barH / 2, bw, barH, barH / 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }
      /* value */
      ctx.fillStyle = "#e9eefb";
      ctx.textAlign = "left";
      ctx.fillText(result ? val : "—", padL + maxW + 6, y);
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, h / 2, w / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawRisk() {
    var c = prep($("#chartRisk"));
    if (!c) return;
    var ctx = c.ctx, w = c.w, h = c.h;
    var counts = store.get("riskCounts", { low: 0, medium: 0, high: 0, unknown: 0 });
    var parts = [
      { k: "low", label: "Low risk", color: "#24c07a", v: counts.low || 0 },
      { k: "medium", label: "Medium risk", color: "#ff9f45", v: counts.medium || 0 },
      { k: "high", label: "High risk", color: "#ff5d6c", v: counts.high || 0 },
      { k: "unknown", label: "Unassessed", color: "#6d7c9e", v: counts.unknown || 0 }
    ];
    var total = parts.reduce(function (a, b) { return a + b.v; }, 0);
    var cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 8, r = R * 0.62;
    if (total === 0) {
      ctx.beginPath(); ctx.arc(cx, cy, (R + r) / 2, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.lineWidth = R - r; ctx.stroke();
      ctx.fillStyle = "#6d7c9e"; ctx.font = "13px Inter, system-ui, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("No checks yet", cx, cy);
      updateLegend(parts);
      return;
    }
    var start = -Math.PI / 2;
    parts.forEach(function (p) {
      if (!p.v) return;
      var ang = (p.v / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, (R + r) / 2, start, start + ang);
      ctx.strokeStyle = p.color; ctx.lineWidth = R - r; ctx.lineCap = "butt"; ctx.stroke();
      start += ang;
    });
    ctx.fillStyle = "#e9eefb";
    ctx.font = "700 22px 'Space Grotesk', system-ui, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(String(total), cx, cy - 6);
    ctx.fillStyle = "#6d7c9e"; ctx.font = "11px Inter, system-ui, sans-serif";
    ctx.fillText("checks", cx, cy + 14);
    updateLegend(parts);
  }
  function updateLegend(parts) {
    var host = $("#riskLegend");
    if (!host) return;
    host.textContent = "";
    parts.forEach(function (p) {
      var row = document.createElement("div");
      row.className = "legend__row";
      var sw = document.createElement("span"); sw.className = "legend__sw"; sw.style.background = p.color;
      var lb = document.createElement("span"); lb.textContent = p.label;
      var vv = document.createElement("span"); vv.className = "legend__v"; vv.textContent = p.v;
      row.appendChild(sw); row.appendChild(lb); row.appendChild(vv);
      host.appendChild(row);
    });
  }

  function drawHistory() {
    var c = prep($("#chartHistory"));
    if (!c) return;
    var ctx = c.ctx, w = c.w, h = c.h;
    var hist = store.get("scoreHistory", []);
    var padL = 34, padR = 12, padT = 14, padB = 22;
    var gw = w - padL - padR, gh = h - padT - padB;
    ctx.strokeStyle = "rgba(255,255,255,0.06)"; ctx.lineWidth = 1;
    [0, 25, 50, 75, 100].forEach(function (p) {
      var y = padT + gh * (1 - p / 100);
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + gw, y); ctx.stroke();
      ctx.fillStyle = "#6d7c9e"; ctx.font = "10px Inter, system-ui, sans-serif";
      ctx.textAlign = "right"; ctx.textBaseline = "middle";
      ctx.fillText(p, padL - 6, y);
    });
    if (hist.length < 2) {
      ctx.fillStyle = "#6d7c9e"; ctx.font = "12px Inter, system-ui, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(hist.length ? "Run the score again to see progress" : "No score history yet", padL + gw / 2, padT + gh / 2);
      return;
    }
    var pts = hist.map(function (d, i) {
      var x = padL + (hist.length === 1 ? gw / 2 : gw * (i / (hist.length - 1)));
      var y = padT + gh * (1 - d.s / 100);
      return { x: x, y: y, s: d.s };
    });
    /* area */
    var grad = ctx.createLinearGradient(0, padT, 0, padT + gh);
    grad.addColorStop(0, "rgba(53,214,239,0.30)");
    grad.addColorStop(1, "rgba(53,214,239,0.02)");
    ctx.beginPath();
    ctx.moveTo(pts[0].x, padT + gh);
    pts.forEach(function (p) { ctx.lineTo(p.x, p.y); });
    ctx.lineTo(pts[pts.length - 1].x, padT + gh);
    ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
    /* line */
    ctx.beginPath();
    pts.forEach(function (p, i) { i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); });
    ctx.strokeStyle = "#35d6ef"; ctx.lineWidth = 2; ctx.stroke();
    /* points */
    pts.forEach(function (p) {
      ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#04060d"; ctx.fill();
      ctx.strokeStyle = "#35d6ef"; ctx.lineWidth = 2; ctx.stroke();
    });
  }

  function updateStats() {
    var last = store.get("lastScore", null);
    var s = last ? last.s : "—";
    var ds = $("#dashScore"); if (ds) ds.textContent = s;
    var sub = $("#dashScoreSub");
    if (sub) sub.textContent = last ? ("Updated " + new Date(last.t).toLocaleDateString("en-IN")) : "Not calculated yet";
    var st = $("#dashStatus");
    if (st) {
      if (last) { st.textContent = last.band; st.style.color = last.s >= 80 ? "#8ff0c0" : last.s >= 60 ? "#9cc4ff" : last.s >= 40 ? "#ffd8a0" : "#ffb3ba"; }
      else { st.textContent = "—"; st.style.color = ""; }
    }
    var acts = store.get("activity", []).length;
    var dc = $("#dashChecks"); if (dc) dc.textContent = acts;
    var res = window.RGApp ? RGApp.computeScore() : { cats: { identity: 0, privacy: 0, password: 0, browser: 0, habits: 0 } };
    var prog = Math.round((res.cats.identity + res.cats.privacy + res.cats.password + res.cats.browser + res.cats.habits) / 5);
    var dp = $("#dashProgress"); if (dp) dp.textContent = prog + "%";
  }

  var current = null;
  function refresh(result) {
    if (result !== undefined) current = result;
    else if (window.RGApp) current = RGApp.computeScore();
    updateStats();
    drawCats(current);
    drawRisk();
    drawHistory();
  }

  document.addEventListener("DOMContentLoaded", function () {
    refresh(null);
    window.addEventListener("resize", debounce(function () { refresh(); }, 180));
    document.addEventListener("rg:score", function (e) { refresh(e.detail); });
    document.addEventListener("rg:risk", function () { refresh(); });
    document.addEventListener("rg:activity", function () { updateStats(); });
    document.addEventListener("rg:reset", function () { refresh(null); });
    /* redraw when dashboard scrolls into view */
    var dash = $("#dashboard");
    if (dash && "IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) refresh(); });
      }, { threshold: 0.15 }).observe(dash);
    }
  });

  function debounce(fn, ms) {
    var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  window.RGDashboard = { refresh: refresh };
})();
