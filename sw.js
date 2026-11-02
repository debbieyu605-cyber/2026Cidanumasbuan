/* 離線快取：有網路時一律走網路並順手更新快取，沒網路時拿快取的版本。 */
var VER = 'jm-v1';
var CORE = ['./', './index.html', './d3.min.js', './data.json', './manifest.webmanifest', './icon-180.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VER).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== VER; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function key(req) { var u = new URL(req.url); return u.origin + u.pathname; }

function markOffline(res) {
  return res.blob().then(function (b) {
    var h = new Headers(res.headers); h.set('x-jm-offline', '1');
    return new Response(b, { status: 200, headers: h });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        e.waitUntil(caches.open(VER).then(function (c) { return c.put(key(req), copy); }));
      }
      return res;
    }).catch(function () {
      return caches.open(VER).then(function (c) {
        return c.match(key(req)).then(function (hit) {
          if (hit) return markOffline(hit);
          if (req.mode === 'navigate') return c.match('./index.html').then(function (h) { return h ? markOffline(h) : Response.error(); });
          return Response.error();
        });
      });
    })
  );
});
