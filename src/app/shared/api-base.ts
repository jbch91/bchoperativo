export const API_BASE = (() => {
  const win = window as unknown as { __API_BASE__?: string };
  if (win.__API_BASE__) return win.__API_BASE__;
  if (window.location.hostname === 'localhost') {
    return 'http://localhost:5050';
  }
  return '/api';
})();

export function apiUrl(path: string): string {
  if (API_BASE.startsWith('http')) {
    return `${API_BASE}${path}`;
  }
  return `${API_BASE}${path}`;
}
