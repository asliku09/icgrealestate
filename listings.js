/* ICG Real Estate — ilan motoru (anasayfa satirlari + tum ilanlar + ilan detayi) */
var ListingsApp = (function () {
  'use strict';

  var CATS = [
    { key: 'ticari', name: 'Ticari Gayrimenkul', img: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=800&auto=format&fit=crop', alt: 'Ticari bina' },
    { key: 'konut', name: 'Konut', img: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=800&auto=format&fit=crop', alt: 'Konut' },
    { key: 'arsa', name: 'Arsa', img: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=800&auto=format&fit=crop', alt: 'Arsa' }
  ];

  /* Bilinen bilgi basliklari (en uzundan en kisaya) */
  var LABELS = [
    'Bölüm & Oda Sayısı', 'Enerji Kimlik Belgesi', 'Krediye Uygunluk',
    'Krediye Uygun', 'Bulunduğu Kat', 'Site İçerisinde', 'Kullanım Durumu',
    'Yapının Durumu', 'Zemin Etüdü', 'Emlak Tipi', 'Oda Sayısı',
    'Banyo Sayısı', 'Depozito (TL)', 'Aidat (TL)', 'Tapu Durumu',
    'Kat Sayısı', 'Bina Yaşı', 'Bina Tipi', 'Açık Alan m²', 'Açık Alan m2',
    'Toplam m2', 'Toplam m²', 'm² (Brüt)', 'm² (Net)', 'Site Adı',
    'İlan Tarihi', 'İlan Tarih', 'İlan No', 'Kategori', 'Durumu', 'Kimden',
    'Türü', 'Türü'.slice(0, 3), 'Isıtma', 'Asansör', 'Mutfak', 'Balkon',
    'Otopark', 'Eşyalı', 'Takas', 'm²', 'm2'
  ];

  /* Asla gosterilmeyecek basliklar: tarih, kod/numara, referans */
  var BANNED = /(tarih|kod|referans|\bno\b|numara)/;
  /* Basligi ayristirilamayan satirlardaki gizli meta veriler (or. "İlan No 123") */
  var META_LINE = /(ilan\s*(no|numara|tarih|kod))|((tarih|kod|referans)\s*[:\d])/;

  function splitListing(l) {
    var lines = l.lines || [];
    var price = lines.length ? lines[0] : '';
    var loc = '', locIx = -1, i;
    for (i = 1; i < lines.length && i <= 4; i++) {
      if (lines[i].indexOf('/') !== -1) { loc = lines[i]; locIx = i; break; }
    }
    if (locIx === -1 && lines.length > 1) { loc = lines[1]; locIx = 1; }
    var facts = [];
    for (i = 0; i < lines.length; i++) {
      if (i !== 0 && i !== locIx) facts.push(lines[i]);
    }
    return { id: l.id, price: price, location: loc, facts: facts, cover: l.cover, gallery: l.gallery };
  }

  function NL(l) {
    if (!l._n) l._n = splitListing(l);
    return l._n;
  }

  var cfg = { fetchUrl: 'ilanlar.json', fallbackUrl: 'ilanlar-fallback.js', pollMs: 30000 };
  var pages = { detail: 'ilan-detay.html', list: 'ilanlar.html', home: 'index.html' };
  var data = null;
  var lastSig = '';

  function trLow(s) { return (s || '').toLocaleLowerCase('tr-TR'); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function parseFact(line) {
    var l = trLow(line);
    for (var i = 0; i < LABELS.length; i++) {
      var lab = LABELS[i];
      if (l.indexOf(trLow(lab)) === 0) {
        var v = line.slice(lab.length).replace(/^[\s:–-]+/, '');
        if (v) return { k: lab, v: v };
      }
    }
    return { k: '', v: line };
  }

  /* "Belirtilmemiş" yazan hiçbir özelliği gösterme */
  function isUnspecified(s) {
    var t = trLow(s || '');
    return t.indexOf('belirtilmemi') !== -1;
  }

  function parsedFacts(listing) {
    return (listing.facts || []).map(parseFact).filter(function (f) {
      if (!f.v) return false;
      if (isUnspecified(f.v)) return false;
      if (f.k) {
        if (isUnspecified(f.k)) return false;
        return !BANNED.test(trLow(f.k));
      }
      return !META_LINE.test(trLow(f.v));
    });
  }

  function fieldVal(listing, names) {
    var facts = parsedFacts(listing);
    var nl = names.map(trLow);
    for (var i = 0; i < facts.length; i++) {
      if (facts[i].k && nl.indexOf(trLow(facts[i].k)) !== -1) return facts[i].v;
    }
    return '';
  }

  function hasAny(hay, needles) {
    var h = trLow(hay);
    for (var i = 0; i < needles.length; i++) {
      if (h.indexOf(needles[i]) !== -1) return true;
    }
    return false;
  }

  var ALIAS = {
    ticari: ['ticari', 'iş yeri', 'isyeri', 'is yeri', 'dükkan', 'dukkan', 'mağaza', 'magaza', 'komple bina', 'bina', 'ofis', 'plaza', 'depo', 'fabrika', 'otel', 'pansiyon', 'hostel', 'motel'],
    konut: ['daire', 'konut', 'villa', 'rezidans', 'apartman dairesi'],
    arsa: ['arsa', 'tarla', 'bahçe', 'bahce']
  };

  function categoryOf(listing) {
    var explicit = [
      fieldVal(listing, ['Kategori']),
      fieldVal(listing, ['Türü', 'Tür']),
      fieldVal(listing, ['Emlak Tipi', 'Tip'])
    ].join(' | ');
    var keys = ['ticari', 'konut', 'arsa'];
    var i, k;
    for (i = 0; i < keys.length; i++) {
      k = keys[i];
      if (explicit && hasAny(explicit, ALIAS[k])) return k;
    }
    var all = (listing.facts || []).join(' | ') + ' | ' + (listing.location || '');
    for (i = 0; i < keys.length; i++) {
      k = keys[i];
      if (hasAny(all, ALIAS[k])) return k;
    }
    return 'ticari';
  }

  function statusOf(listing) {
    var d = fieldVal(listing, ['Durumu']);
    if (d) return d;
    var t = fieldVal(listing, ['Emlak Tipi', 'Tip']);
    if (/kiralık/i.test(t)) return 'Kiralık';
    if (/satılık/i.test(t)) return 'Satılık';
    return '';
  }

  function titleOf(listing) {
    var tur = fieldVal(listing, ['Türü', 'Tür']) || fieldVal(listing, ['Emlak Tipi', 'Tip']) || fieldVal(listing, ['Kategori']);
    var durum = fieldVal(listing, ['Durumu']);
    if (tur) {
      if (durum && trLow(tur).indexOf(trLow(durum)) !== 0) return durum + ' ' + tur;
      return tur;
    }
    if (listing.location) return listing.location;
    var m = /ilan\s*0*(\d+)/i.exec(listing.id || '');
    if (m) return 'İlan ' + m[1];
    return listing.id || 'İlan';
  }

  function catOf(key) {
    for (var i = 0; i < CATS.length; i++) if (CATS[i].key === key) return CATS[i];
    return CATS[0];
  }

  function detailUrl(id) { return pages.detail + '?id=' + encodeURIComponent(id); }
  function listUrl(cat) { return pages.list + (cat ? '?kategori=' + encodeURIComponent(cat) : ''); }

  function cardHtml(l) {
    var cat = catOf(categoryOf(l));
    var cover = l.cover || cat.img;
    var status = statusOf(l);
    var title = titleOf(l);
    return '<a class="lcard" href="' + detailUrl(l.id) + '">' +
      '<span class="lphoto"><img src="' + esc(cover) + '" alt="' + esc(title) + '" loading="lazy" onerror="this.style.display=\'none\'">' +
      (status ? '<span class="lbadge">' + esc(status) + '</span>' : '') + '</span>' +
      '<span class="lbody">' +
      (l.price ? '<strong class="lprice">' + esc(l.price) + '</strong>' : '') +
      '<span class="ltitle">' + esc(title) + '</span>' +
      (l.location ? '<small class="lloc">' + esc(l.location) + '</small>' : '') +
      '</span></a>';
  }

  function signature(d) {
    return JSON.stringify((d.listings || []).map(function (l) {
      return [l.id, (l.lines || []).join('|'), l.cover, (l.gallery || []).join('|')];
    }));
  }

  function getQuery(name) {
    var m = new RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search || '');
    return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : '';
  }

  /* Bilgisi duzgun cekilemeyen ilanlari gizle: fiyati da ozellik satiri da yoksa gosterme */
  function validListings() {
    var all = (data && data.listings) ? data.listings : [];
    var out = [];
    for (var i = 0; i < all.length; i++) {
      var n = NL(all[i]);
      var hasPrice = n.price && String(n.price).trim() !== '';
      var hasFacts = (n.facts || []).length > 0;
      if (hasPrice || hasFacts) out.push(n);
    }
    return out;
  }

  /* Kayan satirlar: surekli ping-pong kayma; dokununca durur, birakinca devam eder */
  var SCROLL_SPEED = 135;
  function stopAutoScroll() {
    var rows = document.querySelectorAll('#faaliyetRows .lrow');
    for (var i = 0; i < rows.length; i++) {
      if (rows[i]._raf) { cancelAnimationFrame(rows[i]._raf); rows[i]._raf = null; }
    }
  }

  function setupAutoScroll() {
    stopAutoScroll();
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    /* Mobil / dokunmatik cihazlarda otomatik kaymayı kapat: tap ile ilan detayına giriş engellenmesin, kullanıcı parmağıyla kaydırsın */
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return;
    var rows = document.querySelectorAll('#faaliyetRows .lrow');
    for (var i = 0; i < rows.length; i++) { animateRow(rows[i]); }
  }

  function animateRow(row) {
    if (!row || row.scrollWidth <= row.clientWidth + 20) return;
    var st = { dir: 1, hold: false, last: null, timer: null };
    row._st = st;
    function pause(ms) {
      st.hold = true;
      if (st.timer) clearTimeout(st.timer);
      st.timer = setTimeout(function () { st.hold = false; st.last = null; }, ms);
    }
    row.addEventListener('pointerdown', function () {
      st.hold = true;
      if (st.timer) { clearTimeout(st.timer); st.timer = null; }
    });
    row.addEventListener('touchstart', function () {
      st.hold = true;
      if (st.timer) { clearTimeout(st.timer); st.timer = null; }
    }, { passive: true });
    row.addEventListener('pointerup', function () { pause(900); });
    row.addEventListener('touchend', function () { pause(900); });
    row.addEventListener('pointercancel', function () { pause(900); });
    row.addEventListener('wheel', function () { pause(2500); }, { passive: true });
    function step(ts) {
      if (!document.body.contains(row)) return;
      if (st.last === null) st.last = ts;
      var dt = Math.min(ts - st.last, 60);
      st.last = ts;
      if (!st.hold) {
        row.scrollLeft += st.dir * SCROLL_SPEED * dt / 1000;
        var max = row.scrollWidth - row.clientWidth;
        if (row.scrollLeft >= max - 1) { row.scrollLeft = max; st.dir = -1; }
        else if (row.scrollLeft <= 1) { row.scrollLeft = 0; st.dir = 1; }
      } else { st.last = null; }
      row._raf = requestAnimationFrame(step);
    }
    row._raf = requestAnimationFrame(step);
  }

  /* --- Anasayfa: kategori satirlari --- */
  function renderHome() {
    var host = document.getElementById('faaliyetRows');
    if (!host || !data) return;
    var items = validListings();
    host.innerHTML = CATS.map(function (c) {
      var mine = items.filter(function (l) { return categoryOf(l) === c.key; });
      var body;
      if (mine.length) {
        body = '<div class="lrow">' + mine.map(cardHtml).join('') + '</div>';
      } else {
        body = '<div class="lrow"><span class="lcard lcard-static"><span class="lphoto"><img src="' + c.img + '" alt="' + esc(c.alt) + '" loading="lazy" onerror="this.style.display=\'none\'"><span class="lbadge">' + esc(c.name) + '</span></span></span></div>';
      }
      var count = mine.length ? ' <span class="fcount">• ' + mine.length + ' ilan</span>' : '';
      return '<div class="fcat"><div class="fcat-head"><h3>' + esc(c.name) + '</h3>' + count + '</div>' +
        body +
        '<a class="gold-link" href="' + listUrl(c.key) + '">Tümünü Gör <span>→</span></a></div>';
    }).join('');
    setupAutoScroll();
  }

  /* --- Tum ilanlar sayfasi --- */
  var activeCat = '';
  var activeStatus = '';
  function renderGrid() {
    var host = document.getElementById('allListings');
    if (!host || !data) return;
    var items = validListings();
    if (!activeCat) activeCat = getQuery('kategori');
    if (!activeStatus) {
      var qd = getQuery('durum');
      if (qd === 'Satılık' || qd === 'Kiralık') activeStatus = qd;
    }
    var counts = { '': items.length };
    CATS.forEach(function (c) {
      counts[c.key] = items.filter(function (l) { return categoryOf(l) === c.key; }).length;
    });
    var btns = document.getElementById('catFilter');
    if (btns) {
      var html = '<button data-cat="" class="' + (activeCat === '' ? 'on' : '') + '">Tümü (' + counts[''] + ')</button>';
      html += CATS.map(function (c) {
        return '<button data-cat="' + c.key + '" class="' + (activeCat === c.key ? 'on' : '') + '">' + esc(c.name) + ' (' + counts[c.key] + ')</button>';
      }).join('');
      btns.innerHTML = html;
      var arr = btns.querySelectorAll('button');
      for (var i = 0; i < arr.length; i++) {
        arr[i].addEventListener('click', function () {
          activeCat = this.getAttribute('data-cat');
          renderGrid();
        });
      }
    }
    var base = activeCat ? items.filter(function (l) { return categoryOf(l) === activeCat; }) : items;
    var nSat = base.filter(function (l) { return statusOf(l) === 'Satılık'; }).length;
    var nKir = base.filter(function (l) { return statusOf(l) === 'Kiralık'; }).length;
    var sbtns = document.getElementById('statusFilter');
    if (sbtns) {
      sbtns.innerHTML =
        '<button data-st="" class="' + (activeStatus === '' ? 'on' : '') + '">Tümü (' + base.length + ')</button>' +
        '<button data-st="Satılık" class="' + (activeStatus === 'Satılık' ? 'on' : '') + '">Satılık (' + nSat + ')</button>' +
        '<button data-st="Kiralık" class="' + (activeStatus === 'Kiralık' ? 'on' : '') + '">Kiralık (' + nKir + ')</button>';
      var sarr = sbtns.querySelectorAll('button');
      for (var j = 0; j < sarr.length; j++) {
        sarr[j].addEventListener('click', function () {
          activeStatus = this.getAttribute('data-st');
          renderGrid();
        });
      }
    }
    var shown = base.filter(function (l) { return activeStatus === '' || statusOf(l) === activeStatus; });
    host.innerHTML = shown.length
      ? shown.map(cardHtml).join('')
      : '<p class="empty-note">Bu seçimde ilan bulunmuyor. Dilerseniz size özel portföy araştırması yapalım — <a href="' + pages.home + '#iletisim">bize ulaşın</a>.</p>';
  }

  /* --- Ilan detay sayfasi --- */
  function renderDetail() {
    var host = document.getElementById('listingDetail');
    if (!host || !data) return;
    var id = getQuery('id');
    var items = validListings();
    var l = null;
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === id) { l = items[i]; break; }
    }
    if (!l) {
      host.innerHTML = '<p class="empty-note">İlan bulunamadı. <a href="' + pages.list + '">Tüm ilanlara dönün</a>.</p>';
      return;
    }
    var cat = catOf(categoryOf(l));
    var title = titleOf(l);
    var status = statusOf(l);
    document.title = title + ' | ICG Real Estate';
    var photos = [];
    if (l.cover) photos.push(l.cover);
    (l.gallery || []).forEach(function (g) { if (photos.indexOf(g) === -1) photos.push(g); });
    if (!photos.length) photos.push(cat.img);
    var facts = parsedFacts(l);
    var rows = facts.map(function (f) {
      if (!f.k) return '<tr class="fnote"><td colspan="2">' + esc(f.v) + '</td></tr>';
      return '<tr><td>' + esc(f.k) + '</td><td>' + esc(f.v) + '</td></tr>';
    }).join('');
    var m2 = fieldVal(l, ['m² (Net)']) || fieldVal(l, ['m² (Brüt)']) || fieldVal(l, ['m²', 'm2']) || fieldVal(l, ['Toplam m2', 'Toplam m²']);
    var oda = fieldVal(l, ['Oda Sayısı']) || fieldVal(l, ['Bölüm & Oda Sayısı']);
    var waLines = ['Merhaba, "' + title + '" ilanınız hakkında bilgi almak istiyorum.'];
    if (l.price) waLines.push('Fiyat: ' + l.price);
    if (status) waLines.push('Durumu: ' + status);
    waLines.push('Kategori: ' + cat.name);
    if (m2) waLines.push('m²: ' + m2);
    if (oda) waLines.push('Oda Sayısı: ' + oda);
    if (l.location) waLines.push('Adres: ' + l.location);
    var waText = waLines.join('\n');
    host.innerHTML =
      '<p class="crumbs"><a href="' + pages.home + '">Anasayfa</a> / <a href="' + pages.list + '">İlanlar</a> / <span>' + esc(title) + '</span></p>' +
      '<div class="detail-grid">' +
      '<div class="gallery"><div class="gmain"><img id="gMain" src="' + esc(photos[0]) + '" alt="' + esc(title) + '" onerror="this.style.display=\'none\'"></div>' +
      (photos.length > 1 ? '<div class="gthumbs">' + photos.map(function (p, ix) {
        return '<img src="' + esc(p) + '" alt="' + esc(title) + ' ' + (ix + 1) + '" class="' + (ix === 0 ? 'on' : '') + '" data-src="' + esc(p) + '" loading="lazy" onerror="this.style.display=\'none\'">';
      }).join('') + '</div>' : '') + '</div>' +
      '<div class="dinfo">' +
      '<span class="dbadges">' + esc(cat.name) + (status ? ' • ' + esc(status) : '') + '</span>' +
      '<h1>' + esc(title) + '</h1>' +
      (l.price ? '<p class="dprice">' + esc(l.price) + '</p>' : '') +
      (l.location ? '<p class="dloc">' + esc(l.location) + '</p>' : '') +
      (rows ? '<table class="specs">' + rows + '</table>' : '<p class="muted">Bu ilan için henüz detay girilmedi.</p>') +
      '<div class="contact-btns">' +
      '<a class="btn btn-gold" href="tel:+902122441314">0212 244 13 14</a>' +
      '<a class="btn btn-outline-dark" target="_blank" rel="noopener" href="https://wa.me/905323881072?text=' + encodeURIComponent(waText) + '">WhatsApp ile Sorun</a>' +
      '</div></div></div>';
    var main = document.getElementById('gMain');
    var thumbs = host.querySelectorAll('.gthumbs img');
    for (var t = 0; t < thumbs.length; t++) {
      thumbs[t].addEventListener('click', function () {
        if (main) { main.src = this.getAttribute('data-src'); main.style.display = ''; }
        for (var j = 0; j < thumbs.length; j++) thumbs[j].classList.remove('on');
        this.classList.add('on');
      });
    }
  }

  function renderAll() {
    renderHome();
    renderGrid();
    renderDetail();
  }

  function applyPayload(payload) {
    if (!payload || !payload.listings) return;
    var sig = signature(payload);
    if (sig === lastSig && data) return; /* degisen yoksa dokunma (kaydirma konumu korunur) */
    lastSig = sig;
    data = payload;
    renderAll();
  }

  function fetchData() {
    if (!cfg.fetchUrl) {
      if (window.__LISTINGS_FALLBACK__) applyPayload(window.__LISTINGS_FALLBACK__);
      return;
    }
    fetch(cfg.fetchUrl + '?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .then(applyPayload)
      .catch(function () { fallbackPoll(); });
  }

  function fallbackPoll() {
    if (window.__LISTINGS_FALLBACK__) applyPayload(window.__LISTINGS_FALLBACK__);
    if (!cfg.fallbackUrl) return;
    var s = document.createElement('script');
    s.src = cfg.fallbackUrl + '?t=' + Date.now();
    s.onload = function () { if (window.__LISTINGS_FALLBACK__) applyPayload(window.__LISTINGS_FALLBACK__); s.remove(); };
    s.onerror = function () { s.remove(); };
    document.body.appendChild(s);
  }

  function tick() {
    if (!cfg.fetchUrl) {
      if (window.__LISTINGS_FALLBACK__) applyPayload(window.__LISTINGS_FALLBACK__);
      return;
    }
    if (window.location.protocol.indexOf('http') === 0) fetchData();
    else fallbackPoll();
  }

  return {
    init: function (options) {
      options = options || {};
      if (options.fetchUrl !== undefined) cfg.fetchUrl = options.fetchUrl;
      if (options.fallbackUrl !== undefined) cfg.fallbackUrl = options.fallbackUrl;
      if (options.pollMs) cfg.pollMs = options.pollMs;
      if (window.ICG_PAGES) {
        if (window.ICG_PAGES.detail) pages.detail = window.ICG_PAGES.detail;
        if (window.ICG_PAGES.list) pages.list = window.ICG_PAGES.list;
        if (window.ICG_PAGES.home) pages.home = window.ICG_PAGES.home;
      }
      tick();
      setInterval(tick, cfg.pollMs);
    },
    CATS: CATS
  };
})();
