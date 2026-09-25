/* ICG Real Estate — kadro canlı yükleme + site etkileşimleri */
(function () {
  'use strict';

  var TEAM_URL = 'team.json';
  var POLL_MS = 30000; // 30 saniyede bir tazele (canlı takip)
  var lastSignature = '';

  // Telefonu tel: bağlantısına çevir (+ ve rakam kalsın)
  function telHref(phone) {
    var d = (phone || '').replace(/[^\d+]/g, '');
    if (d.charAt(0) !== '+') {
      if (d.indexOf('0') === 0) d = '+9' + d; // 0xxx -> +90xxx
      else d = '+' + d;
    }
    return 'tel:' + d;
  }

  function initials(name) {
    return (name || '?').trim().split(/\s+/).map(function (w) { return w.charAt(0); }).join('').slice(0, 2).toLocaleUpperCase('tr-TR');
  }

  function signature(list) {
    return JSON.stringify((list || []).map(function (p) { return [p.name, p.role, p.phoneOffice, p.phoneMobile, p.photo]; }));
  }

  function renderTeam(list, updatedAt) {
    var grid = document.getElementById('teamGrid');
    var updated = document.getElementById('teamUpdated');
    if (!grid) return;
    if (!list || !list.length) {
      grid.innerHTML = '<div class="team-skeleton">Henüz danışman bilgisi bulunamadı. <strong>danışmanlar</strong> klasörüne ad + .txt ve fotoğraf ekleyip <strong>KADROYU-GUNCELLE</strong> dosyasını çalıştırın.</div>';
      return;
    }
    // Sabit kadro sıralaması: mustafa, uğur, feray, gizem, salih, gülşah
    var ORDER = ['mustafa çelik', 'uğur mumcu', 'feray bakthavar', 'gizem karataş', 'salih özdemir', 'gülşah erdal'];
    function ordIx(name) {
      var n = (name || '').toLocaleLowerCase('tr-TR');
      var ix = ORDER.indexOf(n);
      return ix === -1 ? 99 : ix;
    }
    var sorted = list.slice().sort(function (a, b) { return ordIx(a.name) - ordIx(b.name); });
    grid.innerHTML = sorted.map(function (p) {
      var isBroker = /broker/i.test(p.role || '');
      var phones = '';
      if (p.phoneOffice) phones += '<a href="' + telHref(p.phoneOffice) + '">📞 ' + p.phoneOffice + '</a><small>Ofis</small>';
      if (p.phoneMobile) phones += '<a href="' + telHref(p.phoneMobile) + '">📱 ' + p.phoneMobile + '</a><small>Cep</small>';
      var photo = p.photo
        ? '<img src="' + p.photo + '" alt="' + p.name + '" loading="lazy" onerror="this.parentNode.innerHTML=\'<div style=display:flex;align-items:center;justify-content:center;height:100%;font-size:3rem;color:#fff;font-weight:700>' + initials(p.name) + '</div>\'">'
        : '<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:3rem;color:#fff;font-weight:700">' + initials(p.name) + '</div>';
      return '<div class="team-card">' +
        '<div class="team-photo">' + photo + '</div>' +
        '<h3>' + p.name + '</h3>' +
        '<span class="team-role' + (isBroker ? ' broker' : '') + '">' + (p.role || 'Danışman') + '</span>' +
        '<div class="team-phones">' + phones + '</div>' +
        '</div>';
    }).join('');
    if (updated) updated.textContent = updatedAt ? 'Son güncelleme: ' + updatedAt : '';
  }

  function applyPayload(payload) {
    if (!payload || !payload.team) return;
    var sig = signature(payload.team);
    if (sig !== lastSignature) {
      lastSignature = sig;
      renderTeam(payload.team, payload.generatedAt);
    }
  }

  // 1) Sunucu üzerinden (http) taze team.json dene
  function fetchTeam() {
    fetch(TEAM_URL + '?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .then(applyPayload)
      .catch(function () { fallbackPoll(); });
  }

  // 2) Dosyadan açıldığında (file://) gömülü yedek + canlı script tazeleme
  function fallbackPoll() {
    if (window.__TEAM_FALLBACK__) applyPayload(window.__TEAM_FALLBACK__);
    var s = document.createElement('script');
    s.src = 'team-fallback.js?t=' + Date.now();
    s.onload = function () { if (window.__TEAM_FALLBACK__) applyPayload(window.__TEAM_FALLBACK__); s.remove(); };
    s.onerror = function () { s.remove(); };
    document.body.appendChild(s);
  }

  function tick() {
    if (window.ICG_NO_TEAM) return;
    if (window.location.protocol.indexOf('http') === 0) fetchTeam();
    else fallbackPoll();
  }

  // İlk yükleme + periyodik canlı kontrol
  tick();
  setInterval(tick, POLL_MS);

  // Mobil menü
  var btn = document.getElementById('menuBtn');
  var nav = document.getElementById('nav');
  if (btn && nav) {
    btn.addEventListener('click', function () { nav.classList.toggle('open'); });
    nav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { nav.classList.remove('open'); });
    });
  }

  // Header gölgesi
  var header = document.getElementById('header');
  window.addEventListener('scroll', function () {
    if (header) header.classList.toggle('scrolled', window.scrollY > 10);
  });

  // Yıl
  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  // İletişim tercihi butonları -> form konusunu önceden seç
  var prefBtns = document.querySelectorAll('[data-topic]');
  for (var pi = 0; pi < prefBtns.length; pi++) {
    (function (b) {
      b.addEventListener('click', function () {
        var t = document.getElementById('fTopic');
        var want = b.getAttribute('data-topic');
        if (t && want) {
          for (var i = 0; i < t.options.length; i++) {
            if (t.options[i].text === want) { t.selectedIndex = i; break; }
          }
        }
      });
    })(prefBtns[pi]);
  }

  // İletişim formu -> WhatsApp + E-posta (adres: mail icg.txt)
  var CONTACT_EMAIL = 'icgrealestate@gmail.com';
  var form = document.getElementById('contactForm');
  function formData() {
    return {
      name: document.getElementById('fName').value.trim(),
      phone: document.getElementById('fPhone').value.trim(),
      topic: document.getElementById('fTopic').value,
      msg: document.getElementById('fMsg').value.trim()
    };
  }
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var d = formData();
      var text = 'Merhaba, ben ' + d.name + ' (' + d.phone + '). Konu: ' + d.topic + (d.msg ? '. Mesaj: ' + d.msg : '');
      window.open('https://wa.me/905323881072?text=' + encodeURIComponent(text), '_blank');
    });
    var mailBtn = document.getElementById('mailBtn');
    if (mailBtn) {
      mailBtn.addEventListener('click', function () {
        var d = formData();
        var subject = 'Site formu: ' + d.topic;
        var body = 'Ad Soyad: ' + d.name + '\nTelefon: ' + d.phone + '\nKonu: ' + d.topic + (d.msg ? '\nMesaj: ' + d.msg : '');
        window.location.href = 'mailto:' + CONTACT_EMAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
      });
    }
  }
})();
