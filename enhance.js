// enhance.js — progressive-enhancement polish: scroll-reveal, metric
// count-up, and a sticky-nav shadow. Everything here is additive and
// safe to fail: without JS (or with reduced motion) the page is fully
// visible and static. Loaded with `defer`, so the DOM is ready.
(function () {
  'use strict';

  var prefersReducedMotion =
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- Sticky-nav shadow (cheap, always on) -------------------------
  function initStickyNav() {
    var nav = document.querySelector('.site-nav');
    if (!nav) return;
    var ticking = false;
    function update() {
      nav.classList.toggle('is-stuck', window.scrollY > 4);
      ticking = false;
    }
    window.addEventListener(
      'scroll',
      function () {
        if (!ticking) {
          ticking = true;
          window.requestAnimationFrame(update);
        }
      },
      { passive: true }
    );
    update();
  }

  // ---- Metric count-up ----------------------------------------------
  // Splits e.g. "$50k+" into prefix "$", number 50, suffix "k+" and
  // animates the number from 0 to its target. Non-numeric values are
  // left untouched.
  function animateNumber(el) {
    var raw = el.textContent.trim();
    var match = raw.match(/^(\D*)(\d[\d,]*)(.*)$/);
    if (!match) return;
    var prefix = match[1];
    var hadCommas = match[2].indexOf(',') !== -1;
    var target = parseInt(match[2].replace(/,/g, ''), 10);
    var suffix = match[3];
    if (!isFinite(target)) return;

    var duration = 1100;
    var start = null;

    function fmt(n) {
      return hadCommas ? n.toLocaleString() : String(n);
    }

    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      el.textContent = prefix + fmt(Math.round(eased * target)) + suffix;
      if (p < 1) window.requestAnimationFrame(step);
      else el.textContent = prefix + fmt(target) + suffix;
    }
    el.textContent = prefix + fmt(0) + suffix;
    window.requestAnimationFrame(step);
  }

  function initCountUp() {
    var strip = document.querySelector('.metrics-strip');
    if (!strip) return;
    var nums = Array.prototype.slice.call(
      strip.querySelectorAll('.metric-number')
    );
    if (!nums.length) return;

    if (!('IntersectionObserver' in window)) return; // leave as-is

    var obs = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          obs.disconnect();
          nums.forEach(animateNumber);
        });
      },
      { threshold: 0.4 }
    );
    obs.observe(strip);
  }

  // ---- Scroll-reveal -------------------------------------------------
  var REVEAL_SELECTOR = [
    '.card',
    '.project-card',
    '.featured-product',
    '.metric',
    '.skill-category',
    '.news-entry',
    '.tl-item'
  ].join(',');

  function initReveal() {
    var targets = Array.prototype.slice.call(
      document.querySelectorAll(REVEAL_SELECTOR)
    );
    if (!targets.length) return;

    // Stagger items that share a parent for a gentle cascade.
    var perParent = new Map();
    targets.forEach(function (el) {
      el.classList.add('reveal');
      var parent = el.parentNode;
      var i = perParent.get(parent) || 0;
      perParent.set(parent, i + 1);
      el.style.transitionDelay = Math.min(i, 6) * 60 + 'ms';
    });

    function revealAll() {
      targets.forEach(function (el) {
        el.classList.add('is-visible');
      });
    }

    if (!('IntersectionObserver' in window)) {
      revealAll();
      return;
    }

    var obs = new IntersectionObserver(
      function (entries, observer) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );
    targets.forEach(function (el) {
      obs.observe(el);
    });

    // Safety net: if anything is still hidden after 3s, show it.
    window.setTimeout(revealAll, 3000);
  }

  function init() {
    initStickyNav();
    if (prefersReducedMotion) return; // honour the user's preference
    document.documentElement.classList.add('motion-ok');
    initReveal();
    initCountUp();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
