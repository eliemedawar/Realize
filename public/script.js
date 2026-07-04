/* Realize Therapy Center — front-end behavior */
(function () {
  'use strict';

  /* ---------- sticky nav ---------- */
  var nav = document.getElementById('site-nav');
  function onScroll() {
    nav.classList.toggle('scrolled', window.scrollY > 18);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- mobile menu ---------- */
  var toggle = document.getElementById('menu-toggle');
  var mobileMenu = document.getElementById('mobile-menu');
  toggle.addEventListener('click', function () {
    var open = mobileMenu.classList.toggle('open');
    toggle.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  mobileMenu.querySelectorAll('a, button').forEach(function (el) {
    el.addEventListener('click', function () {
      mobileMenu.classList.remove('open');
      toggle.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });

  /* ---------- scroll reveals ---------- */
  var revealIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      var el = e.target;
      var delay = parseInt(el.getAttribute('data-delay') || '0', 10);
      setTimeout(function () { el.classList.add('revealed'); }, delay);
      revealIO.unobserve(el);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('[data-reveal]').forEach(function (el) { revealIO.observe(el); });

  /* ---------- animated counters ---------- */
  function runCount(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    var suffix = el.getAttribute('data-suffix') || '';
    var dur = 1400;
    var start = performance.now();
    function step(now) {
      var p = Math.min(1, (now - start) / dur);
      var ease = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * ease).toLocaleString() + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  var countIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      runCount(e.target);
      countIO.unobserve(e.target);
    });
  }, { threshold: 0.5 });
  document.querySelectorAll('[data-count]').forEach(function (el) { countIO.observe(el); });

  /* ---------- interactive about image ---------- */
  var interactivePhoto = document.querySelector('[data-interactive-photo]');
  if (interactivePhoto &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
      window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    var interactiveWrap = interactivePhoto.closest('.about-visual');

    function setPhotoMotion(clientX, clientY) {
      var rect = interactivePhoto.getBoundingClientRect();
      var px = (clientX - rect.left) / rect.width;
      var py = (clientY - rect.top) / rect.height;
      var x = Math.max(0, Math.min(1, px));
      var y = Math.max(0, Math.min(1, py));
      var tiltX = (x - 0.5) * 7;
      var tiltY = (0.5 - y) * 6;

      interactiveWrap.style.setProperty('--photo-tilt-x', tiltX.toFixed(2) + 'deg');
      interactiveWrap.style.setProperty('--photo-tilt-y', tiltY.toFixed(2) + 'deg');
      interactiveWrap.style.setProperty('--photo-shift-x', ((0.5 - x) * 10).toFixed(1) + 'px');
      interactiveWrap.style.setProperty('--photo-shift-y', ((0.5 - y) * 8).toFixed(1) + 'px');
      interactiveWrap.style.setProperty('--float-x', ((x - 0.5) * 10).toFixed(1) + 'px');
      interactiveWrap.style.setProperty('--float-y', ((y - 0.5) * 8).toFixed(1) + 'px');
      interactivePhoto.style.setProperty('--glow-x', (x * 100).toFixed(1) + '%');
      interactivePhoto.style.setProperty('--glow-y', (y * 100).toFixed(1) + '%');
    }

    function resetPhotoMotion() {
      interactiveWrap.style.setProperty('--photo-tilt-x', '0deg');
      interactiveWrap.style.setProperty('--photo-tilt-y', '0deg');
      interactiveWrap.style.setProperty('--photo-shift-x', '0px');
      interactiveWrap.style.setProperty('--photo-shift-y', '0px');
      interactiveWrap.style.setProperty('--float-x', '0px');
      interactiveWrap.style.setProperty('--float-y', '0px');
      interactivePhoto.style.setProperty('--glow-x', '50%');
      interactivePhoto.style.setProperty('--glow-y', '50%');
    }

    interactivePhoto.addEventListener('pointermove', function (e) {
      setPhotoMotion(e.clientX, e.clientY);
    });
    interactivePhoto.addEventListener('pointerleave', resetPhotoMotion);
    interactivePhoto.addEventListener('focus', function () {
      var rect = interactivePhoto.getBoundingClientRect();
      setPhotoMotion(rect.left + rect.width * 0.62, rect.top + rect.height * 0.38);
    });
    interactivePhoto.addEventListener('blur', resetPhotoMotion);
  }

  /* ---------- testimonials ---------- */
  var testis = document.querySelectorAll('[data-testi]');
  var dots = document.querySelectorAll('[data-dot]');
  var activeT = 0;
  var timer = null;

  function showTesti(i) {
    activeT = i;
    testis.forEach(function (t, idx) { t.classList.toggle('active', idx === i); });
    dots.forEach(function (d, idx) { d.classList.toggle('active', idx === i); });
  }
  function startAuto() {
    if (timer) clearInterval(timer);
    timer = setInterval(function () { showTesti((activeT + 1) % testis.length); }, 6000);
  }
  dots.forEach(function (d, i) {
    d.addEventListener('click', function () { showTesti(i); startAuto(); });
  });
  startAuto();

  /* swipe between testimonials on touch screens */
  var testiStage = document.querySelector('.testi-stage');
  if (testiStage) {
    var swipeStartX = null;
    testiStage.addEventListener('touchstart', function (e) {
      swipeStartX = e.touches[0].clientX;
    }, { passive: true });
    testiStage.addEventListener('touchend', function (e) {
      if (swipeStartX === null) return;
      var dx = e.changedTouches[0].clientX - swipeStartX;
      swipeStartX = null;
      if (Math.abs(dx) < 40) return;
      var next = dx < 0 ? activeT + 1 : activeT - 1 + testis.length;
      showTesti(next % testis.length);
      startAuto();
    }, { passive: true });
  }

  /* ---------- booking modal ---------- */
  var overlay = document.getElementById('booking-overlay');
  var closeBtn = document.getElementById('booking-close');
  var doneBtn = document.getElementById('booking-done');
  var form = document.getElementById('booking-form');
  var formView = document.getElementById('booking-form-view');
  var successView = document.getElementById('booking-success-view');
  var errorBox = document.getElementById('booking-error');
  var submitBtn = form.querySelector('.submit-btn');
  var submitLabel = form.querySelector('.submit-label');
  var successTitle = successView.querySelector('h3');
  var successText = successView.querySelector('p');

  /* ---------- contact channels ---------- */
  var CHANNELS = {
    whatsappNumber: '96170387738',
    instagramUser: 'realizetherapycenter',
    email: 'realizetherapycenter@gmail.com'
  };

  /* ---------- booking method selector ---------- */
  var methodBtns = document.querySelectorAll('.method-btn');
  var emailInput = form.querySelector('input[name="email"]');
  var directNote = form.querySelector('.direct-note');
  var currentMethod = 'email';

  var METHOD_UI = {
    email: 'Send Booking Request',
    whatsapp: 'Continue on WhatsApp',
    instagram: 'Continue on Instagram'
  };

  // Shown instead of the form when the visitor picks WhatsApp / Instagram.
  var DIRECT_NOTE = {
    whatsapp: 'Press the button below to open WhatsApp — send us a message and we\'ll reply as soon as we can.',
    instagram: 'Press the button below to open Instagram — send us a message and we\'ll reply as soon as we can.'
  };

  function setMethod(method) {
    currentMethod = method;
    methodBtns.forEach(function (b) {
      var on = b.getAttribute('data-method') === method;
      b.classList.toggle('active', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    submitLabel.textContent = METHOD_UI[method] || METHOD_UI.email;

    // Email collects details in the form; WhatsApp/Instagram just open the app.
    var isEmail = method === 'email';
    form.classList.toggle('direct', !isEmail);
    emailInput.required = isEmail;
    if (directNote) {
      directNote.textContent = isEmail ? '' : (DIRECT_NOTE[method] || '');
      directNote.hidden = isEmail;
    }
    errorBox.classList.remove('show');
  }

  methodBtns.forEach(function (b) {
    b.addEventListener('click', function () { setMethod(b.getAttribute('data-method')); });
  });

  function openModal() {
    formView.hidden = false;
    successView.hidden = true;
    errorBox.classList.remove('show');
    setMethod('email');
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    setTimeout(function () {
      var first = form.querySelector('input[name="name"]');
      if (first) first.focus();
    }, 320);
  }
  function closeModal() {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }

  document.querySelectorAll('[data-open-booking]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      openModal();
    });
  });
  closeBtn.addEventListener('click', closeModal);
  doneBtn.addEventListener('click', function () {
    closeModal();
    form.reset();
  });
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay.classList.contains('open')) closeModal();
  });

  /* ---------- booking submit ---------- */
  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.classList.add('show');
  }

  function showSuccess(title, text) {
    successTitle.textContent = title;
    successText.textContent = text;
    formView.hidden = true;
    successView.hidden = false;
    form.reset();
  }

  function submitByEmail(data) {
    submitBtn.classList.add('loading');
    fetch('/api/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          if (!res.ok) throw new Error(body.error || 'Something went wrong. Please try again.');
          return body;
        });
      })
      .then(function () {
        showSuccess('Request Received!',
          'Thank you — we\'ve received your booking request and will reach out to you shortly to confirm a time.');
      })
      .catch(function (err) {
        showError(err.message === 'Failed to fetch'
          ? 'Could not reach the server. Please try again, or call us directly.'
          : err.message);
      })
      .finally(function () {
        submitBtn.classList.remove('loading');
      });
  }

  function submitByWhatsApp() {
    window.open('https://wa.me/' + CHANNELS.whatsappNumber, '_blank', 'noopener');
    showSuccess('Opening WhatsApp…',
      'We\'re opening WhatsApp — send us your message there and we\'ll reply as soon as we can.');
  }

  function submitByInstagram() {
    window.open('https://ig.me/m/' + CHANNELS.instagramUser, '_blank', 'noopener');
    showSuccess('Opening Instagram…',
      'We\'re opening Instagram — send us your message there and we\'ll reply as soon as we can.');
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    errorBox.classList.remove('show');

    // WhatsApp / Instagram: no form, just open the app.
    if (currentMethod === 'whatsapp') return submitByWhatsApp();
    if (currentMethod === 'instagram') return submitByInstagram();

    // Email: collect and validate the form, then send.
    var data = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      phone: form.phone.value.trim(),
      details: form.details.value.trim(),
      method: 'email'
    };

    if (!data.name) return showError('Please enter your full name.');
    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)) {
      return showError('Please enter a valid email address.');
    }
    if (!data.details) return showError('Please tell us a little about how we can help.');

    submitByEmail(data);
  });

  /* ---------- therapist profile modal ---------- */
  var tOverlay = document.getElementById('therapist-overlay');
  if (tOverlay) {
    var tClose = document.getElementById('therapist-close');
    var tName = document.getElementById('therapist-name');
    var tRoles = document.getElementById('therapist-roles');
    var tAbout = document.getElementById('therapist-about');
    var tAvatar = document.getElementById('therapist-avatar');
    var tBook = document.getElementById('therapist-book');

    function openTherapist(card) {
      // avatar
      tAvatar.innerHTML = '';
      var ring = card.querySelector('.avatar-ring');
      if (ring) tAvatar.appendChild(ring.cloneNode(true));
      // name
      var h = card.querySelector('h3');
      tName.textContent = h ? h.textContent : '';
      // roles
      tRoles.innerHTML = '';
      card.querySelectorAll('.role').forEach(function (r) {
        var p = document.createElement('p');
        p.className = 'role';
        p.textContent = r.textContent;
        tRoles.appendChild(p);
      });
      // detailed about (falls back to the short bio if no details added yet)
      var about = card.querySelector('.team-about');
      var bio = card.querySelector('.bio');
      tAbout.innerHTML = (about && about.innerHTML.trim())
        ? about.innerHTML
        : (bio ? '<p>' + bio.textContent + '</p>' : '');

      tOverlay.classList.add('open');
      tOverlay.setAttribute('aria-hidden', 'false');
      document.body.classList.add('modal-open');
      setTimeout(function () { tClose.focus(); }, 320);
    }
    function closeTherapist() {
      tOverlay.classList.remove('open');
      tOverlay.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('modal-open');
    }

    document.querySelectorAll('.team-card').forEach(function (card) {
      card.addEventListener('click', function () { openTherapist(card); });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openTherapist(card); }
      });
    });
    tClose.addEventListener('click', closeTherapist);
    tOverlay.addEventListener('click', function (e) {
      if (e.target === tOverlay) closeTherapist();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && tOverlay.classList.contains('open')) closeTherapist();
    });
    tBook.addEventListener('click', function () { closeTherapist(); openModal(); });
  }
})();
