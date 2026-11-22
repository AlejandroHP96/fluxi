// Enlaza o desenlaza un miembro del presupuesto compartido (budgets/{dueño}.members + links/{miembro}).
// Usa la sesión de `firebase login` (firebase-tools global) y la API REST, que no pasa por las reglas.
//
//   node scripts/members.cjs link <email> <nombre> [--owner-name Alejandro] [--owner <uid>] [--apply]
//   node scripts/members.cjs unlink <email> [--owner <uid>] [--apply]
//
// Sin --apply solo enseña lo que haría. El dueño, por defecto, es la cuenta de Fluxi con el email de `firebase login`.
const { execSync } = require("child_process")
const path = require("path")

const PROJECT = "dashboard-finance-48b7f"
const DEMO_UID = "jTQDmVrbmDSX657q7Of8E0O0EfK2" // src/constants/demo.ts
const DOCS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`

const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(name)
  return i === -1 ? null : args[i + 1]
}
const apply = args.includes("--apply")
// Posicionales: todo lo que no es una opción ni el valor de --owner / --owner-name
const VALUE_FLAGS = ["--owner", "--owner-name"]
const [command, email, name] = args.filter((a, i) => !a.startsWith("--") && !VALUE_FLAGS.includes(args[i - 1]))

const usage = () => {
  console.error("Uso: node scripts/members.cjs link <email> <nombre> [--owner-name Alejandro] [--owner <uid>] [--apply]")
  console.error("     node scripts/members.cjs unlink <email> [--owner <uid>] [--apply]")
  process.exit(1)
}

async function main() {
  if (!["link", "unlink"].includes(command) || !email || (command === "link" && !name)) usage()

  const auth = require(path.join(execSync("npm root -g").toString().trim(), "firebase-tools/lib/auth.js"))
  const account = auth.getGlobalDefaultAccount()
  if (!account) throw new Error("No hay sesión de firebase-tools: ejecuta `firebase login`")
  const { access_token } = await auth.getAccessToken(account.tokens.refresh_token, ["https://www.googleapis.com/auth/cloud-platform"])
  const H = { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" }

  const call = async (url, init = {}) => {
    const r = await fetch(url, { ...init, headers: H })
    if (r.status === 404 && (init.method ?? "GET") === "GET") return null
    if (!r.ok) throw new Error(`${r.status} ${await r.text()}`)
    return r.status === 204 ? null : r.json()
  }
  const lookup = async (mail) => {
    const j = await call(`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:lookup`, {
      method: "POST",
      body: JSON.stringify({ email: [mail] }),
    })
    const uid = j?.users?.[0]?.localId
    if (!uid) throw new Error(`No hay ninguna cuenta con el email ${mail}`)
    return uid
  }

  const owner = flag("--owner") ?? (await lookup(account.user.email))
  const member = await lookup(email)
  if (member === owner) throw new Error("Ese email es el del dueño del presupuesto")
  if (member === DEMO_UID || owner === DEMO_UID) throw new Error("La cuenta demo no se puede enlazar")

  const budget = await call(`${DOCS}/budgets/${owner}`)
  if (!budget) throw new Error(`El dueño (${owner}) no tiene presupuesto en budgets/`)
  const current = Object.fromEntries(
    Object.entries(budget.fields?.members?.mapValue?.fields ?? {}).map(([k, v]) => [k, v.stringValue])
  )
  const link = await call(`${DOCS}/links/${member}`)

  const next = { ...current }
  if (command === "link") {
    next[owner] = flag("--owner-name") ?? current[owner] ?? "Alejandro"
    next[member] = name
  } else {
    delete next[member]
  }

  console.log(`Dueño:   ${owner}`)
  console.log(`Miembro: ${member} (${email})`)
  console.log("members antes: ", current)
  console.log("members después:", next)
  console.log(`links/${member}: ${link ? JSON.stringify(link.fields) : "(no existe)"} -> ${command === "link" ? `{ budget: ${owner} }` : "(se borra)"}`)
  if (!apply) return console.log("\nSolo lectura. Nada escrito. Repite con --apply para aplicarlo.")

  const mapValue = { fields: Object.fromEntries(Object.entries(next).map(([k, v]) => [k, { stringValue: v }])) }
  await call(`${DOCS}/budgets/${owner}?updateMask.fieldPaths=members&currentDocument.exists=true`, {
    method: "PATCH",
    body: JSON.stringify({ fields: { members: { mapValue } } }),
  })
  if (command === "link") {
    await call(`${DOCS}/links/${member}`, { method: "PATCH", body: JSON.stringify({ fields: { budget: { stringValue: owner } } }) })
  } else if (link) {
    await call(`${DOCS}/links/${member}`, { method: "DELETE" })
  }
  console.log("\nHecho.")
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
