import React, { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useSession } from './SessionContext';
import { getApiBase, getAuthHeaders, type Appointment, type Notification } from './shared';

interface InteractionContextValue {
  appointments: Appointment[];
  addAppointment: (appointment: Omit<Appointment, 'id'>) => Promise<void>;
  updateAppointment: (id: string, appointment: Partial<Appointment>) => Promise<void>;
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id'>) => Promise<void>;
  markNotificationAsRead: (id: string) => Promise<void>;
}

const InteractionContext = createContext<InteractionContextValue | undefined>(undefined);

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toUiAppointment(item: any): Appointment {
  return {
    id: item.id,
    petId: item.petId ?? item.pet_id,
    petName: item.petName ?? item.pet_name ?? '',
    clinicId: item.clinicId ?? item.clinic_id ?? null,
    clinicName: item.clinicName ?? item.clinic_name ?? null,
    veterinarianId: item.veterinarianId ?? item.veterinarian_id ?? null,
    veterinarianName: item.veterinarianName ?? item.veterinarian_name ?? null,
    veterinarianEmail: item.veterinarianEmail ?? item.veterinarian_email ?? null,
    veterinarianPhone: item.veterinarianPhone ?? item.veterinarian_phone ?? null,
    targetType: item.targetType ?? (item.veterinarianId ?? item.veterinarian_id ? 'veterinarian' : 'clinic'),
    date: item.date ?? item.appointment_date ?? '',
    time: item.time ?? item.appointment_time ?? '',
    reason: item.reason ?? '',
    status: item.status === 'completed' || item.status === 'cancelled' ? item.status : 'scheduled',
    ownerId: item.ownerId ?? item.tutorId ?? item.tutor_id ?? '',
  };
}

function toUiNotification(item: any): Notification {
  return {
    id: item.id,
    userId: item.userId ?? item.user_id ?? '',
    type: item.type === 'vaccine' || item.type === 'appointment' || item.type === 'connection' ? item.type : 'referral',
    title: item.title ?? '',
    message: item.message ?? '',
    date: item.date ?? item.notification_date ?? '',
    read: Boolean(item.read ?? item.read_at),
    petId: item.petId ?? item.pet_id ?? undefined,
    appointmentId: item.appointmentId ?? item.appointment_id ?? undefined,
    sourceKey: item.sourceKey ?? item.source_key ?? undefined,
  };
}

