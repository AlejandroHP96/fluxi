// Traspasos con la cuenta de Ahorros, huchas o bolsillos e intereses: no son gastos.
// Lo usan el CSV de Revolut (src/utils/revolutCsv.ts) y los movimientos del banco (api/_lib/enablebanking.ts)
export const SAVINGS_TRANSFER = /^(A|Desde|To|From)\s+.*(Ahorros|Savings|Vault|Pocket|Bolsillo)|inter[eé]s.*(ahorros|savings|vault)/i
