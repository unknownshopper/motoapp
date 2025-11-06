import Link from 'next/link';

export default function Sidebar() {
  const items = [
    { href: '/', label: 'Inicio' },
    { href: '/tracking', label: 'Tracking' },
    { href: '/vehicles', label: 'Vehículos' },
    { href: '/drivers', label: 'Conductores' },
    { href: '/sponsors', label: 'Sponsors' },
    { href: '/share', label: 'Compartir' },
    { href: '/routes', label: 'Rutas' },
  ];
  return (
    <aside className="w-56 bg-white border-r min-h-screen p-3">
      <div className="text-lg font-semibold mb-4">MotoApp</div>
      <nav className="space-y-2">
        {items.map((it) => (
          <Link key={it.href} href={it.href} className="block px-2 py-1 rounded hover:bg-gray-100">
            {it.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
