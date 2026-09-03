import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  BarChart3,
  ClipboardCheck,
  FileQuestion,
  FileText,
  HelpCircle,
  LayoutDashboard,
  Menu,
  Users,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/app/routes';

interface NavItem {
  to: string;
  label: string;
  Icon: typeof LayoutDashboard;
}

/** Matches the navigation defined in section 8.1 of the requirements document. */
const NAV_ITEMS: readonly NavItem[] = [
  { to: ROUTES.dashboard, label: 'Painel', Icon: LayoutDashboard },
  { to: ROUTES.classes, label: 'Turmas', Icon: Users },
  { to: ROUTES.questions, label: 'Banco de Questões', Icon: FileQuestion },
  { to: ROUTES.exams, label: 'Provas', Icon: FileText },
  { to: ROUTES.applications, label: 'Aplicações', Icon: ClipboardCheck },
  { to: ROUTES.reports, label: 'Relatórios', Icon: BarChart3 },
];

export function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = () => setDrawerOpen(false);

  return (
    <div className="min-h-screen bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-[var(--radius-control)] focus:bg-surface focus:px-4 focus:py-2 focus:text-label focus:text-primary"
      >
        Pular para o conteúdo
      </a>

      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-surface px-4 md:hidden">
        <IconButton label="Abrir menu" onClick={() => setDrawerOpen(true)}>
          <Menu size={22} aria-hidden />
        </IconButton>
        <span className="font-[family-name:var(--font-heading)] text-title text-primary">
          Correctio
        </span>
        <IconButton label="Ajuda: rever o tour desta tela">
          <HelpCircle size={22} aria-hidden />
        </IconButton>
      </header>

      {drawerOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={closeDrawer}
          className="fixed inset-0 z-40 bg-ink/40 md:hidden"
        />
      )}

      <nav
        aria-label="Navegação principal"
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-line bg-surface transition-transform md:translate-x-0',
          drawerOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between px-6 py-6">
          <span className="font-[family-name:var(--font-heading)] text-headline text-primary">
            Correctio
          </span>
          <span className="md:hidden">
            <IconButton label="Fechar menu" onClick={closeDrawer}>
              <X size={20} aria-hidden />
            </IconButton>
          </span>
        </div>

        <ul className="flex flex-1 flex-col gap-1 px-3">
          {NAV_ITEMS.map(({ to, label, Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                onClick={closeDrawer}
                className={({ isActive }) =>
                  cn(
                    'touch-target flex items-center gap-3 rounded-[var(--radius-control)] px-4 text-label transition-colors',
                    isActive
                      ? 'bg-primary-container text-on-primary'
                      : 'text-ink-muted hover:bg-surface-hover',
                  )
                }
              >
                <Icon size={20} aria-hidden />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="border-t border-line px-6 py-4">
          <NavLink to={ROUTES.privacy} className="text-caption text-ink-subtle hover:text-primary">
            Aviso de privacidade
          </NavLink>
        </div>
      </nav>

      <main id="main" className="p-4 md:ml-64 md:p-8">
        <div className="mx-auto max-w-[1280px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="touch-target inline-flex items-center justify-center rounded-[var(--radius-control)] text-primary hover:bg-surface-muted"
    >
      {children}
    </button>
  );
}
