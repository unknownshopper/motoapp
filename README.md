MotoApp es la aplicación del club de motociclistas "Primotos" que permite a los usuarios logearse para ingresar a un dashboard, el cual está compuesto por secciones como: rutas, vehículos, conductores, reportes, ubicaciones en tiempo real, y demás configuraciones del sistema.

Usa Leaflet para mostrar las rutas y ubicaciones en tiempo real.

# Objetivos del MVP
- **Autenticación y roles**: Inicio de sesión por email/contraseña con roles básicos (`admin`, `operador`, `piloto`).
- **Dashboard**: Layout con sidebar/topbar y navegación clara.
- **Rutas**: Lista, detalle y visualización (polyline/GeoJSON) en mapa Leaflet.
- **Vehículos**: CRUD básico (placa, marca, modelo, estado).
- **Conductores**: CRUD básico (nombre, licencia, asignación opcional a usuario).
- **Tracking en tiempo real**: Marcadores de vehículos actualizados vía WebSockets.
- **Reportes básicos**: Viajes por rango de fechas y uso de vehículos.

# Stack recomendado
- **Frontend**: Next.js + TypeScript + TailwindCSS + shadcn/ui + react-leaflet.
- **Backend**: API Routes de Next.js (para el MVP). Alternativa futura: NestJS separado.
- **Base de datos**: Postgres (opcional: Supabase para acelerar).
- **Tiempo real**: Socket.IO (u opción Supabase Realtime si aplicara).
- **Autenticación**: NextAuth con adapter Postgres.

# Modelo de datos (borrador)
- **Usuario**: id, email, hash, nombre, rol.
- **Conductor**: id, nombre, licencia, usuario_id?
- **Vehículo**: id, placa, marca, modelo, estado.
- **Ruta**: id, nombre, descripción, polyline/geojson.
- **Posición**: id, vehículo_id, lat, lng, velocidad, timestamp.
- **Viaje/Evento**: id, vehículo_id, ruta_id, conductor_id, inicio, fin, estado.

# Plan de implementación
- **Fase 1: Base del proyecto**
  - Crear app Next.js + Tailwind + shadcn/ui.
  - Configurar NextAuth + Postgres.
  - Layout de dashboard y navegación.
- **Fase 2: Catálogos**
  - CRUD de Vehículos, Conductores y Rutas (formularios + tablas).
- **Fase 3: Mapa y tiempo real**
  - Integrar Leaflet.
  - API de ingestión de posiciones + Socket.IO.
  - Vista de tracking en tiempo real.
- **Fase 4: Reportes**
  - KPIs y tablas por rango de fechas (viajes, uso de vehículos).
- **Fase 5: Calidad**
  - Tests básicos, roles y permisos, logs.

# Decisiones pendientes
- **Arquitectura**: Monolito Next.js (rápido) vs Backend separado con NestJS (más escalable).
- **Infra/DB**: Supabase vs Postgres autogestionado.
- **Tiempo real**: Socket.IO propio vs servicio Realtime.

# Arquitectura elegida
- **Opción B**: Frontend Next.js y Backend NestJS separados.
- **Comunicación**: REST/JSON para CRUD y Socket.IO para tiempo real.
- **Gestión de datos**: Prisma + Postgres.

## Estado actual (MVP en curso)
- **Backend (NestJS)**: Auth JWT (registro/login), CRUD de Vehicles protegido por JWT, Socket.IO base.
- **DB**: Postgres funcionando (guía abajo con Docker). Prisma migraciones aplicadas.
- **Frontend (Next.js)**: Layout base, páginas de Login, Vehicles (crear/listar) y Tracking con Leaflet (centrado en Villahermosa, Tabasco).
- **Entorno**: `.env` locales creados a partir de `config/env.sample.md`.

# Entorno gratuito recomendado
- **Frontend (gratis)**: Vercel (plan free) para desplegar Next.js.
- **Backend (gratis)**: Render (free web service) o Railway (free tier limitado) para NestJS.
- **Base de datos (gratis)**: Supabase Postgres (free tier) o Railway Postgres (free tier) con backups locales.
- **Tiempo real (gratis)**: Socket.IO en el backend (sin servicios externos).
- **Tiles de mapa (gratis)**: OpenStreetMap tile server para desarrollo con atribución obligatoria. Para producción, considerar proveedor con cuota gratuita (ej. MapTiler free).
- **Monitorización (opcional, free)**: UptimeRobot para pings de salud.

