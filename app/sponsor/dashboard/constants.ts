// Sponsor dashboard — soft card UI, portal fonts, high contrast.

export const C = {
  bg: "#f2ede5",
  card: "#ffffff",
  cardAlt: "#fef9f1",
  text: "#1d1c17",
  border: "#d4cdc0",
  borderStrong: "#1d1c17",
  red: "#CC0000",
  redHover: "#A20000",
  redSoft: "#fce8e8",
  azure: "#0078D4",
  azureSoft: "#e8f3fb",
  white: "#ffffff",
  gold: "#E6B800",
  silver: "#9A9A9A",
  bronze: "#C47A3A",
} as const;

export const FM = "var(--font-ibm-plex-mono), 'IBM Plex Mono', monospace";
export const FB = "var(--font-bebas-neue), 'Bebas Neue', sans-serif";

export const CARD_SHADOW = "0 2px 8px rgba(29, 28, 23, 0.08)";
export const CARD_SHADOW_ACTIVE = "0 4px 16px rgba(204, 0, 0, 0.18)";

export const RESPONSIVE_CSS = `
  .sp-award-tab { transition: background 0.15s, color 0.15s, border-color 0.15s; }
  .sp-award-pane { animation: sp-pane-in 0.22s ease; }
  @keyframes sp-pane-in {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .sp-team-card { transition: border-color 0.15s, box-shadow 0.15s; }
  .sp-team-card:hover { border-color: #CC0000; }

  .sp-logout-btn { transition: background 0.15s, border-color 0.15s; }
  .sp-logout-btn:hover { background: rgba(204,0,0,0.08); border-color: #ff2222; }
  .sp-logout-btn:active { background: rgba(204,0,0,0.14); transform: translateY(1px); }

  .sp-hamburger { transition: border-color 0.15s, color 0.15s, background 0.15s; }
  .sp-hamburger:hover { border-color: #CC0000; color: #CC0000; background: rgba(204,0,0,0.06); }

  .sp-score-btn:hover:not(:disabled) { background: #A20000; }
  .sp-score-btn:disabled { opacity: 0.45; cursor: not-allowed; }

  .sp-input:focus,
  .sp-select:focus,
  .sp-score-input:focus {
    outline: none;
    border-color: #CC0000 !important;
    box-shadow: 0 0 0 3px rgba(204, 0, 0, 0.18);
  }

  .sp-select {
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%231d1c17' d='M1 1l5 5 5-5'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 14px center;
    padding-right: 36px !important;
  }

  @media (max-width: 820px) {
    .sp-topbar {
      padding: 12px 14px !important;
      gap: 10px !important;
    }

    .sp-body {
      padding: 0 0 55vh !important;
      max-width: none !important;
      margin: 0 !important;
    }

    .sp-award-tabs {
      flex-direction: row !important;
      gap: 0 !important;
    }

    .sp-award-tab {
      min-height: 64px !important;
      padding: 10px 12px !important;
      border-radius: 0 !important;
      margin-bottom: 0 !important;
      box-shadow: none !important;
    }

    .sp-award-tab .sp-award-tab-title {
      font-size: 13px !important;
      line-height: 1.2 !important;
    }

    .sp-award-tab .sp-award-tab-meta {
      margin-top: 6px !important;
      font-size: 12px !important;
    }

    /* Drop outer red pane chrome — full-bleed content */
    .sp-award-pane {
      border: none !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      margin-top: 0 !important;
      padding: 14px !important;
      background: transparent !important;
    }

    .sp-filters {
      flex-direction: column !important;
      align-items: stretch !important;
      gap: 10px !important;
    }

    .sp-search-wrap,
    .sp-sort-wrap {
      flex: 1 1 auto !important;
      width: 100% !important;
    }

    .sp-select {
      min-width: 0 !important;
      width: 100% !important;
      flex: 1 1 auto !important;
    }

    .sp-team-card {
      flex-wrap: wrap !important;
      align-items: flex-start !important;
      gap: 12px !important;
      padding: 12px !important;
    }

    .sp-thumb {
      width: 72px !important;
      height: 54px !important;
    }

    .sp-team-main {
      flex: 1 1 160px !important;
      min-width: 0 !important;
    }

    .sp-team-actions {
      width: 100% !important;
      flex-direction: row !important;
      align-items: center !important;
      justify-content: flex-start !important;
      gap: 10px !important;
      padding-top: 4px !important;
      border-top: 1.5px solid #d4cdc0;
    }

    .sp-score-input {
      width: 110px !important;
      flex: 0 0 auto !important;
    }

    .sp-score-status {
      text-align: left !important;
    }
  }

  @media (max-width: 420px) {
    .sp-award-tab .sp-award-tab-title {
      font-size: 12px !important;
    }
  }
`;
