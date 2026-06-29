// Service Worker do Bolão Central
// Objetivo principal: tornar o site instalável como PWA (requisito do Chrome/Android).
// Faz um cache simples do "shell" do app para abrir mais rápido e funcionar offline básico.

const CACHE_NAME = 'bolao-central-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// Instala e guarda o shell do app em cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // addAll pode falhar se algum asset não existir — usamos Promise.allSettled
      // para não travar a instalação do SW por causa de um ícone faltando, por exemplo.
      return Promise.allSettled(
        ASSETS_TO_CACHE.map((url) => cache.add(url).catch(() => null))
      );
    })
  );
  self.skipWaiting();
});

// Limpa caches antigos quando uma nova versão do SW assume
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Estratégia: network-first para o HTML (sempre tenta buscar versão nova),
// cache-first para os demais assets estáticos.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const isHTML = req.headers.get('accept')?.includes('text/html');

  if (isHTML) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Respostas 206 (parciais, comuns em vídeo/áudio com range request)
          // não podem ser colocadas no Cache API — pulamos o cache nesse caso.
          if (res.status === 206) return res;
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res.status === 206) return res;
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => cached);
    })
  );
});

// Permite que o app force a ativação imediata de uma nova versão do SW
// (útil para o botão "atualizar app" caso você queira adicionar um no futuro).
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
