/* ICG Real Estate — Supabase public veri adaptoru (public site).
   public.public_listings view'ini okuyup legacy {id,lines,cover,gallery}
   formatina cevirir; mevcut listings.js motoru aynen calisir.
   Private tabloya erisim YOKTUR (sadece public view + public foto URL). */
var SupabaseListings = (function () {
  'use strict';

  var SUPABASE_URL = 'https://wtlzazdntrkqtynwdjdz.supabase.co';
  var ANON_KEY = 'sb_publishable_759h8_BPnELI4x5RNxQesQ_7AlUXQyG';
  var PHOTO_BASE = SUPABASE_URL + '/storage/v1/object/public/listing-public/';
  var JSON_URL = 'ilanlar.json';
  var REFRESH_MS = 5 * 60 * 1000;

  var FEATURE_LABELS = {
    net: 'm² (Net)', brut: 'm² (Brüt)', m2: 'm²', binaM2: 'Bina m²',
    kat: 'Bulunduğu Kat', toplamKat: 'Kat Sayısı', katSayisi: 'Kat Sayısı',
    binaYasi: 'Bina Yaşı', isitma: 'Isıtma', banyo: 'Banyo Sayısı',
    balkon: 'Balkon', asansor: 'Asansör', otopark: 'Otopark',
    esyali: 'Eşyalı', site: 'Site İçerisinde', kullanim: 'Kullanım Durumu',
    cephe: 'Cephe', tapu: 'Tapu Durumu', kredi: 'Krediye Uygunluk',
    takas: 'Takas', arsaM2: 'Arsa m²', havuz: 'Havuz', bahce: 'Bahçe',
    ada: 'Ada', parsel: 'Parsel', imar: 'İmar Durumu',
    kaks: 'KAKS / Emsal', taks: 'TAKS', gabari: 'Gabari',
    odaSayisi: '', salonSayisi: ''
  };

  function num(n) {
    if (n === null || n === undefined || n === '') return '';
    var v = Number(n);
    return isNaN(v) ? '' : Math.round(v).toLocaleString('tr-TR');
  }

  function cur(c) {
    if (c === 'USD') return 'USD';
    if (c === 'EUR') return 'EUR';
    return 'TL';
  }

  function toLegacy(r) {
    var lines = [];
    var price = num(r.price);
    if (price) lines.push(price + ' ' + cur(r.currency));
    var loc = r.is_foreign
      ? (r.foreign_location || '')
      : [r.city, r.district, r.neighborhood].filter(Boolean).join(' / ');
    if (loc) lines.push(loc);
    if (r.property_type) lines.push('Kategori ' + r.property_type);
    lines.push('Durumu ' + (r.listing_type === 'kiralik' ? 'Kiralık' : 'Satılık'));
    if (r.sub_category) lines.push('Türü ' + r.sub_category);
    if (r.area_m2 !== null && r.area_m2 !== undefined && r.area_m2 !== '') {
      lines.push('m² ' + num(r.area_m2));
    }
    if (r.room_count) lines.push('Oda Sayısı ' + r.room_count);
    var feats = r.features || {};
    Object.keys(feats).forEach(function (k) {
      var v = feats[k];
      if (typeof v !== 'string' || v.trim() === '') return;
      var label = FEATURE_LABELS[k];
      if (label === '') return;
      lines.push((label || k) + ' ' + v.trim());
    });
    if (r.dues) lines.push('Aidat ' + r.dues + ' ' + cur(r.dues_currency));
    if (r.description) lines.push(r.description);
    var photos = Array.isArray(r.photo_paths) ? r.photo_paths : [];
    var urls = photos.filter(Boolean).map(function (p) { return PHOTO_BASE + p; });
    return {
      id: r.id,
      lines: lines,
      cover: urls.length ? urls[0] : '',
      gallery: urls.length > 1 ? urls.slice(1) : []
    };
  }

  function fetchJson(url) {
    return fetch(url + '?t=' + Date.now(), { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('http ' + res.status);
        return res.json();
      })
      .then(function (j) { return (j && j.listings) || []; })
      .catch(function () { return []; });
  }

  // GECICI TANI (kaldirilacak): localhost'ta her zaman gosterilir,
  // prod'da asla gosterilmez. Yonlendirmede query kaybolsa da calisir.
  function diagOn() {
    try {
      var h = window.location.hostname || '';
      return h === 'localhost' || h === '127.0.0.1';
    } catch (e) { return false; }
  }
  function diag(msg) {
    try {
      if (!diagOn()) return;
      var el = document.getElementById('sbdiag-badge');
      if (!el) {
        el = document.createElement('div');
        el.id = 'sbdiag-badge';
        el.style.cssText = 'position:fixed;bottom:8px;left:8px;z-index:9999;background:#14110d;color:#faf9f6;font-size:12px;padding:10px 12px;border-radius:8px;max-width:92vw;white-space:pre-wrap;';
        document.body.appendChild(el);
      }
      el.textContent = 'SB-DIAG ' + new Date().toLocaleTimeString('tr-TR') + '\n' + msg;
    } catch (e) { /* sessiz */ }
  }

  function fetchView() {
    return fetch(SUPABASE_URL + '/rest/v1/public_listings?select=*', {
      headers: { apikey: ANON_KEY, Authorization: 'Bearer ' + ANON_KEY }
    })
      .then(function (res) {
        if (!res.ok) throw new Error('http ' + res.status);
        return res.json();
      })
      .then(function (rows) {
        diag('view OK, satir=' + (Array.isArray(rows) ? rows.length : '?'));
        return (Array.isArray(rows) ? rows : []).map(toLegacy);
      })
      .catch(function (err) {
        diag('view HATA: ' + (err && err.message ? err.message : err));
        return null;
      });
  }

  function merge(dbRows, jsonRows) {
    var seen = {};
    var out = [];
    (dbRows || []).forEach(function (l) { seen[l.id] = true; out.push(l); });
    (jsonRows || []).forEach(function (l) {
      if (!seen[l.id]) out.push(l);
    });
    return out;
  }

  function load() {
    return Promise.all([fetchView(), fetchJson(JSON_URL)]).then(function (parts) {
      var dbRows = parts[0];
      var payload = dbRows === null
        ? { listings: parts[1] }
        : { listings: merge(dbRows, parts[1]) };
      window.__LISTINGS_FALLBACK__ = payload;
      return payload;
    });
  }

  function boot() {
    diag('adapter yuklendi');
    load().then(function (payload) {
      diag('merge tamam, toplam=' + (payload.listings || []).length);
      if (window.ListingsApp) ListingsApp.init({ fetchUrl: '' });
      setInterval(function () {
        load();
      }, REFRESH_MS);
    });
  }

  return { boot: boot };
})();
