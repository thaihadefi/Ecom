import { AI_CONFIG } from "../configs/ai.config";

class GroqError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "GroqError";
    this.status = status;
    this.code = code;
  }
}

interface CatalogModel {
  id: string;
  chatCapable: boolean;
  contextWindow: number;
  maxCompletion: number;
}

const FAILOVER_STATUSES: ReadonlySet<number> = new Set([404, 413, 429, 500, 502, 503, 504]);

const isModelGone = (error: unknown): boolean =>
  error instanceof GroqError && (error.status === 404 || error.code === "model_decommissioned");

const shouldFailover = (error: unknown): boolean => {
  if (error instanceof GroqError) return FAILOVER_STATUSES.has(error.status) || isModelGone(error);
  return true;
};

let catalog: { models: CatalogModel[] | null; expiresAt: number } = { models: null, expiresAt: 0 };
let pendingCatalog: Promise<CatalogModel[] | null> | null = null;

const toCatalogModel = (m: Record<string, unknown>): CatalogModel => ({
  id: String(m.id),
  chatCapable:
    Array.isArray(m.supported_features) &&
    (m.supported_features as string[]).includes("tools") &&
    Number(m.context_window) >= AI_CONFIG.MIN_CONTEXT_WINDOW,
  contextWindow: Number(m.context_window) || 0,
  maxCompletion: Number(m.max_completion_tokens) || 0
});

const refreshCatalog = async (): Promise<CatalogModel[] | null> => {
  try {
    const res = await fetch(`${AI_CONFIG.API_BASE}/models`, {
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      signal: AbortSignal.timeout(AI_CONFIG.CATALOG_TIMEOUT_MS)
    });
    if (!res.ok) throw new Error(`responded ${res.status}`);

    const json = await res.json();
    const models = (json.data ?? [])
      .filter((m: Record<string, unknown>) =>
        m.active === true &&
        Array.isArray(m.input_modalities) && (m.input_modalities as string[]).includes("text") &&
        Array.isArray(m.output_modalities) && (m.output_modalities as string[]).includes("text") &&
        !String(m.id).includes("guard")
      )
      .map(toCatalogModel);
    if (models.length === 0) throw new Error("catalog has no text models");

    catalog = { models, expiresAt: Date.now() + AI_CONFIG.CATALOG_TTL_MS };
  } catch (error) {
    console.warn(`[AI] model catalog unavailable: ${error instanceof Error ? error.message : error}`);
    catalog = { models: catalog.models, expiresAt: Date.now() + AI_CONFIG.CATALOG_FAILURE_TTL_MS };
  }
  return catalog.models;
};

const loadCatalog = (): Promise<CatalogModel[] | null> => {
  if (Date.now() < catalog.expiresAt) return Promise.resolve(catalog.models);
  if (!pendingCatalog) {
    pendingCatalog = refreshCatalog().finally(() => {
      pendingCatalog = null;
    });
  }
  return pendingCatalog;
};

const warnedUnavailable = new Set<string>();

const getModelChain = async (): Promise<string[]> => {
  const preferred = process.env.GROQ_MODEL?.trim() || undefined;
  const pinned = [...new Set([preferred, AI_CONFIG.DEFAULT_MODEL])].filter((id): id is string => !!id);

  const models = await loadCatalog();
  if (!models) return pinned;

  const live = new Set(models.map((m) => m.id));
  if (preferred && !live.has(preferred) && !warnedUnavailable.has(preferred)) {
    warnedUnavailable.add(preferred);
    console.warn(`[AI] GROQ_MODEL "${preferred}" is not in the live Groq catalog and is skipped`);
  }

  const discovered = models
    .filter((m) => m.chatCapable)
    .sort((a, b) => b.contextWindow - a.contextWindow || b.maxCompletion - a.maxCompletion || a.id.localeCompare(b.id))
    .map((m) => m.id);

  const chain = [...new Set([...pinned, ...discovered])].filter((id) => live.has(id));
  return (chain.length > 0 ? chain : pinned).slice(0, AI_CONFIG.MAX_ATTEMPTS);
};

const callGroq = async (model: string, prompt: string, timeoutMs: number): Promise<string> => {
  const res = await fetch(`${AI_CONFIG.API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }]
    }),
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new GroqError(`Groq [${model}] responded ${res.status}`, res.status, body?.error?.code);
  }

  const data = await res.json();
  const content: string = data.choices?.[0]?.message?.content || "";
  if (!content.trim()) throw new GroqError(`Groq [${model}] returned an empty answer`, 502);
  return content;
};

const describeFailure = (error: unknown): string => {
  if (error instanceof GroqError) return `${error.status}${error.code ? ` ${error.code}` : ""}`;
  return error instanceof Error ? error.name : "error";
};

export const aiGenerateAnswer = async (prompt: string): Promise<string> => {
  if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY is not configured");

  const chain = await getModelChain();
  const deadline = Date.now() + AI_CONFIG.TOTAL_BUDGET_MS;
  let lastError: unknown;

  for (let i = 0; i < chain.length; i++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;

    try {
      return await callGroq(chain[i], prompt, Math.min(AI_CONFIG.REQUEST_TIMEOUT_MS, remaining));
    } catch (error) {
      lastError = error;
      if (!shouldFailover(error)) throw error;
      if (isModelGone(error)) catalog.expiresAt = 0;

      const next = chain[i + 1];
      console.warn(`[AI] ${chain[i]} failed (${describeFailure(error)})${next ? `, trying ${next}` : ""}`);
    }
  }

  throw lastError;
};
