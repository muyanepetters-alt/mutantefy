// v31
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:"AIzaSyDtquDfDzLnxOSzD2rd-nxH8AEKWqITT2U",
  authDomain:"mutantes-mc.firebaseapp.com",
  projectId:"mutantes-mc",
  storageBucket:"mutantes-mc.firebasestorage.app",
  messagingSenderId:"696991823272",
  appId:"1:696991823272:web:174f19e5178c495e2a999d"
});

const messaging = firebase.messaging();

console.log('[SW] Mutantes MC — service worker carregado (v10)');

// Ativa o novo SW imediatamente, sem esperar o tab fechar
self.addEventListener('install', e => {
  console.log('[SW] install event — skipWaiting');
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  console.log('[SW] activate event — clients.claim');
  e.waitUntil(clients.claim());
});

// Notificações recebidas com o app em background / fechado
messaging.onBackgroundMessage(payload => {
  console.log('[SW] onBackgroundMessage recebido:', JSON.stringify(payload).slice(0, 120));
  const { title, body } = payload.notification || {};
  const iconUrl = payload.data?.icon || self.registration.scope + 'icon-192.png';
  self.registration.showNotification(title || 'Mutantes MC', {
    body: body || '',
    icon: iconUrl,
    badge: iconUrl,
    vibrate: [200, 100, 200],
    data: payload.data || {},
    actions: payload.data?.url ? [{action:'abrir', title:'Abrir app'}] : []
  });
});

// Clique na notificação abre o app
self.addEventListener('notificationclick', e => {
  console.log('[SW] notificationclick — abrindo app');
  e.notification.close();
  e.waitUntil(clients.openWindow(self.registration.scope));
});

// Obrigatório para critérios de instalabilidade PWA no Chrome
self.addEventListener('fetch', e => {});
