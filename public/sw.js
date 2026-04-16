// Service Worker — Balqarn Dashboard
// تحديث رقم النسخة لإجبار المتصفحات على تحميل الجديد
const CACHE_VERSION = 'v2';
const CACHE_NAME = 'balqarn-' + CACHE_VERSION;

// الأصول الأساسية المحلية (نُحمّلها مسبقاً)
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/BB.png',
  '/BB2.png',
  '/BBD1.png',
  '/Saudi_Riyal_Symbol.svg',
  '/assets/ornaments/arda.png',
  '/assets/ornaments/bayt.png',
  '/assets/ornaments/jabal.png',
  '/assets/ornaments/qit.png',
  '/assets/ornaments/sanbala.png',
  '/assets/ornaments/shajara.png',
  '/assets/ornaments/takatuf.png',
  '/assets/ornaments/tawq.png',
  '/assets/ornaments/footer_bar.png',
  '/assets/ornaments/developer_sig.png'
];

// التثبيت: حمّل الأصول مسبقاً
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS).catch(e => console.warn('precache partial', e)))
      .then(() => self.skipWaiting())
  );
});

// التفعيل: احذف النسخ القديمة من الكاش
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME && k.startsWith('balqarn-')).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// استراتيجية: cache-first للأصول الثابتة، network-only لـ Firestore/Auth
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // لا نتدخل في طلبات غير GET
  if (req.method !== 'GET') return;

  // Firebase/Firestore/Google — دائماً من الشبكة (لا كاش)
  if (
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('firebaseapp.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('google.com')
  ) {
    return; // دع المتصفح يتولى
  }

  // fonts.googleapis — stale-while-revalidate
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(req).then(cached => {
        const fetched = fetch(req).then(resp => {
          if (resp && resp.status === 200) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, clone));
          }
          return resp;
        }).catch(() => cached);
        return cached || fetched;
      })
    );
    return;
  }

  // CDN خارجية (sheetjs) — network-first مع fallback للكاش
  if (url.hostname.includes('cdn.sheetjs.com')) {
    event.respondWith(
      fetch(req).then(resp => {
        if (resp && resp.status === 200) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone));
        }
        return resp;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // الأصول المحلية — cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) {
          // في الخلفية، حدّث الكاش لو الشبكة متوفرة
          fetch(req).then(resp => {
            if (resp && resp.status === 200) {
              const clone = resp.clone();
              caches.open(CACHE_NAME).then(c => c.put(req, clone));
            }
          }).catch(() => {});
          return cached;
        }
        return fetch(req).then(resp => {
          if (resp && resp.status === 200 && resp.type === 'basic') {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, clone));
          }
          return resp;
        }).catch(() => {
          // fallback لـ index.html للـ SPA routes
          if (req.mode === 'navigate') return caches.match('/index.html');
        });
      })
    );
  }
});

// استجابة لرسالة تحديث فوري من التطبيق
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
