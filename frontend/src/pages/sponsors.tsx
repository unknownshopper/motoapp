import { useEffect, useState } from 'react';
import { api } from '../lib/api';

type SponsorLocation = { id: string; lat: number; lng: number; label?: string | null; category?: string | null; note?: string | null };

type Registration = {
  id: string;
  type: 'PILOT' | 'SPECTATOR' | 'SPONSOR';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  route?: { id: string; name: string } | null;
  name: string;
  email: string;
  phone: string;
  companyName?: string | null;
  website?: string | null;
  services?: string | null;
  sponsorLocations?: SponsorLocation[];
  dates?: { id: string; when: string }[];
  createdAt: string;
};

export default function SponsorsPage() {
  const [approved, setApproved] = useState<Registration[]>([]);
  const [pending, setPending] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'APROBADOS' | 'SOLICITUDES'>('APROBADOS');
  const role = api.getCurrentRole();
  const isAdmin = role === 'ADMIN';

  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState<Registration | null>(null);
  const [poiEdits, setPoiEdits] = useState<SponsorLocation[]>([]);
  const [saving, setSaving] = useState(false);
  const [openDetails, setOpenDetails] = useState<Record<string, boolean>>({});

  function toggleDetails(id: string) {
    setOpenDetails((m) => ({ ...m, [id]: !m[id] }));
  }

  function fmt(d?: string) {
    if (!d) return '—';
    const dt = new Date(d);
    return dt.toLocaleDateString();
  }

  // Helpers de edición y refresco (fuera del useEffect)
  async function refreshLists() {
    const sponsors: Registration[] = await api.registrationsSponsorsPublicApproved();
    setApproved(sponsors);
    if (isAdmin) {
      try {
        const pend: any[] = await api.registrationsPending();
        const onlySponsors = (pend || []).filter((r) => r.type === 'SPONSOR');
        setPending(onlySponsors as any);
      } catch {}
    }
  }

  function openEdit(r: Registration) {
    setEditData(r);
    setPoiEdits([...(r.sponsorLocations || [])]);
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editData) return;
    try {
      setSaving(true);
      await api.registrationsUpdate(editData.id, {
        companyName: editData.companyName || null,
        website: editData.website || null,
        services: editData.services || null,
        message: (editData as any).message || null,
        email: editData.email,
        phone: editData.phone,
        name: editData.name,
      });
      // Sync POIs (actualizar/eliminar existentes). Nota: crear nuevos POIs requiere lat/lng.
      const original = editData.sponsorLocations || [];
      const toDelete = original.filter(o => !poiEdits.find(p => p.id === o.id));
      for (const d of toDelete) {
        // eslint-disable-next-line no-await-in-loop
        await api.registrationsDeletePoi(editData.id, d.id);
      }
      for (const p of poiEdits) {
        if (p.id && !String(p.id).startsWith('tmp-')) {
          // eslint-disable-next-line no-await-in-loop
          await api.registrationsUpdatePoi(editData.id, p.id, { category: p.category || undefined, note: p.note || undefined, label: p.label || undefined });
        }
      }
      await refreshLists();
      setEditOpen(false);
    } catch (e: any) {
      setError(e?.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  async function deleteSponsor(id: string) {
    if (!confirm('¿Eliminar este registro y sus POIs?')) return;
    try {
      await api.registrationsDelete(id);
      await refreshLists();
    } catch (e: any) {
      setError(e?.message || 'No se pudo eliminar');
    }
  }

  // Carga inicial
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const sponsors: Registration[] = await api.registrationsSponsorsPublicApproved();
        setApproved(sponsors);
        if (role === 'ADMIN') {
          try {
            const pend: any[] = await api.registrationsPending();
            const onlySponsors = (pend || []).filter((r) => r.type === 'SPONSOR');
            setPending(onlySponsors as any);
          } catch {}
        }
      } catch (e: any) {
        setError(e?.message || 'No se pudo cargar la lista');
      } finally {
        setLoading(false);
      }
    })();
  }, [role]);

  async function handleDecision(id: string, status: 'APPROVED' | 'REJECTED') {
    try {
      await api.registrationsSetStatus(id, status);
      // refrescar ambas listas
      const sponsors: Registration[] = await api.registrationsSponsorsPublicApproved();
      setApproved(sponsors);
      if (role === 'ADMIN') {
        const pend: any[] = await api.registrationsPending();
        const onlySponsors = (pend || []).filter((r) => r.type === 'SPONSOR');
        setPending(onlySponsors as any);
      }
    } catch (e: any) {
      setError(e?.message || 'No se pudo actualizar el estado');
    }
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Sponsors</h1>
      <div className="flex items-center gap-2">
        <button
          className={`px-3 py-1 rounded ${tab === 'APROBADOS' ? 'bg-gray-800 text-white' : 'bg-gray-200'}`}
          onClick={() => setTab('APROBADOS')}
        >Aprobados</button>
        <button
          className={`px-3 py-1 rounded ${tab === 'SOLICITUDES' ? 'bg-gray-800 text-white' : 'bg-gray-200'}`}
          onClick={() => setTab('SOLICITUDES')}
        >Solicitudes</button>
      </div>
      <p className="text-sm text-gray-600">{tab === 'APROBADOS' ? 'Lista pública de sponsors aprobados y sus POIs.' : 'Solicitudes pendientes de aprobación (solo admin).'}</p>
      {loading && <p>Cargando…</p>}
      {error && (
        <div className="text-red-600 text-sm">{error}</div>
      )}
      {tab === 'APROBADOS' ? (
        !loading && !error && (
          approved.length === 0 ? (
            <p className="text-gray-600">No hay sponsors.</p>
          ) : (
            <ul className="space-y-3">
              {approved.map((r) => (
                <li key={r.id} className="bg-white border rounded p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{r.companyName || '—'} <span className="text-gray-500 text-sm">({r.name})</span></div>
                      <div className="text-sm text-gray-600">Ruta: {r.route?.name || '—'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-800">{r.status}</span>
                      <button className="text-xs px-2 py-1 rounded bg-gray-200" onClick={() => toggleDetails(r.id)}>{openDetails[r.id] ? 'Ocultar' : 'Ver'} detalles</button>
                      {isAdmin && (
                        <>
                          <button className="text-xs px-2 py-1 rounded bg-gray-200" onClick={() => openEdit(r)}>Editar</button>
                          <button className="text-xs px-2 py-1 rounded bg-red-600 text-white" onClick={() => deleteSponsor(r.id)}>Eliminar</button>
                        </>
                      )}
                    </div>
                  </div>
                  {openDetails[r.id] && (
                    <>
                      <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-700">
                        <div><span className="text-gray-500">Contacto:</span> {r.name}</div>
                        <div><span className="text-gray-500">Tel:</span> {r.phone}</div>
                        <div><span className="text-gray-500">Email:</span> {r.email}</div>
                        <div className="md:col-span-3"><span className="text-gray-500">Web:</span> {r.website || '—'}</div>
                      </div>
                      {r.services && <div className="mt-1 text-sm"><span className="text-gray-500">Servicios/Producto:</span> {r.services}</div>}
                      <div className="mt-1 text-sm text-gray-700">
                        <span className="text-gray-500">Fechas:</span> {(r.dates && r.dates.length > 0) ? r.dates.map(d => fmt(d.when)).join(', ') : fmt(r as any as string)}
                      </div>
                    </>
                  )}
                  <div className="mt-2 text-xs text-gray-600">POIs: {(r.sponsorLocations || []).length}</div>
                  {(r.sponsorLocations || []).length > 0 && (
                    <ul className="mt-1 text-xs text-gray-600 list-disc pl-5">
                      {(r.sponsorLocations || []).map((p) => (
                        <li key={p.id}>
                          {p.label || p.category || '(sin categoría)'}{p.note ? ` — ${p.note}` : ''}
                          {' · '}lat {p.lat.toFixed(5)}, lng {p.lng.toFixed(5)}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )
        )
      ) : (
        role !== 'ADMIN' ? (
          <p className="text-gray-600">Requiere rol ADMIN.</p>
        ) : (
          !loading && (
            pending.length === 0 ? (
              <p className="text-gray-600">No hay solicitudes pendientes.</p>
            ) : (
              <ul className="space-y-3">
                {pending.map((r) => (
                  <li key={r.id} className="bg-white border rounded p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{r.companyName || '—'} <span className="text-gray-500 text-sm">({r.name})</span></div>
                        <div className="text-sm text-gray-600">Ruta: {r.route?.name || '—'}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800">{r.status}</span>
                        <button className="text-xs px-2 py-1 rounded bg-gray-200" onClick={() => toggleDetails(r.id)}>{openDetails[r.id] ? 'Ocultar' : 'Ver'} detalles</button>
                        <button className="text-xs px-2 py-1 rounded bg-gray-200" onClick={() => openEdit(r)}>Editar</button>
                        <button className="text-xs px-2 py-1 rounded bg-red-600 text-white" onClick={() => deleteSponsor(r.id)}>Eliminar</button>
                      </div>
                    </div>
                    {openDetails[r.id] && (
                      <>
                        <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-700">
                          <div><span className="text-gray-500">Email:</span> {r.email}</div>
                          <div><span className="text-gray-500">Tel:</span> {r.phone}</div>
                          <div><span className="text-gray-500">Web:</span> {r.website || '—'}</div>
                          <div className="md:col-span-3"><span className="text-gray-500">Empresa:</span> {r.companyName || '—'}</div>
                          <div className="md:col-span-3"><span className="text-gray-500">Servicios:</span> {r.services || '—'}</div>
                          <div className="md:col-span-3"><span className="text-gray-500">Fechas:</span> {(r.dates && r.dates.length > 0) ? r.dates.map(d => fmt(d.when)).join(', ') : fmt(r as any as string)}</div>
                        </div>
                      </>
                    )}
                    <div className="mt-2 text-xs text-gray-600">POIs: {(r.sponsorLocations || []).length}</div>
                    {(r.sponsorLocations || []).length > 0 && (
                      <ul className="mt-1 text-xs text-gray-600 list-disc pl-5">
                        {(r.sponsorLocations || []).map((p) => (
                          <li key={p.id}>
                            {p.label || p.category || '(sin categoría)'}{p.note ? ` — ${p.note}` : ''}
                            {' · '}lat {p.lat.toFixed(5)}, lng {p.lng.toFixed(5)}
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-3 flex gap-2">
                      <button className="px-2 py-1 rounded bg-emerald-600 text-white" onClick={() => handleDecision(r.id, 'APPROVED')}>Aprobar</button>
                      <button className="px-2 py-1 rounded bg-red-600 text-white" onClick={() => handleDecision(r.id, 'REJECTED')}>Rechazar</button>
                    </div>
                  </li>
                ))}
              </ul>
            )
          )
        )
      )}

      {/* Edit Modal */}
      {editOpen && editData && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-2xl rounded shadow p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Editar Sponsor</h3>
              <button className="text-sm px-2 py-1 rounded bg-gray-200" onClick={() => setEditOpen(false)}>Cerrar</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <div>
                <label className="block text-xs text-gray-600">Empresa</label>
                <input className="w-full border rounded px-2 py-1" value={editData.companyName || ''} onChange={(e) => setEditData({ ...editData, companyName: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-gray-600">Website</label>
                <input className="w-full border rounded px-2 py-1" value={editData.website || ''} onChange={(e) => setEditData({ ...editData, website: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-gray-600">Contacto</label>
                <input className="w-full border rounded px-2 py-1" value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-gray-600">Email</label>
                <input className="w-full border rounded px-2 py-1" value={editData.email} onChange={(e) => setEditData({ ...editData, email: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-gray-600">Teléfono</label>
                <input className="w-full border rounded px-2 py-1" value={editData.phone} onChange={(e) => setEditData({ ...editData, phone: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-600">Servicios</label>
                <input className="w-full border rounded px-2 py-1" value={editData.services || ''} onChange={(e) => setEditData({ ...editData, services: e.target.value })} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">POIs</h4>
                <button className="text-xs px-2 py-1 rounded bg-gray-200" onClick={() => setPoiEdits([...poiEdits, { id: `tmp-${Date.now()}`, lat: 0, lng: 0, category: '', note: '' } as any])}>Añadir POI</button>
              </div>
              <div className="mt-2 space-y-2">
                {poiEdits.map((p, i) => (
                  <div key={p.id} className="border rounded p-2 bg-gray-50 text-sm">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-600">lat {p.lat.toFixed ? p.lat.toFixed(5) : p.lat}, lng {p.lng.toFixed ? p.lng.toFixed(5) : p.lng}</div>
                      <button className="text-xs px-2 py-1 rounded bg-red-100 text-red-700" onClick={() => setPoiEdits(arr => arr.filter((x) => x.id !== p.id))}>Eliminar</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
                      <input className="border rounded px-2 py-1" placeholder="Categoría" value={p.category || ''} onChange={(e) => setPoiEdits(arr => arr.map((x) => x.id === p.id ? { ...x, category: e.target.value } : x))} />
                      <input className="border rounded px-2 py-1 md:col-span-2" placeholder="Nota" value={p.note || ''} onChange={(e) => setPoiEdits(arr => arr.map((x) => x.id === p.id ? { ...x, note: e.target.value } : x))} />
                    </div>
                  </div>
                ))}
                {poiEdits.length === 0 && <div className="text-xs text-gray-500">Sin POIs</div>}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button className="px-3 py-1 rounded bg-gray-200" onClick={() => setEditOpen(false)}>Cancelar</button>
              <button disabled={saving} className={`px-3 py-1 rounded ${saving ? 'bg-gray-300' : 'bg-blue-600 text-white'}`} onClick={saveEdit}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
