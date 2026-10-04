/* ============================================================
   RAKSHAGRID DIGITAL — app.js
   Navigation, custom cursor, GSAP motion, micro-interactions.
   Respects prefers-reduced-motion.
   ============================================================ */
(function () {
  "use strict";

  function $(s, r) { return (r || document).querySelector(s); }
  function $all(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasGsap = typeof window.gsap !== "undefined";
  var finePointer = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  if (reduceMotion || !hasGsap) document.body.classList.add("no-motion");

  /* ---------------- Navigation ---------------- */
  function initNav() {
    var nav = $("#nav");
    var burger = $("#burger");
    var menu = $("#mobileMenu");
    var links = $all(".nav__link");

    function onScroll() {
      var y = window.scrollY || window.pageYOffset;
      if (nav) nav.classList.toggle("scrolled", y > 24);
      /* scroll-spy */
      var sections = ["home", "center", "scanner", "tools", "dashboard", "company"];
      var active = "home";
      sections.forEach(function (id) {
        var s = document.getElementById(id);
        if (s && s.getBoundingClientRect().top <= 140) active = id;
      });
      links.forEach(function (l) {
        l.classList.toggle("active", l.getAttribute("href") === "#" + active);
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    function closeMenu() {
      if (!menu) return;
      menu.classList.remove("open");
      burger.classList.remove("open");
      burger.setAttribute("aria-expanded", "false");
      burger.setAttribute("aria-label", "Open menu");
      document.body.classList.remove("no-scroll");
    }
    if (burger && menu) {
      burger.addEventListener("click", function () {
        var open = !menu.classList.contains("open");
        menu.classList.toggle("open", open);
        burger.classList.toggle("open", open);
        burger.setAttribute("aria-expanded", String(open));
        burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
        document.body.classList.toggle("no-scroll", open);
      });
    }

    /* smooth anchor scrolling with nav offset */
    $all('a[href^="#"]').forEach(function (a) {
      a.addEventListener("click", function (e) {
        var id = a.getAttribute("href");
        if (id.length < 2) return;
        var target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        closeMenu();
        var top = target.getBoundingClientRect().top + window.scrollY - (window.innerWidth <= 620 ? 60 : 74);
        window.scrollTo({ top: top, behavior: reduceMotion ? "auto" : "smooth" });
        history.replaceState(null, "", id);
      });
    });

    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenu(); });
  }

  /* ---------------- Custom cursor ---------------- */
  function initCursor() {
    if (!finePointer || reduceMotion) return;
    var dot = document.createElement("div"); dot.className = "cursor-dot";
    var ring = document.createElement("div"); ring.className = "cursor-ring";
    document.body.appendChild(dot); document.body.appendChild(ring);
    document.body.classList.add("cursor-none");

    var mx = window.innerWidth / 2, my = window.innerHeight / 2;
    var rx = mx, ry = my;
    window.addEventListener("mousemove", function (e) {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = "translate(" + (mx - 3) + "px," + (my - 3) + "px)";
    }, { passive: true });

    (function loop() {
      rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
      ring.style.transform = "translate(" + (rx - ring.offsetWidth / 2) + "px," + (ry - ring.offsetHeight / 2) + "px)";
      requestAnimationFrame(loop);
    })();

    var hoverables = "a, button, input, select, textarea, [data-tilt], .scard, .tool, .check-item, .dropzone";
    document.addEventListener("mouseover", function (e) {
      if (e.target.closest && e.target.closest(hoverables)) ring.classList.add("hover");
    });
    document.addEventListener("mouseout", function (e) {
      if (e.target.closest && e.target.closest(hoverables)) ring.classList.remove("hover");
    });
    document.addEventListener("mouseleave", function () { dot.style.opacity = "0"; ring.style.opacity = "0"; });
    document.addEventListener("mouseenter", function () { dot.style.opacity = "1"; ring.style.opacity = "1"; });
  }

  /* ---------------- Card glow follow ---------------- */
  function initCardGlow() {
    $all(".scard").forEach(function (card) {
      card.addEventListener("mousemove", function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty("--mx", ((e.clientX - r.left) / r.width * 100) + "%");
        card.style.setProperty("--my", ((e.clientY - r.top) / r.height * 100) + "%");
      });
    });
  }

  /* ---------------- 3D tilt ---------------- */
  function initTilt() {
    if (!finePointer || reduceMotion) return;
    $all("[data-tilt]").forEach(function (card) {
      var raf = null;
      card.addEventListener("mousemove", function (e) {
        if (raf) return;
        raf = requestAnimationFrame(function () {
          raf = null;
          var r = card.getBoundingClientRect();
          var px = (e.clientX - r.left) / r.width - 0.5;
          var py = (e.clientY - r.top) / r.height - 0.5;
          card.style.transform = "perspective(900px) rotateX(" + (-py * 6).toFixed(2) + "deg) rotateY(" + (px * 8).toFixed(2) + "deg) translateY(-6px)";
        });
      });
      card.addEventListener("mouseleave", function () { card.style.transform = ""; });
    });
  }

  /* ---------------- GSAP motion ---------------- */
  function initMotion() {
    if (!hasGsap) return;
    if (window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

    /* hero entrance */
    if (!reduceMotion) {
      var tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from(".hero__title .line > span", { yPercent: 118, duration: 1.05, stagger: 0.12 }, 0.1)
        .from('[data-hero="fade"]', { opacity: 0, y: 22, duration: 0.8, stagger: 0.1 }, 0.35)
        .from(".status-panel", { opacity: 0, y: 30, scale: 0.97, duration: 0.9 }, 0.5);

      /* hero score counter */
      var ps = $("#panelScore");
      if (ps) {
        var obj = { v: 0 };
        tl.to(obj, { v: 82, duration: 1.2, ease: "power2.out", onUpdate: function () { ps.textContent = Math.round(obj.v); } }, 0.6);
      }
    } else {
      gsap.set(".hero__title .line > span", { clearProps: "all" });
    }

    /* generic reveals */
    var reveals = $all("[data-reveal]");
    if (window.ScrollTrigger && !reduceMotion) {
      reveals.forEach(function (el) {
        gsap.from(el, {
          opacity: 0, y: 30, duration: 0.85, ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 88%", once: true }
        });
      });
      ScrollTrigger.batch(".scard, .seg, .trust-card, .tool", {
        start: "top 90%", once: true,
        onEnter: function (batch) {
          gsap.from(batch, { opacity: 0, y: 26, duration: 0.7, stagger: 0.07, ease: "power2.out", overwrite: true });
        }
      });
      /* parallax on hero copy */
      gsap.to(".hero__copy", {
        y: -60, ease: "none",
        scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
      });
      /* section titles */
      gsap.utils.toArray(".section-title").forEach(function (t) {
        gsap.from(t, {
          opacity: 0, y: 24, duration: 0.8, ease: "power3.out",
          scrollTrigger: { trigger: t, start: "top 90%", once: true }
        });
      });
    } else {
      reveals.forEach(function (el) { el.style.opacity = "1"; el.style.transform = "none"; });
    }
  }

  /* ---------------- Scroll progress hint (reduced-motion safe) ---------------- */
  function initSectionObservers() {
    if (!("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) en.target.classList.add("in-view");
      });
    }, { threshold: 0.12 });
    $all(".section, .cta-band, .hero").forEach(function (s) { io.observe(s); });
  }

  /* ---------------- 3D fallback (offline / no WebGL) ---------------- */
  function init3DFallback() {
    setTimeout(function () {
      ["heroCanvas", "indiaCanvas", "shieldCanvas", "ctaCanvas"].forEach(function (id) {
        var c = document.getElementById(id);
        if (c && !c.querySelector("canvas")) c.classList.add("no3d");
      });
    }, 3200);
  }

  document.addEventListener("DOMContentLoaded", function () {
    initNav();
    initCursor();
    initCardGlow();
    initTilt();
    initMotion();
    initSectionObservers();
    init3DFallback();
  });
})();
