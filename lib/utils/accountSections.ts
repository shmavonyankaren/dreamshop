export const accountSections = ["overview", "profile", "security"] as const;
export function focusAccountSection(hash = window.location.hash): boolean {
  const id = hash.replace(/^#/, "");
  if (window.location.pathname !== "/account" || !accountSections.some(section => section === id)) return false;
  const target = document.getElementById(id);
  if (!target) return false;
  target.scrollIntoView({ block: "start" });
  target.focus({ preventScroll: true });
  return true;
}
export function navigateAccountSection(hash: string): boolean {
  if (window.location.pathname !== "/account" || !accountSections.some(section => `#${section}` === hash) || !document.getElementById(hash.slice(1))) return false;
  if (window.location.hash !== hash) window.history.pushState(null, "", `/account${hash}`);
  // pushState does not emit hashchange; notify selection and section focus together.
  window.dispatchEvent(new Event("hashchange"));
  return true;
}
