# Presupuesto compartido Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una segunda cuenta usa el mismo presupuesto que el dueño y cada gasto guarda y muestra quién lo apuntó y quién lo editó.

**Architecture:** El presupuesto sigue en `budgets/{ownerUid}` con un mapa `members` nuevo; `links/{memberUid}` dice al miembro qué presupuesto cargar. Las reglas aceptan al dueño o a un miembro (`get()` del budget). `useBudget` resuelve el `budgetUid` antes de suscribirse y firma los gastos con `createdBy`/`updatedBy`.

**Tech Stack:** React 18 + TypeScript, Firebase 13 (Firestore), vitest, `@firebase/rules-unit-testing` con el emulador.

**Spec:** `docs/superpowers/specs/2026-11-22-presupuesto-compartido-design.md`

## Global Constraints

- Tarea del vault: `shared-budget`. Cada commit lleva la línea `Tarea: shared-budget`.
- Una sola rama `main` en este repo.
- Textos de la app en español; comentarios en español, como el resto del código.
- `members` y `links` solo los escribe el script (REST con OAuth, sin reglas). Ningún cliente puede escribirlos.
- `createdBy` y `updatedBy` son opcionales en las reglas (app antigua en caché), pero si vienen deben ser `request.auth.uid`.
- La demo (`DEMO_UID`) no cambia de comportamiento.
- Verificación final: `npx tsc --noEmit -p .`, `yarn test`, `yarn build` y reglas en el emulador.

---

### Task 1: Reglas de Firestore para miembros

**Files:**
- Modify: `firestore.rules`
- Test: `tests/firestore.rules.test.mjs`

**Interfaces:**
- Produces: colecciones `links/{uid}` (`{ budget }`), campo `budgets/{uid}.members` (`{ [uid]: nombre }`), campos `expenses.createdBy`/`updatedBy`.

- [x] **Step 1: Tests de miembros (antes de `await env.cleanup()`)**

```js
// --- Presupuesto compartido: u1 dueño, m1 miembro, x1 desconocido ---
const m = env.authenticatedContext("m1").firestore(), x = env.authenticatedContext("x1").firestore()
await env.withSecurityRulesDisabled(async c => {
  const f = c.firestore()
  await setDoc(doc(f, "budgets/u1"), { userId: "u1", categories: [], members: { u1: "Alejandro", m1: "Ana" } }, { merge: true })
  await setDoc(doc(f, "links/m1"), { budget: "u1" })
  await setDoc(doc(f, "expenses/shared1"), { userId: "u1", amount: 5, concept: "Pan", category: "c1", date: "2026-11-21" })
})
const mine = { ...ok, createdBy: "m1", updatedBy: "m1" }
await t("miembro consulta gastos del dueño", assertSucceeds(getDocs(query(collection(m, "expenses"), where("userId", "==", "u1")))))
await t("desconocido no consulta", assertFails(getDocs(query(collection(x, "expenses"), where("userId", "==", "u1")))))
await t("miembro crea gasto firmado", assertSucceeds(addDoc(collection(m, "expenses"), mine)))
await t("miembro no firma como el dueño", assertFails(addDoc(collection(m, "expenses"), { ...mine, createdBy: "u1" })))
await t("miembro no pone updatedBy ajeno", assertFails(addDoc(collection(m, "expenses"), { ...mine, updatedBy: "u1" })))
await t("dueño crea firmado", assertSucceeds(addDoc(collection(u, "expenses"), { ...ok, createdBy: "u1", updatedBy: "u1" })))
await t("gasto sin firma (app antigua)", assertSucceeds(addDoc(collection(u, "expenses"), ok)))
await t("desconocido no crea en el budget", assertFails(addDoc(collection(x, "expenses"), { ...ok, createdBy: "x1" })))
await t("miembro edita con su updatedBy", assertSucceeds(updateDoc(doc(m, "expenses/shared1"), { amount: 6, updatedBy: "m1" })))
await t("miembro edita con updatedBy ajeno", assertFails(updateDoc(doc(m, "expenses/shared1"), { amount: 7, updatedBy: "u1" })))
await t("nadie cambia createdBy", assertFails(updateDoc(doc(m, "expenses/shared1"), { createdBy: "m1" })))
await t("desconocido no edita", assertFails(updateDoc(doc(x, "expenses/shared1"), { amount: 1 })))
await t("miembro lee el budget", assertSucceeds(getDoc(doc(m, "budgets/u1"))))
await t("miembro cambia la nómina", assertSucceeds(setDoc(doc(m, "budgets/u1"), { userId: "u1", income: { "2026-11": 2000 } }, { merge: true })))
await t("miembro no toca members", assertFails(setDoc(doc(m, "budgets/u1"), { userId: "u1", members: { m1: "Ana", x1: "X" } }, { merge: true })))
await t("dueño no toca members desde la app", assertFails(setDoc(doc(u, "budgets/u1"), { userId: "u1", members: { u1: "A" } }, { merge: true })))
await t("miembro no borra el budget", assertFails(deleteDoc(doc(m, "budgets/u1"))))
await t("desconocido no lee el budget", assertFails(getDoc(doc(x, "budgets/u1"))))
await t("miembro lee su link", assertSucceeds(getDoc(doc(m, "links/m1"))))
await t("dueño lee su link (no existe)", assertSucceeds(getDoc(doc(u, "links/u1"))))
await t("miembro no escribe su link", assertFails(setDoc(doc(m, "links/m1"), { budget: "x1" })))
await t("desconocido no lee links ajenos", assertFails(getDoc(doc(x, "links/m1"))))
await t("miembro borra gasto", assertSucceeds(deleteDoc(doc(m, "expenses/shared1"))))
```