# Variables de entorno
- **Backend (NestJS)**
  - `PORT` (por defecto 3001)
  - `DATABASE_URL` (cadena de conexión de Postgres en Supabase)
  - `JWT_SECRET` (secreto para firmar tokens)
  - `CORS_ORIGIN` (URL del frontend)
- **Frontend (Next.js)**
  - `NEXT_PUBLIC_API_URL` (URL base del backend REST)
  - `NEXT_PUBLIC_WS_URL` (URL del Socket.IO)
  - `NEXT_PUBLIC_MAP_TILES_URL` (URL de proveedor de tiles; por defecto OSM)

# Siguientes pasos (Opción B)
1. [Listo] Backend NestJS con Prisma, JWT Auth, Socket.IO base y esquemas iniciales.
2. [Listo] Frontend Next.js con layout, login, Vehicles y Tracking (Leaflet).
3. [En progreso] CRUD de Conductores (Drivers) y Rutas.
4. [Próximo] Tracking en tiempo real en el mapa con Socket.IO (marcadores dinámicos).
5. [Próximo] Roles/guards de UI y protección de rutas en frontend.
6. [Próximo] Despliegues en Vercel (frontend) y Render/Railway (backend).

# Instalación y ejecución local
- **Requisitos**: Node 18+, npm o pnpm o yarn.

## Backend (NestJS)
1. Instalar dependencias:
   - npm: `cd backend && npm install`
   - pnpm: `cd backend && pnpm install`
   - yarn: `cd backend && yarn`
2. Ejecutar en desarrollo:
   - npm: `npm run start:dev`
   - pnpm: `pnpm run start:dev`
   - yarn: `yarn start:dev`
3. Probar healthcheck: `GET http://localhost:3001/health`

### Base de datos con Docker (rápido)
- Levantar Postgres local:
  ```bash
  docker run --name motoapp-postgres \
    -e POSTGRES_PASSWORD=postgres \
    -e POSTGRES_DB=motoapp \
    -p 5432:5432 -d postgres:15
  ```
- Variables en `backend/.env` (ver `config/env.sample.md`):
  - `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/motoapp?schema=public`
- Generar cliente y migraciones Prisma:
  ```bash
  cd backend
  npm run prisma:generate
  npm run prisma:migrate:dev
  npm run start:dev
  ```

### Pruebas rápidas de API
- Registro:
  ```bash
  curl -X POST http://localhost:3001/auth/register \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@example.com","password":"secret123","name":"Admin"}'
  ```
- Login y uso de token (requiere `jq`):
  ```bash
  TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@example.com","password":"secret123"}' | jq -r .token)
  curl http://localhost:3001/vehicles -H "Authorization: Bearer $TOKEN"
  ```

## Frontend (Next.js)
1. Instalar dependencias:
   - npm: `cd frontend && npm install`
   - pnpm: `cd frontend && pnpm install`
   - yarn: `cd frontend && yarn`
2. Ejecutar en desarrollo:
   - npm: `npm run dev`
   - pnpm: `pnpm run dev`
   - yarn: `yarn dev`
3. Abrir: `http://localhost:3000`

### Mapa (Leaflet) compatible con React 18
- Instalar versiones compatibles:
  ```bash
  cd frontend
  npm install react-leaflet@4.2.1 leaflet@1.9.4 --legacy-peer-deps
  npm run dev
  ```
- Tracking: `http://localhost:3000/tracking` (centrado en Villahermosa, Tabasco)
- Login: `http://localhost:3000/login` → redirige a `/vehicles`
- Vehicles: crear y listar vehículos con el token guardado en `localStorage`.

### Solución de problemas
- Error de websockets en backend: instalar driver compatible
  ```bash
  cd backend
  npm install @nestjs/platform-socket.io@10.4.20
  ```
