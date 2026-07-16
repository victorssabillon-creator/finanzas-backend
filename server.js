import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" }));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash:generateContent";

// ─── Categorías ────────────────────────────────────────────────────────────────

const EXPENSE_CATEGORIES = [
  { id: "meals",         label: "Comidas",         examples: "papitas, snacks, café, bebidas, dulces, supermercado con alimentos predominantes" },
  { id: "restaurant",   label: "Restaurante",      examples: "almuerzo en restaurante, cena, soda, comida en local o cafetería" },
  { id: "transport",    label: "Transporte",       examples: "Uber, Didi, taxi, bus, parqueo, peaje, lavado de carro" },
  { id: "shopping",     label: "Compras",          examples: "artículos del hogar, compras generales, tienda por departamentos, bazar" },
  { id: "health",       label: "Salud",            examples: "farmacia, medicinas, doctor, exámenes médicos, dentista, óptica, laboratorio" },
  { id: "housing",      label: "Vivienda",         examples: "alquiler, hipoteca, condominio, cuota de administración" },
  { id: "bills",        label: "Servicios",        examples: "electricidad, agua, teléfono, internet, RECOPE, AyA, ICE, cable" },
  { id: "entertainment",label: "Entretenimiento",  examples: "cine, concierto, evento deportivo, videojuegos, parque de diversiones" },
  { id: "education",    label: "Educación",        examples: "libros, cursos, colegiatura, matrícula universitaria, tutorías, útiles" },
  { id: "gym",          label: "Gimnasio",         examples: "gimnasio, mensualidad de gym, spinning, yoga, actividad física" },
  { id: "pets",         label: "Mascotas",         examples: "veterinario, comida de mascotas, accesorios para animales, grooming" },
  { id: "gifts",        label: "Regalos",          examples: "regalo, presente, tarjeta de regalo, flores, detalle para alguien" },
  { id: "subscriptions",label: "Suscripciones",    examples: "Netflix, Spotify, Amazon Prime, YouTube Premium, HBO Max, Adobe, software mensual" },
  { id: "clothing",     label: "Ropa",             examples: "camisa, pantalón, zapatos, ropa, calzado, bolso, accesorios de vestir" },
  { id: "fuel",         label: "Combustible",      examples: "gasolina, diésel, super, regular, recarga de gasolinera" },
  { id: "kids",         label: "Hijos",            examples: "ropa infantil, juguetes, útiles escolares, cuota escolar, guardería" },
  { id: "delivery",     label: "Delivery",         examples: "Uber Eats, Rappi, Hugo, iFood, pedido a domicilio, comida delivery" },
  { id: "electronics",  label: "Electrónica",      examples: "celular, televisor, laptop, audífonos, electrodomésticos, cargador, tablet" },
  { id: "insurance",    label: "Seguros",          examples: "seguro de auto, seguro de salud, seguro de vida, COSEVI, INS, póliza" },
 { id: "repairs", label: "Reparaciones", examples: "reparaciones del hogar generales, mantenimiento, arreglos" },
 { id: "urgent", label: "Gasto ASAP", examples: "ferretería, Colono, Coopelesca, Novoa, EPA, martillo, clavos, taladro, pintura, materiales de construcción, herramientas, plomero, electricista, gasto urgente no médico, emergencia del hogar" },
  { id: "outings",      label: "Salidas",          examples: "discoteca, bar, karaoke, salida nocturna, tragos" },
  { id: "flights",      label: "Avión",            examples: "boleto de avión, aerolínea, vuelo, tiquete aéreo" },
  { id: "hotel",        label: "Hotel",            examples: "hotel, Airbnb, hospedaje, alojamiento, resort" },
  { id: "other_expense",label: "Otro",             examples: "cualquier gasto que no encaje claramente en las categorías anteriores" },
];

const INCOME_CATEGORIES = [
  { id: "salary",      label: "Salario",    examples: "depósito de salario, planilla, quincena, pago mensual de trabajo" },
  { id: "freelance",   label: "Freelance",  examples: "pago por proyecto, trabajo independiente, honorarios profesionales" },
  { id: "investment",  label: "Inversión",  examples: "intereses bancarios, dividendos, rendimiento de inversión, fondos" },
  { id: "bonus",       label: "Bono",       examples: "bono, aguinaldo, comisión, incentivo, gratificación" },
  { id: "refund",      label: "Reembolso",  examples: "devolución, reembolso, cashback, reintegro, nota de crédito" },
  { id: "rental",      label: "Alquiler",   examples: "ingreso por alquiler de propiedad, renta recibida" },
  { id: "sales",       label: "Ventas",     examples: "venta de artículo, ingreso por ventas de productos" },
  { id: "tips",        label: "Propinas",   examples: "propinas recibidas, gratuidades" },
  { id: "other_income",label: "Otro",       examples: "transferencia recibida sin contexto claro, ingreso no identificado" },
];

