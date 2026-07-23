"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

export type GlobalSettings = {
  id: number;
  submission_status: boolean;
  resubmission_status: boolean;
  max_team_size: number;
  max_file_size: number;
  deadline: string;
  active_tracks: string[];
  technical_execution_value: number;
  problem_solution_fit_value: number;
  innovation_creativity_value: number;
  presentation_quality_value: number;
  entrepreneurship_value: number;
  updated_at: string;
};

type SettingsResponse = {
  settings?: Partial<GlobalSettings>;
  error?: string;
};

const DEFAULT_SETTINGS: GlobalSettings = {
  id: 1,
  submission_status: true,
  resubmission_status: true,
  max_team_size: 5,
  max_file_size: 10,
  deadline: "",
  active_tracks: [],
  technical_execution_value: 20,
  problem_solution_fit_value: 20,
  innovation_creativity_value: 30,
  presentation_quality_value: 20,
  entrepreneurship_value: 10,
  updated_at: "",
};

function normalizeSettings(value: Partial<GlobalSettings> | undefined): GlobalSettings {
  const next = value ?? {};
  return {
    id: typeof next.id === "number" ? next.id : DEFAULT_SETTINGS.id,
    submission_status: typeof next.submission_status === "boolean"
      ? next.submission_status
      : DEFAULT_SETTINGS.submission_status,
    resubmission_status: typeof next.resubmission_status === "boolean"
      ? next.resubmission_status
      : DEFAULT_SETTINGS.resubmission_status,
    max_team_size: typeof next.max_team_size === "number"
      ? Math.max(1, Math.round(next.max_team_size))
      : DEFAULT_SETTINGS.max_team_size,
    max_file_size: typeof next.max_file_size === "number"
      ? Math.max(1, Math.round(next.max_file_size))
      : DEFAULT_SETTINGS.max_file_size,
    deadline: typeof next.deadline === "string" ? next.deadline : DEFAULT_SETTINGS.deadline,
    active_tracks: Array.isArray(next.active_tracks)
      ? next.active_tracks.filter((item): item is string => typeof item === "string")
      : DEFAULT_SETTINGS.active_tracks,
    technical_execution_value: typeof next.technical_execution_value === "number"
      ? Math.max(0, Math.round(next.technical_execution_value))
      : DEFAULT_SETTINGS.technical_execution_value,
    problem_solution_fit_value: typeof next.problem_solution_fit_value === "number"
      ? Math.max(0, Math.round(next.problem_solution_fit_value))
      : DEFAULT_SETTINGS.problem_solution_fit_value,
    innovation_creativity_value: typeof next.innovation_creativity_value === "number"
      ? Math.max(0, Math.round(next.innovation_creativity_value))
      : DEFAULT_SETTINGS.innovation_creativity_value,
    presentation_quality_value: typeof next.presentation_quality_value === "number"
      ? Math.max(0, Math.round(next.presentation_quality_value))
      : DEFAULT_SETTINGS.presentation_quality_value,
    entrepreneurship_value: typeof next.entrepreneurship_value === "number"
      ? Math.max(0, Math.round(next.entrepreneurship_value))
      : DEFAULT_SETTINGS.entrepreneurship_value,
    updated_at: typeof next.updated_at === "string" ? next.updated_at : DEFAULT_SETTINGS.updated_at,
  };
}

export function useSettings() {
  const [settings, setSettings] = useState<GlobalSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/settings/public", { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as SettingsResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load settings.");
      }

      const normalized = normalizeSettings(payload.settings);
      setSettings(normalized);
      setError("");
      return normalized;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unable to load settings.";
      setError(message);
      throw cause;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const channel = supabaseBrowser
      .channel("global-settings-singleton")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "settings", filter: "id=eq.1" },
        () => {
          void refresh();
        },
      )
      .subscribe();

    return () => {
      void supabaseBrowser.removeChannel(channel);
    };
  }, [refresh]);

  const deadlineAt = useMemo(() => {
    if (!settings.deadline) return null;
    const parsed = new Date(settings.deadline);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [settings.deadline]);

  return {
    settings,
    deadlineAt,
    loading,
    error,
    refresh,
  };
}