Añadir `getDocs, query, where` al import de `firebase/firestore`.

- [x] **Step 2: Ejecutar y ver fallar**

Run: `npx -y firebase-tools@15.37.0 emulators:exec --config firebase.test.json --only firestore --project demo-fluxi "node tests/firestore.rules.test.mjs"`
Expected: FAIL en los casos de miembro (p. ej. «miembro consulta gastos del dueño»).

- [x] **Step 3: Reglas**

En `firestore.rules`:
- `owns(data)` pasa a `canUse(data.userId)`:

```
    // Dueño del presupuesto o miembro (budgets/{uid}.members, lo escribe solo el script de enlace)
    function canUse(budgetUid) {
      return request.auth != null && (request.auth.uid == budgetUid
        || (exists(/databases/$(database)/documents/budgets/$(budgetUid))
            && request.auth.uid in get(/databases/$(database)/documents/budgets/$(budgetUid)).data.get('members', {})));
    }
    // Autoría del gasto: opcional (app antigua en caché), pero si viene es quien escribe
    function signedBy(d, field) { return !(field in d) || d[field] == request.auth.uid; }
```

- `expenses`: `read`/`delete` con `canUse(resource.data.userId)`; `create` con `canUse(request.resource.data.userId)`, `hasOnly([... 'createdBy', 'updatedBy'])`, `signedBy(d, 'createdBy') && signedBy(d, 'updatedBy')`; `update` con `canUse(resource.data.userId) && request.resource.data.userId == resource.data.userId`, `affectedKeys().hasOnly(['amount','concept','category','date','refunds','updatedBy'])` y `(!affected.hasAny(['updatedBy']) || request.resource.data.updatedBy == request.auth.uid)`.
- `validBudget(d, uid)`: `d.userId == uid` (antes `request.auth.uid`).
- `budgets/{uid}`: `read`/`update` con `canUse(uid)`; `create`/`delete` con `request.auth.uid == uid`. `members` fuera de las claves permitidas en `create` y `update`.
- `match /links/{uid} { allow read: if request.auth != null && request.auth.uid == uid; }`

- [x] **Step 4: Ejecutar y ver pasar**

Run: el mismo comando del Step 2.
Expected: «Todos los casos en verde».

- [x] **Step 5: Commit**

