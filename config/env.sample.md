# Variables de entorno de ejemplo

Guarda estas variables en archivos `.env` locales (no se suben al repo). Usa este archivo como referencia.

## Backend (NestJS) — archivo: `backend/.env`
```
# Puerto del backend
PORT=3001

# Cadena de conexión Postgres (ejemplo Supabase)
# Formato: postgresql://USER:PASSWORD@HOST:PORT/DB?schema=public
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/motoapp?schema=public

# Secreto para firmar JWT
JWT_SECRET=super-secreto-cambia-esto

# Origen permitido para CORS (frontend)
CORS_ORIGIN=http://localhost:3000
```

## Frontend (Next.js) — archivo: `frontend/.env.local`
```
# URL base del backend REST
NEXT_PUBLIC_API_URL=http://localhost:3001

# URL del servidor de WebSockets/Socket.IO
NEXT_PUBLIC_WS_URL=http://localhost:3001

# URL de tiles de mapa (OSM por defecto)
NEXT_PUBLIC_MAP_TILES_URL=https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
```

## Notas
- No exportes estas variables directamente en la terminal (evitas errores de sintaxis). Preferible usar archivos `.env` por app.
- En producción, configura variables en el panel del proveedor (Vercel/Render/Supabase) sin commitearlas.
