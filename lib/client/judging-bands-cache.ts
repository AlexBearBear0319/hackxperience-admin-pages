"use client";

import {
  parseJudgingBands,
  type JudgingBandsMap,
  type JudgingBandsPayload,
} from "@/lib/judging-bands";

const STORAGE_KEY = "hx.judge.judgingBands";

function readCache(): JudgingBandsPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<JudgingBandsPayload>;
    if (typeof parsed.version !== "number" || !parsed.bands) return null;
    const bands = parseJudgingBands(parsed.bands);
    if (Object.keys(bands).length === 0) return null;
    return { version: Math.round(parsed.version), bands };
  } catch {
    return null;
  }
}

function writeCache(payload: JudgingBandsPayload) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Quota / private mode — ignore.
  }
}

/**
 * Load judging bands once: localStorage hit → no network.
 * Miss → fetch judge API, then persist. Bump settings.judging_bands_version
 * and clear this key (or call clearJudgingBandsCache) if the rubric changes.
 */
export async function loadJudgingBands(): Promise<JudgingBandsPayload> {
  const cached = readCache();
  if (cached) return cached;

  const response = await fetch("/api/judge/bands", { cache: "no-store" });
  const payload = (await response.json()) as Partial<JudgingBandsPayload> & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "Unable to load judging bands.");
  }

  const version = typeof payload.version === "number" ? Math.round(payload.version) : 1;
  const bands = parseJudgingBands(payload.bands);
  const next = { version, bands };
  writeCache(next);
  return next;
}

export function peekCachedJudgingBands(): JudgingBandsMap | null {
  return readCache()?.bands ?? null;
}

export function clearJudgingBandsCache() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
