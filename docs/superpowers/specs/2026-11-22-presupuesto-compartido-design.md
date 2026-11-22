# Presupuesto compartido (dos cuentas, mismos datos)

Tarea del vault: `shared-budget`. Fecha: 2026-11-22.

## Objetivo

Que una segunda cuenta (la de la pareja del dueño) trabaje sobre el mismo presupuesto que el dueño: mismos gastos, nómina, gastos fijos, sobres, memoria de importación y cartera de ahorros. Cada gasto registra quién lo apuntó y quién lo editó por última vez, y la app lo muestra.

## Decisiones tomadas

- Se comparte **todo**: un único presupuesto.
- El enlace se hace **a mano, una vez**, con un script. No hay invitaciones ni pantalla de miembros.
- Autoría: **quién apuntó y quién editó por última vez** cada gasto. No hay historial de actividad.
- La importación (CSV, banco y Ventajón) queda **solo para el dueño**. La importación del banco se quitará en una tarea aparte (`rm-bank`).
- Enfoque A: el presupuesto sigue siendo `budgets/{ownerUid}` y se le añaden miembros. No se migra ningún dato.

## Datos

| Ruta | Cambio |
|---|---|
| `budgets/{ownerUid}.members` | Nuevo. Mapa `{ [uid]: nombre }` con el dueño y los miembros. Solo lo escribe el script (los clientes no pueden cambiarlo). |
| `links/{memberUid}` | Nuevo. `{ budget: ownerUid }`. El miembro solo puede leer el suyo; ningún cliente puede escribirlo. El dueño no tiene `link`. |
| `expenses/{id}.createdBy` | Nuevo, opcional. Uid de quien apuntó el gasto. |
| `expenses/{id}.updatedBy` | Nuevo, opcional. Uid de quien lo editó por última vez (incluye cambios de devoluciones). |

- `expenses.userId` sigue siendo el uid del dueño del presupuesto en todos los gastos, también en los que apunta el miembro.
- Gasto sin `createdBy` (anteriores a esta tarea): cuenta como apuntado por el dueño del presupuesto (`userId`).

## Reglas de Firestore

- Función `canUse(budgetUid)`: `request.auth.uid == budgetUid`, o existe `budgets/{budgetUid}` y `request.auth.uid in get(...).data.get('members', {})`.
- La cuenta demo sigue igual (`notDemo()` en todas las escrituras).
- `expenses`:
  - `read`, `delete`: `canUse(resource.data.userId)`.
  - `create`: `canUse(request.resource.data.userId)`, claves permitidas + `createdBy` y `updatedBy`, y si vienen, los dos iguales a `request.auth.uid`.
  - `update`: `canUse` sobre el documento actual y el nuevo (`userId` no cambia), claves cambiables + `updatedBy`, y si `updatedBy` cambia, igual a `request.auth.uid`. `createdBy` no se puede cambiar.
  - Los dos campos son opcionales para que una versión antigua de la app (PWA en caché) siga pudiendo apuntar gastos durante el despliegue. La app nueva siempre los envía.
- `budgets/{uid}`:
  - `read`, `update`: `canUse(uid)`. `members` no está entre las claves que un cliente puede cambiar.
  - `create`, `delete`: solo `request.auth.uid == uid` (el dueño).
- `links/{uid}`: `read` si `request.auth.uid == uid`; sin escritura.
- Riesgo a comprobar primero en el emulador: la consulta `where('userId', '==', ownerUid)` hecha por el miembro tiene que pasar una regla que hace `get()` del budget a partir de `resource.data.userId`.

## App

### `useBudget`

- Recibe el uid de sesión. Fuera de la demo, primero escucha `links/{uid}`: `budgetUid = link?.budget ?? uid`. Mientras se resuelve, `loading` sigue en `true`.
- Las suscripciones a `expenses` (`where userId == budgetUid`) y a `budgets/{budgetUid}` usan `budgetUid`.
- Expone `members` (del documento de ajustes), `currentUid` y `isOwner` (`budgetUid == uid`).
- `addExpense` guarda `createdBy` y `updatedBy` = uid de sesión. Editar un gasto o sus devoluciones pone `updatedBy` = uid de sesión.

### Utilidad

- `authorName(expense, members, ownerUid)` en `src/utils/members.ts`: nombre de `createdBy`, o del dueño si no hay `createdBy`, o `null` si no está en `members`. Con tests.

### Pantallas

- `ExpenseList`: burbuja con la inicial del autor en cada fila, solo si `members` tiene más de una entrada. El buscador también busca por nombre del autor.
- `ExpenseModal` (gasto existente): línea «Apuntado por X», y «· editado por Y» si `updatedBy` es otra persona. Solo con más de un miembro.
- `AppHeader`: sin el botón «Importar» si no es el dueño.
- `CategorySettings`: sin «Borrar todos mis datos» si no es el dueño.
- La demo y la cuenta del dueño sin miembros se ven igual que ahora.

## Script `scripts/members.cjs`

- `node scripts/members.cjs link <email> <nombre> [--owner-name Alejandro]`: busca el uid del email con Identity Toolkit (`accounts:lookup`). Después escribe en `budgets/{ownerUid}.members` el dueño y el miembro, y crea `links/{memberUid}`.
- `node scripts/members.cjs unlink <email>`: quita al miembro de `members` y borra su `links`.
- Sin `--apply` solo enseña lo que escribiría.
- Usa el token de la sesión de `firebase login` (módulo `auth` de firebase-tools global) y la API REST de Firestore, que no pasa por las reglas.
- El dueño es la cuenta de Fluxi con el mismo email que la sesión de `firebase login`, resuelta con `accounts:lookup`. `--owner <uid>` lo sustituye.

## Pruebas

- `tests/firestore.rules.test.mjs`, con dueño, miembro y desconocido:
  - el miembro consulta los gastos del dueño con `where userId`;
  - el miembro crea, edita y borra gastos del dueño con su `createdBy`/`updatedBy`;
  - el miembro no puede crear con `createdBy` del dueño ni cambiar `createdBy`;
  - un desconocido no lee ni escribe;
  - el miembro lee y edita `budgets/{owner}` pero no `members`, y no lo crea ni lo borra;
  - el miembro lee su `links` y no lo escribe; un desconocido no lo lee;
  - un gasto sin `createdBy` sigue pasando (app antigua).
- `src/utils/members.test.ts` para `authorName`.
- `tsc --noEmit`, `yarn test`, `yarn build` y revisión por otro agente.

## Despliegue

1. Reglas: `firebase deploy --only firestore:rules --project dashboard-finance-48b7f`. Son compatibles con la app actual.
2. App: push a `main` (Vercel despliega).
3. La pareja se registra con su email.
4. `members.cjs link` en modo lectura, el dueño confirma y se ejecuta con `--apply`.

## Fuera de alcance

Invitaciones, pantalla de miembros, notificaciones, historial de actividad, importación por el miembro y quitar la importación del banco (tarea `rm-bank`).
