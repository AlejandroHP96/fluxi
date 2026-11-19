// Compartido por parse-ventajon (PDF) y ventajon-sync (API de Ventajón).
// Las carpetas con "_" dentro de api/ no se publican como funciones en Vercel.

export function cleanVentajonConcept(raw: string): string {
  let s = raw.trim()
  s = s.replace(/\s+(ES|NL|FR|DE)$/i, "")
  s = s.replace(/\s+PINPAD\b/i, "")
  // Sin \b final: el PDF pega el país a la localidad ("SANTA CRUZ DEES", "SAN CRISTOBALES")
  s = s.replace(/\b(SANTA CRUZ DE|SANATA CRUZ|SAN CRISTOBAL|LA LAGUNA|SAN CRISTOBLA).*/i, "").trim()
  s = s.replace(/FINCA ESPA#?A/i, "Finca España")
  s = s.replace(/RTE\b/i, "Restaurante")

  if (/MERCADONA/i.test(s)) {
    s = s.replace(/TENERIFE.*/i, "").trim()
  }
  if (/MCDONALD/i.test(s)) {
    s = s.replace(/72400041/g, "").trim()
  }

  return s
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

export function categorizeVentajonItem(concept: string): string {
  const up = concept.toUpperCase()
  if (
    /MERCADONA|CARREFOUR|ALCAMPO|COVIRAN|SUPERMERCADO|MULTITIENDA|A24|CRIS-CLA|SD RAMBLAS|ALIMENTACION/i.test(
      up
    )
  ) {
    return "Alimentación"
  }
  if (/MCDONALD|BAR|RESTAURANTE|BURGER|KFC|PIZZA|CAFETERIA/i.test(up)) {
    return "Ocio"
  }
  if (/GASOLINERA|PARKING|CHUMBERAS|REPSOL|CEPSA|BP\b|DISA/i.test(up)) {
    return "Transporte"
  }
  if (/HOSPITAL|FARMACIA|OFRA|CLINICA|SALUD|MEDIC/i.test(up)) {
    return "Salud"
  }
  if (
    /IKEA|GAME|G2A|SAVE STORE|SOL EN CANARIAS|CAON|EXCLUSIVAS LIFER|MAS COSITAS|ZARA|PRIMARK|AMAZON/i.test(
      up
    )
  ) {
    return "Compras"
  }
  return "Otro"
}
