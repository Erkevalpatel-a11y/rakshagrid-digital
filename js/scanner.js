/* ============================================================
   RAKSHAGRID DIGITAL — scanner.js
   Client-side URL risk analysis. Structure/pattern inspection
   ONLY — the destination is never fetched, scanned or attacked.
   ============================================================ */
(function () {
  "use strict";

  function $(s, r) { return (r || document).querySelector(s); }
  function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }

  var SUSPICIOUS_TLDS = ["zip", "mov", "top", "xyz", "tk", "ml", "ga", "cf", "gq", "work", "click", "link", "country", "kim", "loan", "men", "review"];
  var BAIT_WORDS = ["login", "verify", "secure", "account", "update", "bank", "wallet", "upi", "kyc", "otp", "free", "gift", "prize", "win", "bonus", "refund", "pay", "signin", "confirm", "unlock", "recovery", "support"];

  function parseInput(raw) {
    var value = (raw || "").trim();
    if (!value) return { error: "Please enter a link to analyse." };
    var unsafe = /^(javascript|data|vbscript|file|blob):/i.exec(value);
    if (unsafe) return { url: null, unsafeScheme: unsafe[1].toLowerCase(), raw: value };
    var hadScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
    var toParse = hadScheme ? value : "http://" + value;
    var u;
    try { u = new URL(toParse); }
    catch (e) { return { error: "That does not look like a valid URL." }; }
    if (!u.hostname || u.hostname.indexOf(".") === -1 && !/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)) {
      if (u.hostname !== "localhost") return { error: "That does not look like a valid web address." };
    }
    return { url: u, hadScheme: hadScheme, raw: value };
  }

  function isIp(host) {
    return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) ||
      /^\[?[0-9a-f:]+\]?$/i.test(host) && host.indexOf(":") > -1;
  }

  function analyze(raw) {
    var parsed = parseInput(raw);
    if (parsed.error) return { verdict: "UNABLE TO ASSESS", key: "unknown", findings: [], error: parsed.error };

    var findings = [];
    var risk = 0;
    function add(level, title, detail, weight) {
      findings.push({ level: level, title: title, detail: detail });
      risk += (weight != null) ? weight : (level === "fail" ? 3 : level === "warn" ? 2 : 0.4);
    }

    if (parsed.unsafeScheme) {
      add("fail", "Unsafe URL scheme", "The link uses “" + parsed.unsafeScheme + ":” — a scheme that can execute or embed content directly rather than loading a web page.", 5);
      add("warn", "Not a web address", "This does not look like an ordinary website link and should not be opened from an untrusted source.");
      return { verdict: "HIGH RISK", key: "high", findings: findings, raw: parsed.raw };
    }

    var u = parsed.url;

    var host = u.hostname.toLowerCase();
    var isHttps = u.protocol === "https:";

    if (isHttps) add("pass", "Uses HTTPS", "The link declares an encrypted connection scheme.");
    else add("fail", "No HTTPS", "The link uses " + u.protocol.replace(":", "") + " — traffic would not be encrypted.");

    if (u.protocol === "javascript:" || u.protocol === "data:" || u.protocol === "file:") {
      add("fail", "Unsafe scheme", "The scheme “" + u.protocol.replace(":", "") + "” can execute or embed content directly.");
    }

    var full = u.href;
    if (full.length > 100) add("warn", "Very long URL", "Length is " + full.length + " characters — unusually long links can hide their true destination.");
    else if (full.length > 60) add("info", "Long URL", "Length is " + full.length + " characters.");
    else add("pass", "Reasonable URL length", full.length + " characters.");

    if (isIp(host)) add("fail", "IP address as hostname", "The host is a raw IP address rather than a domain name — common in phishing links.");

    if (host.indexOf("xn--") > -1) add("fail", "Punycode detected", "The hostname uses punycode (xn--), which can imitate real domains using look-alike characters.", 4);

    var subCount = host.split(".").length - 2;
    if (subCount >= 4) add("warn", "Excessive subdomains", host + " has " + subCount + " subdomain levels — a common obfuscation tactic.");
    else if (subCount >= 2) add("info", "Multiple subdomains", host + " has " + subCount + " subdomain levels.");

    if (host.indexOf(".") === -1 && host !== "localhost") add("warn", "Hostname without a domain", "The host has no public suffix, which is unusual for a website.");

    if (u.port && u.port !== "80" && u.port !== "443" && u.port !== "") {
      add("warn", "Non-standard port", "The link targets port " + u.port + " instead of a standard web port.");
    }

    var beforeAt = full.split("@");
    if (beforeAt.length > 1 && u.username) {
      add("fail", "Credentials embedded in URL", "The link contains an “@” userinfo section — the visible host may be misleading.", 4);
    }

    if (full.indexOf("//", 8) > -1) add("info", "Double slash in path", "A “//” appears after the host, which can confuse naive parsers.");

    if (/%(2e|2f|3a|40)/i.test(full)) add("warn", "Encoded characters", "The URL contains percent-encoded characters that may conceal structure.");

    var tld = host.split(".").pop();
    if (SUSPICIOUS_TLDS.indexOf(tld) > -1) add("warn", "Higher-risk top-level domain", "“." + tld + "” is frequently used for disposable or abusive sites.");

    var hits = BAIT_WORDS.filter(function (w) { return full.toLowerCase().indexOf(w) > -1; });
    if (hits.length >= 3) add("warn", "Multiple bait keywords", "Contains " + hits.length + " attention-grabbing terms (" + hits.slice(0, 4).join(", ") + ").");
    else if (hits.length) add("info", "Sensitive keywords present", "Contains terms such as: " + hits.slice(0, 3).join(", ") + ".");

    if (host.split("-").length > 4) add("info", "Many hyphens in hostname", "Hyphen-heavy hostnames are sometimes used to mimic brands.");

    if (/\d{5,}/.test(host.replace(/\./g, ""))) add("info", "Long digit run in hostname", "The hostname contains a long sequence of digits.");

    var verdict, key;
    if (risk >= 6) { verdict = "HIGH RISK"; key = "high"; }
    else if (risk >= 3) { verdict = "MEDIUM RISK"; key = "medium"; }
    else { verdict = "LOW RISK"; key = "low"; }

    return { verdict: verdict, key: key, findings: findings, url: u, raw: parsed.raw };
  }

  var ICON = { pass: "i-check", info: "i-info", warn: "i-alert", fail: "i-x" };
  var VERDICT_SUB = {
    low: "No strong structural risk patterns were found in this URL.",
    medium: "Some structural signals deserve a closer look before you trust this link.",
    high: "Several structural risk patterns were detected. Treat this link with caution."
  };

  function render(result) {
    var host = $("#scanResult");
    if (!host) return;
    host.textContent = "";

    if (result.error) {
      var n = el("div", "note note--warn");
      var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      var use = document.createElementNS("http://www.w3.org/2000/svg", "use");
      use.setAttribute("href", "#i-alert"); svg.appendChild(use); n.appendChild(svg);
      n.appendChild(el("span", null, result.error));
      host.appendChild(n);
      return;
    }

    var verdict = el("div", "verdict verdict--" + result.key);
    var badge = el("div", "verdict__badge", result.key === "low" ? "LOW" : result.key === "medium" ? "MED" : "HIGH");
    var info = el("div", null);
    info.appendChild(el("div", "verdict__label", result.verdict));
    info.appendChild(el("div", "verdict__sub", VERDICT_SUB[result.key] || ""));
    verdict.appendChild(badge); verdict.appendChild(info);
    host.appendChild(verdict);

    var list = el("div", "findings");
    result.findings.forEach(function (f) {
      var row = el("div", "finding finding--" + f.level);
      var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "finding__ico");
      var use = document.createElementNS("http://www.w3.org/2000/svg", "use");
      use.setAttribute("href", "#" + ICON[f.level]); svg.appendChild(use);
      var txt = el("div", "finding__txt");
      txt.appendChild(el("strong", null, f.title + " — "));
      txt.appendChild(el("span", null, f.detail));
      row.appendChild(svg); row.appendChild(txt);
      list.appendChild(row);
    });
    host.appendChild(list);

    var disc = el("div", "note mt-16");
    var dsvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    var duse = document.createElementNS("http://www.w3.org/2000/svg", "use");
    duse.setAttribute("href", "#i-info"); dsvg.appendChild(duse); disc.appendChild(dsvg);
    disc.appendChild(el("span", null, "This browser-based assessment cannot guarantee that a website is safe. The destination was never contacted."));
    host.appendChild(disc);
  }

  function init() {
    var form = $("#scanForm");
    var input = $("#scanUrl");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var val = input.value;
      if (!val.trim()) { window.RGApp && RGApp.toast("Enter a link to analyse", "warn"); input.focus(); return; }
      var result = analyze(val);
      render(result);
      if (!result.error) {
        var counts = window.RG.store.get("riskCounts", { low: 0, medium: 0, high: 0, unknown: 0 });
        counts[result.key] = (counts[result.key] || 0) + 1;
        window.RG.store.set("riskCounts", counts);
        window.RG.store.set("lastLinkScore", result.key === "low" ? 92 : result.key === "medium" ? 60 : 28);
        window.RGApp && RGApp.logActivity("url", "URL assessment completed — " + result.verdict);
        document.dispatchEvent(new CustomEvent("rg:risk"));
      }
    });
  }

  window.RGScanner = { analyze: analyze };

  document.addEventListener("DOMContentLoaded", init);

  /* Also wire the in-tools URL analyzer (tool #3) */
  document.addEventListener("DOMContentLoaded", function () {
    var run = $("#t3run"), inp = $("#t3url"), out = $("#t3out");
    if (!run) return;
    function go() {
      var r = analyze(inp.value);
      if (r.error) { out.textContent = r.error; return; }
      var lines = [r.verdict];
      r.findings.forEach(function (f) {
        var tag = f.level === "pass" ? "OK " : f.level === "info" ? "i  " : f.level === "warn" ? "!  " : "X  ";
        lines.push(tag + f.title);
      });
      out.textContent = lines.join("\n");
      window.RGApp && RGApp.logActivity("url", "URL structure analysed in tools");
    }
    run.addEventListener("click", go);
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); go(); } });
  });
})();
