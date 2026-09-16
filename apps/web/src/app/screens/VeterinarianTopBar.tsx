import React from 'react';
import { Bell, CalendarDays, LogOut, PawPrint, Settings, Stethoscope } from 'lucide-react';

type VeterinarianTopBarProps = {
  veterinarianName: string;
  notificationsCount?: number;
  onNotifications: () => void;
  onSchedule: () => void;
  onSettings: () => void;
  onLogout: () => void;
};

export default function VeterinarianTopBar({
  veterinarianName,
  notificationsCount = 0,
  onNotifications,
  onSchedule,
  onSettings,
  onLogout,
}: VeterinarianTopBarProps) {
  return (
    <div className="sticky top-0 z-30 bg-card/95 border-b border-border backdrop-blur supports-[backdrop-filter]:bg-card/85">
      <div className="mx-auto max-w-5xl px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary">
              <PawPrint className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl text-foreground">PetHelp</h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/15 bg-primary/5 px-2.5 py-1 text-[11px] text-primary">
                  <Stethoscope className="h-3 w-3" />
                  Veterinário
                </span>
              </div>
              <p className="text-sm text-muted-foreground">Olá, {veterinarianName}</p>
            </div>
          </div>

          <div className="flex gap-2 sm:gap-3">
            <button
              onClick={onSchedule}
              className="rounded-xl p-2 transition-colors hover:bg-muted"
              title="Agenda"
            >
              <CalendarDays className="h-6 w-6 text-foreground" />
            </button>
            <button
              onClick={onNotifications}
              className="relative rounded-xl p-2 transition-colors hover:bg-muted"
              title="Notificações"
            >
              <Bell className="h-6 w-6 text-foreground" />
              {notificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs text-white">
                  {notificationsCount}
                </span>
              )}
            </button>
            <button
              onClick={onSettings}
              className="rounded-xl p-2 transition-colors hover:bg-muted"
              title="Configurações"
            >
              <Settings className="h-6 w-6 text-foreground" />
            </button>
            <button
              onClick={onLogout}
              className="rounded-xl p-2 transition-colors hover:bg-muted"
              title="Sair"
            >
              <LogOut className="h-6 w-6 text-foreground" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
