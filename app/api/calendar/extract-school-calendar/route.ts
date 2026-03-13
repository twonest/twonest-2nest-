import { NextResponse } from "next/server";

type DetectedType = "ferie" | "pedagogique" | "vacances" | "scolaire";

type DetectedDate = {
  id: string;
  date: string;
  description: string;
  type: DetectedType;
};

type KeywordRule = {
  keyword: string;
  description: string;
  type: DetectedType;
};

const KEYWORD_RULES: KeywordRule[] = [
  { keyword: "congé pédagogique", description: "Congé pédagogique", type: "pedagogique" },
  { keyword: "journée pédagogique", description: "Journée pédagogique", type: "pedagogique" },
  { keyword: "relâche", description: "Relâche", type: "vacances" },
  { keyword: "vacances", description: "Vacances", type: "vacances" },
  { keyword: "férié", description: "Jour férié", type: "ferie" },
  { keyword: "ferie", description: "Jour férié", type: "ferie" },
  { keyword: "rentrée", description: "Rentrée", type: "scolaire" },
  { keyword: "examens", description: "Examens", type: "scolaire" },
  { keyword: "remise de bulletins", description: "Remise de bulletins", type: "scolaire" },
];

const MONTHS_FR: Record<string, number> = {
  janvier: 1,
  fevrier: 2,
  février: 2,
  mars: 3,
  avril: 4,
  mai: 5,
  juin: 6,
  juillet: 7,
  aout: 8,
  août: 8,
  septembre: 9,
  octobre: 10,
  novembre: 11,
  decembre: 12,
  décembre: 12,
};

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function toIsoDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) {
    return null;
  }

  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  const monthStr = String(month).padStart(2, "0");
  const dayStr = String(day).padStart(2, "0");
  return `${year}-${monthStr}-${dayStr}`;
}

function extractDatesFromLine(line: string): string[] {
  const found = new Set<string>();

  const slashPattern = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/g;
  for (const match of line.matchAll(slashPattern)) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    const rawYear = Number(match[3]);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    const iso = toIsoDate(year, month, day);
    if (iso) {
      found.add(iso);
    }
  }

  const isoPattern = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
  for (const match of line.matchAll(isoPattern)) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const iso = toIsoDate(year, month, day);
    if (iso) {
      found.add(iso);
    }
  }

  const monthPattern = /\b(\d{1,2})\s+(janvier|fevrier|février|mars|avril|mai|juin|juillet|aout|août|septembre|octobre|novembre|decembre|décembre)\s+(\d{4})\b/gi;
  for (const match of line.matchAll(monthPattern)) {
    const day = Number(match[1]);
    const monthLabel = normalizeText(match[2]);
    const year = Number(match[3]);
    const month = MONTHS_FR[monthLabel];
    if (!month) {
      continue;
    }
    const iso = toIsoDate(year, month, day);
    if (iso) {
      found.add(iso);
    }
  }

  return Array.from(found.values());
}

function detectFromText(text: string): DetectedDate[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const detected: DetectedDate[] = [];
  const dedupe = new Set<string>();

  for (const originalLine of lines) {
    const line = normalizeText(originalLine);
    const rule = KEYWORD_RULES.find((item) => line.includes(item.keyword));
    if (!rule) {
      continue;
    }

    const dates = extractDatesFromLine(originalLine);
    if (dates.length === 0) {
      continue;
    }

    for (const date of dates) {
      const key = `${date}|${rule.type}|${rule.description}`;
      if (dedupe.has(key)) {
        continue;
      }

      dedupe.add(key);
      detected.push({
        id: key,
        date,
        description: rule.description,
        type: rule.type,
      });
    }
  }

  return detected.sort((a, b) => a.date.localeCompare(b.date));
}

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const fileValue = formData.get("file");

    if (!(fileValue instanceof File)) {
      return NextResponse.json({ error: "Aucun fichier PDF reçu." }, { status: 400 });
    }

    const extension = fileValue.name.split(".").pop()?.toLowerCase();
    if (fileValue.type !== "application/pdf" && extension !== "pdf") {
      return NextResponse.json({ error: "Le fichier doit être un PDF." }, { status: 400 });
    }

    const buffer = Buffer.from(await fileValue.arrayBuffer());
    const pdfModule = (await import("pdf-parse")) as unknown as {
      PDFParse?: new (params: { data: Buffer }) => {
        getText: () => Promise<{ text?: string }>;
        destroy: () => Promise<void>;
      };
    };

    if (!pdfModule.PDFParse) {
      return NextResponse.json({ error: "La librairie pdf-parse est indisponible." }, { status: 500 });
    }

    const parser = new pdfModule.PDFParse({ data: buffer });
    const parsed = await parser.getText();
    const text = parsed.text ?? "";
    await parser.destroy();

    const dates = detectFromText(text);
    return NextResponse.json({ dates });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur lors de l'analyse du PDF.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
