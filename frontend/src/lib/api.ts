const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

function setToken(token: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('token', token);
}

function clearToken() {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem('token'); } catch {}
}

function decodeJwt<T = any>(token: string): T | null {
  try {
    const [, payload] = token.split('.');
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decodeURIComponent(
      json
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    ));
  } catch {
    return null;
  }
}

function getCurrentRole(): string | null {
  const t = getToken();
  if (!t) return null;
  const data = decodeJwt<{ role?: string }>(t);
  return data?.role || null;
}

async function request(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options.headers as any) };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    // intenta extraer mensaje útil del backend
    let message = `HTTP ${res.status}`;
    try {
      const text = await res.text();
      if (text) {
        try {
          const j = JSON.parse(text);
          message = j?.message || message;
        } catch {
          message = text;
        }
      }
    } catch {}
    throw new Error(message);
  }
  return res.json();
}

export const api = {
  setToken,
  clearToken,
  getCurrentRole,
  getCurrentUser(): { id?: string; email?: string; role?: string; name?: string; username?: string } | null {
    const t = getToken();
    if (!t) return null;
    const p: any = decodeJwt(t);
    if (!p) return null;
    const id = p.id || p.userId || p.sub || p.uid || undefined;
    const email = p.email || p.userEmail || undefined;
    const role = p.role || p.userRole || undefined;
    const name = p.name || p.fullName || undefined;
    const username = p.username || p.user || undefined;
    return { id, email, role, name, username };
  },
  logout() {
    clearToken();
  },
  async me() {
    return request('/auth/me');
  },
  async login(email: string, password: string) {
    const data = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    setToken(data.token);
    return data;
  },
  async register(email: string, password: string, name?: string) {
    const data = await request('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name }) });
    setToken(data.token);
    return data;
  },
  async vehiclesList() {
    return request('/vehicles');
  },
  async vehiclesCreate(payload: { plate: string; brand?: string; model?: string; status?: string; club?: string; driverId?: string }) {
    return request('/vehicles', { method: 'POST', body: JSON.stringify(payload) });
  },
  async vehiclesUpdate(id: string, payload: Partial<{ plate: string; brand?: string; model?: string; status?: string; club?: string; driverId?: string }>) {
    return request(`/vehicles/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
  },
  async vehiclesDelete(id: string) {
    return request(`/vehicles/${id}`, { method: 'DELETE' });
  },
  async driversList() {
    return request('/drivers');
  },
  async driversCreate(payload: { name: string; license?: string; userId?: string; club?: string; nickname?: string; preferNickname?: boolean }) {
    return request('/drivers', { method: 'POST', body: JSON.stringify(payload) });
  },
  async driversUpdate(id: string, payload: Partial<{ name: string; license?: string; userId?: string; club?: string; nickname?: string; preferNickname?: boolean }>) {
    return request(`/drivers/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
  },
  async driversDelete(id: string) {
    return request(`/drivers/${id}`, { method: 'DELETE' });
  },
  // Routes
  async routesList() {
    return request('/routes');
  },
  async routesCreate(payload: { name: string; description?: string; geojson?: any }) {
    return request('/routes', { method: 'POST', body: JSON.stringify(payload) });
  },
  async routesUpdate(id: string, payload: Partial<{ name: string; description?: string; geojson?: any }>) {
    return request(`/routes/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
  },
  async routesDelete(id: string) {
    return request(`/routes/${id}`, { method: 'DELETE' });
  },
  async routesImportGpx(id: string, file: File) {
    const token = getToken();
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`${API_URL}/routes/${id}/import-gpx`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } as any : undefined,
      body: fd,
    });
    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try { message = await res.text(); } catch {}
      throw new Error(message || 'Upload failed');
    }
    return res.json();
  },
  routesExportGpxUrl(id: string) {
    return `${API_URL}/routes/${id}/export.gpx`;
  },
  // Positions
  async positionsCreate(payload: { vehicleId: string; lat: number; lng: number; speed?: number; timestamp?: string }) {
    return request('/positions', { method: 'POST', body: JSON.stringify(payload) });
  },
  async positionsLastAll() {
    return request('/positions/last');
  },
  async positionsLast(vehicleId: string) {
    return request(`/positions/last/${vehicleId}`);
  },
  // Registrations
  async registrationsCreate(payload: {
    type: 'PILOT' | 'SPECTATOR' | 'SPONSOR';
    routeId: string;
    when: string;
    whenMultiple?: string[];
    name: string;
    email: string;
    phone: string;
    license?: string;
    motoPlate?: string;
    motoBrand?: string;
    motoModel?: string;
    motoClub?: string;
    message?: string;
    companyName?: string;
    website?: string;
    services?: string;
    sponsorLocations?: Array<{ lat: number; lng: number; label?: string; category?: string; note?: string }>;
  }) {
    // público, no requiere token
    return request('/registrations', { method: 'POST', body: JSON.stringify(payload) });
  },
  async registrationsPending() {
    return request('/registrations/pending');
  },
  async registrationsSponsors(status?: 'PENDING' | 'APPROVED' | 'REJECTED') {
    const q = status ? `?status=${encodeURIComponent(status)}` : '';
    return request(`/registrations/sponsors${q}`);
  },
  async registrationsSponsorsPublicApproved() {
    return request('/registrations/sponsors-public');
  },
  async registrationsSetStatus(id: string, status: 'APPROVED' | 'REJECTED') {
    return request(`/registrations/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
  },
  async registrationsUpdate(id: string, data: any) {
    return request(`/registrations/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  },
  async registrationsDelete(id: string) {
    return request(`/registrations/${id}`, { method: 'DELETE' });
  },
  async registrationsAddPoi(id: string, poi: { lat: number; lng: number; label?: string; category?: string; note?: string }) {
    return request(`/registrations/${id}/pois`, { method: 'POST', body: JSON.stringify(poi) });
  },
  async registrationsUpdatePoi(id: string, poiId: string, data: { label?: string; category?: string; note?: string }) {
    return request(`/registrations/${id}/pois/${poiId}`, { method: 'PATCH', body: JSON.stringify(data) });
  },
  async registrationsDeletePoi(id: string, poiId: string) {
    return request(`/registrations/${id}/pois/${poiId}`, { method: 'DELETE' });
  },
};
