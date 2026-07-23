import "server-only";

import { supabaseServer } from "@/lib/supabase-server";
import { normalizePortalUsername, usernameFromSupabaseEmail } from "@/lib/auth/portal-identity";
import type { PortalUserId } from "@/lib/auth/session";

export type JudgeScoresIdColumn = "judges_id" | "judge_id";

type LooseScoreRow = Record<string, unknown>;
type LegacyJudgeRow = {
  id: number;
};
type ErrorLike = {
  code?: string;
  message?: string;
};
type AuthUserListItem = {
  id: string;
  email?: string | null;
};

let cachedJudgeScoresIdColumn: JudgeScoresIdColumn | null = null;
let cachedJudgeScoresIdColumns: JudgeScoresIdColumn[] | null = null;
const authUserIdByUsernameCache = new Map<string, string | null>();
const AUTH_PER_PAGE = 200;
const AUTH_MAX_PAGES = 25;

function isMissingColumnError(error: ErrorLike | null | undefined, column: JudgeScoresIdColumn) {
  if (!error) return false;
  const message = (error.message ?? "").toLowerCase();
  const needle = column.toLowerCase();
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    (message.includes(needle) && (message.includes("column") || message.includes("schema cache"))) ||
    message.includes("does not exist")
  );
}

function isMissingTableError(error: ErrorLike | null | undefined) {
  if (!error) return false;
  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    message.includes("could not find the table") ||
    message.includes("relation") ||
    message.includes("does not exist")
  );
}

function isDuplicateError(error: ErrorLike | null | undefined) {
  if (!error) return false;
  const message = (error.message ?? "").toLowerCase();
  return error.code === "23505" || message.includes("duplicate") || message.includes("already exists");
}

export function isJudgeScoreActorIdError(error: ErrorLike | null | undefined) {
  if (!error) return false;

  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "23503" || // foreign_key_violation
    error.code === "22P02" || // invalid_text_representation
    error.code === "42804" || // datatype_mismatch
    (message.includes("foreign key") && message.includes("judge")) ||
    message.includes("invalid input syntax") ||
    message.includes("violates foreign key constraint")
  );
}

export function toDatabaseJudgeActorId(value: PortalUserId): string | number {
  if (typeof value === "number") return value;

  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    const asNumber = Number(trimmed);
    if (Number.isSafeInteger(asNumber)) return asNumber;
  }

  return trimmed;
}

