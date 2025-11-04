import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, Polyline, useMap, useMapEvent } from 'react-leaflet';
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { api } from '../lib/api';

// Fix default icon paths when bundling
// @ts-ignore
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

type Route = { id: string; name: string; description?: string | null; geojson?: any };
type Vehicle = { id: string; plate: string; brand?: string | null; driverName?: string | null };

export default function TrackingMapInner() {
  const center: [number, number] = [17.989456, -92.947506];
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const selected = routes.find((r) => r.id === selectedId);
  const geoRef = useRef<L.GeoJSON<any> | null>(null);
  const [positions, setPositions] = useState<Record<string, { lat: number; lng: number }>>({});
  const [socketReady, setSocketReady] = useState(false);
  const [drawPoints, setDrawPoints] = useState<Array<{ lat: number; lng: number }>>([]);
  const [routeName, setRouteName] = useState('Ruta dibujada');
  const [lastClick, setLastClick] = useState<{ lat: number; lng: number } | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  // POIs
  const [poiMode, setPoiMode] = useState(false);
  const [poiType, setPoiType] = useState<string>('gasolinera');
  const [poiName, setPoiName] = useState('');
  const [tempPois, setTempPois] = useState<Array<{ lat: number; lng: number; type: string; name?: string }>>([]);
  const liveEnabledRef = useRef(true);
  useEffect(() => { liveEnabledRef.current = !poiMode; }, [poiMode]);
  const [autoFit, setAutoFit] = useState(false);
  const userInteractedRef = useRef(false);
  const userInteractTimerRef = useRef<any>(null);
  const prevSelectedIdRef = useRef<string>('');
  const fitTriggerRef = useRef(0);
  const routeSelectedRef = useRef(false);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [simRunning, setSimRunning] = useState(false);
  const simTimersRef = useRef<Map<string, any>>(new Map());
  const simStatesRef = useRef<Map<string, { idx: number; sub: number; pos: { lat: number; lng: number } | null }>>(new Map());
  const colorByIdRef = useRef<Map<string, string>>(new Map());
  const numberByIdRef = useRef<Map<string, number>>(new Map());
  const simEnabledRef = useRef(false);
  const [editingRoute, setEditingRoute] = useState(false);
  const [saveAsLineString, setSaveAsLineString] = useState(true);
  const [showVertices, setShowVertices] = useState(true);
  const [moveVertexOnClick, setMoveVertexOnClick] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.routesList();
        setRoutes(data);
      } catch {}
    })();
  }, []);

  // React to route selection changes
  useEffect(() => {
    routeSelectedRef.current = !!selectedId;
    if (!selectedId) {
      // clear markers and stop any running simulation
      setPositions({});
      simEnabledRef.current = false;
      setSimRunning(false);
      Array.from(simTimersRef.current.keys()).forEach((id) => {
        const t = simTimersRef.current.get(id);
        if (t) clearInterval(t);
        simTimersRef.current.delete(id);
      });
    }
  }, [selectedId]);

  function buildVertexIcon(): L.DivIcon {
    const html = `
      <div style="
        width:10px;height:10px;border-radius:50%;
        background:#1d4ed8;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,0.2);
        transform: translate(-5px, -5px);
      "></div>`;
    return L.divIcon({ html, className: 'vertex-marker', iconSize: [10, 10], iconAnchor: [5, 5] });
  }

  useEffect(() => {
    (async () => {
      try {
        const vs = await api.vehiclesList();
        const mapped: Vehicle[] = vs.map((v: any) => ({
          id: v.id,
          plate: v.plate,
          brand: v.brand ?? null,
          driverName: v.driver ? ((v.driver.preferNickname && v.driver.nickname) ? v.driver.nickname : v.driver.name) : null,
        }));
        setVehicles(mapped);
        // assign colors and numbers deterministically
        const palette = ['#ef4444','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#84cc16','#fb7185','#06b6d4'];
        const cMap = new Map<string,string>();
        const nMap = new Map<string,number>();
        mapped.forEach((v, idx) => {
          cMap.set(v.id, palette[idx % palette.length]);
          nMap.set(v.id, idx + 1);
        });
        colorByIdRef.current = cMap;
        numberByIdRef.current = nMap;
      } catch {}
    })();
  }, []);

  // Componente auxiliar para ajustar el mapa a la geometría
  const FitToSelected = () => {
    const map = useMap();
    useEffect(() => {
      const selectedChanged = prevSelectedIdRef.current !== selectedId;
      if (selectedChanged) {
        prevSelectedIdRef.current = selectedId;
        userInteractedRef.current = false; // permitir un ajuste cuando cambie la ruta
      }
      if (poiMode) return; // no ajustar vista mientras se agregan POIs
      if (!autoFit) return; // el usuario desactivó auto-ajuste
      if (!selectedChanged && fitTriggerRef.current === 0) return; // solo ajustar en cambios explícitos
      if (userInteractedRef.current) return; // suprimir si el usuario interactuó recientemente
      if (geoRef.current) {
        const b = geoRef.current.getBounds();
        if (b.isValid()) map.fitBounds(b, { padding: [20, 20] });
      }
      // reset manual trigger
      fitTriggerRef.current = 0;
    }, [map, selectedId, poiMode, autoFit]);
    return null;
  };

  function buildIcon(vehicleId: string): L.DivIcon {
    const color = colorByIdRef.current.get(vehicleId) || '#2563eb';
    const num = numberByIdRef.current.get(vehicleId) || 0;
    const html = `
      <div style="position:relative; transform: translate(-12px, -24px);">
        <div style="
          width:24px;height:24px;border-radius:50%;
          background:${color}; display:flex; align-items:center; justify-content:center;
          box-shadow:0 1px 3px rgba(0,0,0,0.3);
        ">
          <span style="font-size:14px;">🏍️</span>
        </div>
        <div style="position:absolute; right:-6px; top:-6px; width:16px; height:16px; border-radius:50%; background:#111; color:#fff; font-size:10px; display:flex; align-items:center; justify-content:center;">
          ${num}
        </div>
      </div>`;
    return L.divIcon({ html, className: 'moto-marker', iconSize: [24, 24], iconAnchor: [12, 24] });
  }

  const ClickCapture = () => {
    const map = useMap();
    const flagInteract = () => {
      userInteractedRef.current = true;
      if (userInteractTimerRef.current) clearTimeout(userInteractTimerRef.current);
      userInteractTimerRef.current = setTimeout(() => { userInteractedRef.current = false; }, 4000);
    };
    useMapEvent('click', (e) => {
      const { lat, lng } = e.latlng;
      setLastClick({ lat, lng });
      // If editing and tool enabled: move nearest vertex to clicked location
      if (editingRoute && moveVertexOnClick) {
        const path = getSelectedRoutePath();
        if (path.length === 0) return;
        // find nearest vertex
        let best = 0;
        let bestD = Number.POSITIVE_INFINITY;
        for (let i = 0; i < path.length; i++) {
          const d = Math.hypot(path[i].lat - lat, path[i].lng - lng);
          if (d < bestD) { bestD = d; best = i; }
        }
        const updated = path.slice();
        updated[best] = { lat, lng };
        // apply into current GeoJSON in layer, preserving other features
        try {
          let g: any = selected?.geojson;
          if (typeof g === 'string') { try { g = JSON.parse(g); } catch { g = null; } }
          const coords = updated.map((p) => [p.lng, p.lat]);
          const replaceGeom = (geom: any) => ({ type: 'LineString', coordinates: coords });
          let newGeo: any = null;
          if (!g) {
            newGeo = { type: 'Feature', properties: {}, geometry: replaceGeom(null) };
          } else if (g.type === 'Feature') {
            newGeo = { ...g, geometry: replaceGeom(g.geometry) };
          } else if (g.type === 'FeatureCollection') {
            const feats = [...(g.features || [])];
            let idx = feats.findIndex((f: any) => ['LineString','MultiLineString','Polygon','MultiPolygon'].includes(f?.geometry?.type));
            if (idx === -1) idx = 0;
            feats[idx] = { ...feats[idx], geometry: replaceGeom(feats[idx]?.geometry) };
            newGeo = { ...g, features: feats };
          } else {
            newGeo = replaceGeom(g);
          }
          const layer: any = geoRef.current as any;
          layer?.clearLayers?.();
          layer?.addData?.(newGeo);
        } catch {}
        return; // do not add points to draw/POI when moving
      }
      if (poiMode) {
        setTempPois((ps) => [...ps, { lat, lng, type: poiType, name: poiName || undefined }]);
      } else {
        setDrawPoints((pts) => [...pts, { lat, lng }]);
      }
    });
    useMapEvent('zoomstart', flagInteract);
    useMapEvent('movestart', flagInteract);
    return null;
  };

  // Load Leaflet-Geoman (editor) from CDN and manage edit mode
  async function ensureGeomanLoaded(): Promise<void> {
    const w = window as any;
    if (w.L?.pm) return;
    // CSS
    if (!document.getElementById('leaflet-geoman-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-geoman-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet-geoman-free@2.14.1/dist/leaflet-geoman.css';
      document.head.appendChild(link);
    }
    // JS
    await new Promise<void>((resolve, reject) => {
      if (document.getElementById('leaflet-geoman-js')) return resolve();
      const s = document.createElement('script');
      s.id = 'leaflet-geoman-js';
      s.src = 'https://unpkg.com/leaflet-geoman-free@2.14.1/dist/leaflet-geoman.min.js';
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed to load Leaflet-Geoman'));
      document.body.appendChild(s);
    });
  }

  useEffect(() => {
    (async () => {
      if (!editingRoute) {
        try { (mapRef.current as any)?.pm?.removeControls?.(); } catch {}
        try {
          const gj: any = geoRef.current as any;
          gj?.eachLayer?.((ly: any) => ly?.pm?.disable?.());
        } catch {}
        return;
      }
      if (!mapRef.current || !geoRef.current) return;
      try {
        await ensureGeomanLoaded();
        const map: any = mapRef.current as any;
        map.pm.addControls({
          position: 'topleft',
          editMode: true,
          dragMode: false,
          drawMarker: false,
          drawCircleMarker: false,
          drawPolyline: false,
          drawRectangle: false,
          drawPolygon: false,
          drawCircle: false,
          cutPolygon: false,
          removalMode: true,
        });
        map.pm.setGlobalOptions({
          snappable: true,
          snapDistance: 20,
          allowSelfIntersection: true,
          hideMiddleMarkers: false,
          snapMiddle: true,
        });
        map.pm.enableGlobalEditMode();
        // Enable PM on each child layer so vertices and midpoints are visible
        const gj: any = geoRef.current as any;
        gj?.eachLayer?.((ly: any) => {
          ly?.pm?.enable?.({
            allowSelfIntersection: true,
            snappable: true,
            snapDistance: 20,
            snapMiddle: true,
            // make sure middle markers for adding vertices are shown
            hideMiddleMarkers: false,
          });
        });
        userInteractedRef.current = true;
      } catch {}
    })();
  }, [editingRoute, selectedId]);

  async function saveEditedRoute() {
    if (!geoRef.current || !selected) return;
    try {
      const gj = (geoRef.current as any).toGeoJSON?.();
      if (!gj) return;
      let payload = gj;
      if (saveAsLineString) {
        const normalize = (geo: any): any => {
          const toFeature = (geom: any) => ({ type: 'Feature', properties: {}, geometry: geom });
          const toLS = (geom: any): any => {
            if (!geom) return null;
            if (geom.type === 'LineString') return toFeature(geom);
            if (geom.type === 'MultiLineString') {
              const coords = ([] as any[]).concat(...geom.coordinates);
              return toFeature({ type: 'LineString', coordinates: coords });
            }
            if (geom.type === 'Polygon') {
              const ring = Array.isArray(geom.coordinates) && geom.coordinates[0] ? geom.coordinates[0] : [];
              return toFeature({ type: 'LineString', coordinates: ring });
            }
            if (geom.type === 'MultiPolygon') {
              const first = Array.isArray(geom.coordinates) && geom.coordinates[0] && geom.coordinates[0][0] ? geom.coordinates[0][0] : [];
              return toFeature({ type: 'LineString', coordinates: first });
            }
            return null;
          };
          if (geo.type === 'Feature') return toLS(geo.geometry) || geo;
          if (geo.type === 'FeatureCollection') {
            const feats = geo.features || [];
            // prefer any LineString/MultiLineString, else Polygon/MultiPolygon
            const pick = feats.find((f: any) => ['LineString','MultiLineString'].includes(f?.geometry?.type))
              || feats.find((f: any) => ['Polygon','MultiPolygon'].includes(f?.geometry?.type));
            return pick ? toLS(pick.geometry) : geo;
          }
          // raw geometry
          return toLS(geo) || geo;
        };
        payload = normalize(gj);
      }
      await api.routesUpdate(selected.id, { geojson: payload });
      setEditingRoute(false);
      const data = await api.routesList();
      setRoutes(data);
    } catch {}
  }

  function cancelEditedRoute() {
    setEditingRoute(false);
    (async () => {
      try { const data = await api.routesList(); setRoutes(data); } catch {}
    })();
  }

  // Socket.IO subscription for live positions
  useEffect(() => {
    let socket: any;
    let polling: any;
    let cancelled = false;
    (async () => {
      try {
        const io = (await import('socket.io-client')).io;
        const url = (process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001') + '/positions';
        socket = io(url, { transports: ['websocket'] });
        socket.on('connect', () => setSocketReady(true));
        socket.on('disconnect', () => setSocketReady(false));
        socket.on('position:update', (p: { vehicleId: string; lat: number; lng: number }) => {
          if (!liveEnabledRef.current) return;
          if (!routeSelectedRef.current) return;
          setPositions((prev) => ({ ...prev, [p.vehicleId]: { lat: p.lat, lng: p.lng } }));
        });
      } catch {
        // ignore
      }
      // Fallback polling every 10s
      const poll = async () => {
        try {
          if (!liveEnabledRef.current) return;
          if (!routeSelectedRef.current) return;
          const list = await api.positionsLastAll();
          if (cancelled) return;
          const map: Record<string, { lat: number; lng: number }> = {};
          for (const row of list) {
            map[row.vehicleId] = { lat: row.lat, lng: row.lng };
          }
          setPositions(map);
        } catch {}
      };
      await poll();
      polling = setInterval(poll, 15000);
    })();
    return () => {
      cancelled = true;
      if (polling) clearInterval(polling);
      try { socket?.close?.(); } catch {}
    };
  }, []);

  function getSelectedRoutePath(): Array<{ lat: number; lng: number }> {
    let g: any = selected?.geojson;
    try { if (typeof g === 'string') g = JSON.parse(g); } catch { g = null; }
    const out: Array<{ lat: number; lng: number }> = [];
    const pushCoords = (coords: [number, number][]) => {
      for (const [lng, lat] of coords) out.push({ lat, lng });
    };
    const pushPolygon = (rings: [number, number][][]) => {
      if (!Array.isArray(rings) || !rings[0]) return;
      pushCoords(rings[0]);
    };
    if (!g) return out;
    const geom = g.type === 'Feature' ? g.geometry : g.type === 'FeatureCollection' ? null : g;
    if (geom?.type === 'LineString') pushCoords(geom.coordinates as [number, number][]);
    else if (geom?.type === 'MultiLineString') {
      for (const seg of geom.coordinates as [number, number][][]) pushCoords(seg);
    } else if (geom?.type === 'Polygon') {
      pushPolygon(geom.coordinates as [number, number][][]);
    } else if (geom?.type === 'MultiPolygon') {
      for (const poly of geom.coordinates as [number, number][][][]) pushPolygon(poly);
    } else if (g.type === 'FeatureCollection') {
      for (const f of g.features || []) {
        const gg = f.geometry;
        if (gg?.type === 'LineString') pushCoords(gg.coordinates as [number, number][]);
        if (gg?.type === 'MultiLineString') for (const seg of gg.coordinates as [number, number][][]) pushCoords(seg);
        if (gg?.type === 'Polygon') pushPolygon(gg.coordinates as [number, number][][]);
        if (gg?.type === 'MultiPolygon') for (const poly of gg.coordinates as [number, number][][][]) pushPolygon(poly);
      }
    }
    return out;
  }

  const simPath = getSelectedRoutePath();

  async function stepSimulationFor(vehicleId: string) {
    if (!simEnabledRef.current) return;
    let next: { lat: number; lng: number } | null = null;
    const path = getSelectedRoutePath();
    // crear estado inicial si no existe
    if (!simStatesRef.current.has(vehicleId)) {
      simStatesRef.current.set(vehicleId, { idx: Math.floor(Math.random() * 3), sub: Math.floor(Math.random() * 10), pos: null });
    }
    const st = simStatesRef.current.get(vehicleId)!;
    if (path.length >= 2) {
      if (st.idx >= path.length - 1) { st.idx = 0; st.sub = 0; }
      const a = path[st.idx];
      const b = path[st.idx + 1];
      const t = st.sub / 10;
      next = { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
      st.sub += 1;
      if (st.sub > 10) { st.sub = 0; st.idx += 1; }
    } else {
      let p = st.pos ?? { lat: center[0], lng: center[1] };
      const dLat = (Math.random() - 0.5) * 0.001;
      const dLng = (Math.random() - 0.5) * 0.001;
      p = { lat: p.lat + dLat, lng: p.lng + dLng };
      st.pos = p;
      next = p;
    }
    if (!next) return;
    try {
      await api.positionsCreate({ vehicleId, lat: next.lat, lng: next.lng });
      setPositions((prev) => ({ ...prev, [vehicleId]: next! }));
    } catch {}
  }

  function startSimulationFor(vehicleId: string) {
    if (simTimersRef.current.has(vehicleId)) return;
    const timer = setInterval(() => stepSimulationFor(vehicleId), 1000);
    simTimersRef.current.set(vehicleId, timer);
  }

  function stopSimulationFor(vehicleId: string) {
    const t = simTimersRef.current.get(vehicleId);
    if (t) clearInterval(t);
    simTimersRef.current.delete(vehicleId);
  }

  function startAll() {
    if (selectedVehicleIds.length === 0) return;
    // clear any previous timers to avoid duplicates
    Array.from(simTimersRef.current.keys()).forEach((id) => stopSimulationFor(id));
    simEnabledRef.current = true;
    setSimRunning(true);
    selectedVehicleIds.forEach((id) => startSimulationFor(id));
  }

  function stopAll() {
    simEnabledRef.current = false;
    setSimRunning(false);
    Array.from(simTimersRef.current.keys()).forEach((id) => stopSimulationFor(id));
  }

  return (
    <div className="space-y-3">
      <details className="rounded border bg-white/80 p-2">
        <summary className="cursor-pointer select-none text-sm font-medium">Controles</summary>
        <div className="mt-2 flex flex-wrap items-center gap-3">
        <label className="text-sm">Ruta:</label>
        <select
          className="border rounded px-2 py-1"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          <option value="">Selecciona una ruta</option>
          {routes.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <span className="text-sm text-gray-600">| Dibuja con clicks:</span>
        <input className="border rounded px-2 py-1" placeholder="Nombre de la ruta" value={routeName} onChange={(e) => setRouteName(e.target.value)} />
        <button
          className="px-2 py-1 rounded bg-gray-200"
          onClick={() => setDrawPoints([])}
        >Limpiar</button>
        <button
          className="px-2 py-1 rounded bg-gray-200"
          onClick={() => setDrawPoints((pts) => pts.slice(0, -1))}
        >Deshacer</button>
        <button
          className="px-2 py-1 rounded bg-blue-600 text-white"
          onClick={async () => {
            if (drawPoints.length < 2) return;
            const geojson = {
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: drawPoints.map((p) => [p.lng, p.lat]) },
            };
            try {
              await api.routesCreate({ name: routeName || 'Ruta dibujada', geojson });
              setDrawPoints([]);
              setRouteName('Ruta dibujada');
              await (async () => {
                const data = await api.routesList();
                setRoutes(data);
              })();
            } catch (e) {
              // no-op visual
            }
          }}
        >Guardar como ruta</button>
        {lastClick && (
          <span className="text-xs text-gray-600">Último click: {lastClick.lat.toFixed(6)}, {lastClick.lng.toFixed(6)}</span>
        )}
        <div className="flex items-center gap-2">
          <label className="text-sm inline-flex items-center gap-2">
            <input type="checkbox" checked={autoFit} onChange={(e) => setAutoFit(e.target.checked)} /> Auto-ajustar mapa
          </label>
          <button
            className="px-2 py-1 rounded bg-gray-200"
            onClick={() => { fitTriggerRef.current = Date.now(); /* trigger */ setAutoFit((v) => v || true); }}
          >Ajustar vista</button>
        </div>
        <span className="text-sm text-gray-600">| Simulación (múltiples vehículos):</span>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="max-h-28 overflow-auto border rounded p-2">
            {vehicles.length === 0 && (
              <div className="text-xs text-gray-500">No hay vehículos. Crea algunos en /vehicles</div>
            )}
            {vehicles.map((v) => {
              const checked = selectedVehicleIds.includes(v.id);
              return (
                <label key={v.id} className="block text-sm">
                  <input
                    type="checkbox"
                    className="mr-2"
                    checked={checked}
                    onChange={(e) => {
                      setSelectedVehicleIds((prev) => {
                        if (e.target.checked) return Array.from(new Set([...prev, v.id]));
                        return prev.filter((id) => id !== v.id);
                      });
                    }}
                  />
                  {v.plate}
                </label>
              );
            })}
          </div>
          <button
            className={`px-2 py-1 rounded ${simRunning ? 'bg-gray-300' : 'bg-emerald-600 text-white'}`}
            disabled={simRunning || selectedVehicleIds.length === 0}
            onClick={startAll}
          >Iniciar todos</button>
          <button
            className={`px-2 py-1 rounded ${simRunning ? 'bg-red-600 text-white' : 'bg-gray-300'}`}
            disabled={!simRunning}
            onClick={stopAll}
          >Detener todos</button>
        </div>
        <span className="text-sm text-gray-600">| POIs:</span>
        <label className="text-sm flex items-center gap-2">
          <input type="checkbox" checked={poiMode} onChange={(e) => setPoiMode(e.target.checked)} /> Modo POI
        </label>
        {poiMode && (
          <span className="text-xs text-orange-600">Actualización en vivo pausada mientras agregas POIs</span>
        )}
        <input list="poi-type-suggestions" className="border rounded px-2 py-1" placeholder="Categoría (libre)" value={poiType} onChange={(e) => setPoiType(e.target.value)} />
        <datalist id="poi-type-suggestions">
          <option value="gasolinera" />
          <option value="bebidas" />
          <option value="descanso" />
          <option value="comida" />
          <option value="mecanica" />
          <option value="primeros_auxilios" />
          <option value="banos" />
          <option value="informacion" />
          <option value="estacionamiento" />
          <option value="taller" />
          <option value="restaurante" />
          <option value="sponsor" />
          <option value="bar" />
          <option value="billar" />
          <option value="sport_bar" />
          <option value="moto_club" />
          <option value="parque" />
        </datalist>
        <input className="border rounded px-2 py-1" placeholder="Nombre POI" value={poiName} onChange={(e) => setPoiName(e.target.value)} />
        <button
          className="px-2 py-1 rounded bg-emerald-600 text-white"
          disabled={!selectedId || tempPois.length === 0}
          onClick={async () => {
            if (!selected) return;
            // Mezclar POIs como FeatureCollection junto a la geometría existente
            let g: any = selected.geojson;
            try { if (typeof g === 'string') g = JSON.parse(g); } catch {}
            const poiFeatures = tempPois.map((p) => ({
              type: 'Feature',
              properties: { kind: 'poi', poiType: p.type, name: p.name },
              geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
            }));
            let newGeo: any;
            if (!g) {
              newGeo = { type: 'FeatureCollection', features: poiFeatures };
            } else if (g.type === 'FeatureCollection') {
              newGeo = { ...g, features: [...(g.features || []), ...poiFeatures] };
            } else {
              newGeo = { type: 'FeatureCollection', features: [g, ...poiFeatures] };
            }
            try {
              await api.routesUpdate(selected.id, { geojson: newGeo });
              setTempPois([]);
              setPoiName('');
              const data = await api.routesList();
              setRoutes(data);
            } catch {}
          }}
        >Guardar POIs en ruta</button>
          <button
            className={`px-2 py-1 rounded ${editingRoute ? 'bg-yellow-500 text-white' : 'bg-gray-200'}`}
            disabled={!selected}
            onClick={() => setEditingRoute((e) => !e)}
          >{editingRoute ? 'Editando…' : 'Editar ruta'}</button>
        </div>
      </details>
      <div style={{ position: 'relative' }}>
      <MapContainer {...({ center, zoom: 13, style: { height: '70vh', width: '100%' }, whenCreated: (m: L.Map) => { mapRef.current = m; } } as any)}>
        <TileLayer
          url={process.env.NEXT_PUBLIC_MAP_TILES_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}
        />
        {(() => {
          let g: any = selected?.geojson;
          if (!g) return null;
          if (typeof g === 'string') {
            try { g = JSON.parse(g); } catch { return null; }
          }
          return (
            <GeoJSON
              key={selected?.id}
              ref={geoRef as any}
              data={g}
              pathOptions={{ color: '#2563eb', weight: 4 }}
            />
          );
        })()}
        <FitToSelected />
        <ClickCapture />
        {drawPoints.length >= 2 && (
          <Polyline positions={drawPoints.map((p) => [p.lat, p.lng])} pathOptions={{ color: '#16a34a', weight: 3 }} />
        )}
        {tempPois.map((p, i) => (
          <Marker key={`tmp-${i}`} position={[p.lat, p.lng]}>
            <Popup>
              POI (no guardado): {p.name || '(sin nombre)'}
              <br />Tipo: {p.type}
            </Popup>
          </Marker>
        ))}
        {(() => {
          let g: any = selected?.geojson;
          try { if (typeof g === 'string') g = JSON.parse(g); } catch { g = null; }
          const feats: any[] = g?.type === 'FeatureCollection' ? (g.features || []) : g ? [g] : [];
          const points = feats.filter((f) => f?.geometry?.type === 'Point');
          return points.map((f, i) => {
            const [lng, lat] = f.geometry.coordinates || [];
            const name = f.properties?.name || '(sin nombre)';
            const kind = f.properties?.poiType || f.properties?.kind || 'poi';
            return (
              <Marker key={`poi-${i}`} position={[lat, lng]}>
                <Popup>
                  {name}
                  <br />Tipo: {kind}
                </Popup>
              </Marker>
            );
          });
        })()}
        {editingRoute && showVertices && simPath.length > 0 && simPath.map((p, i) => (
          <Marker key={`vtx-${i}`} {...({ position: [p.lat, p.lng], icon: buildVertexIcon() } as any)} />
        ))}
        {Object.entries(positions).map(([vehicleId, pos]) => {
          const v = vehicles.find((vv) => vv.id === vehicleId);
          const plate = v?.plate || vehicleId;
          const driver = v?.driverName || '-';
          const brand = v?.brand || '-';
          return (
            <Marker key={vehicleId} {...({ position: [pos.lat, pos.lng], icon: buildIcon(vehicleId) } as any)}>
              <Popup>
                <div className="text-sm">
                  <div><strong>#{(numberByIdRef.current.get(vehicleId) || 0)}</strong> · {plate}</div>
                  <div>Conductor: {driver}</div>
                  <div>Marca: {brand}</div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
      {/* Floating compact controls over the map */}
      <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 8, zIndex: 1000 }}>
        {!simRunning ? (
          <button
            className="px-2 py-1 rounded bg-emerald-600 text-white text-xs"
            disabled={selectedVehicleIds.length === 0 || !selectedId}
            title={!selectedId ? 'Selecciona una ruta para iniciar' : (selectedVehicleIds.length === 0 ? 'Selecciona al menos un vehículo' : '')}
            onClick={startAll}
          >Iniciar</button>
        ) : (
          <button
            className="px-2 py-1 rounded bg-red-600 text-white text-xs"
            onClick={stopAll}
          >Detener</button>
        )}
      </div>
      <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 8, zIndex: 1000 }}>
        <button
          className={`px-2 py-1 rounded ${editingRoute ? 'bg-yellow-500 text-white' : 'bg-white/80'} text-xs`}
          disabled={!selected}
          onClick={() => setEditingRoute((e) => !e)}
        >{editingRoute ? 'Editando' : 'Editar'}</button>
        {editingRoute && (
          <>
            <button className="px-2 py-1 rounded bg-emerald-600 text-white text-xs" onClick={saveEditedRoute}>Guardar</button>
            <button className="px-2 py-1 rounded bg-gray-300 text-xs" onClick={cancelEditedRoute}>Cancelar</button>
            <label className="bg-white/90 px-2 py-1 rounded text-xs inline-flex items-center gap-1">
              <input type="checkbox" checked={saveAsLineString} onChange={(e) => setSaveAsLineString(e.target.checked)} />
              Guardar como LineString
            </label>
            <label className="bg-white/90 px-2 py-1 rounded text-xs inline-flex items-center gap-1">
              <input type="checkbox" checked={showVertices} onChange={(e) => setShowVertices(e.target.checked)} />
              Mostrar vértices
            </label>
            <label className="bg-white/90 px-2 py-1 rounded text-xs inline-flex items-center gap-1">
              <input type="checkbox" checked={moveVertexOnClick} onChange={(e) => setMoveVertexOnClick(e.target.checked)} />
              Mover vértice con clic
            </label>
          </>
        )}
      </div>
      </div>
      {/* Leyenda de pilotos */}
      <div className="flex flex-wrap gap-3 text-sm">
        {vehicles.map((v) => {
          const color = colorByIdRef.current.get(v.id) || '#2563eb';
          const num = numberByIdRef.current.get(v.id) || 0;
          return (
            <div key={`leg-${v.id}`} className="inline-flex items-center gap-2">
              <span style={{display:'inline-block', width:10, height:10, borderRadius:9999, background:color}} />
              <span>#{num} · {v.plate}{v.driverName ? ` · ${v.driverName}` : ''}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