```bash
git add firestore.rules tests/firestore.rules.test.mjs
git commit -m "feat: reglas de Firestore para compartir el presupuesto con miembros" -m "Tarea: shared-budget"
```

### Task 2: Autoría de los gastos (`src/utils/members.ts`)

**Files:**
- Create: `src/utils/members.ts`
- Modify: `src/types/budget.ts` (campos `createdBy?`, `updatedBy?` en `Expense`; tipo `Members`)
- Test: `src/utils/members.test.ts`

**Interfaces:**
- Produces:
  - `type Members = Record<string, string>` (en `src/types/budget.ts`)
  - `isShared(members: Members): boolean`
  - `authorName(e: Pick<Expense,"userId"|"createdBy">, members: Members): string | null`
  - `authorshipLabel(e: Pick<Expense,"userId"|"createdBy"|"updatedBy">, members: Members): string | null`

- [x] **Step 1: Test**

```ts
import { describe, expect, it } from "vitest"
import { authorName, authorshipLabel, isShared } from "./members"

const members = { u1: "Alejandro", m1: "Ana" }
const base = { userId: "u1" }

describe("members", () => {
  it("compartido solo con más de un miembro", () => {
    expect(isShared({})).toBe(false)
    expect(isShared({ u1: "Alejandro" })).toBe(false)
    expect(isShared(members)).toBe(true)
  })
  it("gasto antiguo sin createdBy es del dueño", () => {
    expect(authorName(base, members)).toBe("Alejandro")
  })
  it("autor por createdBy", () => {
    expect(authorName({ ...base, createdBy: "m1" }, members)).toBe("Ana")
    expect(authorName({ ...base, createdBy: "zz" }, members)).toBeNull()
  })
  it("etiqueta con editor distinto", () => {
    expect(authorshipLabel({ ...base, createdBy: "m1", updatedBy: "u1" }, members)).toBe("Apuntado por Ana · editado por Alejandro")
  })
  it("etiqueta sin editor o editor = autor", () => {
    expect(authorshipLabel({ ...base, createdBy: "m1", updatedBy: "m1" }, members)).toBe("Apuntado por Ana")
    expect(authorshipLabel(base, members)).toBe("Apuntado por Alejandro")
  })
  it("sin compartir no hay etiqueta", () => {
    expect(authorshipLabel(base, { u1: "Alejandro" })).toBeNull()
  })
})
```

- [x] **Step 2: Ejecutar y ver fallar**

Run: `yarn vitest run src/utils/members.test.ts`
Expected: FAIL (no existe `./members`).

- [x] **Step 3: Implementación**

`src/types/budget.ts`, en `Expense`:

```ts
  createdBy?: string // uid de quien lo apuntó (los antiguos no lo tienen: son del dueño, userId)
  updatedBy?: string // uid de quien lo editó por última vez
```

y al final:

```ts
// Miembros del presupuesto compartido (budgets/{uid}.members): uid -> nombre. Lo escribe solo el script de enlace
export type Members = Record<string, string>
```

`src/utils/members.ts`:

```ts
import type { Expense, Members } from "../types/budget"

// Hay alguien más que el dueño: solo entonces se enseña quién hizo cada cosa
export const isShared = (members: Members) => Object.keys(members).length > 1

// Quién apuntó el gasto: createdBy o, en los antiguos, el dueño del presupuesto (userId)
export const authorName = (e: Pick<Expense, "userId" | "createdBy">, members: Members) =>
  members[e.createdBy ?? e.userId] ?? null

// «Apuntado por X · editado por Y» (el editor solo si es otra persona); null si no se comparte
export function authorshipLabel(e: Pick<Expense, "userId" | "createdBy" | "updatedBy">, members: Members): string | null {
  if (!isShared(members)) return null
  const author = authorName(e, members)
  if (!author) return null
  const editor = e.updatedBy && e.updatedBy !== (e.createdBy ?? e.userId) ? members[e.updatedBy] : null
  return editor ? `Apuntado por ${author} · editado por ${editor}` : `Apuntado por ${author}`
}
```

