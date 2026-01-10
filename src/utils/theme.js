const THEME_KEY = "verbotech_theme";

export function getTheme() {
  return localStorage.getItem(THEME_KEY) || "light";
}

export function setTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
  document.documentElement.setAttribute("data-theme", theme);
}

export function initTheme() {
  const theme = getTheme();
  document.documentElement.setAttribute("data-theme", theme);
}
