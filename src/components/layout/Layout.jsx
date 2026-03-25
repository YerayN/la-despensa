import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  LayoutDashboard, BookOpen, CalendarDays,
  ShoppingCart, Users, Settings
} from 'lucide-react'

const NAV_ITEMS = [
  { to: '/',            label: 'Inicio',   icon: LayoutDashboard },
  { to: '/recetas',     label: 'Recetas',  icon: BookOpen        },
  { to: '/planning',    label: 'Planning', icon: CalendarDays    },
  { to: '/lista',       label: 'Compra',   icon: ShoppingCart    },
  { to: '/comunidad',   label: 'Comunidad',icon: Users           },
  { to: '/ajustes',     label: 'Ajustes',  icon: Settings        },
]

export default function Layout() {
  const { perfil, hogar } = useAuth()
  const location = useLocation()

  const isActive = (to) => {
    if (to === '/') return location.pathname === '/'
    return location.pathname.startsWith(to)
  }

  return (
    <>
      <style>{`
        /* ── Variables globales del sistema de diseño ── */
        :root {
          --brand:        #2D6A4F;
          --brand-light:  #40916C;
          --brand-dark:   #1B4332;
          --brand-pale:   #D8F3DC;
          --brand-pale2:  #B7E4C7;
          --accent:       #f37e57;
          --bg:           #F6F8F6;
          --surface:      #FFFFFF;
          --surface-2:    #F0F4F1;
          --border:       #E2EBE4;
          --border-strong:#C5D9CB;
          --text:         #1A2E22;
          --text-2:       #4A6358;
          --text-3:       #8AA494;
          --nav-h:        64px;   /* altura bottom nav móvil */
          --sidebar-w:    220px;  /* ancho sidebar escritorio */
          --content-max:  860px;
          --font-display: 'Fraunces', Georgia, serif;
          --font-body:    'DM Sans', system-ui, sans-serif;
          --radius:       16px;
          --radius-sm:    10px;
          --shadow:       0 1px 8px rgba(45,106,79,0.07);
          --shadow-md:    0 4px 20px rgba(45,106,79,0.10);
          --shadow-lg:    0 8px 40px rgba(45,106,79,0.13);
          --transition:   0.18s ease;
        }

        /* ── Reset & base ── */
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { -webkit-tap-highlight-color: transparent; }
        body {
          font-family: var(--font-body);
          background: var(--bg);
          color: var(--text);
          -webkit-font-smoothing: antialiased;
        }

        /* ── Layout shell ── */
        .app-shell {
          display: flex;
          min-height: 100dvh;
        }

        /* ════════════════════════════════
           SIDEBAR — visible en escritorio
        ════════════════════════════════ */
        .sidebar {
          display: none; /* oculto en móvil */
        }

        @media (min-width: 768px) {
          .sidebar {
            display: flex;
            flex-direction: column;
            width: var(--sidebar-w);
            min-height: 100dvh;
            position: fixed;
            top: 0; left: 0;
            background: var(--surface);
            border-right: 1px solid var(--border);
            z-index: 100;
            padding: 0 0 24px;
          }

          .sidebar-logo {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 20px 20px 24px;
            border-bottom: 1px solid var(--border);
            margin-bottom: 8px;
          }

          .sidebar-logo-icon {
            width: 36px; height: 36px;
            background: linear-gradient(135deg, var(--brand) 0%, var(--brand-light) 100%);
            border-radius: 10px;
            display: flex; align-items: center; justify-content: center;
            color: white;
            font-size: 18px;
            flex-shrink: 0;
            box-shadow: 0 2px 10px rgba(45,106,79,0.2);
          }

          .sidebar-logo-text {
            font-family: var(--font-display);
            font-size: 17px;
            font-weight: 700;
            color: var(--brand-dark);
            letter-spacing: -0.3px;
          }

          .sidebar-nav {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 2px;
            padding: 0 10px;
          }

          .sidebar-link {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 12px;
            border-radius: var(--radius-sm);
            color: var(--text-3);
            font-size: 14px;
            font-weight: 500;
            text-decoration: none;
            transition: all var(--transition);
            position: relative;
          }

          .sidebar-link:hover {
            background: var(--surface-2);
            color: var(--text-2);
          }

          .sidebar-link.active {
            background: var(--brand-pale);
            color: var(--brand);
            font-weight: 600;
          }

          .sidebar-link svg {
            flex-shrink: 0;
            opacity: 0.7;
          }
          .sidebar-link.active svg,
          .sidebar-link:hover svg {
            opacity: 1;
          }

          .sidebar-hogar {
            margin: 0 10px;
            padding: 12px;
            background: var(--surface-2);
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
          }

          .sidebar-hogar-label {
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--text-3);
            margin-bottom: 4px;
          }

          .sidebar-hogar-nombre {
            font-size: 13px;
            font-weight: 600;
            color: var(--text);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .sidebar-hogar-sub {
            font-size: 12px;
            color: var(--text-3);
            margin-top: 2px;
          }
        }

        /* ════════════════════════════════
           CONTENIDO PRINCIPAL
        ════════════════════════════════ */
        .main-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 100dvh;
          /* espacio para bottom nav en móvil */
          padding-bottom: var(--nav-h);
        }

        @media (min-width: 768px) {
          .main-content {
            margin-left: var(--sidebar-w);
            padding-bottom: 0;
          }
        }

        .page-wrapper {
          flex: 1;
          width: 100%;
          max-width: var(--content-max);
          margin: 0 auto;
          padding: 20px 16px;
        }

        @media (min-width: 768px) {
          .page-wrapper {
            padding: 32px 28px;
          }
        }

        @media (min-width: 1024px) {
          .page-wrapper {
            padding: 40px 40px;
          }
        }

        /* ════════════════════════════════
           BOTTOM NAV — solo móvil
        ════════════════════════════════ */
        .bottom-nav {
          position: fixed;
          bottom: 0; left: 0; right: 0;
          height: var(--nav-h);
          background: var(--surface);
          border-top: 1px solid var(--border);
          display: flex;
          align-items: stretch;
          z-index: 200;
          /* safe area para iPhone con home bar */
          padding-bottom: env(safe-area-inset-bottom, 0px);
        }

        @media (min-width: 768px) {
          .bottom-nav { display: none; }
        }

        .bottom-nav-item {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          color: var(--text-3);
          text-decoration: none;
          font-size: 10px;
          font-weight: 500;
          padding: 6px 4px;
          transition: color var(--transition);
          position: relative;
          -webkit-tap-highlight-color: transparent;
        }

        .bottom-nav-item svg {
          width: 22px; height: 22px;
          transition: transform 0.15s ease;
        }

        .bottom-nav-item.active {
          color: var(--brand);
        }

        .bottom-nav-item.active svg {
          transform: scale(1.12);
        }

        .bottom-nav-item.active::before {
          content: '';
          position: absolute;
          top: 0; left: 50%;
          transform: translateX(-50%);
          width: 28px; height: 3px;
          background: var(--brand);
          border-radius: 0 0 4px 4px;
        }

        /* ── Utilidades globales reutilizables en todas las páginas ── */
        .card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          box-shadow: var(--shadow);
        }

        .badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 10px;
          border-radius: 100px;
          font-size: 12px;
          font-weight: 600;
        }

        .badge-green  { background: var(--brand-pale);  color: var(--brand-dark); }
        .badge-orange { background: #FEF0E8; color: #C4622D; }
        .badge-red    { background: #FDECEA; color: #B83A2F; }
        .badge-gray   { background: var(--surface-2); color: var(--text-2); }

        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          border: none;
          border-radius: var(--radius-sm);
          font-family: var(--font-body);
          font-weight: 600;
          cursor: pointer;
          transition: all var(--transition);
          -webkit-tap-highlight-color: transparent;
          white-space: nowrap;
        }

        .btn-primary {
          background: linear-gradient(135deg, var(--brand) 0%, var(--brand-light) 100%);
          color: white;
          box-shadow: 0 2px 10px rgba(45,106,79,0.22);
          padding: 11px 20px;
          font-size: 14px;
        }
        .btn-primary:hover { opacity: 0.9; box-shadow: 0 4px 16px rgba(45,106,79,0.28); }
        .btn-primary:active { transform: scale(0.97); }

        .btn-secondary {
          background: var(--surface);
          color: var(--text-2);
          border: 1.5px solid var(--border);
          padding: 10px 18px;
          font-size: 14px;
        }
        .btn-secondary:hover { border-color: var(--brand-pale2); background: var(--surface-2); }

        .btn-ghost {
          background: transparent;
          color: var(--text-3);
          padding: 8px 12px;
          font-size: 14px;
        }
        .btn-ghost:hover { background: var(--surface-2); color: var(--text-2); }

        .btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .btn-sm { padding: 7px 14px; font-size: 13px; }
        .btn-lg { padding: 13px 24px; font-size: 15px; }
        .btn-full { width: 100%; }

        .spinner-sm {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.35);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          flex-shrink: 0;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Input genérico */
        .input-field {
          width: 100%;
          padding: 10px 14px;
          border: 1.5px solid var(--border);
          border-radius: var(--radius-sm);
          font-family: var(--font-body);
          font-size: 15px;
          color: var(--text);
          background: var(--surface);
          outline: none;
          transition: border-color var(--transition), box-shadow var(--transition);
          -webkit-appearance: none;
        }
        .input-field:focus {
          border-color: var(--brand);
          box-shadow: 0 0 0 3px rgba(45,106,79,0.1);
        }
        .input-field::placeholder { color: var(--text-3); }

        /* Divider */
        .divider {
          height: 1px;
          background: var(--border);
          border: none;
          margin: 0;
        }

        /* Skeleton loader */
        .skeleton {
          background: linear-gradient(90deg, var(--surface-2) 25%, var(--border) 50%, var(--surface-2) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
          border-radius: 8px;
        }
        @keyframes shimmer { to { background-position: -200% 0; } }

        /* Empty state */
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 48px 24px;
          text-align: center;
          color: var(--text-3);
        }
        .empty-state-icon {
          font-size: 40px;
          opacity: 0.6;
          margin-bottom: 4px;
        }
        .empty-state h3 {
          font-family: var(--font-display);
          font-size: 18px;
          color: var(--text-2);
          font-weight: 600;
        }
        .empty-state p { font-size: 14px; line-height: 1.5; max-width: 280px; }

        /* Page header */
        .page-header {
          margin-bottom: 24px;
        }
        .page-title {
          font-family: var(--font-display);
          font-size: 26px;
          font-weight: 700;
          color: var(--text);
          letter-spacing: -0.5px;
          line-height: 1.2;
        }
        .page-subtitle {
          font-size: 14px;
          color: var(--text-3);
          margin-top: 4px;
        }
        @media (min-width: 768px) {
          .page-title { font-size: 30px; }
        }

        /* Scrollbar sutil */
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: var(--text-3); }
      `}</style>

      <div className="app-shell">

        {/* ── Sidebar escritorio ── */}
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="sidebar-logo-icon">🥘</div>
            <span className="sidebar-logo-text">La Despensa</span>
          </div>

          <nav className="sidebar-nav">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
              >
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
          </nav>

          {hogar && (
            <div className="sidebar-hogar">
              <div className="sidebar-hogar-label">Hogar activo</div>
              <div className="sidebar-hogar-nombre">🏠 {hogar.nombre}</div>
              <div className="sidebar-hogar-sub">
                {hogar.num_comensales} {hogar.num_comensales === 1 ? 'comensal' : 'comensales'}
              </div>
            </div>
          )}
        </aside>

        {/* ── Contenido principal ── */}
        <main className="main-content">
          <div className="page-wrapper">
            <Outlet />
          </div>
        </main>

        {/* ── Bottom nav móvil ── */}
        <nav className="bottom-nav">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}
            >
              <Icon strokeWidth={isActive(to) ? 2.2 : 1.8} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

      </div>
    </>
  )
}
