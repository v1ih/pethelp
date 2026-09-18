import React, { useEffect, useState } from 'react';
import { BellRing, Mail, Share2, ShieldCheck } from 'lucide-react';

const STORAGE_KEY = 'pethelp:permissions';

type Prefs = {
  emailReminders: boolean;
  appNotifications: boolean;
  vetPassSharing: boolean;
};

const DEFAULTS: Prefs = { emailReminders: true, appNotifications: true, vetPassSharing: true };

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-muted-foreground/30'}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
    </button>
  );
}

/** Seção de Permissões/Preferências (por dispositivo). Reforça a transparência (LGPD). */
export default function PermissionsSection() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [browserPerm, setBrowserPerm] = useState<string>(() =>
    typeof window === 'undefined' || !('Notification' in window) ? 'unsupported' : Notification.permission
  );

  useEffect(() => {
    setPrefs(loadPrefs());
  }, []);

  const update = (patch: Partial<Prefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignora: preferência é opcional */
      }
      return next;
    });
  };

  const requestBrowser = async () => {
    if (!('Notification' in window)) return;
    const result = await Notification.requestPermission();
    setBrowserPerm(result);
  };

  const rows = [
    {
      icon: Mail,
      title: 'Lembretes por e-mail',
      desc: 'Receber avisos de vacinas e consultas por e-mail.',
      control: <Toggle checked={prefs.emailReminders} onChange={(v) => update({ emailReminders: v })} />,
    },
    {
      icon: ShieldCheck,
      title: 'Notificações no app',
      desc: 'Mostrar alertas dentro do PetHelp.',
      control: <Toggle checked={prefs.appNotifications} onChange={(v) => update({ appNotifications: v })} />,
    },
    {
      icon: Share2,
      title: 'Compartilhamento via Vet-Pass',
      desc: 'Permitir liberar dados do pet a veterinários por Vet-Pass.',
      control: <Toggle checked={prefs.vetPassSharing} onChange={(v) => update({ vetPassSharing: v })} />,
    },
    {
      icon: BellRing,
      title: 'Alertas do navegador',
      desc:
        browserPerm === 'granted'
          ? 'Ativados neste dispositivo.'
          : browserPerm === 'denied'
            ? 'Bloqueados nas configurações do navegador.'
            : browserPerm === 'unsupported'
              ? 'Não suportado neste navegador.'
              : 'Permitir notificações do navegador.',
      control:
        browserPerm === 'default' ? (
          <button type="button" onClick={() => void requestBrowser()} className="rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs text-primary transition-colors hover:bg-primary/10">
            Ativar
          </button>
        ) : (
          <span className="text-xs text-muted-foreground">
            {browserPerm === 'granted' ? 'Ativo' : browserPerm === 'denied' ? 'Bloqueado' : '—'}
          </span>
        ),
    },
  ];

  return (
    <section className="rounded-[34px] border border-border/70 bg-card p-6 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)] sm:p-8">
      <h2 className="text-xl font-medium text-foreground">Permissões e privacidade</h2>
      <p className="mt-1 text-sm text-muted-foreground">Controle o que o PetHelp pode fazer. Suas escolhas ficam salvas neste dispositivo.</p>

      <div className="mt-5 divide-y divide-border/70">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <div key={row.title} className="flex items-center justify-between gap-4 py-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">{row.title}</p>
                  <p className="text-sm text-muted-foreground">{row.desc}</p>
                </div>
              </div>
              <div className="shrink-0">{row.control}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
