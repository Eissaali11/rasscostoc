/**
 * RASSCO design tokens for charts / inline styles (Portal).
 * Keep in sync with `styles/rassco-tokens.css`.
 */
export const rassco = {
  primary: "#18B2B0",
  primaryHover: "#149D9B",
  gray: "#5F6368",
  background: "#F5F7F8",
  card: "#FFFFFF",
  border: "#18B2B0",
  text: "#1A1D21",
  textSecondary: "#4A5056",
  success: "#18B2B0",
  warning: "#F4B740",
  danger: "#E05252",
  tableHeader: "#F3F4F6",
  inputBorder: "#D7DCE2",
  chartMuted: "#DADDE1",
  darkBg: "#1F2328",
  darkCard: "#2A2F36",
  radius: {
    input: 12,
    button: 12,
    card: 22,
    dialog: 18,
  },
  shadow: {
    card: "0 10px 28px rgba(24,178,176,.14), 0 2px 8px rgba(24,178,176,.08)",
  },
  chart: ["#18B2B0", "#5F6368", "#F4B740", "#DADDE1", "#E05252"],
} as const;
