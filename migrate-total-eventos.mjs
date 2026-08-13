/**
 * Migração retroativa: preenche `totalEventos` em usuarios/{docId} contando
 * quantos registros (participações em eventos) cada membro já tem em registros/.
 *
 * Usa a mesma lógica de fallback de uid + authUid do app (findMembro/resolveDocId):
 * um registro pode ter `membroId` = docId do usuário OU = Auth UID (campo `uid`
 * do doc), então cada registro é contado para o docId canônico do membro.
 *
 * Rodar UMA VEZ (correção retroativa). Depois disso, o app mantém totalEventos
 * incrementalmente a cada lançamento/exclusão.
 *
 * Como rodar:
 *   1. Firebase Console → Configurações do projeto → Contas de serviço
 *      → "Gerar nova chave privada" → salvar como serviceAccount.json nesta pasta
 *   2. node migrate-total-eventos.mjs
 *      ou: node migrate-total-eventos.mjs --dry-run   (só lista, não altera)
 */

import { readFileSync } from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const admin = require("firebase-admin");

const DRY_RUN = process.argv.includes("--dry-run");

const SA_PATH = "./serviceAccount.json";

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(SA_PATH, "utf8"));
} catch {
  console.error(
    "❌  Arquivo serviceAccount.json não encontrado.\n" +
    "    Baixe em: Firebase Console → Configurações → Contas de serviço\n" +
    "    → Gerar nova chave privada → salvar como serviceAccount.json aqui."
  );
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "mutantes-mc",
});

const db = admin.firestore();

async function migrar() {
  console.log(DRY_RUN ? "🔍  DRY RUN — nada será alterado\n" : "⚠️  MODO REAL — totalEventos será atualizado em usuarios\n");
  console.log("🔍  Lendo coleção usuarios...\n");

  const usuariosSnap = await db.collection("usuarios").get();
  const membros = usuariosSnap.docs
    .filter((d) => !d.data().isAdmin)
    .map((d) => ({ docId: d.id, ...d.data(), authUid: d.data().uid || d.id }));

  // Mapa: qualquer id conhecido do membro (docId ou authUid) -> docId canônico
  const idParaDocId = new Map();
  membros.forEach((m) => {
    idParaDocId.set(m.docId, m.docId);
    idParaDocId.set(m.authUid, m.docId);
  });

  console.log(`   Membros (sem admin): ${membros.length}\n`);
  console.log("🔍  Lendo coleção registros...\n");

  const regsSnap = await db.collection("registros").get();
  console.log(`   Total de registros: ${regsSnap.docs.length}\n`);

  const contagens = new Map(); // docId canônico -> contagem
  let semMembro = 0;

  regsSnap.docs.forEach((d) => {
    const membroId = d.data().membroId;
    const docId = membroId && idParaDocId.get(membroId);
    if (!docId) { semMembro++; return; }
    contagens.set(docId, (contagens.get(docId) || 0) + 1);
  });

  if (semMembro > 0) {
    console.log(`⚠️  ${semMembro} registro(s) com membroId não encontrado em usuarios (ignorados).\n`);
  }

  // Garante que membros sem nenhum registro também recebam totalEventos:0
  membros.forEach((m) => {
    if (!contagens.has(m.docId)) contagens.set(m.docId, 0);
  });

  const resultado = [...contagens.entries()]
    .map(([docId, total]) => ({ docId, total, apelido: membros.find((m) => m.docId === docId)?.apelido || docId }))
    .sort((a, b) => b.total - a.total);

  console.log("📋  Resumo por membro:\n");
  resultado.forEach((r) => {
    console.log(`   ${String(r.apelido).padEnd(22)}  totalEventos=${r.total}`);
  });

  if (DRY_RUN) {
    console.log(`\n🔍  DRY RUN concluído — ${resultado.length} membro(s) seriam atualizados. Rode sem --dry-run para aplicar.`);
    process.exit(0);
  }

  console.log(`\n💾  Gravando totalEventos de ${resultado.length} membro(s) via batch write...`);

  // Firestore batch suporta até 500 operações por batch
  const BATCH_SIZE = 400;
  let total = 0;
  for (let i = 0; i < resultado.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = resultado.slice(i, i + BATCH_SIZE);
    chunk.forEach((r) => {
      batch.set(db.collection("usuarios").doc(r.docId), { totalEventos: r.total }, { merge: true });
    });
    await batch.commit();
    total += chunk.length;
    console.log(`   ${total}/${resultado.length} membros atualizados`);
  }

  console.log(`\n✅  Concluído — totalEventos atualizado para ${total} membro(s).`);
  process.exit(0);
}

migrar().catch((e) => {
  console.error("Erro fatal:", e);
  process.exit(1);
});
