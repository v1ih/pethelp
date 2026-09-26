import * as React from 'react';
import { useNavigate } from 'react-router';
import { Bell, CalendarDays, ClipboardList, HelpCircle, Home, Link2, LogOut, PawPrint, Settings } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import EmailVerificationBanner from './EmailVerificationBanner';
import { useInteraction } from '../../context/InteractionContext';
import { useOnboarding } from '../../context/OnboardingContext';
import { useSession } from '../../context/SessionContext';
import { useAppNavigation } from '../../navigation';
import { getDashboardRouteForUserType, getSettingsRouteForUserType, type UserType } from '../../context/shared';

type VeterinarianNavKey = 'dashboard' | 'registration' | 'registered' | 'agenda' | 'links' | 'history' | 'settings';

type VeterinarianShellProps = React.PropsWithChildren<{
  active: VeterinarianNavKey;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
}>;

type NavItem = {
  key: VeterinarianNavKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  visibleFor?: UserType[];
};

function ShellNavButton({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
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

export default function VeterinarianShell({ active, title, description, actions, children }: VeterinarianShellProps) {
  const navigate = useNavigate();
  const { user } = useSession();
  const { notifications } = useInteraction();
  const { confirmAndLogout } = useAppNavigation();
  const { openHelp } = useOnboarding();

  const currentUserType = user?.userType ?? 'veterinarian';
  const dashboardPath = getDashboardRouteForUserType(currentUserType);
  const settingsPath = getSettingsRouteForUserType(currentUserType);
  const unreadNotifications = notifications.filter((notification) => notification.userId === user?.id && !notification.read).length;
  const veterinarianName = user?.name || 'Veterinário';

  const navItems: NavItem[] = [
    { key: 'dashboard', label: 'Dashboard', icon: Home, path: dashboardPath, visibleFor: ['veterinarian'] },
    { key: 'registration', label: 'Cadastrar pet', icon: PawPrint, path: '/veterinarian-pet-registration', visibleFor: ['veterinarian'] },
    { key: 'registered', label: 'Pets cadastrados', icon: ClipboardList, path: '/veterinarian-pets', visibleFor: ['veterinarian'] },
    { key: 'agenda', label: 'Agenda', icon: CalendarDays, path: '/veterinarian-schedule', visibleFor: ['veterinarian'] },
    { key: 'links', label: 'Vínculos', icon: Link2, path: '/veterinarian-links', visibleFor: ['veterinarian'] },
    { key: 'history', label: 'Histórico', icon: ClipboardList, path: '/veterinarian-history', visibleFor: ['veterinarian'] },
    { key: 'settings', label: 'Config.', icon: Settings, path: settingsPath, visibleFor: ['veterinarian'] },
  ].filter((item) => !item.visibleFor || item.visibleFor.includes(currentUserType));

  return (
    <div className="min-h-screen bg-[var(--page-background)] text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-card/92 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <button type="button" onClick={() => navigate(dashboardPath)} className="flex min-w-0 items-center gap-2 text-left transition-opacity hover:opacity-90 sm:gap-3">
            <img src="/icon.png" alt="PetHelp" className="h-10 w-10 shrink-0 object-contain sm:h-11 sm:w-11" />
            <div>
              <p className="text-[19px] font-medium leading-none">PetHelp</p>
              <p className="mt-1 hidden text-sm text-muted-foreground sm:block">Cuidado veterinário conectado</p>
            </div>
          </button>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <div className="hidden text-right md:block">
              <p className="text-sm text-muted-foreground">Olá, {veterinarianName}</p>
            </div>
            <span className="hidden rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary sm:inline-flex">Veterinário</span>
            <ThemeToggle />
            <button
              type="button"
              onClick={openHelp}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-foreground transition-colors hover:bg-muted sm:h-11 sm:w-11"
              aria-label="Tutorial: como usar o app"
              title="Tutorial: como usar o app"
            >
              <HelpCircle className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => navigate('/veterinarian-notifications')}
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-foreground transition-colors hover:bg-muted sm:h-11 sm:w-11"
              aria-label="Notificações"
              title="Notificações"
            >
              <Bell className="h-5 w-5" />
              {unreadNotifications > 0 ? <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[#f4a64a]" /> : null}
            </button>
            <button
              type="button"
              onClick={() => navigate(settingsPath)}
              className="hidden h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-foreground transition-colors hover:bg-muted sm:inline-flex sm:h-11 sm:w-11"
              aria-label="Configurações"
              title="Configurações"
            >
              <Settings className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => confirmAndLogout()}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-foreground transition-colors hover:bg-muted sm:h-11 sm:w-11"
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
              <ShellNavButton key={item.key} item={item} active={active === item.key} onClick={() => navigate(item.path)} />
            ))}
          </nav>
        </aside>

        <main className="min-w-0 px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pt-8">
          <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:hidden [&::-webkit-scrollbar]:hidden">
            {navItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => navigate(item.path)}
                className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors ${
                  active === item.key ? 'border-primary bg-primary text-white' : 'border-border bg-card text-foreground hover:bg-muted'
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

          <EmailVerificationBanner />

          {children}
        </main>
      </div>
    </div>
  );
}




