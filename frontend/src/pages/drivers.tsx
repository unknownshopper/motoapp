import { useEffect, useState } from 'react';
import { api } from '../lib/api';

type Driver = {
  id: string;
  name: string;
  license?: string | null;
  userId?: string | null;
  club?: string | null;
  nickname?: string | null;
  preferNickname?: boolean | null;
  _count?: { vehicles?: number };
};

export default function DriversPage() {
  const [items, setItems] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', license: '', club: '', nickname: '', preferNickname: false });
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; license: string; club: string; nickname: string; preferNickname: boolean }>({ name: '', license: '', club: '', nickname: '', preferNickname: false });
  const isAdmin = (api.getCurrentRole() || '').toUpperCase() === 'ADMIN';

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.driversList();
      setItems(data);
    } catch (e: any) {
      setError(`Error cargando conductores (${e.message})`);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (d: Driver) => {
    setEditingId(d.id);
    setEditForm({ name: d.name, license: d.license || '', club: d.club || '', nickname: d.nickname || '', preferNickname: !!d.preferNickname });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      await api.driversUpdate(editingId, {
        name: editForm.name,
        license: editForm.license || undefined,
        club: editForm.club || undefined,
        nickname: editForm.nickname || undefined,
        preferNickname: editForm.preferNickname,
      });
      setEditingId(null);
      await load();
    } catch (e: any) {
      setError(`Error actualizando conductor (${e.message})`);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar conductor?')) return;
    try {
      await api.driversDelete(id);
      await load();
    } catch (e: any) {
      setError(`Error eliminando conductor (${e.message})`);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.driversCreate({
        name: form.name,
        license: form.license || undefined,
        club: form.club || undefined,
        nickname: form.nickname || undefined,
        preferNickname: form.preferNickname || undefined,
      });
      setForm({ name: '', license: '', club: '', nickname: '', preferNickname: false });
      await load();
    } catch (e: any) {
      setError(`Error creando conductor (${e.message})`);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Conductores</h1>

      <section className="p-4 bg-white rounded border">
        <h2 className="font-medium mb-2">Nuevo conductor</h2>
        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <input
            className="border rounded px-2 py-1"
            placeholder="Nombre"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
          <input
            className="border rounded px-2 py-1"
            placeholder="Licencia (opcional)"
            value={form.license}
            onChange={(e) => setForm((f) => ({ ...f, license: e.target.value }))}
          />
          <input
            className="border rounded px-2 py-1"
            placeholder="Alias/Nickname (opcional)"
            value={form.nickname}
            onChange={(e) => setForm((f) => ({ ...f, nickname: e.target.value }))}
          />
          <input
            className="border rounded px-2 py-1"
            placeholder="Grupo/Club (opcional)"
            value={form.club}
            onChange={(e) => setForm((f) => ({ ...f, club: e.target.value }))}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.preferNickname}
              onChange={(e) => setForm((f) => ({ ...f, preferNickname: e.target.checked }))}
            />
            Mostrar alias públicamente
          </label>
          <div className="md:col-span-5">
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
                  <th className="p-2">Nombre público</th>
                  {isAdmin && <th className="p-2">Nombre real</th>}
                  <th className="p-2">Licencia</th>
                  <th className="p-2">Club</th>
                  <th className="p-2">Vehículos</th>
                  <th className="p-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((d: any) => (
                  <tr key={d.id} className="border-b">
                    <td className="p-2">
                      {editingId === d.id ? (
                        <>
                          <input className="border rounded px-2 py-1" placeholder="Alias público" value={editForm.nickname} onChange={(e) => setEditForm((f) => ({ ...f, nickname: e.target.value }))} />
                          <label className="ml-2 text-sm inline-flex items-center gap-2">
                            <input type="checkbox" checked={editForm.preferNickname} onChange={(e) => setEditForm((f) => ({ ...f, preferNickname: e.target.checked }))} />
                            Mostrar alias públicamente
                          </label>
                        </>
                      ) : (
                        d.preferNickname && d.nickname ? d.nickname : d.name
                      )}
                    </td>
                    {isAdmin && (
                      <td className="p-2">
                        {editingId === d.id ? (
                          <input className="border rounded px-2 py-1" placeholder="Nombre real" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
                        ) : (
                          d.name
                        )}
                      </td>
                    )}
                    <td className="p-2">
                      {editingId === d.id ? (
                        <input className="border rounded px-2 py-1" value={editForm.license} onChange={(e) => setEditForm((f) => ({ ...f, license: e.target.value }))} />
                      ) : (
                        d.license || '-'
                      )}
                    </td>
                    <td className="p-2">
                      {editingId === d.id ? (
                        <input className="border rounded px-2 py-1" value={editForm.club} onChange={(e) => setEditForm((f) => ({ ...f, club: e.target.value }))} />
                      ) : (
                        d.club || '-'
                      )}
                    </td>
                    <td className="p-2">{d._count?.vehicles ?? 0}</td>
                    <td className="p-2 space-x-2">
                      {editingId === d.id ? (
                        <>
                          <button onClick={saveEdit} className="px-2 py-1 rounded bg-green-600 text-white">Guardar</button>
                          <button onClick={cancelEdit} className="px-2 py-1 rounded bg-gray-300">Cancelar</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(d)} className="px-2 py-1 rounded bg-yellow-500 text-white">Editar</button>
                          <button onClick={() => remove(d.id)} className="px-2 py-1 rounded bg-red-600 text-white">Eliminar</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td className="p-2 text-gray-500" colSpan={isAdmin ? 6 : 5}>Sin registros</td>
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
