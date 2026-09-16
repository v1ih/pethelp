import * as React from 'react';
import { ArrowLeftRight, Bell, ClipboardList, FileText, Home, Link2, LogOut, PawPrint, Settings, Syringe, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router';
import { ThemeToggle } from './ThemeToggle';
import { useInteraction } from '../../context/InteractionContext';
import { useSession } from '../../context/SessionContext';
import { useAppNavigation } from '../../navigation';
import { getDashboardRouteForUserType, getSettingsRouteForUserType, type UserType } from '../../context/shared';

export type TutorNavKey = 'home' | 'profile' | 'transfer' | 'connection' | 'records' | 'vaccines' | 'exams' | 'appointments' | 'settings';

type TutorShellProps = React.PropsWithChildren<{
  active: TutorNavKey;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
}>;

type NavItem = {
  key: TutorNavKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  visibleFor?: UserType[];
};

function TutorNavButton({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-[20px] px-4 py-3 text-left transition-all ${
        active ? 'bg-primary text-white shadow-[0_16px_32px_-24px_rgba(127,162,106,0.85)]' : 'text-foreground hover:bg-muted/70'
      }`}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="text-[17px] font-medium">{item.label}</span>
    </button>
  );
}

export function TutorShell({ active, title, description, actions, children }: TutorShellProps) {
  const navigate = useNavigate();
  const { user } = useSession();
  const { notifications } = useInteraction();
  const { confirmAndLogout, goToSettings } = useAppNavigation();

  const unreadNotifications = notifications.filter((notification) => notification.userId === user?.id && !notification.read).length;
  const currentUserType = user?.userType ?? 'owner';
  const dashboardPath = getDashboardRouteForUserType(currentUserType);
  const settingsPath = getSettingsRouteForUserType(currentUserType);

  const navItems: NavItem[] = [
    { key: 'home', label: 'Início', icon: Home, path: dashboardPath, visibleFor: ['owner', 'veterinarian', 'clinic'] },
    { key: 'profile', label: 'Perfil do pet', icon: PawPrint, path: '/pet-profile', visibleFor: ['owner', 'veterinarian'] },
    { key: 'transfer', label: 'Transferir pet', icon: ArrowLeftRight, path: '/pet-transfer', visibleFor: ['owner'] },
    { key: 'connection', label: 'Conexão clínica', icon: Link2, path: '/connection', visibleFor: ['owner', 'veterinarian'] },
    { key: 'records', label: 'Prontuário', icon: ClipboardList, path: '/medical-history', visibleFor: ['owner', 'veterinarian'] },
    { key: 'vaccines', label: 'Vacinas', icon: Syringe, path: '/vaccines', visibleFor: ['owner', 'veterinarian'] },
    { key: 'exams', label: 'Exames', icon: FileText, path: '/exams', visibleFor: ['owner', 'veterinarian'] },
    { key: 'appointments', label: 'Agenda', icon: Calendar, path: '/appointments', visibleFor: ['owner', 'veterinarian'] },
    { key: 'settings', label: 'Config.', icon: Settings, path: settingsPath, visibleFor: ['owner', 'clinic', 'veterinarian'] },
  ].filter((item) => !item.visibleFor || item.visibleFor.includes(currentUserType));

  return (
    <div className="min-h-screen bg-[var(--page-background)] text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-card/92 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <button type="button" onClick={() => navigate(dashboardPath)} className="flex items-center gap-3 text-left transition-opacity hover:opacity-90">
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
              <p className="text-sm text-muted-foreground">Olá, {user?.name || 'Tutor'}</p>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">Tutor</span>
            <ThemeToggle />
            <button
              type="button"
              onClick={() => navigate('/notifications')}
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-card text-foreground transition-colors hover:bg-muted"
              aria-label="Notificações"
              title="Notificações"
            >
              <Bell className="h-5 w-5" />
              {unreadNotifications > 0 ? <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[#f4a64a]" /> : null}
            </button>
            <button
              type="button"
              onClick={() => goToSettings(currentUserType)}
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
              <TutorNavButton key={item.key} item={item} active={active === item.key} onClick={() => navigate(item.path)} />
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
                  active === item.key ? 'border-primary bg-primary text-white' : 'border-border bg-card text-foreground hover:bg-muted'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </div>

          {(title || description || actions) ? (
            <section className="mb-6 rounded-[34px] border border-border/70 bg-card px-6 py-6 shadow-[0_28px_80px_-48px_rgba(127,162,106,0.26)] sm:px-8 sm:py-8">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  {title ? <h1 className="text-3xl font-medium tracking-tight text-foreground sm:text-4xl">{title}</h1> : null}
                  {description ? <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">{description}</p> : null}
                </div>
                {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
              </div>
            </section>
          ) : null}

          {children}
        </main>
      </div>
    </div>
  );
}
