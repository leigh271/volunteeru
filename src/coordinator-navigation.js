export const coordinatorPages = ["Events", "Command Center", "Reporting"];
export function coordinatorDestination(page) {
  if (["Events", "Nonprofit Portal"].includes(page)) return "Events";
  if (["Reporting", "Impact Reports", "School Reports"].includes(page))
    return "Reporting";
  return "Command Center";
}
const svg = (body) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
export const coordinatorIcons = {
  "Command Center": svg(
    '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  ),
  Events: svg(
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18M8 15h2M14 15h2"/>',
  ),
  Reporting: svg('<path d="M4 3v18h17M9 16v-4M14 16V7M19 16v-6"/>'),
};
