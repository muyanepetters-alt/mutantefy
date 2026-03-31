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

// Notificações recebidas com o app em background / fechado
messaging.onBackgroundMessage(payload => {
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
  e.notification.close();
  e.waitUntil(clients.openWindow(self.registration.scope));
});
