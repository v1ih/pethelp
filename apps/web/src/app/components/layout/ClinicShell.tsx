import * as React from 'react';
import { useNavigate } from 'react-router';
import {
  Bell,
  CalendarDays,
  ClipboardList,
  Home,
  LogOut,
  PawPrint,
  Settings,
  Stethoscope,
  Users,
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { useInteraction } from '../../context/InteractionContext';
import { useSession } from '../../context/SessionContext';
import { useAppNavigation } from '../../navigation';

type ClinicNavKey = 'dashboard' | 'veterinarians' | 'agenda' | 'history' | 'settings' | 'notifications';

type ClinicShellProps = React.PropsWithChildren<{
  active: ClinicNavKey;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
}>;

type NavItem = {
  key: Exclude<ClinicNavKey, 'notifications'>;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
};

function NavButton({
  active,
  item,
  onClick,
}: {
  active: boolean;
  item: NavItem;
  onClick: () => void;
}) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-[20px] px-4 py-3 text-left transition-all ${
        active
          ? 'bg-primary text-white shadow-[0_16px_32px_-24px_rgba(127,162,106,0.85)]'
          : 'text-foreground hover:bg-muted/70'
      }`}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="text-[17px] font-medium">{item.label}</span>
    </button>
  );
}

export function ClinicShell({ active, title, description, actions, children }: ClinicShellProps) {
  const navigate = useNavigate();
  const { user } = useSession();
  const { notifications } = useInteraction();
  const { confirmAndLogout } = useAppNavigation();

  const clinicName = user?.clinicName || user?.name || 'Clínica';
  const unreadNotifications = notifications.filter((notification) => notification.userId === user?.id && !notification.read).length;

  const navItems: NavItem[] = [
    { key: 'dashboard', label: 'Dashboard', icon: Home, path: '/clinic-dashboard' },
    { key: 'veterinarians', label: 'Veterinários', icon: Stethoscope, path: '/clinic-veterinarians' },
    { key: 'agenda', label: 'Agenda', icon: CalendarDays, path: '/clinic-agenda' },
    { key: 'history', label: 'Histórico', icon: ClipboardList, path: '/clinic-history' },
    { key: 'settings', label: 'Config.', icon: Settings, path: '/clinic-settings' },
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,162,106,0.12),_transparent_34%),linear-gradient(180deg,_#fbfaf5_0%,_#ffffff_100%)] text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-card/92 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => navigate('/clinic-dashboard')}
            className="flex items-center gap-3 text-left transition-opacity hover:opacity-90"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white shadow-[0_16px_32px_-22px_rgba(127,162,106,0.8)]">
              <PawPrint className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[19px] font-medium leading-none">PetHelp</p>
              <p className="mt-1 text-sm text-muted-foreground">Cuidado veterinário conectado</p>
            </div>
          </button>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden text-right md:block">
              <p className="text-sm text-muted-foreground">Olá, {clinicName}</p>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">Clínica</span>
            <ThemeToggle />
            <button
              type="button"
              onClick={() => navigate('/clinic-notifications')}
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-card text-foreground transition-colors hover:bg-muted"
              aria-label="Notificações"
              title="Notificações"
            >
              <Bell className="h-5 w-5" />
              {unreadNotifications > 0 ? <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[#f4a64a]" /> : null}
            </button>
            <button
              type="button"
              onClick={() => navigate('/clinic-settings')}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-card text-foreground transition-colors hover:bg-muted"
              aria-label="Configurações"
              title="Configurações"
            >
              <Settings className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => confirmAndLogout()}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-card text-foreground transition-colors hover:bg-muted"
              aria-label="Sair"
              title="Sair"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1600px] lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden border-r border-border/70 bg-card/70 px-4 py-6 lg:block">
          <nav className="space-y-2">
            {navItems.map((item) => (
              <NavButton key={item.key} item={item} active={active === item.key} onClick={() => navigate(item.path)} />
            ))}
          </nav>
        </aside>

        <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {navItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => navigate(item.path)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors ${
                  active === item.key
                    ? 'border-primary bg-primary text-white'
                    : 'border-border bg-card text-foreground hover:bg-muted'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </div>

          {(title || description || actions) ? (
            <div className="mb-6 flex flex-col gap-4 pt-2 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                {title ? <h1 className="text-[32px] font-medium tracking-tight text-foreground sm:text-[40px]">{title}</h1> : null}
                {description ? <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">{description}</p> : null}
              </div>
              {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
            </div>
          ) : null}

          {children}
        </main>
      </div>
    </div>
  );
}

export default ClinicShell;
