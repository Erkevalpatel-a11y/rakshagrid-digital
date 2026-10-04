/* ============================================================
   RAKSHAGRID DIGITAL — tools.js
   All protection tools. Everything runs locally in the browser.
   Cryptographic operations use the Web Crypto API.
   ============================================================ */
(function () {
  "use strict";

  var RG = window.RG;
  var store = RG.store;
  function $(s, r) { return (r || document).querySelector(s); }
  function $all(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function toast(m, k) { window.RGApp && RGApp.toast(m, k); }
  function log(t, m) { window.RGApp && RGApp.logActivity(t, m); }
  function strength(pw) { return window.RGApp.strength(pw); }

  var subtle = (window.crypto && window.crypto.subtle) ? window.crypto.subtle : null;

  /* ---------------- crypto helpers ---------------- */
  function bufToHex(buf) {
    var b = new Uint8Array(buf), s = "";
    for (var i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, "0");
    return s;
  }
  function bufToB64(buf) {
    var b = new Uint8Array(buf), bin = "";
    for (var i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
    return btoa(bin);
  }
  function b64ToBuf(b64) {
    var bin = atob(b64), b = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    return b.buffer;
  }
  function randomBytes(n) {
    var a = new Uint8Array(n);
    (window.crypto || window.msCrypto).getRandomValues(a);
    return a;
  }
  function digestHex(algo, buf) {
    return subtle.digest(algo, buf).then(bufToHex);
  }

  /* ---------------- meter rendering ---------------- */
  function paintMeter(trackId, score) {
    var track = $("#" + trackId);
    if (!track) return;
    var segs = $all(".meter__seg", track);
    segs.forEach(function (s, i) {
      s.className = "meter__seg" + (i < score ? " on-" + score : "");
    });
    track.setAttribute("aria-valuenow", String(score));
  }

  /* ============================================================
     PASSWORD SECURITY SECTION
     ============================================================ */
  function initPasswordSection() {
    var input = $("#pwInput");
    if (!input) return;
    var toggle = $("#pwToggle"), clear = $("#pwClear");
    function update() {
      var r = strength(input.value);
      paintMeter("pwMeter", input.value ? r.score : 0);
      var cat = $("#pwCat");
      if (cat) { cat.textContent = input.value ? r.category : "Awaiting input"; }
      var ent = $("#pwEntropy");
      if (ent) ent.textContent = input.value ? "≈ " + r.bits + " bits" : "—";
      $all("#pwCriteria .crit").forEach(function (c) {
        c.classList.toggle("pass", !!r.checks[c.getAttribute("data-c")]);
      });
      var dv = $("#pwDiversity"); if (dv) dv.textContent = input.value ? r.diversity + " / 4" : "—";
      var rp = $("#pwRepeat"); if (rp) rp.textContent = input.value ? r.repeat : "—";
      var cm = $("#pwCommon"); if (cm) cm.textContent = input.value ? r.common : "—";
      var sp = $("#pwSpace"); if (sp) sp.textContent = input.value ? "2^" + Math.round(r.bits) : "—";
      if (input.value) {
        var best = store.get("pwBest", 0);
        if (r.score > best) store.set("pwBest", r.score);
      }
    }
    input.addEventListener("input", update);
    input.addEventListener("change", function () {
      if (!input.value) return;
      var r = strength(input.value);
      log("password", "Password check completed — " + r.category);
    });
    if (toggle) toggle.addEventListener("click", function () {
      var show = input.type === "password";
      input.type = show ? "text" : "password";
      toggle.textContent = show ? "Hide" : "Show";
      toggle.setAttribute("aria-pressed", String(show));
    });
    if (clear) clear.addEventListener("click", function () {
      input.value = ""; update(); input.focus(); toast("Input cleared", "ok");
    });
  }

  /* ============================================================
     TOOL 1 — Password strength checker
     ============================================================ */
  function initTool1() {
    var inp = $("#t1pw"); if (!inp) return;
    inp.addEventListener("input", function () {
      var r = strength(inp.value);
      paintMeter("t1meter", inp.value ? r.score : 0);
      var cat = $("#t1cat"); if (cat) cat.textContent = inp.value ? r.category : "Awaiting input";
      var bits = $("#t1bits"); if (bits) bits.textContent = inp.value ? "≈ " + r.bits + " bits" : "—";
      var out = $("#t1out");
      if (out) out.textContent = inp.value
        ? "Length: " + inp.value.length + "\nClasses used: " + r.diversity + "/4\nRepeats: " + r.repeat + "\nPatterns: " + r.common
        : "";
    });
  }

  /* ============================================================
     TOOL 2 — Secure random password generator
     ============================================================ */
  function initTool2() {
    var len = $("#t2len"), out = $("#t2out"), gen = $("#t2gen");
    if (!gen) return;
    var lenv = $("#t2lenv");
    len.addEventListener("input", function () { lenv.textContent = len.value; });
    var SETS = { upper: "ABCDEFGHJKLMNPQRSTUVWXYZ", lower: "abcdefghijkmnopqrstuvwxyz", num: "23456789", sym: "!@#$%^&*()-_=+[]{};:,.?" };
    function pick(str) {
      var a = randomBytes(1)[0];
      return str[a % str.length];
    }
    gen.addEventListener("click", function () {
      var chosen = [];
      if ($("#t2upper").checked) chosen.push(SETS.upper);
      if ($("#t2lower").checked) chosen.push(SETS.lower);
      if ($("#t2num").checked) chosen.push(SETS.num);
      if ($("#t2sym").checked) chosen.push(SETS.sym);
      if (!chosen.length) { toast("Select at least one character set", "warn"); return; }
      var all = chosen.join("");
      var n = parseInt(len.value, 10);
      var chars = [];
      chosen.forEach(function (set) { chars.push(pick(set)); });
      while (chars.length < n) chars.push(pick(all));
      /* secure shuffle */
      for (var i = chars.length - 1; i > 0; i--) {
        var j = randomBytes(1)[0] % (i + 1);
        var t = chars[i]; chars[i] = chars[j]; chars[j] = t;
      }
      out.textContent = chars.join("");
      log("tool", "Secure random password generated");
    });
  }

  /* ============================================================
     TOOL 4 — Hash generator
     ============================================================ */
  function initTool4() {
    var run = $("#t4run"); if (!run) return;
    run.addEventListener("click", function () {
      var txt = $("#t4text").value, algo = $("#t4algo").value, out = $("#t4out");
      if (!txt) { out.textContent = "Enter some text to hash."; return; }
      if (!subtle) { out.textContent = "Web Crypto unavailable — requires a secure context (HTTPS or localhost)."; return; }
      var data = new TextEncoder().encode(txt);
      digestHex(algo, data).then(function (hex) {
        out.textContent = algo + ":\n" + hex;
        log("hash", algo + " hash generated for text");
      }).catch(function () { out.textContent = "Hashing failed in this browser."; });
    });
  }

  /* ============================================================
     TOOL 5 — Text encryption demo (AES-GCM + PBKDF2)
     ============================================================ */
  function deriveKey(pass, salt) {
    return subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"])
      .then(function (base) {
        return subtle.deriveKey(
          { name: "PBKDF2", salt: salt, iterations: 150000, hash: "SHA-256" },
          base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
        );
      });
  }
  function initTool5() {
    var enc = $("#t5enc"), dec = $("#t5dec");
    if (!enc) return;
    enc.addEventListener("click", function () {
      var out = $("#t5out"), txt = $("#t5text").value, pass = $("#t5pass").value;
      if (!subtle) { out.textContent = "Web Crypto unavailable — requires HTTPS or localhost."; return; }
      if (!txt || !pass) { out.textContent = "Enter both text and a passphrase."; return; }
      var salt = randomBytes(16), iv = randomBytes(12);
      deriveKey(pass, salt).then(function (key) {
        return subtle.encrypt({ name: "AES-GCM", iv: iv }, key, new TextEncoder().encode(txt));
      }).then(function (ct) {
        var combined = new Uint8Array(16 + 12 + ct.byteLength);
        combined.set(salt, 0); combined.set(iv, 16); combined.set(new Uint8Array(ct), 28);
        out.textContent = bufToB64(combined.buffer);
        log("tool", "Text encrypted locally (AES-GCM)");
        toast("Encrypted locally", "ok");
      }).catch(function () { out.textContent = "Encryption failed."; });
    });
    dec.addEventListener("click", function () {
      var out = $("#t5out"), pass = $("#t5pass").value;
      if (!subtle) { out.textContent = "Web Crypto unavailable."; return; }
      if (!out.textContent || !pass) { out.textContent = "Nothing to decrypt, or passphrase missing."; return; }
      var buf;
      try { buf = b64ToBuf(out.textContent.trim()); } catch (e) { out.textContent = "Input is not valid encrypted data."; return; }
      var bytes = new Uint8Array(buf);
      if (bytes.length < 29) { out.textContent = "Input is not valid encrypted data."; return; }
      var salt = bytes.slice(0, 16), iv = bytes.slice(16, 28), ct = bytes.slice(28);
      deriveKey(pass, salt).then(function (key) {
        return subtle.decrypt({ name: "AES-GCM", iv: iv }, key, ct);
      }).then(function (pt) {
        out.textContent = new TextDecoder().decode(pt);
        toast("Decrypted", "ok");
      }).catch(function () { out.textContent = "Decryption failed — wrong passphrase or corrupted data."; });
    });
  }

  /* ============================================================
     TOOL 6 — QR code generator
     ============================================================ */
  function initTool6() {
    var run = $("#t6run"), holder = $("#t6qr"), dl = $("#t6dl"), text = $("#t6text");
    if (!run) return;
    var lastUrl = "";
    run.addEventListener("click", function () {
      var val = text.value.trim();
      holder.textContent = "";
      if (!val) { holder.appendChild(mkEmpty("Enter text or a link to encode")); return; }
      if (typeof window.qrcode !== "function") {
        holder.appendChild(mkEmpty("QR library unavailable (offline)."));
        return;
      }
      try {
        var qr = window.qrcode(0, "M");
        qr.addData(val);
        qr.make();
        lastUrl = qr.createDataURL(6, 8);
        var img = document.createElement("img");
        img.alt = "Generated QR code";
        img.src = lastUrl;
        holder.appendChild(img);
        dl.disabled = false;
        log("tool", "QR code generated locally");
      } catch (e) {
        holder.appendChild(mkEmpty("Could not encode this text — try shorter input."));
      }
    });
    dl.addEventListener("click", function () {
      if (!lastUrl) return;
      var a = document.createElement("a");
      a.href = lastUrl; a.download = "rakshagrid-qr.gif";
      document.body.appendChild(a); a.click(); a.remove();
    });
  }
  function mkEmpty(msg) {
    var d = document.createElement("div");
    d.className = "qr-empty"; d.textContent = msg;
    return d;
  }

  /* ============================================================
     TOOLS 7 & 8 — Checklists (persisted locally)
     ============================================================ */
  function initChecklist(listId, meterId, catId, key) {
    var list = $("#" + listId);
    if (!list) return;
    var saved = store.get(key, {});
    var boxes = $all("input[type=checkbox]", list);
    boxes.forEach(function (b) {
      var k = b.getAttribute("data-k");
      if (saved[k]) b.checked = true;
      b.addEventListener("change", function () {
        var s = store.get(key, {});
        s[k] = b.checked;
        store.set(key, s);
        update();
        log("tool", (key === "check_security" ? "Security" : "Privacy") + " checklist updated");
      });
    });
    function update() {
      var done = boxes.filter(function (b) { return b.checked; }).length;
      paintMeter(meterId, done);
      var cat = $("#" + catId);
      if (cat) cat.textContent = done + " / 5 complete";
    }
    update();
  }

  /* ============================================================
     TOOL 9 — JSON security formatter
     ============================================================ */
  var SENSITIVE = ["password", "passwd", "pwd", "secret", "token", "apikey", "api_key", "otp", "pin", "card", "cvv", "aadhaar", "aadhar", "pan", "private", "credential", "auth", "session", "bank", "account"];
  function initTool9() {
    var run = $("#t9run"); if (!run) return;
    run.addEventListener("click", function () {
      var out = $("#t9out"), raw = $("#t9text").value.trim();
      if (!raw) { out.textContent = "Paste some JSON to inspect."; return; }
      var obj;
      try { obj = JSON.parse(raw); }
      catch (e) { out.textContent = "Invalid JSON: " + e.message; return; }
      var flags = [];
      (function walk(node, path) {
        if (node && typeof node === "object") {
          Object.keys(node).forEach(function (k) {
            var p = path ? path + "." + k : k;
            if (SENSITIVE.some(function (w) { return k.toLowerCase().indexOf(w) > -1; })) {
              flags.push("⚠ sensitive key: " + p);
            }
            walk(node[k], p);
          });
        }
      })(obj, "");
      out.textContent = JSON.stringify(obj, null, 2) + "\n\n" + (flags.length ? flags.join("\n") : "No sensitive-looking keys detected.");
      log("tool", "JSON inspected locally");
    });
  }

  /* ============================================================
     TOOL 10 + FILE SECURITY — local file hashing
     ============================================================ */
  function hashFile(file, outFn) {
    if (!subtle) { outFn("Web Crypto unavailable — requires HTTPS or localhost."); return; }
    if (file.size > 250 * 1024 * 1024) { outFn("File is very large (>250 MB) — hashing may fail or be slow."); }
    var reader = new FileReader();
    reader.onload = function () {
      subtle.digest("SHA-256", reader.result).then(function (hex) {
        outFn(null, bufToHex(hex));
      }).catch(function () { outFn("Hashing failed in this browser."); });
    };
    reader.onerror = function () { outFn("Could not read the file."); };
    reader.readAsArrayBuffer(file);
  }

  function initTool10() {
    var input = $("#t10file"), out = $("#t10out"), drop = $("#t10drop");
    if (!input) return;
    input.addEventListener("change", function () {
      if (!input.files || !input.files[0]) return;
      var f = input.files[0];
      out.textContent = "Hashing " + f.name + "…";
      hashFile(f, function (err, hex) {
        out.textContent = err ? err : ("SHA-256:\n" + hex);
        if (!err) log("file", "File hash generated (SHA-256)");
      });
    });
  }

  function initFileIntegrity() {
    var input = $("#fileInput"), drop = $("#fileDrop"), meta = $("#fileMeta");
    if (!input) return;
    function human(n) {
      if (n < 1024) return n + " B";
      if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
      if (n < 1073741824) return (n / 1048576).toFixed(2) + " MB";
      return (n / 1073741824).toFixed(2) + " GB";
    }
    function handle(file) {
      $("#fmName").textContent = file.name;
      $("#fmSize").textContent = human(file.size) + " (" + file.size.toLocaleString("en-IN") + " bytes)";
      $("#fmType").textContent = file.type || "Unknown type";
      $("#fmMod").textContent = file.lastModified ? new Date(file.lastModified).toLocaleString("en-IN") : "Unknown";
      $("#fmHash").textContent = "Computing…";
      meta.hidden = false;
      hashFile(file, function (err, hex) {
        $("#fmHash").textContent = err ? err : hex;
        if (!err) { $("#fmCopy").disabled = false; log("file", "File integrity hash generated (SHA-256)"); toast("SHA-256 computed locally", "ok"); }
      });
    }
    input.addEventListener("change", function () { if (input.files && input.files[0]) handle(input.files[0]); });
    ["dragover", "dragenter"].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("drag"); });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("drag"); });
    });
    drop.addEventListener("drop", function (e) {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) handle(e.dataTransfer.files[0]);
    });
    drop.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
    $("#fmCopy").addEventListener("click", function () {
      copyText($("#fmHash").textContent); toast("Hash copied", "ok");
    });
    $("#fmReset").addEventListener("click", function () {
      input.value = ""; meta.hidden = true; $("#fmCopy").disabled = true;
    });
  }

  /* ============================================================
     Copy buttons + privacy review buttons
     ============================================================ */
  function copyText(text) {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () { fallbackCopy(text); });
    } else { fallbackCopy(text); }
  }
  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "absolute"; ta.style.left = "-9999px";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    ta.remove();
  }
  function initCopyButtons() {
    $all("[data-copy]").forEach(function (b) {
      b.addEventListener("click", function () {
        var target = $(b.getAttribute("data-copy"));
        if (target && target.textContent.trim()) { copyText(target.textContent.trim()); toast("Copied to clipboard", "ok"); }
        else toast("Nothing to copy yet", "warn");
      });
    });
  }
  function initPrivacyActions() {
    var cr = $("#btnClipRead");
    if (cr) cr.addEventListener("click", function () {
      if (!navigator.clipboard || !navigator.clipboard.readText) { toast("Clipboard read not supported", "warn"); return; }
      navigator.clipboard.readText().then(function (t) {
        toast("Clipboard read: " + t.length + " characters (not stored)", "ok");
      }).catch(function () { toast("Clipboard permission was not granted", "warn"); });
    });
    var nt = $("#btnNotif");
    if (nt) nt.addEventListener("click", function () {
      if (typeof Notification === "undefined") { toast("Notifications not supported", "warn"); return; }
      Notification.requestPermission().then(function (p) {
        toast("Notification permission: " + p, "ok");
        var node = $('[data-perm="notifications"]');
        if (node) { node.textContent = p === "granted" ? "Granted" : p === "denied" ? "Blocked" : "Ask each time"; node.className = "prow__val " + (p === "denied" ? "v-ok" : p === "granted" ? "v-warn" : "v-mute"); }
      });
    });
  }

  /* ---------------- Boot ---------------- */
  document.addEventListener("DOMContentLoaded", function () {
    initPasswordSection();
    initTool1();
    initTool2();
    initTool4();
    initTool5();
    initTool6();
    initChecklist("t7list", "t7meter", "t7cat", "check_security");
    initChecklist("t8list", "t8meter", "t8cat", "check_privacy");
    initTool9();
    initTool10();
    initFileIntegrity();
    initCopyButtons();
    initPrivacyActions();
  });
})();
