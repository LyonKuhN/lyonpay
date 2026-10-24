/* Service worker do Lyonk: app instalável, notificações de vencimento e uma tela offline mínima.
   Os dados financeiros nunca vão para o cache: só o "esqueleto" do app (HTML, JS, CSS e ícones). */

const VERSAO = 'lyonk-v1';
const ESQUELETO = ['/', '/manifest.json', '/logo.png', '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ESQUELETO)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(chaves.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // Navegação: rede primeiro; sem internet, abre o app guardado
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then((res) => {
        const copia = res.clone();
        caches.open(VERSAO).then((c) => c.put('/', copia));
        return res;
      }).catch(() => caches.match('/')),
    );
    return;
  }

  // Arquivos com hash no nome (/assets/...) não mudam: cache primeiro
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(req).then((achado) => achado || fetch(req).then((res) => {
        if (res.ok) {
          const copia = res.clone();
          caches.open(VERSAO).then((c) => c.put(req, copia));
        }
        return res;
      })),
    );
  }
});

self.addEventListener('push', (event) => {
  let dados = {};
  try {
    dados = event.data ? event.data.json() : {};
  } catch {
    dados = { corpo: event.data ? event.data.text() : '' };
  }
  const titulo = dados.titulo || 'Lyonk';
  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: dados.corpo || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      tag: dados.tag || undefined,
      renotify: !!dados.tag,
      data: { url: dados.url || '/dashboard' },
      lang: 'pt-BR',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destino = new URL(event.notification.data?.url || '/dashboard', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      // Reaproveita uma janela do app que já esteja aberta
      for (const j of janelas) {
        if (j.url.startsWith(self.location.origin) && 'focus' in j) {
          j.navigate(destino);
          return j.focus();
        }
      }
      return self.clients.openWindow(destino);
    }),
  );
});