- Conflicto de `react-leaflet` con React 18: usar `react-leaflet@4.2.1` y `leaflet@1.9.4` con `--legacy-peer-deps`.

# Preguntas rápidas
1. ¿Preferimos MVP rápido con Next.js (API Routes) o backend separado con NestJS?
2. ¿Hosting/DB preferidos (Supabase, Railway, Render, local)?
3. ¿Roles iniciales correctos: `admin`, `operador`, `piloto`?
4. ¿Importaremos rutas (GeoJSON/GPX) o se dibujarán en la UI?
5. ¿Simulamos posiciones en dev o hay proveedor/GPS existente?

---

## Objetivos actuales (Sponsors y Roles)
- Gestionar Sponsors end-to-end.
- Selector de fechas por ruta con soporte de múltiples fechas en una sola solicitud.
- Limpieza de marcadores del mapa al limpiar ubicaciones.
- Pestaña “Solicitudes” visible y funcional para ADMIN (aprobación/rechazo).
- Mostrar en el header el usuario logeado (id/email/rol) y botón “Cerrar sesión”.
- ADMIN puede ver, editar y eliminar registros y sus POIs desde /sponsors.
- Cada solicitud de Sponsor almacena múltiples fechas asociadas (tabla `SponsorDate`).

## Flujo de Sponsors (resumen)
- El formulario permite seleccionar varias fechas y enviar UNA sola solicitud con `whenMultiple`.
- Backend crea 1 `Registration` (type=SPONSOR) y N `SponsorDate`.
- En /sponsors, ADMIN ve detalles: Empresa, Contacto, Teléfono, Email, Ruta, Servicios/Producto y la lista de Fechas.
- CRUD de POIs desde modal de edición.

## Despliegue 100% gratuito recomendado
- Frontend: Vercel (plan free) → Next.js.
- Backend: Render (plan free Web Service) → NestJS.
- Base de datos: Supabase (plan free) → Postgres gestionado.

### Variables de entorno
- Backend (Render):
  - `PORT` (3001 por defecto)
  - `DATABASE_URL` (cadena de Supabase)
  - `JWT_SECRET` (secreto seguro)
  - `CORS_ORIGIN` (URL de Vercel)
- Frontend (Vercel):
  - `NEXT_PUBLIC_API_URL` = URL pública del backend en Render

### Pasos de despliegue
1) Crear proyecto en Supabase y obtener `DATABASE_URL`.
2) Render → New Web Service → repo `backend/`:
   - Build: `npm ci && npm run build`
   - Start: `npm run start:prod`
   - ENV: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`
   - Post deploy: `npx prisma migrate deploy` (Shell) y `npx prisma generate`.
3) Vercel → Import Project → root `frontend/`:
   - ENV: `NEXT_PUBLIC_API_URL` apuntando al dominio de Render.

## Comandos útiles
- Backend:
  - Desarrollo: `npm run start:dev`
  - Prisma generate: `npx prisma generate`
  - Migrar (dev): `npx prisma migrate dev -n <nombre>`
  - Migrar (deploy): `npx prisma migrate deploy`
  - Puerto ocupado 3001: `fuser -k 3001/tcp`
- Frontend:
  - Desarrollo: `npm run dev`

## Notas técnicas recientes
- DTO `CreateRegistrationDto` admite `whenMultiple: string[]`.
- Prisma: modelo `SponsorDate` relacionado a `Registration` para fechas múltiples.
- Los listados incluyen `dates` para renderizar en UI.

## Siguientes pasos sugeridos (próxima sesión)
- Mostrar un badge compacto de fechas en las tarjetas (ej. "1ª fecha + N más").
- En /sponsors, ordenar `dates` ascendente y formateo consistente (dd/mm/aaaa).
- UI: en el modal de edición permitir añadir/editar POIs con mini-mapa y edición de lat/lng.
- Backend: endpoints para CRUD de `SponsorDate` si se requiere modificar fechas desde admin.
- Cerrar warnings de tipos pendientes en service (accesor de Prisma tipado para `sponsorDate`/`sponsorLocation`).
- Deploy gratuito: configurar Render (backend) y Vercel (frontend) con Supabase (DB) usando las variables listadas arriba.# motoapp