export function InteractionProvider({ children }: { children: ReactNode }) {
  const { user, authReady } = useSession();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const knownNotificationIds = useRef(new Set<string>());
  const API_BASE = getApiBase();

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setAppointments([]);
      setNotifications([]);
      knownNotificationIds.current = new Set();
      return;
    }

    knownNotificationIds.current = new Set();
    let cancelled = false;

    const load = async (announceNew = false) => {
      try {
        const [appointmentsResp, notificationsResp] = await Promise.all([
          fetch(`${API_BASE}/api/appointments/me`, { headers: getAuthHeaders() }),
          fetch(`${API_BASE}/api/notifications/me`, { headers: getAuthHeaders() }),
        ]);

        if (cancelled) return;

        if (appointmentsResp.ok) {
          const { data } = await appointmentsResp.json();
          setAppointments((data ?? []).map(toUiAppointment));
        } else {
          setAppointments([]);
        }

        if (notificationsResp.ok) {
          const { data } = await notificationsResp.json();
          const nextNotifications = (data ?? []).map(toUiNotification) as Notification[];
          const newUnread = nextNotifications.filter((item) => !item.read && !knownNotificationIds.current.has(item.id));
          const hasInitialLoad = knownNotificationIds.current.size > 0;
          knownNotificationIds.current = new Set(nextNotifications.map((item) => item.id));
          setNotifications(nextNotifications);

          if (announceNew && hasInitialLoad && typeof window !== 'undefined' && window.Notification?.permission === 'granted') {
            newUnread.forEach((notification) => {
              new window.Notification(notification.title, { body: notification.message, tag: notification.id });
            });
          }
        } else {
          setNotifications([]);
        }
      } catch (error) {
        console.error('interaction load error', error);
        if (!cancelled) {
          setAppointments([]);
          setNotifications([]);
        }
      }
    };

    void load();
    const pollId = window.setInterval(() => void load(true), 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(pollId);
    };
  }, [API_BASE, authReady, user?.id]);

  const addAppointment = async (appointment: Omit<Appointment, 'id'>) => {
    const resp = await fetch(`${API_BASE}/api/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(appointment),
    });

    if (!resp.ok) {
      throw new Error((await resp.json()).message ?? 'Create appointment failed');
    }

    const { data } = await resp.json();
    const created = toUiAppointment(data);
    setAppointments((prev) => [...prev.filter((item) => item.id !== created.id), created]);

    const notificationResp = await fetch(`${API_BASE}/api/notifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        petId: created.petId,
        appointmentId: created.id,
        sourceKey: `appointment-created:${created.id}`,
        type: 'appointment',
        title: 'Consulta agendada',
        message: `${created.petName} foi agendado para ${created.date} �s ${created.time}.`,
        date: new Date().toISOString().slice(0, 10),
      }),
    });

    if (notificationResp.ok) {
      const { data: notificationData } = await notificationResp.json();
      const createdNotification = toUiNotification(notificationData);
      setNotifications((prev) => [createdNotification, ...prev.filter((item) => item.id !== createdNotification.id)]);
    }
  };

  const updateAppointment = async (id: string, appointmentUpdate: Partial<Appointment>) => {
    const resp = await fetch(`${API_BASE}/api/appointments/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(appointmentUpdate),
    });

    if (!resp.ok) {
      throw new Error((await resp.json()).message ?? 'Update appointment failed');
    }

    const { data } = await resp.json();
    const updated = toUiAppointment(data);
    setAppointments((prev) => prev.map((item) => (item.id === id ? { ...item, ...updated } : item)));

    const sourceKey = `appointment-status:${id}:${updated.status}`;
    const notificationResp = await fetch(`${API_BASE}/api/notifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        userId: updated.ownerId,
        petId: updated.petId,
        appointmentId: updated.id,
        sourceKey,
        type: 'appointment',
        title: 'Atualiza��o de consulta',
        message:
          updated.status === 'completed'
            ? `${updated.petName} teve a consulta conclu�da.`
            : updated.status === 'cancelled'
              ? `${updated.petName} teve a consulta cancelada.`
              : `${updated.petName} teve a consulta atualizada.`,
        date: new Date().toISOString().slice(0, 10),
      }),
    });

    if (notificationResp.ok) {
      const { data: notificationData } = await notificationResp.json();
      const createdNotification = toUiNotification(notificationData);
      setNotifications((prev) => [createdNotification, ...prev.filter((item) => item.id !== createdNotification.id)]);
    }
  };

  const addNotification = useCallback(async (notification: Omit<Notification, 'id'>) => {
    const resp = await fetch(`${API_BASE}/api/notifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(notification),
    });

    if (!resp.ok) {
      throw new Error((await resp.json()).message ?? 'Create notification failed');
    }

    const { data } = await resp.json();
    const created = toUiNotification(data);
    setNotifications((prev) => [created, ...prev.filter((item) => item.id !== created.id)]);
  }, [API_BASE]);

  const markNotificationAsRead = async (id: string) => {
    const resp = await fetch(`${API_BASE}/api/notifications/${id}/read`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
    });

    if (!resp.ok) {
      throw new Error((await resp.json()).message ?? 'Mark notification as read failed');
    }

    const { data } = await resp.json();
    const updated = toUiNotification(data);
    setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, ...updated } : item)));
  };

  return (
    <InteractionContext.Provider
      value={{
        appointments,
        addAppointment,
        updateAppointment,
        notifications,
        addNotification,
        markNotificationAsRead,
      }}
    >
      {children}
    </InteractionContext.Provider>
  );
}

export function useInteraction() {
  const context = useContext(InteractionContext);
  if (!context) {
    throw new Error('useInteraction must be used within an InteractionProvider');
  }
  return context;
}
