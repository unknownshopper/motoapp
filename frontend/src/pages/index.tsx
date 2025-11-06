import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import Head from 'next/head';

declare global {
  // eslint-disable-next-line no-var
  var L: any;
}

type Route = { id: string; name: string; description?: string | null; geojson?: any };
type Ride = { id: string; routeId: string; routeName: string; when: string; note?: string };

export default function Home() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registered, setRegistered] = useState<Record<string, boolean>>({});
  const [openRideId, setOpenRideId] = useState<string | null>(null);
  const [form, setForm] = useState<{ name: string; email: string; phone: string; license: string; motoPlate: string; motoBrand: string; motoModel: string; motoClub: string; message: string }>({ name: '', email: '', phone: '', license: '', motoPlate: '', motoBrand: '', motoModel: '', motoClub: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Spectator modal state
  const [openSpectator, setOpenSpectator] = useState(false);
  const [spectator, setSpectator] = useState<{ routeId: string; when: string; name: string; email: string; phone: string; message: string }>({ routeId: '', when: '', name: '', email: '', phone: '', message: '' });
  const [spectatorError, setSpectatorError] = useState<string | null>(null);
  const [spectatorSubmitting, setSpectatorSubmitting] = useState(false);

  // Sponsor modal state
  const [openSponsor, setOpenSponsor] = useState(false);
  const [sponsor, setSponsor] = useState<{ routeId: string; when: string[]; name: string; email: string; phone: string; companyName: string; website: string; services: string; message: string }>(
    { routeId: '', when: [], name: '', email: '', phone: '', companyName: '', website: '', services: '', message: '' }
  );
  const [sponsorLocations, setSponsorLocations] = useState<Array<{ lat: number; lng: number; category?: string; note?: string }>>([]);
  const [sponsorError, setSponsorError] = useState<string | null>(null);
  const [sponsorSubmitting, setSponsorSubmitting] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.routesList();
        setRoutes(data);
      } catch (e: any) {
        setError(`Error cargando rutas (${e.message})`);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Available dates: Weekends (Sat/Sun) at 09:00 and Thursday night rides (18:00–00:00) in Nov & Dec 2025
  const spectatorDates = useMemo(() => {
    type Opt = { group: 'Fines de semana' | 'Jueves nocturnos'; value: string; label: string; ts: number };
    const opts: Opt[] = [];
    const months = [10, 11]; // Nov(10) & Dec(11) 2025
    const dayName = (d: Date) => ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d.getDay()];
    const monthName = (d: Date) => ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][d.getMonth()];

    for (const m of months) {
      // Iterate all days in month
      const d = new Date(2025, m, 1);
      while (d.getMonth() === m) {
        const dow = d.getDay();
        // Weekends 09:00
        if (dow === 6 || dow === 0) {
          const start = new Date(2025, m, d.getDate(), 9, 0, 0, 0);
          const value = `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,'0')}-${String(start.getDate()).padStart(2,'0')}T${String(start.getHours()).padStart(2,'0')}:${String(start.getMinutes()).padStart(2,'0')}`;
          const label = `${dayName(start)} ${start.getDate()} ${monthName(start)} · 09:00`;
          opts.push({ group: 'Fines de semana', value, label, ts: start.getTime() });
        }
        // Thursday night 18:00–00:00
        if (dow === 4) {
          const start = new Date(2025, m, d.getDate(), 18, 0, 0, 0);
          const value = `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,'0')}-${String(start.getDate()).padStart(2,'0')}T${String(start.getHours()).padStart(2,'0')}:${String(start.getMinutes()).padStart(2,'0')}`;
          const label = `Jue noche ${start.getDate()} ${monthName(start)} · 18:00–00:00`;
          opts.push({ group: 'Jueves nocturnos', value, label, ts: start.getTime() });
        }
        d.setDate(d.getDate() + 1);
      }
    }
    // sort chronologically
    opts.sort((a, b) => a.ts - b.ts);
    return opts;
  }, []);

  // Visible dates based on selected route: include Thursday nights only for route "Nocturna"
  const visibleSpectatorDates = useMemo(() => {
    const selected = routes.find(r => r.id === spectator.routeId);
    const isNocturna = (selected?.name || '').toLowerCase().includes('nocturna');
    return spectatorDates.filter(o => o.group === 'Fines de semana' || (isNocturna && o.group === 'Jueves nocturnos'));
  }, [routes, spectator.routeId, spectatorDates]);

  // Visible Sponsor dates based on selected route: Nocturna -> solo Jueves nocturnos; otras -> solo Fines de semana
  const visibleSponsorDates = useMemo(() => {
    const selected = routes.find(r => r.id === sponsor.routeId);
    const isNocturna = (selected?.name || '').toLowerCase().includes('nocturna');
    return spectatorDates.filter(o => isNocturna ? (o.group === 'Jueves nocturnos') : (o.group === 'Fines de semana'));
  }, [routes, sponsor.routeId, spectatorDates]);

  // Default spectator date when opening modal
  useEffect(() => {
    if (openSpectator) {
      setSpectator((s) => ({ ...s, when: visibleSpectatorDates[0]?.value || '' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSpectator]);

  // When route changes in Spectator modal, reset date to first available
  useEffect(() => {
    if (openSpectator) {
      setSpectator((s) => ({ ...s, when: visibleSpectatorDates[0]?.value || '' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSpectator, spectator.routeId, visibleSpectatorDates]);

  // Default sponsor date when opening modal
  useEffect(() => {
    if (openSponsor) {
      setSponsor((s) => ({ ...s, when: visibleSponsorDates[0]?.value ? [visibleSponsorDates[0]?.value] : [] }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSponsor]);

  // When route changes in Sponsor modal, reset date to first available
  useEffect(() => {
    if (openSponsor) {
      setSponsor((s) => ({ ...s, when: visibleSponsorDates[0]?.value ? [visibleSponsorDates[0]?.value] : [] }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSponsor, sponsor.routeId, visibleSponsorDates]);

  // Load Leaflet from CDN only when sponsor modal opens (client-side only)
  useEffect(() => {
    if (!openSponsor) return;
    let cancelled = false;
    (async () => {
      if (typeof window === 'undefined') return;
      // if already loaded
      if ((window as any).L) {
        setMapReady(true);
        return;
      }
      try {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Leaflet load error'));
          document.body.appendChild(script);
        });
        if (!cancelled) setMapReady(true);
      } catch {
        if (!cancelled) setMapReady(false);
      }
    })();
    return () => { cancelled = true; };
  }, [openSponsor]);

  // Compute bounds for sponsor map based on selected route
  const sponsorBounds = useMemo(() => {
    const route = routes.find(r => r.id === sponsor.routeId);
    const pts = extractLineCoords(route?.geojson);
    if (pts.length >= 2) {
      const minLat = Math.min(...pts.map(p => p.lat));
      const maxLat = Math.max(...pts.map(p => p.lat));
      const minLng = Math.min(...pts.map(p => p.lng));
      const maxLng = Math.max(...pts.map(p => p.lng));
      return [[minLat, minLng], [maxLat, maxLng]] as [[number, number],[number, number]];
    }
    return undefined;
  }, [routes, sponsor.routeId]);

  const rides = useMemo<Ride[]>(() => {
    const now = new Date();
    const fmt = (d: Date) => {
      const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    const baseDates = [1, 3, 5].map((days) => {
      const d = new Date(now);
      d.setDate(d.getDate() + days);
      d.setHours(8 + days, 0, 0, 0); // 09:00, 11:00, 13:00 aprox.
      return fmt(d);
    });
    const three = routes.slice(0, 3);
    return three.map((r, i) => ({
      id: `ride-${r.id}`,
      routeId: r.id,
      routeName: r.name,
      when: baseDates[i] || baseDates[0],
      note: r.description || undefined,
    }));
  }, [routes]);

  const selectedRide = useMemo(() => rides.find(r => r.id === openRideId) || null, [rides, openRideId]);

  const past = useMemo<Ride[]>(() => {
    const now = new Date();
    const fmt = (d: Date) => {
      const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    const baseDates = [2, 7, 14].map((days) => {
      const d = new Date(now);
      d.setDate(d.getDate() - days);
      d.setHours(8 + (days % 5), 0, 0, 0);
      return fmt(d);
    });
    const three = routes.slice(0, 3);
    return three.map((r, i) => ({
      id: `past-${r.id}`,
      routeId: r.id,
      routeName: r.name,
      when: baseDates[i] || baseDates[0],
      note: r.description || undefined,
    }));
  }, [routes]);

  // Utilidades: extraer coords y dibujar miniatura SVG
  function extractLineCoords(g: any): Array<{ lat: number; lng: number }> {
    if (!g) return [];
    try { if (typeof g === 'string') g = JSON.parse(g); } catch { return []; }
    const collect: Array<[number, number]> = [];
    const handleGeom = (geom: any) => {
      if (!geom) return;
      if (geom.type === 'LineString') collect.push(...geom.coordinates);
      else if (geom.type === 'MultiLineString') geom.coordinates.forEach((line: any) => collect.push(...line));
      else if (geom.type === 'Polygon') collect.push(...(geom.coordinates?.[0] || []));
      else if (geom.type === 'MultiPolygon') geom.coordinates.forEach((poly: any) => collect.push(...(poly?.[0] || [])));
    };
    if (g.type === 'Feature') handleGeom(g.geometry);
    else if (g.type === 'FeatureCollection') (g.features || []).forEach((f: any) => handleGeom(f.geometry));
    else handleGeom(g);
    return collect.map(([lng, lat]) => ({ lat, lng }));
  }

  function RouteThumb({ geojson }: { geojson: any }) {
    const pts = extractLineCoords(geojson);
    if (pts.length < 2) return (
      <div className="w-full h-20 bg-gray-100 rounded" />
    );
    const minLat = Math.min(...pts.map(p => p.lat));
    const maxLat = Math.max(...pts.map(p => p.lat));
    const minLng = Math.min(...pts.map(p => p.lng));
    const maxLng = Math.max(...pts.map(p => p.lng));
    const w = 240, h = 80; // tamaño del thumbnail
    const pad = 6;
    const spanLat = Math.max(1e-9, maxLat - minLat);
    const spanLng = Math.max(1e-9, maxLng - minLng);
    const toXY = (p: { lat: number; lng: number }) => {
      const x = pad + ((p.lng - minLng) / spanLng) * (w - pad * 2);
      const y = pad + (1 - (p.lat - minLat) / spanLat) * (h - pad * 2);
      return `${x},${y}`;
    };
    const d = pts.map(toXY).join(' ');
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-20 bg-gray-100 rounded">
        <polyline points={d} fill="none" stroke="#2563eb" strokeWidth="2" />
      </svg>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <header>
          <h1 className="text-2xl font-semibold">Próximas rodadas</h1>
          <p className="text-gray-600 text-sm">Convocatoria de salidas, una por cada ruta disponible.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="px-3 py-1 rounded bg-emerald-600 text-white" onClick={() => {
              const defaultRouteId = routes[0]?.id || '';
              const selected = routes[0];
              const isNocturna = (selected?.name || '').toLowerCase().includes('nocturna');
              const initial = spectatorDates.filter(o => o.group === 'Fines de semana' || (isNocturna && o.group === 'Jueves nocturnos'))[0]?.value || '';
              setSpectator({ routeId: defaultRouteId, when: initial, name: '', email: '', phone: '', message: '' });
              setOpenSpectator(true);
            }}>Eventos</button>
            <button className="px-3 py-1 rounded bg-fuchsia-600 text-white" onClick={() => {
              const selected = routes[0];
              const isNocturna = (selected?.name || '').toLowerCase().includes('nocturna');
              const initial = spectatorDates.filter(o => o.group === 'Fines de semana' || (isNocturna && o.group === 'Jueves nocturnos'))[0]?.value || '';
              setSponsor({ routeId: routes[0]?.id || '', when: initial ? [initial] : [], name: '', email: '', phone: '', companyName: '', website: '', services: '', message: '' });
              setSponsorLocations([]);
              setOpenSponsor(true);
            }}>Quiero ser Sponsor</button>
          </div>
        </header>

        {loading && <p>Cargando…</p>}
        {error && <p className="text-red-600">{error}</p>}

        {!loading && rides.length === 0 && (
          <p className="text-gray-600">No hay rutas disponibles aún. Crea rutas en /routes para publicar rodadas.</p>
        )}

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {rides.map((rd) => (
            <article key={rd.id} className="bg-white rounded border p-0 overflow-hidden flex flex-col">
              <RouteThumb geojson={routes.find(r => r.id === rd.routeId)?.geojson} />
              <div className="p-4 flex flex-col gap-2">
                <h2 className="font-medium">{rd.routeName}</h2>
              <div className="text-sm text-gray-600">Fecha y hora: {rd.when}</div>
              {rd.note && <div className="text-sm text-gray-500">{rd.note}</div>}
              <button
                className={`mt-2 px-3 py-1 rounded ${registered[rd.id] ? 'bg-gray-300' : 'bg-blue-600 text-white'}`}
                onClick={() => {
                  setSubmitError(null);
                  setForm({ name: '', email: '', phone: '', license: '', motoPlate: '', motoBrand: '', motoModel: '', motoClub: '', message: '' });
                  setOpenRideId(rd.id);
                }}
              >{registered[rd.id] ? 'Registrado' : 'Registrarme (Piloto)'}</button>
              </div>
            </article>
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">Eventos pasados</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {past.map((ev) => (
              <article key={ev.id} className="bg-white rounded border p-0 overflow-hidden flex flex-col">
                <RouteThumb geojson={routes.find(r => r.id === ev.routeId)?.geojson} />
                <div className="p-4">
                  <h3 className="font-medium">{ev.routeName}</h3>
                  <div className="text-sm text-gray-600">Realizado: {ev.when}</div>
                  {ev.note && <div className="text-sm text-gray-500">{ev.note}</div>}
                </div>
              </article>
            ))}
          </div>
        </section>

        {openRideId && selectedRide && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
            <div className="bg-white w-full max-w-md rounded shadow p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Registro a la rodada (Piloto)</h3>
                <button className="text-sm px-2 py-1 rounded bg-gray-200" onClick={() => setOpenRideId(null)}>Cerrar</button>
              </div>
              <div className="text-sm text-gray-600">Ruta: {selectedRide.routeName}</div>
              <div className="text-sm text-gray-600">Fecha y hora: {selectedRide.when}</div>

              <form
                className="space-y-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setSubmitError(null);
                  // Validaciones básicas
                  if (!form.name.trim()) { setSubmitError('Nombre es requerido'); return; }
                  if (!form.phone.trim()) { setSubmitError('Teléfono es requerido'); return; }
                  if (!form.license.trim()) { setSubmitError('Licencia es requerida'); return; }
                  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setSubmitError('Email inválido'); return; }
                  try {
                    setSubmitting(true);
                    await api.registrationsCreate({
                      type: 'PILOT',
                      routeId: selectedRide.routeId,
                      when: new Date(selectedRide.when.replace(' ', 'T') + ':00').toISOString(),
                      name: form.name.trim(),
                      email: form.email.trim(),
                      phone: form.phone.trim(),
                      license: form.license.trim(),
                      motoPlate: form.motoPlate.trim() || undefined,
                      motoBrand: form.motoBrand.trim() || undefined,
                      motoModel: form.motoModel.trim() || undefined,
                      motoClub: form.motoClub.trim() || undefined,
                      message: form.message.trim() || undefined,
                    });
                    setSubmitting(false);
                    setRegistered((m) => ({ ...m, [selectedRide.id]: true }));
                    setOpenRideId(null);
                  } catch (err: any) {
                    setSubmitting(false);
                    const msg = (err && err.message) ? String(err.message) : 'No se pudo enviar la solicitud. Intenta más tarde.';
                    setSubmitError(msg);
                  }
                }}
              >
                <input className="w-full border rounded px-3 py-2" placeholder="Nombre (requerido)" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                <input className="w-full border rounded px-3 py-2" placeholder="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                <input className="w-full border rounded px-3 py-2" placeholder="Teléfono (requerido)" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                <input className="w-full border rounded px-3 py-2" placeholder="Licencia (requerido)" value={form.license} onChange={(e) => setForm((f) => ({ ...f, license: e.target.value }))} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <input className="w-full border rounded px-3 py-2" placeholder="Placa (opcional)" value={form.motoPlate} onChange={(e) => setForm((f) => ({ ...f, motoPlate: e.target.value }))} />
                  <input className="w-full border rounded px-3 py-2" placeholder="Marca (opcional)" value={form.motoBrand} onChange={(e) => setForm((f) => ({ ...f, motoBrand: e.target.value }))} />
                  <input className="w-full border rounded px-3 py-2" placeholder="Modelo (opcional)" value={form.motoModel} onChange={(e) => setForm((f) => ({ ...f, motoModel: e.target.value }))} />
                  <input className="w-full border rounded px-3 py-2" placeholder="Club (opcional)" value={form.motoClub} onChange={(e) => setForm((f) => ({ ...f, motoClub: e.target.value }))} />
                </div>
                <textarea className="w-full border rounded px-3 py-2 h-24" placeholder="Mensaje (opcional)" value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} />
                {submitError && <div className="text-sm text-red-600">{submitError}</div>}
                <button disabled={submitting} className={`px-3 py-2 rounded ${submitting ? 'bg-gray-300' : 'bg-blue-600 text-white'}`}>
                  {submitting ? 'Enviando…' : 'Enviar solicitud'}
                </button>
              </form>
              <p className="text-xs text-gray-500">Tu solicitud quedará en revisión y deberá ser aprobada por un administrador.</p>
            </div>
          </div>
        )}

        {/* Spectator modal */}
        {openSpectator && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
            <div className="bg-white w-full max-w-md rounded shadow p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Registro como Espectador</h3>
                <button className="text-sm px-2 py-1 rounded bg-gray-200" onClick={() => setOpenSpectator(false)}>Cerrar</button>
              </div>
              <form
                className="space-y-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setSpectatorError(null);
                  if (!spectator.name.trim()) { setSpectatorError('Nombre es requerido'); return; }
                  if (!spectator.phone.trim()) { setSpectatorError('Teléfono es requerido'); return; }
                  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(spectator.email)) { setSpectatorError('Email inválido'); return; }
                  if (!spectator.routeId) { setSpectatorError('Ruta requerida'); return; }
                  if (!spectator.when) { setSpectatorError('Fecha/hora requerida'); return; }
                  try {
                    setSpectatorSubmitting(true);
                    await api.registrationsCreate({
                      type: 'SPECTATOR',
                      routeId: spectator.routeId,
                      when: new Date(spectator.when).toISOString(),
                      name: spectator.name.trim(),
                      email: spectator.email.trim(),
                      phone: spectator.phone.trim(),
                      message: spectator.message.trim() || undefined,
                    } as any);
                    setSpectatorSubmitting(false);
                    setOpenSpectator(false);
                  } catch (err: any) {
                    setSpectatorSubmitting(false);
                    setSpectatorError(err?.message || 'No se pudo enviar');
                  }
                }}
              >
                <label className="block text-sm">Ruta</label>
                <select className="w-full border rounded px-3 py-2" value={spectator.routeId} onChange={(e) => setSpectator((s) => ({ ...s, routeId: e.target.value }))}>
                  {routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <label className="block text-sm">Fecha disponible</label>
                <select className="w-full border rounded px-3 py-2" value={spectator.when} onChange={(e) => setSpectator((s) => ({ ...s, when: e.target.value }))}>
                  {(() => {
                    const selected = routes.find(r => r.id === spectator.routeId);
                    const isNocturna = (selected?.name || '').toLowerCase().includes('nocturna');
                    return (
                      <>
                        {isNocturna && (
                          <optgroup label="Jueves nocturnos">
                            {spectatorDates.filter(o => o.group === 'Jueves nocturnos').map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </optgroup>
                        )}
                        <optgroup label="Fines de semana">
                          {spectatorDates.filter(o => o.group === 'Fines de semana').map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </optgroup>
                      </>
                    );
                  })()}
                </select>
                <input className="w-full border rounded px-3 py-2" placeholder="Nombre (requerido)" value={spectator.name} onChange={(e) => setSpectator((s) => ({ ...s, name: e.target.value }))} />
                <input className="w-full border rounded px-3 py-2" placeholder="Email" value={spectator.email} onChange={(e) => setSpectator((s) => ({ ...s, email: e.target.value }))} />
                <input className="w-full border rounded px-3 py-2" placeholder="Teléfono (requerido)" value={spectator.phone} onChange={(e) => setSpectator((s) => ({ ...s, phone: e.target.value }))} />
                <textarea className="w-full border rounded px-3 py-2 h-24" placeholder="Mensaje (opcional)" value={spectator.message} onChange={(e) => setSpectator((s) => ({ ...s, message: e.target.value }))} />
                {spectatorError && <div className="text-sm text-red-600">{spectatorError}</div>}
                <button disabled={spectatorSubmitting} className={`px-3 py-2 rounded ${spectatorSubmitting ? 'bg-gray-300' : 'bg-emerald-600 text-white'}`}>
                  {spectatorSubmitting ? 'Enviando…' : 'Enviar solicitud'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Sponsor modal */}
        {openSponsor && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
            <div className="bg-white w-full max-w-2xl rounded shadow p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Registro de Sponsor</h3>
                <button className="text-sm px-2 py-1 rounded bg-gray-200" onClick={() => setOpenSponsor(false)}>Cerrar</button>
              </div>
              <form
                className="grid grid-cols-1 md:grid-cols-2 gap-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setSponsorError(null);
                  if (!sponsor.companyName.trim()) { setSponsorError('Nombre de empresa es requerido'); return; }
                  if (!sponsor.name.trim()) { setSponsorError('Nombre de contacto es requerido'); return; }
                  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sponsor.email)) { setSponsorError('Email inválido'); return; }
                  if (!sponsor.phone.trim()) { setSponsorError('Teléfono es requerido'); return; }
                  if (!sponsor.routeId) { setSponsorError('Ruta requerida'); return; }
                  if (!sponsor.when || sponsor.when.length === 0) { setSponsorError('Selecciona al menos una fecha disponible'); return; }
                  if (sponsorLocations.length === 0) { setSponsorError('Debes añadir al menos una ubicación en el mapa'); return; }
                  try {
                    setSponsorSubmitting(true);
                    // Enviar una sola solicitud con todas las fechas seleccionadas
                    await api.registrationsCreate({
                      type: 'SPONSOR',
                      routeId: sponsor.routeId,
                      name: sponsor.name.trim(),
                      email: sponsor.email.trim(),
                      phone: sponsor.phone.trim(),
                      companyName: sponsor.companyName.trim(),
                      website: sponsor.website?.trim() || undefined,
                      services: sponsor.services?.trim() || undefined,
                      when: sponsor.when[0],
                      whenMultiple: sponsor.when,
                      sponsorLocations: sponsorLocations.map((p) => ({
                        lat: p.lat,
                        lng: p.lng,
                        category: p.category || undefined,
                        note: p.note || undefined,
                      })),
                    });
                    setSponsorSubmitting(false);
                    setOpenSponsor(false);
                  } catch (err: any) {
                    setSponsorSubmitting(false);
                    setSponsorError(err?.message || 'No se pudo enviar');
                  }
                }}
              >
                <div className="col-span-1">
                  <label className="block text-sm">Ruta</label>
                  <select className="w-full border rounded px-3 py-2" value={sponsor.routeId} onChange={(e) => setSponsor((s) => ({ ...s, routeId: e.target.value }))}>
                    {routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  <div className="text-xs text-gray-500 mt-1">Fechas seleccionadas: {sponsor.when.length}</div>
                </div>
                <div className="col-span-1">
                  <label className="block text-sm">Fechas disponibles</label>
                  <div className="border rounded px-3 py-2 max-h-40 overflow-auto space-y-2">
                    <div className="flex items-center justify-end gap-2 text-xs text-gray-600 mb-1">
                      <button type="button" className="px-2 py-0.5 rounded bg-gray-200" onClick={() => {
                        setSponsor((s) => ({ ...s, when: visibleSponsorDates.map(o => o.value) }));
                      }}>Seleccionar todo</button>
                      <button type="button" className="px-2 py-0.5 rounded bg-gray-200" onClick={() => {
                        setSponsor((s) => ({ ...s, when: [] }));
                      }}>Limpiar</button>
                    </div>
                    {(() => {
                      const selected = routes.find(r => r.id === sponsor.routeId);
                      const isNocturna = (selected?.name || '').toLowerCase().includes('nocturna');
                      const renderGroup = (label: string, items: typeof visibleSponsorDates) => (
                        items.length > 0 ? (
                          <div>
                            <div className="text-xs font-medium text-gray-600 mb-1">{label}</div>
                            <div className="space-y-1">
                              {items.map((o) => {
                                const checked = sponsor.when.includes(o.value);
                                return (
                                  <label key={o.value} className="flex items-center gap-2 text-sm">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(e) => {
                                        setSponsor((s) => ({
                                          ...s,
                                          when: e.target.checked
                                            ? Array.from(new Set([...(s.when || []), o.value]))
                                            : (s.when || []).filter(v => v !== o.value),
                                        }));
                                      }}
                                    />
                                    <span>{o.label}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ) : null
                      );
                      return (
                        <>
                          {isNocturna
                            ? renderGroup('Jueves nocturnos', visibleSponsorDates.filter(o => o.group === 'Jueves nocturnos'))
                            : renderGroup('Fines de semana', visibleSponsorDates.filter(o => o.group === 'Fines de semana'))}
                        </>
                      );
                    })()}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Fechas seleccionadas: {sponsor.when.length}</div>
                </div>
                <div className="col-span-1">
                  <label className="block text-sm">Empresa</label>
                  <input className="w-full border rounded px-3 py-2" placeholder="Nombre de empresa" value={sponsor.companyName} onChange={(e) => setSponsor((s) => ({ ...s, companyName: e.target.value }))} />
                </div>
                <div className="col-span-1">
                  <label className="block text-sm">Website</label>
                  <input className="w-full border rounded px-3 py-2" placeholder="https://" value={sponsor.website} onChange={(e) => setSponsor((s) => ({ ...s, website: e.target.value }))} />
                </div>
                <div className="col-span-1">
                  <label className="block text-sm">Contacto</label>
                  <input className="w-full border rounded px-3 py-2" placeholder="Nombre de contacto" value={sponsor.name} onChange={(e) => setSponsor((s) => ({ ...s, name: e.target.value }))} />
                </div>
                <div className="col-span-1">
                  <label className="block text-sm">Email</label>
                  <input className="w-full border rounded px-3 py-2" placeholder="email@dominio.com" value={sponsor.email} onChange={(e) => setSponsor((s) => ({ ...s, email: e.target.value }))} />
                </div>
                <div className="col-span-1">
                  <label className="block text-sm">Teléfono</label>
                  <input className="w-full border rounded px-3 py-2" placeholder="Teléfono" value={sponsor.phone} onChange={(e) => setSponsor((s) => ({ ...s, phone: e.target.value }))} />
                </div>
                <div className="col-span-1">
                  <label className="block text-sm">Servicios ofrecidos</label>
                  <input className="w-full border rounded px-3 py-2" placeholder="Comida, orientación, prevención, etc." value={sponsor.services} onChange={(e) => setSponsor((s) => ({ ...s, services: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm">Mensaje (opcional)</label>
                  <textarea className="w-full border rounded px-3 py-2 h-20" value={sponsor.message} onChange={(e) => setSponsor((s) => ({ ...s, message: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm mb-1">Ubicaciones en el mapa (haz clic para añadir)</label>
                  <div id="sponsor-map" className="w-full h-64 rounded border" />
                  <div className="mt-2 flex gap-2 text-sm">
                    <button
                      type="button"
                      className="px-2 py-1 rounded bg-gray-200"
                      onClick={() => {
                        setSponsorLocations([]);
                        try {
                          const el = document.getElementById('sponsor-map') as any;
                          el?._clear_markers?.();
                        } catch {}
                      }}
                    >Limpiar ubicaciones</button>
                  </div>
                  {/* POI categories for each location */}
                  <div className="mt-3 space-y-2">
                    {sponsorLocations.map((p, i) => (
                      <div key={`${p.lat}-${p.lng}-${i}`} className="p-2 border rounded bg-gray-50">
                        <div className="flex items-center justify-between text-xs text-gray-600">
                          <div>#{i + 1} · lat {p.lat.toFixed(5)}, lng {p.lng.toFixed(5)}</div>
                          <button type="button" className="px-2 py-0.5 rounded bg-red-100 text-red-700" onClick={() => setSponsorLocations(arr => arr.filter((_, idx) => idx !== i))}>Quitar</button>
                        </div>
                        <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                          <div>
                            <input list="poi-categories" className="border rounded px-2 py-1 text-sm w-full" placeholder="Categoría (libre)" value={p.category || ''} onChange={(e) => setSponsorLocations(arr => arr.map((it, idx) => idx === i ? { ...it, category: e.target.value } : it))} />
                          </div>
                          <input className="border rounded px-2 py-1 text-sm md:col-span-2" placeholder="Nota (opcional), ej. 2x bombas / hielo / sombra" value={p.note || ''}
                            onChange={(e) => setSponsorLocations(arr => arr.map((it, idx) => idx === i ? { ...it, note: e.target.value } : it))} />
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Suggestions list (libre, solo sugerencias) */}
                  <datalist id="poi-categories">
                    <option value="Gasolinera" />
                    <option value="Bebidas" />
                    <option value="Descanso" />
                    <option value="Comida" />
                    <option value="Mecánica" />
                    <option value="Primeros Auxilios" />
                    <option value="Baños" />
                    <option value="Información" />
                    <option value="Estacionamiento" />
                    <option value="Bar" />
                    <option value="Billar" />
                    <option value="Sport Bar" />
                    <option value="Moto Club" />
                    <option value="Parque" />
                  </datalist>
                </div>
                {sponsorError && <div className="col-span-2 text-sm text-red-600">{sponsorError}</div>}
                <div className="col-span-2">
                  <button disabled={sponsorSubmitting} className={`px-3 py-2 rounded ${sponsorSubmitting ? 'bg-gray-300' : 'bg-fuchsia-600 text-white'}`}>
                    {sponsorSubmitting ? 'Enviando…' : 'Enviar solicitud'}
                  </button>
                </div>
              </form>
              {/* Initialize the map after modal renders */}
              {openSponsor && mapReady && (
                <MapInitializer key={sponsor.routeId || 'no-route'} bounds={sponsorBounds} onClick={(lat, lng) => setSponsorLocations((arr) => [...arr, { lat, lng }])} />
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function MapInitializer({ bounds, onClick }: { bounds?: [[number, number],[number, number]]; onClick: (lat: number, lng: number) => void }) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const L = (window as any).L;
    if (!L) return;
    const container = document.getElementById('sponsor-map');
    if (!container) return;
    // Avoid multiple maps on same div
    (container as any)._leaflet_id && (container.innerHTML = '');
    const map = L.map(container);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    if (bounds) {
      map.fitBounds(bounds, { padding: [20, 20] });
    } else {
      map.setView([19.4326, -99.1332], 12);
    }
    // store map instance for later refits
    (container as any)._leaflet_map = map;
    const markers: any[] = [];
    const onMapClick = (e: any) => {
      const m = L.marker(e.latlng).addTo(map);
      markers.push(m);
      onClick(e.latlng.lat, e.latlng.lng);
    };
    map.on('click', onMapClick);
    // expose clear function to outer UI
    (container as any)._clear_markers = () => {
      try { markers.forEach(m => map.removeLayer(m)); } catch {}
      markers.length = 0;
    };
    return () => {
      map.off('click', onMapClick);
      markers.forEach(m => map.removeLayer(m));
      try { delete (container as any)._clear_markers; } catch {}
      map.remove();
    };
  }, []);

  // Update view if bounds change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const L = (window as any).L;
    const container = document.getElementById('sponsor-map');
    if (!L || !container) return;
    const map = (container as any)._leaflet_map as any;
    if (!map) return;
    if (bounds) {
      try { map.fitBounds(bounds, { padding: [20, 20] }); } catch {}
    }
  }, [bounds]);
  return null;
}