- [x] **Step 4: Ejecutar y ver pasar**

Run: `yarn vitest run src/utils/members.test.ts`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/utils/members.ts src/utils/members.test.ts src/types/budget.ts
git commit -m "feat: autoría de los gastos a partir de los miembros del presupuesto" -m "Tarea: shared-budget"
```

### Task 3: `useBudget` carga el presupuesto enlazado y firma los gastos

**Files:**
- Modify: `src/hooks/useBudget.ts`

**Interfaces:**
- Consumes: `Members` (Task 2), `links/{uid}` (Task 1).
- Produces: `BudgetApi` gana `members: Members`, `currentUid: string | null`, `isOwner: boolean`.

- [x] **Step 1: Resolver el presupuesto**

En `useFirestoreBudget`, renombrar el parámetro a `authUid` y añadir al principio:

```ts
  // Presupuesto que se carga: el del dueño si esta cuenta está enlazada (links/{uid}), si no el propio.
  // Si no se puede leer el enlace (reglas aún sin desplegar), el propio
  const [link, setLink] = useState<{ uid: string; budget: string | null } | null>(null)
  useEffect(() => {
    setLink(null)
    if (!authUid) return
    return onSnapshot(
      doc(db, "links", authUid),
      (s) => setLink({ uid: authUid, budget: (s.data()?.budget as string | undefined) ?? null }),
      () => setLink({ uid: authUid, budget: null })
    )
  }, [authUid])
  const userId = authUid && link?.uid === authUid ? (link.budget ?? authUid) : undefined
```

El resto del hook sigue usando `userId` (ahora el uid del presupuesto).

- [x] **Step 2: Miembros**

Estado `const [members, setMembers] = useState<Members>({})`, se limpia con los demás y en el snapshot de ajustes: `setMembers((data?.members as Members | undefined) ?? {})`.

- [x] **Step 3: Firmar**

- `addExpense`: `{ ...e, amount, userId, createdBy: authUid, updatedBy: authUid, createdAt: serverTimestamp() }`.
- `updateExpense`: `{ ...e, amount, updatedBy: authUid }`.
- `saveRefunds`: `tx.update(doc(db, "expenses", e.id), { refunds, updatedBy: authUid })`.
- En el mapeo del snapshot de gastos: `...(data.createdBy ? { createdBy: data.createdBy } : {})` y lo mismo con `updatedBy`.

- [x] **Step 4: Devolver**

Añadir `members, currentUid: authUid ?? null, isOwner: !!userId && userId === authUid` al objeto devuelto. En `useDemoBudget`: `members: {}, currentUid: DEMO_UID, isOwner: true`.

- [x] **Step 5: Comprobar tipos y tests**

Run: `npx tsc --noEmit -p . && yarn test`
Expected: sin errores; todos los tests en verde.

- [x] **Step 6: Commit**

```bash
git add src/hooks/useBudget.ts
git commit -m "feat: cargar el presupuesto enlazado y firmar los gastos" -m "Tarea: shared-budget"
```

### Task 4: Pantallas

**Files:**
- Modify: `src/components/budget/ExpenseList.tsx`, `src/components/budget/ExpenseModal.tsx`, `src/components/budget/AppHeader.tsx`, `src/pages/MonthDashboard.tsx`

**Interfaces:**
- Consumes: `isShared`, `authorName`, `authorshipLabel` (Task 2); `budget.members`, `budget.isOwner` (Task 3).

- [x] **Step 1: `ExpenseList`**

Prop nueva `members: Members`. `const shared = isShared(members)`. En el filtro de búsqueda, añadir `|| (shared && (authorName(e, members) ?? "").toLowerCase().includes(q))`. En cada fila, antes del importe y solo si `shared`:

```tsx
{shared && (
  <span
    title={authorName(e, members) ?? undefined}
    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[10px] font-semibold text-white/70"
  >
    {(authorName(e, members) ?? "?").charAt(0).toUpperCase()}
  </span>
)}
```

Placeholder del buscador: `shared ? "Buscar por comercio, concepto o quién…" : "Buscar por comercio o concepto…"`.

- [x] **Step 2: `ExpenseModal`**

Prop nueva `authorship?: string | null`. Bajo el `<h2>`, envolver título y línea:

```tsx
<div className="min-w-0">
  <h2 className="text-lg font-semibold tracking-tight">{editing ? "Editar gasto" : "Apuntar gasto"}</h2>
  {editing && authorship && <p className="mt-0.5 text-xs text-white/50">{authorship}</p>}
