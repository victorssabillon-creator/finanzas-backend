import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" }));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

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
  { id: "repairs",      label: "Reparaciones",     examples: "martillo, clavos, taladro, pintura, ferretería, materiales de construcción, herramientas, plomero, electricista" },
  { id: "urgent",       label: "Gasto ASAP",       examples: "gasto urgente no médico, emergencia del hogar" },
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
  if (typeof rawAmt === "number") {
    return Math.abs(rawAmt); // JSON numbers already have correct decimal point
  }
  // Handle string amounts
  const cleaned = String(rawAmt).replace(/[^\d.,]/g, "");
  if (!cleaned) return 0;

  if (cleaned.includes(",") && cleaned.includes(".")) {
    const lastComma = cleaned.lastIndexOf(",");
    const lastDot   = cleaned.lastIndexOf(".");
    if (lastComma > lastDot) {
      // CRC format: 4.595,40 → punto=miles, coma=decimal
      return Math.abs(parseFloat(cleaned.replace(/\./g, "").replace(",", ".")) || 0);
    } else {
      // USD format: 4,595.40 → coma=miles, punto=decimal
      return Math.abs(parseFloat(cleaned.replace(/,/g, "")) || 0);
    }
  } else if (cleaned.includes(",")) {
    // Solo coma: si quedan ≤2 dígitos después, es decimal
    const parts = cleaned.split(",");
    if (parts.length === 2 && parts[1].length <= 2) {
      return Math.abs(parseFloat(cleaned.replace(",", ".")) || 0);
    }
    return Math.abs(parseFloat(cleaned.replace(/,/g, "")) || 0);
  }
  return Math.abs(parseFloat(cleaned) || 0);
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
EJEMPLOS CRÍTICOS DE CÓMO DEVOLVER EL MONTO:
══════════════════════════════════════════════════════════
EJEMPLO 1: El ticket dice "CRC 4.595,40" → amount debe ser 4595.40 (incluye los ,40 céntimos)
EJEMPLO 2: El ticket dice "CRC 4595,40"  → amount debe ser 4595.40 (incluye los ,40 céntimos)
EJEMPLO 3: El ticket dice "CRC 23.000"   → amount debe ser 23000 (sin decimales)
EJEMPLO 4: El ticket dice "₡1.500,75"   → amount debe ser 1500.75 (incluye los ,75 céntimos)
EJEMPLO 5: El ticket dice "$1,234.56"    → amount debe ser 1234.56 (incluye los .56 centavos)
EJEMPLO 6: El ticket dice "$50.00"       → amount debe ser 50 (cero decimales = entero)

⚠️ ADVERTENCIA CRÍTICA: Si el comprobante muestra céntimos o centavos después
de la coma (CRC) o el punto (USD), DEBES incluirlos obligatoriamente en el amount.
NUNCA truncues ni redondees los decimales. Si ves ",40" o ",75" o ".99" al final
del número, esos dígitos SON PARTE DEL MONTO y deben aparecer en tu respuesta.

══════════════════════════════════════════════
REGLAS PARA EL MONTO:
══════════════════════════════════════════════
• En Costa Rica (CRC): el PUNTO (.) separa miles y la COMA (,) marca decimales.
  Ejemplo: ₡4.595,40 → devuelve 4595.40 | ₡23.000 → devuelve 23000
• En USD ($): la COMA (,) separa miles y el PUNTO (.) marca decimales.
  Ejemplo: $1,234.56 → devuelve 1234.56 | $23,000 → devuelve 23000
• Si ves coma o punto seguido de exactamente 2 dígitos al final (ej: ,40 o ,75 o .99),
  DEBES incluir esos 2 dígitos como decimales en el amount. Nunca los omitas.
• Devuelve el monto como número JSON con punto decimal si hay céntimos/centavos.
• Si el monto NO tiene decimales, devuelve entero (ej: 3500, NO 3500.0).
• NUNCA uses comas ni símbolos de moneda en el número JSON.

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
• Ejemplo: "Uber One Membership", "Farmacia Sucre - medicamentos"

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
   farmacia/droguería → "health" | ferretería/materiales → "repairs"
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
  "amount": número con punto decimal si hay céntimos (ej: 4595.40), entero si no (ej: 3500),
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

    const txType   = parsed.type === "income" ? "income" : "expense";
    const currency = parsed.currency === "USD" ? "USD" : "CRC";
    const amount   = parseAmount(parsed.amount);

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
