import * as React from 'react';
import { ThemeToggle } from './ThemeToggle';
import { cn } from '../ui/utils';

type ScreenFrameProps = React.PropsWithChildren<{
  className?: string;
  showThemeToggle?: boolean;
}>;

type ScreenPanelProps = React.PropsWithChildren<{
  className?: string;
}>;

type ScreenHeaderProps = React.PropsWithChildren<{
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}>;

type ScreenStatProps = React.PropsWithChildren<{
  label: string;
  className?: string;
}>;

function ScreenFrame({ className, children, showThemeToggle = true }: ScreenFrameProps) {
  return (
    <div className={cn('app-page relative', className)}>
      {showThemeToggle ? (
        <div className="pointer-events-none fixed right-4 top-4 z-50 sm:right-6 sm:top-6">
          <div className="pointer-events-auto">
            <ThemeToggle />
          </div>
        </div>
      ) : null}
      {children}
    </div>
  );
}

function ScreenPanel({ className, children }: ScreenPanelProps) {
  return <section className={cn('app-surface-compact', className)}>{children}</section>;
}

function ScreenHeader({ eyebrow, title, description, actions, icon, className }: ScreenHeaderProps) {
  return (
    <div className={cn('app-hero-panel px-6 py-6 sm:px-8 sm:py-8', className)}>
      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          {icon ? <div className="app-icon-badge shrink-0">{icon}</div> : null}
          <div className="max-w-3xl space-y-2">
            {eyebrow ? <p className="app-kicker">{eyebrow}</p> : null}
            <h1 className="app-title">{title}</h1>
            {description ? <p className="app-subtitle">{description}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
    </div>
  );
}

function ScreenStat({ label, className, children }: ScreenStatProps) {
  return (
    <div className={cn('app-stat', className)}>
      <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm text-foreground">{children}</div>
    </div>
  );
}

export { ScreenFrame, ScreenHeader, ScreenPanel, ScreenStat };
