import React from 'react';
import { useNavigate } from 'react-router';
import { useState } from 'react';
import { Bell, Calendar, Link as LinkIcon, Syringe } from 'lucide-react';
import { ClinicShell } from '../components/layout/ClinicShell';
import { TutorShell } from '../components/layout/TutorShell';
import VeterinarianShell from '../components/layout/VeterinarianShell';
import { useInteraction } from '../context/InteractionContext';
import { useSession } from '../context/SessionContext';
import { useAppNavigation } from '../navigation';

function NotificationsList({
  notifications,
  onMarkRead,
}: {
  notifications: Array<{ id: string; type: string; title: string; message: string; date: string; read: boolean }>;
  onMarkRead: (id: string) => void;
}) {
  const unread = notifications.filter((notification) => !notification.read);
  const read = notifications.filter((notification) => notification.read);

  const getIcon = (type: string) => {
    switch (type) {
      case 'vaccine':
        return <Syringe className="h-5 w-5 text-primary" />;
      case 'appointment':
        return <Calendar className="h-5 w-5 text-primary" />;
      case 'connection':
        return <LinkIcon className="h-5 w-5 text-primary" />;
      default:
        return <Bell className="h-5 w-5 text-primary" />;
    }
  };

  if (notifications.length === 0) {
    return (
      <div className="rounded-[34px] border border-border/70 bg-card p-10 text-center shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)]">
        <Bell className="mx-auto mb-4 h-16 w-16 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground">Nenhuma notificação por enquanto</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {unread.length > 0 ? (
        <section className="rounded-[34px] border border-border/70 bg-card p-6 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)]">
          <h2 className="mb-4 text-2xl font-medium text-foreground">Novas</h2>
          <div className="space-y-3">
            {unread.map((notification) => (
              <button
                key={notification.id}
                onClick={() => onMarkRead(notification.id)}
                className="w-full rounded-[24px] border border-primary/20 bg-primary/10 p-4 text-left transition-colors hover:bg-primary/15"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/20">
                    {getIcon(notification.type)}
                  </div>
                  <div className="flex-1">
                    <p className="mb-1 text-foreground">{notification.title}</p>
                    <p className="mb-2 text-sm text-muted-foreground">{notification.message}</p>
                    <p className="text-xs text-muted-foreground">{notification.date}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {read.length > 0 ? (
        <section className="rounded-[34px] border border-border/70 bg-card p-6 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)]">
          <h2 className="mb-4 text-2xl font-medium text-foreground">Anteriores</h2>
          <div className="space-y-3">
            {read.map((notification) => (
              <div key={notification.id} className="rounded-[24px] border border-border bg-muted/25 p-4 opacity-70">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-muted">
                    {getIcon(notification.type)}
                  </div>
                  <div className="flex-1">
                    <p className="mb-1 text-foreground">{notification.title}</p>
                    <p className="mb-2 text-sm text-muted-foreground">{notification.message}</p>
                    <p className="text-xs text-muted-foreground">{notification.date}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default function NotificationsScreen() {
  const navigate = useNavigate();
  const { user } = useSession();
  const { notifications, markNotificationAsRead } = useInteraction();
  const { confirmAndLogout } = useAppNavigation();

  const currentUserType = user?.userType ?? 'owner';
  const userNotifications = notifications.filter((notification) => notification.userId === user?.id);
  const clinicName = user?.clinicName || user?.name || 'Clínica';
  const unreadCount = userNotifications.filter((notification) => !notification.read).length;
  const [pushStatus, setPushStatus] = useState(() =>
    typeof window === 'undefined' || !window.Notification ? 'unsupported' : window.Notification.permission
  );

  const handleMarkAllRead = async () => {
    await Promise.all(userNotifications.filter((notification) => !notification.read).map((notification) => markNotificationAsRead(notification.id)));
  };

  const enablePushNotifications = async () => {
    if (typeof window === 'undefined' || !window.Notification) return;
    setPushStatus(await window.Notification.requestPermission());
  };

  const pushAction = pushStatus === 'default' ? (
    <button type="button" onClick={() => void enablePushNotifications()} className="rounded-[18px] border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary transition-colors hover:bg-primary/10">
      Ativar alertas do navegador
    </button>
  ) : null;

  if (currentUserType === 'veterinarian') {
    return (
      <VeterinarianShell active="dashboard" title="Notificações" description="Alertas e histórico de mensagens do sistema." actions={pushAction}>
        <NotificationsList notifications={userNotifications} onMarkRead={markNotificationAsRead} />
      </VeterinarianShell>
    );
  }

  if (currentUserType === 'clinic') {
    return (
      <ClinicShell
        active="dashboard"
        title="Notificações"
        description="Alertas, vínculos e histórico de mensagens da clínica."
        actions={
          <div className="flex flex-wrap gap-2">
            {pushAction}
            <button
              type="button"
              onClick={() => void handleMarkAllRead()}
              disabled={unreadCount === 0}
              className="inline-flex items-center gap-2 rounded-[18px] bg-primary px-5 py-3 text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Marcar todas como lidas
            </button>
          </div>
        }
      >
        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[28px] border border-border/70 bg-card p-6 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)]">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="mt-2 text-3xl font-medium text-foreground">{userNotifications.length}</p>
            <p className="mt-2 text-sm text-muted-foreground">Notificações vinculadas à clínica.</p>
          </div>
          <div className="rounded-[28px] border border-border/70 bg-card p-6 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)]">
            <p className="text-sm text-muted-foreground">Não lidas</p>
            <p className="mt-2 text-3xl font-medium text-foreground">{unreadCount}</p>
            <p className="mt-2 text-sm text-muted-foreground">Itens que ainda pedem atenção.</p>
          </div>
          <div className="rounded-[28px] border border-border/70 bg-card p-6 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)]">
            <p className="text-sm text-muted-foreground">Clínica</p>
            <p className="mt-2 text-2xl font-medium text-foreground">{clinicName}</p>
            <p className="mt-2 text-sm text-muted-foreground">Contexto atual do painel clínico.</p>
          </div>
        </section>

        <div className="mt-6">
          <NotificationsList notifications={userNotifications} onMarkRead={markNotificationAsRead} />
        </div>
      </ClinicShell>
    );
  }

  return (
    <TutorShell active="home" title="Notificações" description="Alertas e histórico de mensagens do sistema." actions={pushAction}>
      <NotificationsList notifications={userNotifications} onMarkRead={markNotificationAsRead} />
    </TutorShell>
  );
}
