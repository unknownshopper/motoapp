import { useEffect, useState } from 'react';
import { api } from '../lib/api';

 type Route = {
  id: string;
  name: string;
  description?: string | null;
  geojson?: any;
};

// Utils para calcular distancia en Km a partir de GeoJSON (LineString/MultiLineString/Feature/FeatureCollection)
function toRad(d: number) { return (d * Math.PI) / 180; }
function haversineKm(a: [number, number], b: [number, number]) {
  const R = 6371; // km
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function sumLineKm(coords: [number, number][]) {
  let s = 0;
  for (let i = 1; i < coords.length; i++) s += haversineKm(coords[i - 1], coords[i]);
  return s;
}
function lengthFromGeometry(geom: any): number {
  if (!geom) return 0;
  const t = geom.type;
  if (t === 'LineString') return sumLineKm(geom.coordinates as [number, number][]);
  if (t === 'MultiLineString') return (geom.coordinates as [number, number][][]).reduce((acc, c) => acc + sumLineKm(c), 0);
  if (t === 'Polygon') {
    const rings = geom.coordinates as [number, number][][];
    return sumLineKm(rings[0] || []); // perímetro de anillo exterior
  }
  if (t === 'MultiPolygon') {
    const polys = geom.coordinates as [number, number][][][];
    return polys.reduce((acc, p) => acc + sumLineKm((p[0] || [])), 0);
  }
  return 0;
}
function getKmFromGeojson(g: any): number {
  if (!g) return 0;
  try { if (typeof g === 'string') g = JSON.parse(g); } catch { return 0; }
  if (g.type === 'Feature') return lengthFromGeometry(g.geometry);
  if (g.type === 'FeatureCollection') return (g.features || []).reduce((acc: number, f: any) => acc + lengthFromGeometry(f.geometry), 0);
  return lengthFromGeometry(g);
}
function getTimeLabelFromGeojson(g: any): string {
  if (!g) return '-';
  try { if (typeof g === 'string') g = JSON.parse(g); } catch { return '-'; }
  const props = g.properties || (g.type === 'Feature' ? g.properties : undefined);
  let minutes: number | null = null;
  if (props) {
    if (typeof props.durationMinutes === 'number') minutes = props.durationMinutes;
    else if (typeof props.durationSeconds === 'number') minutes = Math.round(props.durationSeconds / 60);
    else if (typeof props.timeMin === 'number') minutes = props.timeMin;
  }
  if (minutes == null) {
    // Estimación basada en distancia y velocidad media
    const km = getKmFromGeojson(g);
    if (km > 0) {
      const avgSpeedKmH = 50; // velocidad media estimada
      minutes = Math.max(1, Math.round((km / avgSpeedKmH) * 60));
    } else {
      return '-';
    }
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function RoutesPage() {
  const [items, setItems] = useState<Route[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ name: string; description: string; geojsonText: string }>({ name: '', description: '', geojsonText: '' });
  const [gpxFile, setGpxFile] = useState<File | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; description: string; geojsonText: string }>({ name: '', description: '', geojsonText: '' });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.routesList();
      setItems(data);
    } catch (e: any) {
      setError(`Error cargando rutas (${e.message})`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      // Caso 1: Subida directa de GPX -> crear ruta y luego importar GPX
      if (gpxFile) {
        const created = await api.routesCreate({ name: form.name, description: form.description || undefined });
        const routeId = (created && (created.id || created.route?.id)) ?? created?.id;
        if (!routeId) throw new Error('No se obtuvo el ID de la ruta creada');
        await api.routesImportGpx(routeId, gpxFile);
      } else {
        // Caso 2: GeoJSON pegado o archivo GeoJSON
        let geojson: any = undefined;
        if (form.geojsonText.trim()) {
          geojson = JSON.parse(form.geojsonText);
        }
        await api.routesCreate({ name: form.name, description: form.description || undefined, geojson });
      }
      setForm({ name: '', description: '', geojsonText: '' });
      setGpxFile(null);
      await load();
    } catch (e: any) {
      setError(`Error creando ruta (${e.message})`);
    }
  };

  const startEdit = (r: Route) => {
    setEditingId(r.id);
    setEditForm({ name: r.name, description: r.description || '', geojsonText: r.geojson ? JSON.stringify(r.geojson) : '' });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      let geojson: any = undefined;
      if (editForm.geojsonText.trim()) {
        geojson = JSON.parse(editForm.geojsonText);
      }
      await api.routesUpdate(editingId, { name: editForm.name, description: editForm.description || undefined, geojson });
      setEditingId(null);
      await load();
    } catch (e: any) {
      setError(`Error actualizando ruta (${e.message})`);
    }
  };

  const cancelEdit = () => setEditingId(null);

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar ruta?')) return;
    try {
      await api.routesDelete(id);
      await load();
    } catch (e: any) {
      setError(`Error eliminando ruta (${e.message})`);
    }
  };

  const onImportGpx = async (routeId: string, file: File) => {
    setError(null);
    try {
      await api.routesImportGpx(routeId, file);
      await load();
    } catch (e: any) {
      setError(`Error importando GPX (${e.message})`);
    }
  };

  const onGeoJsonFile = async (file: File, setText: (s: string) => void) => {
    const text = await file.text();
    setText(text);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Rutas</h1>

      <section className="p-4 bg-white rounded border">
        <h2 className="font-medium mb-2">Nueva ruta</h2>
        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            className="border rounded px-2 py-1"
            placeholder="Nombre"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
          <input
            className="border rounded px-2 py-1"
            placeholder="Descripción (opcional)"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <div className="md:col-span-2 flex items-center gap-2 flex-wrap">
            <input
              type="file"
              accept="application/geo+json,application/json,.geojson,.json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onGeoJsonFile(file, (s) => setForm((f) => ({ ...f, geojsonText: s })));
              }}
            />
            <input
              type="file"
              accept="application/gpx+xml,.gpx"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setGpxFile(file);
              }}
            />
            <button className="px-3 py-1 rounded bg-blue-600 text-white">Guardar</button>
          </div>
          <textarea
            className="border rounded px-2 py-1 md:col-span-4 h-32"
            placeholder="Pega GeoJSON aquí (opcional)"
            value={form.geojsonText}
            onChange={(e) => setForm((f) => ({ ...f, geojsonText: e.target.value }))}
          />
        </form>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </section>

      <section className="p-4 bg-white rounded border">
        <h2 className="font-medium mb-2">Listado</h2>
        {loading ? (
          <p>Cargando…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="p-2">Nombre</th>
                  <th className="p-2">Descripción</th>
                  <th className="p-2">GeoJSON</th>
                  <th className="p-2">Kilómetros</th>
                  <th className="p-2">Tiempo</th>
                  <th className="p-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id} className="border-b">
                    <td className="p-2">
                      {editingId === r.id ? (
                        <input className="border rounded px-2 py-1" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
                      ) : (
                        r.name
                      )}
                    </td>
                    <td className="p-2">
                      {editingId === r.id ? (
                        <input className="border rounded px-2 py-1" value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} />
                      ) : (
                        r.description || '-'
                      )}
                    </td>
                    <td className="p-2">
                      {editingId === r.id ? (
                        <textarea className="border rounded px-2 py-1 w-full h-24" value={editForm.geojsonText} onChange={(e) => setEditForm((f) => ({ ...f, geojsonText: e.target.value }))} />
                      ) : (
                        r.geojson ? 'Sí' : 'No'
                      )}
                    </td>
                    <td className="p-2">
                      {(() => {
                        const km = getKmFromGeojson(r.geojson);
                        return km ? `${km.toFixed(2)} km` : '-';
                      })()}
                    </td>
                    <td className="p-2">{getTimeLabelFromGeojson(r.geojson)}</td>
                    <td className="p-2 space-x-2">
                      {editingId === r.id ? (
                        <>
                          <button onClick={saveEdit} className="px-2 py-1 rounded bg-green-600 text-white">Guardar</button>
                          <button onClick={cancelEdit} className="px-2 py-1 rounded bg-gray-300">Cancelar</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(r)} className="px-2 py-1 rounded bg-yellow-500 text-white">Editar</button>
                          <button onClick={() => remove(r.id)} className="px-2 py-1 rounded bg-red-600 text-white">Eliminar</button>
                          <label className="inline-flex items-center gap-2 px-2 py-1 rounded bg-blue-50 border cursor-pointer">
                            <span>Importar GPX</span>
                            <input
                              type="file"
                              accept="application/gpx+xml,.gpx"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) onImportGpx(r.id, f);
                                // reset to allow uploading same file again
                                e.currentTarget.value = '';
                              }}
                            />
                          </label>
                          <a
                            href={api.routesExportGpxUrl(r.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-1 rounded bg-indigo-600 text-white"
                          >Exportar GPX</a>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td className="p-2 text-gray-500" colSpan={6}>Sin registros</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
