import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true }));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const EXPENSE_CATEGORY_IDS = [
  "meals", "restaurant", "urgent", "outings", "flights",
  "transport", "hotel", "shopping", "health", "housing",
  "bills", "entertainment", "education", "other_expense",
];
const INCOME_CATEGORY_IDS = [
  "salary", "freelance", "transfer", "investment", "bonus", "other_income",
];
const ALL_CATEGORY_IDS = [...EXPENSE_CATEGORY_IDS, ...INCOME_CATEGORY_IDS];

app.get("/api/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/analyze-receipt", async (req, res) => {
  try {
    const { imageBase64, mimeType = "image/jpeg" } = req.body ?? {};

    if (!imageBase64) {
      res.status(400).json({ error: "imageBase64 is required" });
      return;
    }

    if (!GEMINI_API_KEY) {
      res.status(500).json({ error: "GEMINI_API_KEY not configured" });
      return;
    }

    const prompt = `Analyze this receipt or payment image and extract transaction information.
Return ONLY a valid JSON object with these exact fields (no markdown, no code fences):
{
  "type": "expense" or "income",
  "amount": number (total amount, no currency symbol, no decimals),
  "description": "short description in Spanish (max 60 chars)",
  "category": one of: ${ALL_CATEGORY_IDS.join(", ")},
  "date": "YYYY-MM-DD format if visible, otherwise today"
}

Rules:
- amount must be a positive number
- category must be exactly one of the provided IDs
- description should be in Spanish describing what was purchased
- type is almost always "expense" for receipts
- Return ONLY the JSON object, nothing else`;

    const geminiRes = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
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
      res.status(502).json({ error: `Gemini API error: ${errText.slice(0, 300)}` });
      return;
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      res.status(422).json({ error: "Could not parse AI response", raw: rawText.slice(0, 200) });
      return;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const result = {
      type: parsed.type === "income" ? "income" : "expense",
      amount: Math.abs(Number(parsed.amount)) || 0,
      description: String(parsed.description ?? "").slice(0, 80),
      category: ALL_CATEGORY_IDS.includes(parsed.category) ? parsed.category : "other_expense",
      date: /^\d{4}-\d{2}-\d{2}$/.test(parsed.date ?? "")
        ? parsed.date
        : new Date().toISOString().split("T")[0],
    };

    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
