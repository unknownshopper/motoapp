import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import { api } from '../lib/api';

export default function ShareLocationPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const user = api.getCurrentUser();

  const [vehicles, setVehicles] = useState<Array<{ id: string; plate: string }>>([]);
  const [vehicleId, setVehicleId] = useState('');
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [vehiclesError, setVehiclesError] = useState<string | null>(null);

  const [watching, setWatching] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef<number>(0);
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [positionsSent, setPositionsSent] = useState<number>(0);

  const canStart = useMemo(() => !!user && !!vehicleId, [user, vehicleId]);

  async function login(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setAuthError(null);
    if (!email.trim() || !password) { setAuthError('Email y contraseña requeridos'); return; }
    try {
      setLoggingIn(true);
      await api.login(email.trim(), password);
    } catch (err: any) {
      setAuthError(err?.message || 'No se pudo iniciar sesión');
    } finally {
      setLoggingIn(false);
    }
  }

  const loadVehicles = useCallback(async () => {
    setVehiclesError(null);
    setLoadingVehicles(true);
    try {
      const list = await api.vehiclesList();
      const mapped = (list || []).map((v: any) => ({ id: v.id, plate: v.plate }));
      setVehicles(mapped);
      if (mapped.length > 0 && !vehicleId) setVehicleId(mapped[0].id);
    } catch (e: any) {
      setVehiclesError(e?.message || 'No se pudieron cargar vehículos');
    } finally {
      setLoadingVehicles(false);
    }
  }, [vehicleId]);

  useEffect(() => {
    if (user) {
      loadVehicles();
    }
  }, [user, loadVehicles]);

  function stopWatching() {
    try {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    } catch {}
    watchIdRef.current = null;
    setWatching(false);
    setStatusMsg('Tracking detenido');
  }

  async function startWatching() {
    if (!canStart) return;
    if (!('geolocation' in navigator)) {
      setStatusMsg('Geolocalización no soportada en este dispositivo');
      return;
    }
    setPositionsSent(0);
    setStatusMsg('Iniciando…');
    try {
      const id = navigator.geolocation.watchPosition(
        async (pos) => {
          const now = Date.now();
          // Limitar envíos máximo 1 por 2s para ahorrar batería/datos
          if (now - lastSentRef.current < 2000) return;
          lastSentRef.current = now;
          try {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            const speed = isFinite(pos.coords.speed as number) ? (pos.coords.speed as number) : undefined;
            await api.positionsCreate({ vehicleId, lat, lng, speed });
            setPositionsSent((n) => n + 1);
            setStatusMsg(`Enviado ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
          } catch (e: any) {
            setStatusMsg(e?.message || 'Error enviando posición');
          }
        },
        (err) => {
          setStatusMsg(err?.message || 'Error de geolocalización');
        },
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
      );
      watchIdRef.current = id as unknown as number;
      setWatching(true);
      setStatusMsg('Tracking activo');
    } catch (e: any) {
      setStatusMsg(e?.message || 'No se pudo iniciar geolocalización');
    }
  }

  useEffect(() => {
    return () => { stopWatching(); };
  }, []);

  return (
    <main className="min-h-screen bg-gray-50">
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />
        <title>Compartir ubicación · MotoApp</title>
      </Head>
      <div className="max-w-md mx-auto p-4 space-y-4">
        <h1 className="text-xl font-semibold">Compartir ubicación</h1>
        {!user ? (
          <form className="space-y-2" onSubmit={login}>
            <p className="text-sm text-gray-600">Inicia sesión para enviar tu ubicación.</p>
            <input className="w-full border rounded px-3 py-2" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="w-full border rounded px-3 py-2" placeholder="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            {authError && <div className="text-sm text-red-600">{authError}</div>}
            <button disabled={loggingIn} className={`px-3 py-2 rounded ${loggingIn ? 'bg-gray-300' : 'bg-blue-600 text-white'}`}>{loggingIn ? 'Ingresando…' : 'Iniciar sesión'}</button>
          </form>
        ) : (
          <div className="space-y-3">
            <div className="text-sm text-gray-600">Sesión: {user.email || user.id || '—'}</div>
            <div>
              <label className="block text-sm">Vehículo</label>
              {loadingVehicles ? (
                <div className="text-sm text-gray-500">Cargando vehículos…</div>
              ) : vehiclesError ? (
                <div className="text-sm text-red-600">{vehiclesError}</div>
              ) : vehicles.length === 0 ? (
                <div className="text-sm text-gray-600">No hay vehículos disponibles. Crea uno desde el dashboard.</div>
              ) : (
                <select className="w-full border rounded px-3 py-2" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>{v.plate}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!watching ? (
                <button disabled={!canStart} className={`px-3 py-2 rounded ${canStart ? 'bg-emerald-600 text-white' : 'bg-gray-300'}`} onClick={startWatching}>Iniciar</button>
              ) : (
                <button className="px-3 py-2 rounded bg-red-600 text-white" onClick={stopWatching}>Detener</button>
              )}
              <button className="px-3 py-2 rounded bg-gray-200" onClick={loadVehicles}>Refrescar vehículos</button>
            </div>
            <div className="text-sm text-gray-700">Estado: {statusMsg || '—'}</div>
            <div className="text-xs text-gray-500">Posiciones enviadas: {positionsSent}</div>
            <p className="text-xs text-gray-500">Consejo: Mantén esta página abierta y la pantalla activa para un tracking continuo y más preciso.</p>
          </div>
        )}
      </div>
    </main>
  );
}
