/* ICG Real Estate — gizli ilan goruntuleme (public site).
   Slug /ilan/gizli/{slug} yolundan okunur. YALNIZCA view-private-listing
   Edge Function cagrilir; Supabase tablolarina dogrudan erisim YOKTUR.
   Donen signed foto URL'leri dogrudan <img> icinde kullanilir. */
var GizliIlan = (function () {
  'use strict';

  var SUPABASE_URL = 'https://wtlzazdntrkqtynwdjdz.supabase.co';
  var ANON_KEY = 'sb_publishable_759h8_BPnELI4x5RNxQesQ_7AlUXQyG';
  var FN_URL = SUPABASE_URL + '/functions/v1/view-private-listing';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function getSlug() {
    var path = window.location.pathname || '';
    var m = /\/ilan\/gizli\/([^\/?#]+)/.exec(path);
    if (m && m[1]) return decodeURIComponent(m[1]);
    var q = /[?&]slug=([^&#]*)/.exec(window.location.search || '');
    return q && q[1] ? decodeURIComponent(q[1]) : '';
  }

  function fmtMoney(amount, currency) {
    if (amount === null || amount === undefined || amount === '') return '—';
    var n = Number(amount);
    if (isNaN(n)) return '—';
    var s = Math.round(n).toLocaleString('tr-TR');
    if (currency === 'USD') return s + ' USD';
    if (currency === 'EUR') return s + ' EUR';
    return s + ' TL';
  }

  var FEATURE_LABELS = {
    net: 'Net', brut: 'Brüt', kat: 'Kat', tapu: 'Tapu', bolum: 'Bölüm',
    kredi: 'Krediye Uygunluk', isitma: 'Isıtma', asansor: 'Asansör',
    otopark: 'Otopark', binaYasi: 'Bina Yaşı', kullanim: 'Kullanım Durumu',
    oda: 'Oda Sayısı', odaSayisi: 'Oda Sayısı', salonSayisi: 'Salon Sayısı',
    banyo: 'Banyo Sayısı', balkon: 'Balkon', esyali: 'Eşyalı / Eşyasız',
    site: 'Site İçerisinde', cephe: 'Cephe', m2: 'm²', arsaM2: 'Arsa m²',
    binaM2: 'Bina m²', havuz: 'Havuz', bahce: 'Bahçe', ada: 'Ada',
    parsel: 'Parsel', imar: 'İmar Durumu', katSayisi: 'Kat Sayısı'
  };

  function setState(html) {
    var host = document.getElementById('gizliDetail');
    if (host) host.innerHTML = html;
  }

  function loading() {
    setState('<div class="container narrow"><p class="muted center">İlan yükleniyor…</p></div>');
  }

  function notFound() {
    setState('<div class="container narrow"><h2 class="center">İlan Bulunamadı</h2><p class="muted center">Bağlantı geçersiz veya ilan artık yayında değil.</p></div>');
  }

  function failed(msg) {
    setState('<div class="container narrow"><h2 class="center">Yükleme Hatası</h2><p class="muted center">' + esc(msg || 'İlan yüklenemedi.') + '</p></div>');
  }

  function render(listing, photos) {
    var loc = [listing.city, listing.district, listing.neighborhood].filter(Boolean).join(' / ');
    var facts = [];
    if (listing.area_m2 !== null && listing.area_m2 !== undefined && listing.area_m2 !== '') {
      facts.push('<p><b>Alan:</b> ' + esc(listing.area_m2) + ' m²</p>');
    }
    if (listing.room_count) {
      facts.push('<p><b>Oda / Salon:</b> ' + esc(listing.room_count) + '</p>');
    }
    if (listing.room_count) {
      facts.push('<p><b>Oda / Salon:</b> ' + esc(listing.room_count) + '</p>');
    }
    var feats = listing.features || {};
    Object.keys(feats).forEach(function (k) {
      var v = feats[k];
      if (typeof v === 'string' && v.trim().length > 0) {
        facts.push('<p><b>' + esc(FEATURE_LABELS[k] || k) + ':</b> ' + esc(v) + '</p>');
      }
    });

    var gallery = '';
    if (photos && photos.length > 0) {
      var thumbs = photos.map(function (p, i) {
        return '<img src="' + esc(p.url) + '" alt="Fotoğraf ' + (i + 1) +
          '" data-ix="' + i + '"' + (i === 0 ? ' class="on"' : '') + '>';
      }).join('');
      gallery =
        '<div class="gallery"><div class="gmain"><img id="gMain" src="' + esc(photos[0].url) +
        '" alt="' + esc(listing.title) + '"></div>' +
        (photos.length > 1 ? '<div class="gthumbs">' + thumbs + '</div>' : '') + '</div>';
    }

    var typeLabel = listing.listing_type === 'kiralik' ? 'Kiralık' : 'Satılık';
    var cat = [listing.property_type, listing.sub_category].filter(Boolean).join(' / ');
    var dues = listing.dues
      ? '<p class="muted">Aidat: ' + esc(listing.dues) + ' ' + esc(listing.dues_currency || 'TL') + '</p>'
      : '';

    setState(
      '<div class="container narrow">' +
        '<span class="eyebrow">Özel İlan</span>' +
        '<h2 class="center">' + esc(listing.title || '—') + '</h2>' +
        '<p class="muted center">' + esc(typeLabel) +
        (cat ? ' • ' + esc(cat) : '') + '</p>' +
        '<p class="gprice">' + esc(fmtMoney(listing.price, listing.currency)) + '</p>' +
        dues +
        gallery +
        '<h3>Konum</h3><p>' + esc(loc || '—') + '</p>' +
        (facts.length ? '<h3>Özellikler</h3><div class="gfacts">' + facts.join('') + '</div>' : '') +
        (listing.description ? '<h3>Açıklama</h3><p>' + esc(listing.description) + '</p>' : '') +
      '</div>'
    );

    var main = document.getElementById('gMain');
    var thumbs = document.querySelectorAll('#gizliDetail .gthumbs img');
    for (var i = 0; i < thumbs.length; i++) {
      thumbs[i].addEventListener('click', function () {
        for (var j = 0; j < thumbs.length; j++) thumbs[j].classList.remove('on');
        this.classList.add('on');
        if (main) main.src = this.src;
      });
    }
    if (document.title) document.title = (listing.title || 'Özel İlan') + ' | ICG Real Estate';
  }

  function boot() {
    if (!document.getElementById('gizliDetail')) return;
    var slug = getSlug();
    if (!slug) { notFound(); return; }
    loading();
    fetch(FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
      body: JSON.stringify({ slug: slug })
    })
      .then(function (res) {
        if (!res.ok) { notFound(); return null; }
        return res.json();
      })
      .then(function (data) {
        if (!data) return;
        if (!data.ok || !data.listing) { notFound(); return; }
        var photos = Array.isArray(data.photos)
          ? data.photos.slice().sort(function (a, b) { return a.sortOrder - b.sortOrder; })
          : [];
        render(data.listing, photos);
      })
      .catch(function () { failed('Bağlantı hatası. Tekrar deneyin.'); });
  }

  return { boot: boot };
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', GizliIlan.boot);
} else {
  GizliIlan.boot();
}
