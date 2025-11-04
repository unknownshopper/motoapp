import { useState } from 'react';
import { api } from '../lib/api';
import { useRouter } from 'next/router';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.login(email, password);
      router.push('/vehicles');
    } catch (e: any) {
      setError('Credenciales inválidas o error de servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded border">
      <h1 className="text-xl font-semibold mb-4">Iniciar sesión</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          className="w-full border rounded px-3 py-2"
          placeholder="Correo"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="w-full border rounded px-3 py-2"
          placeholder="Contraseña"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button disabled={loading} className="px-4 py-2 rounded bg-blue-600 text-white">
          {loading ? 'Ingresando…' : 'Ingresar'}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </div>
  );
}
