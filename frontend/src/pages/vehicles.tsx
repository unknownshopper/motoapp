import { useEffect, useState } from 'react';
import { api } from '../lib/api';

type Vehicle = {
  id: string;
  plate: string;
  brand?: string | null;
  model?: string | null;
  status?: string | null;
  club?: string | null;
  driver?: { id: string; name: string; nickname?: string | null; preferNickname?: boolean | null } | null;
};

type DriverOpt = { id: string; name: string; nickname?: string | null; preferNickname?: boolean | null };

export default function VehiclesPage() {
  const [items, setItems] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ plate: '', brand: '', model: '', status: 'activo', club: '', driverId: '' });
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ plate: string; brand: string; model: string; status: string; club: string; driverId: string }>({ plate: '', brand: '', model: '', status: 'activo', club: '', driverId: '' });
  const [drivers, setDrivers] = useState<DriverOpt[]>([]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.vehiclesList();
      setItems(data);
    } catch (e: any) {
      setError(`Error cargando vehículos (${e.message})`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    (async () => {
      try {
        const ds = await api.driversList();
        setDrivers(ds);
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.vehiclesCreate({
        plate: form.plate,
        brand: form.brand || undefined,
        model: form.model || undefined,
        status: form.status || undefined,
        club: form.club || undefined,
        driverId: form.driverId || undefined,
      });
      setForm({ plate: '', brand: '', model: '', status: 'activo', club: '', driverId: '' });
      await load();
    } catch (e: any) {
      setError(`Error creando vehículo (${e.message})`);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Vehículos</h1>

      <section className="p-4 bg-white rounded border">
        <h2 className="font-medium mb-2">Nuevo vehículo</h2>
        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <input
            className="border rounded px-2 py-1"
            placeholder="Placa"
            value={form.plate}
            onChange={(e) => setForm((f) => ({ ...f, plate: e.target.value }))}
            required
          />
          <input
            className="border rounded px-2 py-1"
            placeholder="Marca"
            value={form.brand}
            onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
          />
          <input
            className="border rounded px-2 py-1"
            placeholder="Modelo"
            value={form.model}
            onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
          />
          <select
            className="border rounded px-2 py-1"
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
          >
            <option value="activo">activo</option>
            <option value="inactivo">inactivo</option>
          </select>
          <input
            className="border rounded px-2 py-1"
            placeholder="Grupo/Club (opcional)"
            value={form.club}
            onChange={(e) => setForm((f) => ({ ...f, club: e.target.value }))}
          />
          <select
            className="border rounded px-2 py-1"
            value={form.driverId}
            onChange={(e) => setForm((f) => ({ ...f, driverId: e.target.value }))}
          >
            <option value="">Sin piloto asignado</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {(d.preferNickname && d.nickname) ? d.nickname : d.name}
              </option>
            ))}
          </select>
          <div className="md:col-span-6">
            <button className="px-3 py-1 rounded bg-blue-600 text-white">Guardar</button>
          </div>
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
                  <th className="p-2">Placa</th>
                  <th className="p-2">Marca</th>
                  <th className="p-2">Modelo</th>
                  <th className="p-2">Estado</th>
                  <th className="p-2">Club</th>
                  <th className="p-2">Piloto</th>
                  <th className="p-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((v) => (
                  <tr key={v.id} className="border-b">
                    <td className="p-2">
                      {editingId === v.id ? (
                        <input className="border rounded px-2 py-1" value={editForm.plate} onChange={(e) => setEditForm((f) => ({ ...f, plate: e.target.value }))} />
                      ) : (
                        v.plate
                      )}
                    </td>
                    <td className="p-2">
                      {editingId === v.id ? (
                        <input className="border rounded px-2 py-1" value={editForm.brand} onChange={(e) => setEditForm((f) => ({ ...f, brand: e.target.value }))} />
                      ) : (
                        v.brand || '-'
                      )}
                    </td>
                    <td className="p-2">
                      {editingId === v.id ? (
                        <input className="border rounded px-2 py-1" value={editForm.model} onChange={(e) => setEditForm((f) => ({ ...f, model: e.target.value }))} />
                      ) : (
                        v.model || '-'
                      )}
                    </td>
                    <td className="p-2">
                      {editingId === v.id ? (
                        <select className="border rounded px-2 py-1" value={editForm.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}>
                          <option value="activo">activo</option>
                          <option value="inactivo">inactivo</option>
                        </select>
                      ) : (
                        v.status || '-'
                      )}
                    </td>
                    <td className="p-2">
                      {editingId === v.id ? (
                        <input className="border rounded px-2 py-1" value={editForm.club} onChange={(e) => setEditForm((f) => ({ ...f, club: e.target.value }))} />
                      ) : (
                        v.club || '-'
                      )}
                    </td>
                    <td className="p-2">
                      {editingId === v.id ? (
                        <select className="border rounded px-2 py-1" value={editForm.driverId} onChange={(e) => setEditForm((f) => ({ ...f, driverId: e.target.value }))}>
                          <option value="">Sin piloto asignado</option>
                          {drivers.map((d) => (
                            <option key={d.id} value={d.id}>
                              {(d.preferNickname && d.nickname) ? d.nickname : d.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        v.driver ? ((v.driver.preferNickname && v.driver.nickname) ? v.driver.nickname : v.driver.name) : '-'
                      )}
                    </td>
                    <td className="p-2 space-x-2">
                      {editingId === v.id ? (
                        <>
                          <button
                            onClick={async () => {
                              try {
                                await api.vehiclesUpdate(v.id, {
                                  plate: editForm.plate,
                                  brand: editForm.brand || undefined,
                                  model: editForm.model || undefined,
                                  status: editForm.status || undefined,
                                  club: editForm.club || undefined,
                                  driverId: editForm.driverId || undefined,
                                });
                                setEditingId(null);
                                await load();
                              } catch (e: any) {
                                setError(`Error actualizando vehículo (${e.message})`);
                              }
                            }}
                            className="px-2 py-1 rounded bg-green-600 text-white"
                          >
                            Guardar
                          </button>
                          <button onClick={() => setEditingId(null)} className="px-2 py-1 rounded bg-gray-300">Cancelar</button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setEditingId(v.id);
                              setEditForm({ plate: v.plate, brand: v.brand || '', model: v.model || '', status: v.status || 'activo', club: v.club || '', driverId: v.driver?.id || '' });
                            }}
                            className="px-2 py-1 rounded bg-yellow-500 text-white"
                          >
                            Editar
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm('¿Eliminar vehículo?')) return;
                              try {
                                await api.vehiclesDelete(v.id);
                                await load();
                              } catch (e: any) {
                                setError(`Error eliminando vehículo (${e.message})`);
                              }
                            }}
                            className="px-2 py-1 rounded bg-red-600 text-white"
                          >
                            Eliminar
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td className="p-2 text-gray-500" colSpan={7}>Sin registros</td>
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
