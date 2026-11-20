// Tests de seguridad de firestore.rules contra el emulador (puerto 8089).
// Uso: npx firebase-tools emulators:exec --config firebase.test.json --only firestore \
//        --project demo-fluxi "node tests/firestore.rules.test.mjs"
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing"
import { readFileSync } from "fs"
import { doc, setDoc, addDoc, updateDoc, collection, deleteField, serverTimestamp, deleteDoc, getDoc } from "firebase/firestore"

const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8")
const env = await initializeTestEnvironment({ projectId: "demo-fluxi", firestore: { rules, host: "127.0.0.1", port: 8089 } })
const u = env.authenticatedContext("u1").firestore(), o = env.authenticatedContext("u2").firestore()
const ok = { userId: "u1", amount: 12.5, concept: "Lidl", category: "c1", date: "2026-11-20", createdAt: serverTimestamp() }

let failures = 0
const t = async (name, p) => {
  try { await p; console.log("OK  ", name) }
  catch (e) { failures++; console.log("FAIL", name, e.message?.slice(0, 80)) }
}

// --- Expenses ---
await t("crear gasto válido", assertSucceeds(addDoc(collection(u, "expenses"), ok)))
await t("crear con concepto enorme", assertFails(addDoc(collection(u, "expenses"), { ...ok, concept: "x".repeat(5000) })))
await t("crear con campo extra", assertFails(addDoc(collection(u, "expenses"), { ...ok, hack: 1 })))
await t("crear para otro", assertFails(addDoc(collection(u, "expenses"), { ...ok, userId: "u2" })))
await t("crear fecha mala", assertFails(addDoc(collection(u, "expenses"), { ...ok, date: "ayer" })))

await env.withSecurityRulesDisabled(async c => {
  await setDoc(doc(c.firestore(), "expenses/legacy"), { userId: "u1", amount: 5, concept: "Viejo", category: "Ocio", date: "2025-01-01", source: "csv" })
})
await t("editar gasto antiguo con campo extra", assertSucceeds(updateDoc(doc(u, "expenses/legacy"), { amount: 6, concept: "Viejo2", category: "c1", date: "2025-01-02" })))
await t("reasignar categoría", assertSucceeds(updateDoc(doc(u, "expenses/legacy"), { category: "c2" })))
await t("cambiar dueño", assertFails(updateDoc(doc(u, "expenses/legacy"), { userId: "u2" })))
await t("otro lee", assertFails(getDoc(doc(o, "expenses/legacy"))))
await t("borrar propio", assertSucceeds(deleteDoc(doc(u, "expenses/legacy"))))

// --- Budgets ---
const b = doc(u, "budgets/u1")
await t("seed budget", assertSucceeds(setDoc(b, { userId: "u1", categories: [{ id: "a", name: "Ocio", pct: 10, savings: false }], income: { "2026-11": 1800 } }, { merge: true })))
await t("setIncome", assertSucceeds(setDoc(b, { userId: "u1", income: { "2026-10": 1700 } }, { merge: true })))
await t("borrar income mes", assertSucceeds(setDoc(b, { userId: "u1", income: { "2026-10": deleteField() } }, { merge: true })))
await t("fijos", assertSucceeds(setDoc(b, { userId: "u1", fixedExpenses: [{ id: "f", name: "Gym", amount: 30 }] }, { merge: true })))
await t("memory", assertSucceeds(setDoc(b, { userId: "u1", memory: { "lidl": "a" } }, { merge: true })))
await t("campo extra budget", assertFails(setDoc(b, { userId: "u1", hack: "x" }, { merge: true })))
await t("200 categorias", assertFails(setDoc(b, { userId: "u1", categories: Array(200).fill({ id: "a", name: "x", pct: 0, savings: false }) }, { merge: true })))
await t("otro escribe budget", assertFails(setDoc(doc(o, "budgets/u1"), { userId: "u2", income: {} }, { merge: true })))

// --- Budget antiguo (con 'history') sigue aceptando setIncome ---
await env.withSecurityRulesDisabled(async c => {
  await setDoc(doc(c.firestore(), "budgets/u3"), { userId: "u3", history: { x: 1 }, categories: [] })
})
await t("budget antiguo con 'history' acepta setIncome", assertSucceeds(setDoc(doc(env.authenticatedContext("u3").firestore(), "budgets/u3"), { userId: "u3", income: { "2026-11": 1 } }, { merge: true })))

// --- Gastos antiguos con formato raro ---
await env.withSecurityRulesDisabled(async c => {
  await setDoc(doc(c.firestore(), "expenses/raro"), { userId: "u1", amount: 5, concept: "x", category: "Ocio", date: "01/02/2025" })
})
await t("gasto antiguo con fecha rara: cambiar categoría", assertSucceeds(updateDoc(doc(u, "expenses/raro"), { category: "c1" })))
await t("gasto antiguo: fecha nueva mala", assertFails(updateDoc(doc(u, "expenses/raro"), { date: "mal" })))
await t("editar importe negativo", assertFails(updateDoc(doc(u, "expenses/raro"), { amount: -1 })))

// --- Usuario de la demo: solo lectura de lo suyo ---
const demoUid = "jTQDmVrbmDSX657q7Of8E0O0EfK2"
const demo = env.authenticatedContext(demoUid).firestore()
await t("demo no crea gasto", assertFails(addDoc(collection(demo, "expenses"), { ...ok, userId: demoUid })))
await env.withSecurityRulesDisabled(async c => {
  await setDoc(doc(c.firestore(), "expenses/demo1"), { userId: demoUid, amount: 5, concept: "x", category: "c", date: "2026-11-01" })
  await setDoc(doc(c.firestore(), "budgets/" + demoUid), { userId: demoUid, categories: [] })
})
await t("demo no edita", assertFails(updateDoc(doc(demo, "expenses/demo1"), { amount: 9 })))
await t("demo no borra", assertFails(deleteDoc(doc(demo, "expenses/demo1"))))
await t("demo lee lo suyo", assertSucceeds(getDoc(doc(demo, "expenses/demo1"))))
await t("demo no toca budget", assertFails(setDoc(doc(demo, "budgets/" + demoUid), { userId: demoUid, income: { "2026-11": 1 } }, { merge: true })))
await t("demo no borra budget", assertFails(deleteDoc(doc(demo, "budgets/" + demoUid))))

await env.cleanup()
console.log(failures ? `\n${failures} caso(s) fallidos` : "\nTodos los casos en verde")
process.exit(failures ? 1 : 0)