function sameActorId(left: string | number, right: string | number) {
  return String(left) === String(right);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function findAuthUserIdByPortalUsername(username: string) {
  const normalizedUsername = normalizePortalUsername(username);
  if (!normalizedUsername) return null;

  if (authUserIdByUsernameCache.has(normalizedUsername)) {
    return authUserIdByUsernameCache.get(normalizedUsername) ?? null;
  }

  let page = 1;
  for (let checkedPages = 0; checkedPages < AUTH_MAX_PAGES; checkedPages += 1) {
    const { data, error } = await supabaseServer.auth.admin.listUsers({
      page,
      perPage: AUTH_PER_PAGE,
    });

    if (error) {
      throw new Error(error.message);
    }

    for (const user of data.users as AuthUserListItem[]) {
      const portalUsername =
        usernameFromSupabaseEmail(user.email) ||
        normalizePortalUsername(user.email);
      if (portalUsername === normalizedUsername) {
        authUserIdByUsernameCache.set(normalizedUsername, user.id);
        return user.id;
      }
    }

    if (!data.nextPage) break;
    page = data.nextPage;
  }

  authUserIdByUsernameCache.set(normalizedUsername, null);
  return null;
}

export async function resolveJudgeScoresIdColumn(): Promise<JudgeScoresIdColumn> {
  if (cachedJudgeScoresIdColumn) return cachedJudgeScoresIdColumn;

  const columns = await resolveJudgeScoresIdColumns();
  cachedJudgeScoresIdColumn = columns[0];
  return columns[0];
}

export async function resolveJudgeScoresIdColumns(): Promise<JudgeScoresIdColumn[]> {
  if (cachedJudgeScoresIdColumns && cachedJudgeScoresIdColumns.length > 0) {
    return cachedJudgeScoresIdColumns;
  }

  // Prefer `judge_id` first because some environments keep this as the FK-backed column.
  const candidates: JudgeScoresIdColumn[] = ["judge_id", "judges_id"];
  const available: JudgeScoresIdColumn[] = [];
  let lastError: string | null = null;

  for (const candidate of candidates) {
    const { error } = await supabaseServer
      .from("judges_scores")
      .select(candidate)
      .limit(1);

    if (!error) {
      available.push(candidate);
      continue;
    }

    if (!isMissingColumnError(error, candidate)) {
      throw new Error(error.message);
    }

    lastError = error.message;
  }

  if (available.length === 0) {
    throw new Error(lastError ?? "Unable to resolve judge score identity column.");
  }

  cachedJudgeScoresIdColumns = available;
  if (!cachedJudgeScoresIdColumn) {
    cachedJudgeScoresIdColumn = available[0];
  }
  return available;
}

function toNullableNumber(value: unknown) {
  return typeof value === "number" ? value : null;
}

function toNullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

export type NormalizedJudgeScoreRow = {
  judges_id: number | string;
  submission_id: string;
  technical_execution: number | null;
  problem_solution_fit: number | null;
  innovation_creativity: number | null;
  presentation_quality: number | null;
  entrepreneurship: number | null;
  private_comment: string | null;
};

export function normalizeJudgeScoreRows(
  rows: LooseScoreRow[] | null | undefined,
  idColumn: JudgeScoresIdColumn,
): NormalizedJudgeScoreRow[] {
  return (rows ?? [])
    .map((row) => {
      const judgeId = row[idColumn];
      const submissionId = row.submission_id;
      if ((typeof judgeId !== "string" && typeof judgeId !== "number") || typeof submissionId !== "string") {
        return null;
      }

      return {
        judges_id: judgeId,
        submission_id: submissionId,
        technical_execution: toNullableNumber(row.technical_execution),
        problem_solution_fit: toNullableNumber(row.problem_solution_fit),
        innovation_creativity: toNullableNumber(row.innovation_creativity),
        presentation_quality: toNullableNumber(row.presentation_quality),
        entrepreneurship: toNullableNumber(row.entrepreneurship),
        private_comment: toNullableString(row.private_comment),
      };
    })
    .filter((row): row is NormalizedJudgeScoreRow => Boolean(row));
}

export function selectJudgeScoresColumns(idColumn: JudgeScoresIdColumn) {
  return `${idColumn},submission_id,technical_execution,problem_solution_fit,innovation_creativity,presentation_quality,entrepreneurship,private_comment`;
}

export async function resolveLegacyJudgeId(
  username: string,
  options?: { createIfMissing?: boolean },
) {
  const normalizedUsername = normalizePortalUsername(username);
  if (!normalizedUsername) return null;

  const existing = await supabaseServer
    .from("judges")
    .select("id")
    .ilike("username", normalizedUsername)
    .maybeSingle<LegacyJudgeRow>();

  if (existing.error) {
    if (isMissingTableError(existing.error)) return null;
    throw new Error(existing.error.message);
  }

  if (typeof existing.data?.id === "number") return existing.data.id;
  if (!options?.createIfMissing) return null;

  const insertResult = await supabaseServer
    .from("judges")
    .insert({
      username: normalizedUsername,
      password: `auth_managed_${Date.now()}`,
    })
    .select("id")
    .single<LegacyJudgeRow>();

  if (!insertResult.error && typeof insertResult.data?.id === "number") {
    return insertResult.data.id;
  }

  if (isMissingTableError(insertResult.error)) {
    return null;
  }

  if (isDuplicateError(insertResult.error)) {
    const duplicateLookup = await supabaseServer
      .from("judges")
      .select("id")
      .ilike("username", normalizedUsername)
      .maybeSingle<LegacyJudgeRow>();

    if (duplicateLookup.error) {
      if (isMissingTableError(duplicateLookup.error)) return null;
      throw new Error(duplicateLookup.error.message);
    }

    return typeof duplicateLookup.data?.id === "number" ? duplicateLookup.data.id : null;
  }

  throw new Error(insertResult.error?.message ?? "Unable to create legacy judge row.");
}

export async function resolveJudgeActorCandidates({
  sessionUserId,
  sessionUsername,
  createLegacyIfMissing = false,
}: {
  sessionUserId: PortalUserId;
  sessionUsername: string;
  createLegacyIfMissing?: boolean;
}) {
  const primaryActorId = toDatabaseJudgeActorId(sessionUserId);
  let mappedAuthUserId: string | null = null;

  // Compatibility: older cookies might hold user_roles.id; map it to user_roles.user_id.
  if (typeof sessionUserId === "string") {
    const roleRowId = sessionUserId.trim();
    if (isUuid(roleRowId)) {
      const mappedResult = await supabaseServer
        .from("user_roles")
        .select("user_id")
        .eq("id", roleRowId)
        .maybeSingle<{ user_id: string }>();

      if (mappedResult.error) {
        throw new Error(mappedResult.error.message);
      }

      if (typeof mappedResult.data?.user_id === "string" && mappedResult.data.user_id.trim()) {
        mappedAuthUserId = mappedResult.data.user_id.trim();
      }
    }
  }

  const usernameMappedAuthUserId = await findAuthUserIdByPortalUsername(sessionUsername);

  const legacyJudgeId = await resolveLegacyJudgeId(sessionUsername, {
    createIfMissing: createLegacyIfMissing,
  });

  const candidates: Array<string | number> = [primaryActorId];
  if (
    mappedAuthUserId &&
    !candidates.some((candidate) => sameActorId(candidate, mappedAuthUserId))
  ) {
    candidates.push(mappedAuthUserId);
  }
  if (
    usernameMappedAuthUserId &&
    !candidates.some((candidate) => sameActorId(candidate, usernameMappedAuthUserId))
  ) {
    candidates.push(usernameMappedAuthUserId);
  }
  if (
    typeof legacyJudgeId === "number" &&
    !candidates.some((candidate) => sameActorId(candidate, legacyJudgeId))
  ) {
    candidates.push(legacyJudgeId);
  }

  return {
    primaryActorId,
    legacyJudgeId,
    candidates,
  };
}
