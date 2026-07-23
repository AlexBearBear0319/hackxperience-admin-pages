"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchAdminSettings, updateAdminSettings } from "@/lib/client/admin-api";

type PortalSettings = {
  submissionsOpen: boolean;
  allowResubmissions: boolean;
  activeTracks: string[];
};

type PortalSettingsContextValue = PortalSettings & {
  toggleSubmissionsOpen: () => void;
  toggleAllowResubmissions: () => void;
};

const PortalSettingsContext = createContext<PortalSettingsContextValue | null>(null);

export function usePortalSettings() {
  const ctx = useContext(PortalSettingsContext);
  if (!ctx) throw new Error("usePortalSettings must be used inside PortalSettingsProvider");
  return ctx;
}

export function PortalSettingsProvider({ children }: { children: ReactNode }) {
  const [submissionsOpen, setSubmissionsOpen] = useState(false);
  const [allowResubmissions, setAllowResubmissions] = useState(true);
  const [activeTracks, setActiveTracks] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const payload = await fetchAdminSettings();
        if (cancelled || !payload.settings) return;
        setSubmissionsOpen(payload.settings.submission_status);
        setAllowResubmissions(payload.settings.resubmission_status);
        setActiveTracks(
          Array.isArray(payload.settings.active_tracks)
            ? payload.settings.active_tracks.filter((item): item is string => typeof item === "string")
            : [],
        );
      } catch {
        // Keep local defaults when settings endpoint isn't available.
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleSubmissionsOpen = useCallback(() => {
    setSubmissionsOpen((previous) => {
      const next = !previous;
      void updateAdminSettings({ submission_status: next }).catch(() => {
        setSubmissionsOpen(previous);
      });
      return next;
    });
  }, []);

  const toggleAllowResubmissions = useCallback(() => {
    setAllowResubmissions((previous) => {
      const next = !previous;
      void updateAdminSettings({ resubmission_status: next }).catch(() => {
        setAllowResubmissions(previous);
      });
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      submissionsOpen,
      allowResubmissions,
      activeTracks,
      toggleSubmissionsOpen,
      toggleAllowResubmissions,
    }),
    [submissionsOpen, allowResubmissions, activeTracks, toggleSubmissionsOpen, toggleAllowResubmissions],
  );

  return <PortalSettingsContext.Provider value={value}>{children}</PortalSettingsContext.Provider>;
}
