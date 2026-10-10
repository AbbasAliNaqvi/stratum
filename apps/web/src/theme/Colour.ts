export const Colour = {
  background: "#F6F8FC",
  surface: "#FFFFFF",
  primary: "#2563EB",
  secondary: "#5B4BDB",
  accent: "#0F766E",
  text: "#111827",
  mutedText: "#64748B",
  border: "#DCE3ED",
  
  // Semantic Extensions
  success: "#10b981", // Emerald 500
  warning: "#f59e0b", // Amber 500
  error: "#ef4444",   // Red 500
  disabled: "#e2e8f0", // Slate 200
  
  // Surfaces and states
  surfaceHover: "#F1F5F9",
  surfaceElevated: "#FFFFFF",
  surfaceSelected: "#EFF6FF", // Blue 50
  
  textPrimary: "#111827",
  textSecondary: "#475569",
  textMuted: "#64748B",
} as const;

export function installTheme() {
  const root = document.documentElement;
  
  // Set reference colours
  root.style.setProperty("--color-primary", Colour.primary);
  root.style.setProperty("--color-secondary", Colour.secondary);
  root.style.setProperty("--color-accent", Colour.accent);
  root.style.setProperty("--color-surface", Colour.surface);
  root.style.setProperty("--color-background", Colour.background);
  root.style.setProperty("--color-border", Colour.border);
  
  // Set semantic colours
  root.style.setProperty("--color-success", Colour.success);
  root.style.setProperty("--color-warning", Colour.warning);
  root.style.setProperty("--color-error", Colour.error);
  root.style.setProperty("--color-disabled", Colour.disabled);
  
  // Set surfaces and borders
  root.style.setProperty("--color-surface-hover", Colour.surfaceHover);
  root.style.setProperty("--color-surface-elevated", Colour.surfaceElevated);
  root.style.setProperty("--color-surface-selected", Colour.surfaceSelected);
  
  // Set text colours
  root.style.setProperty("--color-text-primary", Colour.textPrimary);
  root.style.setProperty("--color-text-secondary", Colour.textSecondary);
  root.style.setProperty("--color-text-muted", Colour.textMuted);
}
