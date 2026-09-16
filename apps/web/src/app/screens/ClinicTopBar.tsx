import React from 'react';
import { Bell, LogOut, PawPrint, Settings } from 'lucide-react';

type ClinicTopBarProps = {
  clinicName: string;
  notificationsCount?: number;
  onNotifications: () => void;
  onSettings: () => void;
  onLogout: () => void;
};

export default function ClinicTopBar({
  clinicName,
  notificationsCount = 0,
  onNotifications,
  onSettings,
  onLogout,
}: ClinicTopBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white shadow-[0_16px_32px_-18px_rgba(127,162,106,0.7)]">
            <PawPrint className="h-6 w-6" />
          </div>
          <div>
            <p className="app-kicker">PetHelp</p>
            <h1 className="text-lg font-medium text-foreground">{clinicName}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button onClick={onNotifications} className="app-button-ghost relative px-3 py-3" title="Notificações">
            <Bell className="h-5 w-5" />
            {notificationsCount > 0 && (
              <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] text-white">
                {notificationsCount}
              </span>
            )}
          </button>
          <button onClick={onSettings} className="app-button-ghost px-3 py-3" title="Configurações">
            <Settings className="h-5 w-5" />
          </button>
          <button onClick={onLogout} className="app-button-ghost px-3 py-3" title="Sair">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