// ─── Parser de monto ───────────────────────────────────────────────────────────

function parseAmount(rawAmt) {
  if (rawAmt === null || rawAmt === undefined) return 0;
  if (typeof rawAmt === "number") return Math.abs(rawAmt);

  let cleaned = String(rawAmt)
    .replace(/[₡$€£¥]/g, "")
    .replace(/CRC|USD|EUR|GBP|JPY/gi, "")
    .replace(/\s/g, "")
    .trim();

  if (!cleaned) return 0;

  if (cleaned.includes(",") && cleaned.includes(".")) {
    const lastComma = cleaned.lastIndexOf(",");
    const lastDot   = cleaned.lastIndexOf(".");
    if (lastComma > lastDot) {
      // CRC: 4.595,40 → punto=miles, coma=decimal
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      // USD: 4,595.40 → coma=miles, punto=decimal
      cleaned = cleaned.replace(/,/g, "");
    }
  } else if (cleaned.includes(",")) {
    const parts = cleaned.split(",");
    if (parts[parts.length - 1].length <= 2) {
      // Coma es decimal
      cleaned = cleaned.replace(/,/g, ".");
      const parts2 = cleaned.split(".");
      if (parts2.length > 2) {
        const decimals = parts2.pop();
        cleaned = parts2.join("") + "." + decimals;
      }
    } else {
      // Coma es miles
      cleaned = cleaned.replace(/,/g, "");
    }
  } else if (cleaned.includes(".")) {
    const parts = cleaned.split(".");
    if (parts[parts.length - 1].length <= 2 && parts.length <= 2) {
      // Punto es decimal, dejar como está
    } else {
      // Punto es miles
      cleaned = cleaned.replace(/\./g, "");
    }
  }

  const result = parseFloat(cleaned);
  return isNaN(result) ? 0 : Math.abs(result);
}

// ─── Health check ──────────────────────────────────────────────────────────────

app.get("/healthz",     (_req, res) => res.json({ status: "ok" }));
app.get("/api/healthz", (_req, res) => res.json({ status: "ok" }));

// ─── Analyze receipt ───────────────────────────────────────────────────────────

