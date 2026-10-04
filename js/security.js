/* ============================================================
   RAKSHAGRID DIGITAL — security.js
   Shared runtime (toast + activity), password strength engine,
   device info, privacy signals, protection score and history.
   Everything here runs locally. Nothing is transmitted.
   ============================================================ */
(function () {
  "use strict";

  var RG = window.RG;
  var store = RG.store;

  /* ---------------- Small DOM helpers ---------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ---------------- Toast ---------------- */
  function toast(msg, kind) {
    var wrap = $("#toastWrap");
    if (!wrap) return;
    var t = el("div", "toast" + (kind ? " toast--" + kind : ""), msg);
    wrap.appendChild(t);
    setTimeout(function () {
      t.style.transition = "opacity .4s, transform .4s";
      t.style.opacity = "0";
      t.style.transform = "translateY(10px)";
      setTimeout(function () { t.remove(); }, 420);
    }, 2600);
  }

  /* ---------------- Activity log (local metadata only) ---------------- */
  var ACT_MAX = 60;
  var ACT_ICONS = {
    password: "i-key", url: "i-link", file: "i-file", privacy: "i-eye",
    score: "i-gauge", device: "i-device", tool: "i-spark", hash: "i-hash"
  };
  function logActivity(type, text) {
    var list = store.get("activity", []);
    list.unshift({ t: Date.now(), type: type, text: text });
    if (list.length > ACT_MAX) list = list.slice(0, ACT_MAX);
    store.set("activity", list);
    renderActivity();
    document.dispatchEvent(new CustomEvent("rg:activity"));
  }
  function timeAgo(ts) {
    var s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return "just now";
    var m = Math.floor(s / 60);
    if (m < 60) return m + " min ago";
    var h = Math.floor(m / 60);
    if (h < 24) return h + " hr ago";
    var d = Math.floor(h / 24);
    return d + " day" + (d > 1 ? "s" : "") + " ago";
  }
  function renderActivity() {
    var host = $("#activityList");
    if (!host) return;
    host.textContent = "";
    var list = store.get("activity", []);
    if (!list.length) {
      host.appendChild(el("div", "act-empty", "No local activity yet. Run a check to begin."));
      return;
    }
    list.forEach(function (item) {
      var row = el("div", "act");
      var ico = el("span", "act__ico");
      var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      var use = document.createElementNS("http://www.w3.org/2000/svg", "use");
      use.setAttribute("href", "#" + (ACT_ICONS[item.type] || "i-spark"));
      svg.appendChild(use);
      ico.appendChild(svg);
      var body = el("div", "act__body");
      body.appendChild(el("div", "act__txt", item.text));
      body.appendChild(el("div", "act__time", timeAgo(item.t)));
      row.appendChild(ico);
      row.appendChild(body);
      host.appendChild(row);
    });
  }
  function clearActivity() {
    store.set("activity", []);
    renderActivity();
    toast("Local activity cleared", "ok");
  }

  /* ============================================================
     PASSWORD STRENGTH ENGINE (local, in-memory only)
     ============================================================ */
  var COMMON = [
    "password", "passw0rd", "qwerty", "123456", "12345678", "123456789", "111111",
    "abc123", "letmein", "welcome", "admin", "iloveyou", "dragon", "monkey",
    "football", "india", "india123", "aadhaar", "012345", "000000", "test",
    "guest", "login", "master", "sunshine", "princess", "qwerty123", "asdfgh"
  ];
  function hasRun(pw, n) { return new RegExp("(.)\\1{" + (n - 1) + ",}").test(pw); }
  function hasSequence(pw) {
    var p = pw.toLowerCase();
    var seqs = "abcdefghijklmnopqrstuvwxyz0123456789";
    for (var i = 0; i < p.length - 3; i++) {
      var a = seqs.indexOf(p[i]), b = seqs.indexOf(p[i + 1]), c = seqs.indexOf(p[i + 2]), d = seqs.indexOf(p[i + 3]);
      if (a > -1 && b === a + 1 && c === a + 2 && d === a + 3) return true;
      if (a > -1 && b === a - 1 && c === a - 2 && d === a - 3) return true;
    }
    return false;
  }
  function strength(pw) {
    var res = {
      score: 0, category: "Awaiting input", bits: 0, pool: 0,
      checks: { len: false, upper: false, lower: false, num: false, sym: false, norepeat: true },
      diversity: 0, repeat: "None", common: "None"
    };
    if (!pw) return res;
    var hasUpper = /[A-Z]/.test(pw), hasLower = /[a-z]/.test(pw);
    var hasNum = /[0-9]/.test(pw), hasSym = /[^A-Za-z0-9]/.test(pw);
    var pool = (hasUpper ? 26 : 0) + (hasLower ? 26 : 0) + (hasNum ? 10 : 0) + (hasSym ? 33 : 0);
    var bits = pw.length * (pool > 1 ? Math.log(pool) / Math.LN2 : 0);

    res.checks.len = pw.length >= 12;
    res.checks.upper = hasUpper; res.checks.lower = hasLower;
    res.checks.num = hasNum; res.checks.sym = hasSym;
    res.checks.norepeat = !hasRun(pw, 3);
    res.diversity = (hasUpper ? 1 : 0) + (hasLower ? 1 : 0) + (hasNum ? 1 : 0) + (hasSym ? 1 : 0);

    var low = pw.toLowerCase();
    var commonHit = null;
    for (var i = 0; i < COMMON.length; i++) { if (low.indexOf(COMMON[i]) > -1) { commonHit = COMMON[i]; break; } }
    var seq = hasSequence(pw);
    var year = /(19|20)\d{2}/.test(pw);
    res.common = commonHit ? "Contains “" + commonHit + "”" : (seq ? "Sequential characters" : (year ? "Contains a year" : "None"));
    res.repeat = hasRun(pw, 3) ? "Repeated characters found" : "None";

    var s = 0;
    if (bits >= 28) s = 1;
    if (bits >= 40) s = 2;
    if (bits >= 60) s = 3;
    if (bits >= 80) s = 4;
    if (bits >= 110 && res.diversity >= 3) s = 5;
    if (pw.length >= 16 && res.diversity >= 3 && !commonHit && !seq) s = Math.max(s, 5);
    if (commonHit) s = Math.min(s, 1);
    if (seq || year) s = Math.min(s, 3);
    if (hasRun(pw, 3)) s = Math.min(s, s - 1);
    if (pw.length < 8) s = Math.min(s, 1);
    s = clamp(s, 0, 5);

    res.score = s; res.bits = Math.round(bits); res.pool = pool;
    res.category = ["Very Weak", "Weak", "Fair", "Good", "Strong", "Very Strong"][s];
    return res;
  }

  /* ============================================================
     DEVICE INFORMATION (non-sensitive, local)
     ============================================================ */
  function detectBrowser() {
    var ua = navigator.userAgent;
    if (/SamsungBrowser/i.test(ua)) return "Samsung Internet";
    if (/Edg\//i.test(ua)) return "Microsoft Edge";
    if (/OPR\/|Opera/i.test(ua)) return "Opera";
    if (/Firefox\//i.test(ua)) return "Firefox";
    if (/CriOS/i.test(ua)) return "Chrome (iOS)";
    if (/Chrome\//i.test(ua)) return "Chrome";
    if (/Safari\//i.test(ua)) return "Safari";
    return "Unknown browser";
  }
  function detectOS() {
    var ua = navigator.userAgent;
    if (/Android/i.test(ua)) return "Android";
    if (/iPhone|iPad|iPod/i.test(ua)) return "iOS / iPadOS";
    if (/Windows/i.test(ua)) return "Windows";
    if (/Mac OS X/i.test(ua)) return "macOS";
    if (/Linux/i.test(ua)) return "Linux";
    return "Unknown platform";
  }
  function initDevice() {
    var set = function (id, v) { var n = $("#" + id); if (n) n.textContent = v; };
    set("dvBrowser", detectBrowser());
    set("dvBrowserSub", "Rendering engine family");
    set("dvOS", detectOS());
    var dpr = window.devicePixelRatio || 1;
    set("dvScreen", window.screen.width + "×" + window.screen.height);
    var sc = $("#dvScreen");
    if (sc) sc.nextElementSibling.textContent = "Pixel ratio " + dpr + "x";
    var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn && conn.effectiveType) {
      set("dvConn", String(conn.effectiveType).toUpperCase());
      var cs = $("#dvConnSub");
      if (cs) cs.textContent = conn.downlink ? "≈ " + conn.downlink + " Mbps (browser estimate)" : "Where available";
    } else {
      set("dvConn", "Not available");
      var cs2 = $("#dvConnSub");
      if (cs2) cs2.textContent = "Network Information API unsupported";
    }
    set("dvDark", window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "Dark" : "Light");
    set("dvLang", navigator.language || "Unknown");
    try { set("dvTZ", Intl.DateTimeFormat().resolvedOptions().timeZone || "Unknown"); }
    catch (e) { set("dvTZ", "Unknown"); }
    set("dvSecure", window.isSecureContext ? "Secure" : "Not secure");
  }

  /* ============================================================
     PRIVACY SIGNALS
     ============================================================ */
  function permValue(state) {
    if (state === "granted") return { text: "Granted", cls: "v-warn" };
    if (state === "denied") return { text: "Blocked", cls: "v-ok" };
    if (state === "prompt") return { text: "Ask each time", cls: "v-mute" };
    return { text: state || "Unknown", cls: "v-mute" };
  }
  function initPrivacy() {
    var names = ["camera", "microphone", "geolocation", "notifications"];
    names.forEach(function (name) {
      var node = $('[data-perm="' + name + '"]');
      if (!node) return;
      if (name === "notifications" && typeof Notification !== "undefined") {
        var v = permValue(Notification.permission);
        node.textContent = v.text; node.className = "prow__val " + v.cls;
      }
      if (navigator.permissions && navigator.permissions.query) {
        try {
          navigator.permissions.query({ name: name }).then(function (p) {
            var v2 = permValue(p.state);
            node.textContent = v2.text; node.className = "prow__val " + v2.cls;
            p.onchange = function () { var v3 = permValue(p.state); node.textContent = v3.text; node.className = "prow__val " + v3.cls; };
          }).catch(function () { notAvailable(node); });
        } catch (e) { notAvailable(node); }
      } else if (!(name === "notifications" && typeof Notification !== "undefined")) {
        notAvailable(node);
      }
    });
    var clip = $("#pvClipboard");
    if (clip) {
      if (navigator.clipboard && navigator.clipboard.readText) { clip.textContent = "Available"; clip.className = "prow__val v-mute"; }
      else { clip.textContent = "Limited"; clip.className = "prow__val v-mute"; }
    }
    var ck = $("#pvCookies");
    if (ck) {
      if (typeof navigator.cookieEnabled === "boolean") { ck.textContent = navigator.cookieEnabled ? "Enabled" : "Disabled"; ck.className = "prow__val " + (navigator.cookieEnabled ? "v-mute" : "v-ok"); }
      else { ck.textContent = "Not available for browser inspection"; ck.className = "prow__val v-mute"; }
    }
    var st = $("#pvStorage");
    if (st) {
      var ok = false;
      try { window.localStorage.setItem("rg_test", "1"); window.localStorage.removeItem("rg_test"); ok = true; } catch (e) { ok = false; }
      st.textContent = ok ? "Available" : "Restricted";
      st.className = "prow__val " + (ok ? "v-ok" : "v-warn");
    }
  }
  function notAvailable(node) {
    node.textContent = "Not available for browser inspection";
    node.className = "prow__val v-mute";
  }
  function privacyScore() {
    var vals = [];
    ["camera", "microphone", "geolocation", "notifications"].forEach(function (name) {
      var node = $('[data-perm="' + name + '"]');
      if (!node) return;
      var t = node.textContent;
      if (t === "Granted") vals.push(45);
      else if (t === "Blocked") vals.push(100);
      else if (t === "Ask each time") vals.push(78);
    });
    try {
      var ls = window.localStorage.getItem("rg_test");
      if (ls === null) { window.localStorage.setItem("rg_test", "1"); window.localStorage.removeItem("rg_test"); }
      vals.push(90);
    } catch (e) { vals.push(50); }
    if (!vals.length) return 60;
    var avg = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
    return Math.round(clamp(avg, 0, 100));
  }
  function browserScore() {
    var s = 0;
    if (window.isSecureContext) s += 45; else s += 10;
    if (window.crypto && window.crypto.subtle) s += 25;
    if (navigator.doNotTrack === "1" || window.doNotTrack === "1" || navigator.globalPrivacyControl) s += 15;
    else s += 5;
    try { if (window.localStorage) s += 15; } catch (e) {}
    return clamp(Math.round(s), 0, 100);
  }

  /* ============================================================
     PROTECTION SCORE
     ============================================================ */
  function categoryScores() {
    var pwBest = store.get("pwBest", 0); // 0-5
    var secList = store.get("check_security", {});
    var privList = store.get("check_privacy", {});
    var secCount = Object.keys(secList).filter(function (k) { return secList[k]; }).length;
    var privCount = Object.keys(privList).filter(function (k) { return privList[k]; }).length;
    return {
      identity: Math.round(secCount / 5 * 100),
      privacy: privacyScore(),
      password: Math.round(pwBest / 5 * 100),
      browser: browserScore(),
      habits: Math.round(privCount / 5 * 100)
    };
  }
  function band(score) {
    if (score >= 80) return { key: "strong", label: "STRONG", cls: "cat-strong" };
    if (score >= 60) return { key: "good", label: "GOOD", cls: "cat-good" };
    if (score >= 40) return { key: "attention", label: "NEEDS ATTENTION", cls: "cat-attention" };
    return { key: "high", label: "HIGH RISK", cls: "cat-high" };
  }
  function computeScore() {
    var c = categoryScores();
    var overall = Math.round((c.identity + c.privacy + c.password + c.browser + c.habits) / 5);
    return { overall: overall, cats: c, band: band(overall) };
  }

  function renderScore(result) {
    var num = $("#bigScore"), cat = $("#bigCat"), ring = $("#bigRing");
    if (num) num.textContent = result.overall;
    if (cat) { cat.textContent = result.band.label; cat.className = "big-ring__cat " + result.band.cls; }
    if (ring) {
      var C = 2 * Math.PI * 104;
      ring.setAttribute("stroke-dasharray", C.toFixed(1));
      ring.style.transition = "stroke-dashoffset 1.2s cubic-bezier(0.22,1,0.36,1)";
      ring.setAttribute("stroke-dashoffset", (C * (1 - result.overall / 100)).toFixed(1));
    }
    ["identity", "privacy", "password", "browser", "habits"].forEach(function (k) {
      var v = result.cats[k];
      var vn = $('[data-catv="' + k + '"]');
      var fn = $('[data-catf="' + k + '"]');
      if (vn) vn.textContent = v;
      if (fn) fn.style.width = v + "%";
    });
    /* panel (hero) */
    updatePanel(result);
    /* dashboard */
    document.dispatchEvent(new CustomEvent("rg:score", { detail: result }));
  }
  function updatePanel(result) {
    var score = result ? result.overall : 82;
    var b = result ? result.band : { label: "GOOD PROTECTION", cls: "cat-good" };
    var ps = $("#panelScore"); if (ps) ps.textContent = score;
    var st = $("#panelStatus");
    if (st) st.textContent = result ? (b.label + " PROTECTION") : "GOOD PROTECTION";
    var ring = $("#panelRing");
    if (ring) {
      var C = 2 * Math.PI * 50;
      ring.setAttribute("stroke-dasharray", C.toFixed(1));
      ring.setAttribute("stroke-dashoffset", (C * (1 - score / 100)).toFixed(1));
    }
    var demo = { password: 78, privacy: 85, browser: 88, link: 90, device: 80 };
    if (result) {
      demo.password = result.cats.password;
      demo.privacy = result.cats.privacy;
      demo.browser = result.cats.browser;
      demo.link = store.get("lastLinkScore", 90);
      demo.device = result.cats.identity;
    }
    Object.keys(demo).forEach(function (k) {
      var bar = $('[data-check="' + k + '"]');
      var val = $('[data-val="' + k + '"]');
      if (bar) bar.style.width = demo[k] + "%";
      if (val) val.textContent = demo[k];
    });
  }

  function saveScore(result) {
    var hist = store.get("scoreHistory", []);
    hist.push({ t: Date.now(), s: result.overall });
    if (hist.length > 40) hist = hist.slice(-40);
    store.set("scoreHistory", hist);
    store.set("lastScore", { t: Date.now(), s: result.overall, band: result.band.label });
  }

  function initScore() {
    var btn = $("#calcScore");
    if (btn) btn.addEventListener("click", function () {
      var result = computeScore();
      renderScore(result);
      saveScore(result);
      logActivity("score", "Security score updated — " + result.overall + "/100 (" + result.band.label + ")");
      toast("Protection score calculated: " + result.overall + "/100", "ok");
      document.dispatchEvent(new CustomEvent("rg:activity"));
    });
    var clear = $("#clearAllData");
    if (clear) clear.addEventListener("click", function () {
      if (!window.confirm("Clear all locally saved RakshaGrid data on this browser?")) return;
      store.clearAll();
      resetUI();
      toast("Local data cleared", "ok");
    });
  }
  function resetUI() {
    renderActivity();
    $("#bigScore") && ($("#bigScore").textContent = "—");
    $("#bigCat") && (($("#bigCat").textContent = "Not calculated"), ($("#bigCat").className = "big-ring__cat"));
    var ring = $("#bigRing");
    if (ring) { var C = 2 * Math.PI * 104; ring.setAttribute("stroke-dashoffset", C.toFixed(1)); }
    ["identity", "privacy", "password", "browser", "habits"].forEach(function (k) {
      var vn = $('[data-catv="' + k + '"]'); if (vn) vn.textContent = "—";
      var fn = $('[data-catf="' + k + '"]'); if (fn) fn.style.width = "0%";
    });
    $all(".check-item input").forEach(function (c) { c.checked = false; });
    document.dispatchEvent(new CustomEvent("rg:reset"));
    document.dispatchEvent(new CustomEvent("rg:score", { detail: null }));
  }

  /* ---------------- Public API ---------------- */
  window.RGApp = {
    $: $, $all: $all, el: el, clamp: clamp,
    toast: toast,
    logActivity: logActivity,
    renderActivity: renderActivity,
    clearActivity: clearActivity,
    strength: strength,
    computeScore: computeScore,
    renderScore: renderScore,
    updatePanel: updatePanel,
    band: band,
    resetUI: resetUI
  };

  /* ---------------- Boot ---------------- */
  document.addEventListener("DOMContentLoaded", function () {
    initDevice();
    initPrivacy();
    initScore();
    renderActivity();
    updatePanel(null);
    var pr = $("#privacyRefresh");
    if (pr) pr.addEventListener("click", function () { initPrivacy(); toast("Privacy signals re-checked", "ok"); });
    var ca = $("#clearActivity");
    if (ca) ca.addEventListener("click", clearActivity);
  });
})();
