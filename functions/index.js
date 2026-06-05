const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getMessaging } = require("firebase-admin/messaging");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp();

// Dispara FCM quando um documento é criado em notificacoes_push.
// O app cliente grava {titulo, corpo, tokens[], criadoEm} nessa coleção;
// esta função consome o documento e envia o push via Firebase Admin SDK.
exports.enviarPushNotificacao = onDocumentCreated(
  "notificacoes_push/{docId}",
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const { tokens, titulo, corpo } = data;
    if (!tokens || tokens.length === 0) return;

    const messaging = getMessaging();
    const db = getFirestore();

    const INVALID_CODES = [
      "messaging/invalid-registration-token",
      "messaging/registration-token-not-registered",
    ];

    // sendEachForMulticast aceita até 500 tokens por chamada
    const CHUNK = 500;
    const invalidTokens = [];

    for (let i = 0; i < tokens.length; i += CHUNK) {
      const chunk = tokens.slice(i, i + CHUNK);
      let response;
      try {
        response = await messaging.sendEachForMulticast({
          tokens: chunk,
          notification: {
            title: titulo || "",
            body: corpo || "",
          },
        });
      } catch (e) {
        console.error("[FCM] Erro no sendEachForMulticast:", e);
        continue;
      }

      response.responses.forEach((resp, idx) => {
        if (!resp.success && INVALID_CODES.includes(resp.error?.code)) {
          invalidTokens.push(chunk[idx]);
        }
      });

      console.log(
        `[FCM] chunk ${i / CHUNK + 1}: ` +
        `${response.successCount} enviados, ` +
        `${response.failureCount} falhas`
      );
    }

    // Limpar tokens inválidos de usuarios/
    if (invalidTokens.length > 0) {
      console.log(`[FCM] Removendo ${invalidTokens.length} token(s) inválido(s)`);
      const snap = await db.collection("usuarios").get();
      const batch = db.batch();
      snap.docs.forEach((doc) => {
        if (invalidTokens.includes(doc.data().fcmToken)) {
          batch.update(doc.ref, {
            fcmToken: FieldValue.delete(),
            fcmUpdatedAt: FieldValue.delete(),
          });
        }
      });
      await batch.commit();
    }
  }
);