app.post("/api/analyze-receipt", async (req, res) => {
  try {
    const { imageBase64, mimeType = "image/jpeg", customCategories = [] } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "imageBase64 is required" });
    }
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY not configured" });
    }

    const today = new Date().toISOString().split("T")[0];

    const expenseCatList = EXPENSE_CATEGORIES
      .map((c) => `  - "${c.id}" (${c.label}): ${c.examples}`)
      .join("\n");
    const incomeCatList = INCOME_CATEGORIES
      .map((c) => `  - "${c.id}" (${c.label}): ${c.examples}`)
      .join("\n");

    const customExpense = customCategories.filter((c) => c.type === "expense");
    const customIncome  = customCategories.filter((c) => c.type === "income");
    const customSection = customCategories.length > 0
      ? "\nCATEGORÍAS PERSONALIZADAS DEL USUARIO (también son válidas):\n" +
        (customExpense.length > 0
          ? "  Gastos: " + customExpense.map((c) => `"${c.id}" (${c.label})`).join(", ") + "\n"
          : "") +
        (customIncome.length > 0
          ? "  Ingresos: " + customIncome.map((c) => `"${c.id}" (${c.label})`).join(", ") + "\n"
          : "")
      : "";

    const prompt = `Eres un experto analizando comprobantes de pago y recibos de Costa Rica y Latinoamérica.

Analiza la imagen y extrae la información de la transacción.
Devuelve ÚNICAMENTE un objeto JSON válido (sin markdown, sin bloques de código, sin texto extra).

══════════════════════════════════════════════════════════
CAMPO amount_raw — LEE CON MUCHA ATENCIÓN:
══════════════════════════════════════════════════════════
El campo "amount_raw" debe contener EXACTAMENTE los dígitos y separadores
del monto tal como aparecen en el comprobante, sin convertir ni formatear.

EJEMPLOS OBLIGATORIOS:
• El ticket dice "CRC 4.595,40"  → amount_raw: "4.595,40"   (copia literal, con coma y los 40)
• El ticket dice "CRC 4595,40"   → amount_raw: "4595,40"    (copia literal, con coma y los 40)
• El ticket dice "₡1.500,75"    → amount_raw: "1.500,75"   (copia literal, con coma y los 75)
• El ticket dice "CRC 23.000"    → amount_raw: "23.000"     (sin decimales, copia literal)
• El ticket dice "$1,234.56"     → amount_raw: "1,234.56"   (copia literal)
• El ticket dice "$50.00"        → amount_raw: "50.00"      (copia literal)

⚠️ REGLA CRÍTICA: Copia el string EXACTAMENTE como aparece. NO interpretes,
NO conviertas, NO omitas dígitos. Si el recibo dice "4595,40", el campo
amount_raw debe ser "4595,40" — con la coma y el 40.

══════════════
MONEDA:
══════════════
• "CRC" si ves ₡, "colones", "CRC" o es claramente en Costa Rica
• "USD" si ves $, "dólares", "USD", "dollars"
• Si no se detecta → "CRC" por defecto

══════════════
FECHA:
══════════════
• Usa la fecha del comprobante en formato YYYY-MM-DD si es legible.
• Si no se ve → usa hoy: ${today}

══════════════════════════════════════════
TIPO: "expense" para compras/pagos, "income" para ingresos/salarios
══════════════════════════════════════════

══════════════
DESCRIPCIÓN:
══════════════
• En español, máximo 60 caracteres.
• Incluye el nombre del comercio si es visible + qué se compró.

══════════════════════════════════════════
CATEGORÍAS DE GASTO (usa el ID exacto entre comillas):
══════════════════════════════════════════
${expenseCatList}

CATEGORÍAS DE INGRESO (usa el ID exacto):
${incomeCatList}
${customSection}
══════════════════════════════════════════
REGLAS DE CATEGORIZACIÓN:
══════════════════════════════════════════
1. Usa el nombre del comercio como pista principal:
   farmacia/droguería → "health" | ferretería/materiales → "urgent"
   gasolinera → "fuel" | supermercado (comida) → "meals"
   restaurante/soda/fast food local → "restaurant"
   Uber/Didi/taxi → "transport" | Uber Eats/Rappi → "delivery"
   Netflix/Spotify/suscripción digital → "subscriptions"
2. Si hay varios artículos, categoriza según el ítem de mayor valor o tipo predominante.
3. Si no estás seguro → usa "other_expense" o "other_income".
4. NUNCA uses categorías que no estén en la lista de arriba.

Devuelve SOLO este JSON (sin nada más):
{
  "type": "expense" o "income",
  "amount_raw": "string EXACTO del monto como aparece en el recibo (ej: '4.595,40' o '1,234.56')",
  "currency_symbol": "símbolo o texto de moneda exacto del recibo (₡, CRC, $, USD) o '' si no hay",
  "currency": "CRC" o "USD",
  "description": "descripción en español máx 60 chars",
  "category": "id_exacto_de_categoria",
  "date": "YYYY-MM-DD"
}`;

    const geminiRes = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { inline_data: { data: imageBase64, mime_type: mimeType } },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return res.status(502).json({ error: `Gemini API error: ${errText.slice(0, 300)}` });
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(422).json({ error: "Could not parse AI response", raw: rawText });
    }

    const parsed = JSON.parse(jsonMatch[0]);

    const amountInput = parsed.amount_raw ?? parsed.amount;
    const amount = parseAmount(amountInput);
    console.log(`[receipt] amount_raw: ${JSON.stringify(parsed.amount_raw)} | amount fallback: ${JSON.stringify(parsed.amount)} → parsed: ${amount}`);

    const txType   = parsed.type === "income" ? "income" : "expense";
    const currency = parsed.currency === "USD" ? "USD" : "CRC";

    const allExpenseIds = [
      ...EXPENSE_CATEGORIES.map((c) => c.id),
      ...customCategories.filter((c) => c.type === "expense").map((c) => c.id),
    ];
    const allIncomeIds = [
      ...INCOME_CATEGORIES.map((c) => c.id),
      ...customCategories.filter((c) => c.type === "income").map((c) => c.id),
    ];
    const allIds = [...allExpenseIds, ...allIncomeIds];

    const result = {
      type: txType,
      amount,
      currency,
      description: String(parsed.description ?? "").slice(0, 80),
      category: allIds.includes(String(parsed.category ?? ""))
        ? String(parsed.category)
        : txType === "income" ? "other_income" : "other_expense",
      date: /^\d{4}-\d{2}-\d{2}$/.test(String(parsed.date ?? ""))
        ? String(parsed.date)
        : today,
    };

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || "Unknown error" });
  }
});

// ─── Start server ──────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
