export const api = {
  getLocations: async () => {
    const r = await fetch('/locations');
    return r.json();
  },
  getHistory: async (id: string, timeframe: string) => {
    let query = '?limit_hours=6';
    if (timeframe === '24h') query = '?limit_hours=24';
    if (timeframe === '7d') query = '?limit_days=7';
    if (timeframe === '30d') query = '?limit_days=30';
    const r = await fetch(`/locations/${id}/history${query}`);
    return r.json();
  }
};
