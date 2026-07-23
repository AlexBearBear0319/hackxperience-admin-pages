// Shared visual tokens for the sponsor dashboard (mirrors judge portal).

export const C = {
  bgPrimary: "#f2ede5",
  bgCard: "#fef9f1",
  textPrimary: "#1d1c17",
  textMuted: "#7a7669",
  textSuccess: "#3a9e6a",
  borderLight: "#d8d2c5",
  borderMedium: "#d8d2c5",
  primary: "#CC0000",
  white: "#fef9f1",
} as const;

export const FM = "var(--font-ibm-plex-mono), 'IBM Plex Mono', monospace";
export const FB = "var(--font-bebas-neue), 'Bebas Neue', sans-serif";
export const SHADOW = "4px 4px 0 0 #CC0000";
export const SPRING = { type: "spring" as const, stiffness: 420, damping: 18 };

export const RESPONSIVE_CSS = `
  @media (max-width: 768px) {
    .sp-topbar { padding: 0 16px !important; }
    .sp-topbar-meta { display: none !important; }
    .sp-hero { padding: 14px 16px 16px !important; }
    .sp-hero-h1 { font-size: 28px !important; }
    .sp-body { padding: 16px !important; }
    .sp-tabs { flex-wrap: wrap !important; }
    .sp-card-actions { flex-direction: column !important; align-items: stretch !important; }
    .sp-score-input { width: 100% !important; }
  }

  .sp-tab { transition: background 0.15s, color 0.15s, border-color 0.15s; }
  .sp-tab:hover { border-color: #CC0000; color: #CC0000; }

  .sp-ghost-btn { transition: background 0.15s, color 0.15s, border-color 0.15s; }
  .sp-ghost-btn:hover { border-color: #CC0000; color: #CC0000; }

  .sp-save-btn { transition: background 0.15s, transform 0.1s; }
  .sp-save-btn:hover:not(:disabled) { background: #A20000; }
  .sp-save-btn:disabled { opacity: 0.45; cursor: not-allowed; }

  .sp-score-input:focus { border-color: #CC0000 !important; outline: none; }
  .sp-search:focus { border-color: #CC0000 !important; outline: none; }

  @keyframes sp-progress-fill {
    from { width: 0%; }
  }
  .sp-progress-fill {
    animation: sp-progress-fill 0.7s ease-out forwards;
  }
`;
