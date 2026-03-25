# 🥘 La Despensa — Setup

## 1. Base de datos (Supabase)

Ve a tu proyecto Supabase → **SQL Editor** → pega y ejecuta el contenido de `supabase_migration.sql`.

Eso crea todas las tablas, RLS y políticas necesarias.

## 2. Variables de entorno

```bash
cp .env.example .env
```

Edita `.env` con tus credenciales:
- **URL y anon key**: Supabase Dashboard → Settings → API

## 3. Instalar y arrancar

```bash
npm install
npm run dev
```

## Estructura de archivos

```
src/
├── context/
│   └── AuthContext.jsx     ← Estado de auth (React Context, sin Zustand)
├── lib/
│   └── supabase.js         ← Cliente Supabase
├── pages/
│   ├── auth/
│   │   ├── AuthPage.jsx        ← Login + Registro (tabs)
│   │   └── SetupHogarPage.jsx  ← Crear hogar post-registro
│   └── DashboardPage.jsx       ← Placeholder (se desarrollará)
└── App.jsx                 ← Rutas y guardas
```

## Flujo de auth

```
/auth (login/registro)
  ↓ registro OK → email de confirmación (Supabase)
  ↓ confirmar email → login
  ↓ login OK
  ↓ tiene hogar? → / (dashboard)
  ↓ no tiene hogar? → /setup-hogar
  ↓ crear hogar → / (dashboard)
```

## Guardas de ruta

- `PublicOnlyRoute` — Solo sin sesión (login/registro). Si ya estás logueado, redirige a `/`
- `PrivateRoute` — Requiere sesión
- `AppRoute` — Requiere sesión + hogar configurado

## Notas importantes

- El perfil en `public.perfiles` se crea en `SetupHogarPage` al entrar por primera vez tras confirmar el email. **No hay trigger en Supabase** (esa era la fuente de bugs).
- Todo el estado de auth vive en `AuthContext`. No hay Zustand.
- El `onAuthStateChange` tiene `mounted` guard para evitar memory leaks y estados fantasma en mobile.