</div>
```

- [x] **Step 3: `AppHeader`**

`onImport?: () => void`; el botón de importar solo se pinta si `onImport`.

- [x] **Step 4: `MonthDashboard`**

- `onImport={budget.isOwner ? () => setImporting(true) : undefined}`.
- `onResetAll={budget.isOwner ? async () => { ... } : undefined}` (el cuerpo actual).
- `ExpenseList members={budget.members}`.
- `ExpenseModal authorship={modal.kind === "edit" ? authorshipLabel(<gasto actual>, budget.members) : null}`; el gasto actual es el mismo que ya se pasa en `expense`.

- [x] **Step 5: Comprobar**

Run: `npx tsc --noEmit -p . && yarn test && yarn build`
Expected: todo en verde.

- [x] **Step 6: Commit**

```bash
git add src/components/budget/ExpenseList.tsx src/components/budget/ExpenseModal.tsx src/components/budget/AppHeader.tsx src/pages/MonthDashboard.tsx
git commit -m "feat: ver quién apuntó y editó cada gasto; el miembro no importa ni borra todo" -m "Tarea: shared-budget"
```

### Task 5: Script de enlace `scripts/members.cjs`

**Files:**
- Create: `scripts/members.cjs`

**Interfaces:**
- Consumes: `budgets/{owner}.members`, `links/{uid}` (Task 1).

- [x] **Step 1: Script**

- Token: `require(<npm root -g>/firebase-tools/lib/auth.js)`, `getGlobalDefaultAccount()` + `getAccessToken(refresh_token, [cloud-platform])`. La raíz global se saca con `execSync("npm root -g")`.
- `lookup(email)`: `POST https://identitytoolkit.googleapis.com/v1/projects/dashboard-finance-48b7f/accounts:lookup` con `{ email: [email] }` → `users[0].localId`.
- Dueño: `--owner <uid>` o `lookup(<email de firebase login>)`.
- `link <email> <nombre> [--owner-name Alejandro]`: lee `budgets/{owner}` (debe existir), calcula `members = { ...actuales, [owner]: ownerName, [uid]: nombre }`, enseña el antes y el después, y con `--apply` hace `PATCH budgets/{owner}?updateMask.fieldPaths=members&currentDocument.exists=true` y `PATCH links/{uid}` con `{ budget: owner }`.
- `unlink <email>`: quita el uid de `members` y borra `links/{uid}`, mismo modo lectura/`--apply`.
- Rechaza enlazar al propio dueño o a la demo.

- [x] **Step 2: Probar en modo lectura**

Run: `node scripts/members.cjs link nadie@example.com Prueba`
Expected: error «No hay ninguna cuenta con ese email» y nada escrito.

- [x] **Step 3: Commit**

```bash
git add scripts/members.cjs
git commit -m "feat: script para enlazar y desenlazar miembros del presupuesto" -m "Tarea: shared-budget"
```

### Task 6: Verificación, revisión y despliegue

- [x] `npx tsc --noEmit -p .`, `yarn test`, `yarn build` y reglas en el emulador: todo en verde.
- [x] Revisión del diff por otro agente; corregir lo que salga.
- [x] `firebase deploy --only firestore:rules --project dashboard-finance-48b7f`. (comprobado el 2026-11-23: ya estaban al día)
- [x] `git push` a `main` (Vercel despliega).
- [x] Vault: `Inicio.md` (esquema y reglas) y nota `shared-budget` al día. El enlace (`link --apply`) espera el email de ella y la confirmación del dueño.
