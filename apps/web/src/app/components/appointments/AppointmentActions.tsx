import React, { useState } from 'react';
import { CalendarX, Mail, MessageCircle, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { useInteraction, type AppointmentContact } from '../../context/InteractionContext';

// Ações que responsável, clínica e veterinário têm sobre uma consulta: cancelar
// (avisando o outro lado) e falar com a outra parte. Fica num componente só para as
// três telas de agenda se comportarem igual.

type AppointmentActionsProps = {
  appointmentId: string;
  petName: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  /** Como chamar a outra parte no botão de contato. */
  contactLabel?: string;
  onChanged?: () => void;
};

function onlyDigits(value: string) {
  return value.replace(/\D/g, '');
}

/** Monta o link do WhatsApp com DDI do Brasil quando o número vem sem ele. */
function whatsappLink(phone: string, text: string) {
  const digits = onlyDigits(phone);
  const withCountry = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(text)}`;
}

export default function AppointmentActions({
  appointmentId,
  petName,
  status,
  contactLabel = 'Falar com a outra parte',
  onChanged,
}: AppointmentActionsProps) {
  const { cancelAppointment, getAppointmentContact } = useInteraction();
  const [busy, setBusy] = useState(false);
  const [contact, setContact] = useState<AppointmentContact | null>(null);
  const [loadingContact, setLoadingContact] = useState(false);

  const canCancel = status === 'scheduled';

  const handleCancel = () => {
    toast(`Cancelar a consulta de ${petName}?`, {
      description: 'A outra parte recebe um aviso por e-mail e no app, e o horário volta a ficar livre.',
      duration: 12000,
      action: {
        label: 'Cancelar consulta',
        onClick: () => {
          void (async () => {
            setBusy(true);
            try {
              await cancelAppointment(appointmentId);
              toast.success('Consulta cancelada. Avisamos a outra parte.');
              onChanged?.();
            } catch (error) {
              toast.error(error instanceof Error ? error.message : 'Não foi possível cancelar.');
            } finally {
              setBusy(false);
            }
          })();
        },
      },
      cancel: { label: 'Manter', onClick: () => {} },
    });
  };

  const handleContact = async () => {
    if (contact) {
      setContact(null);
      return;
    }

    setLoadingContact(true);
    try {
      setContact(await getAppointmentContact(appointmentId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível carregar o contato.');
    } finally {
      setLoadingContact(false);
    }
  };

  const message = `Olá! Sou do PetHelp e queria falar sobre a consulta de ${petName}.`;

  return (
    <div className="mt-3 border-t border-border/70 pt-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleContact()}
          disabled={loadingContact}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted disabled:opacity-60"
        >
          <MessageCircle className="h-4 w-4" />
          {loadingContact ? 'Carregando...' : contact ? 'Ocultar contato' : contactLabel}
        </button>

        {canCancel ? (
          <button
            type="button"
            onClick={handleCancel}
            disabled={busy}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
          >
            <CalendarX className="h-4 w-4" />
            {busy ? 'Cancelando...' : 'Cancelar consulta'}
          </button>
        ) : null}
      </div>

      {contact ? (
        <div className="mt-3 rounded-[18px] border border-border bg-muted/25 p-3">
          <p className="text-sm font-medium text-foreground">{contact.name}</p>
          <div className="mt-2 grid gap-2">
            {contact.phone ? (
              <>
                <a
                  href={whatsappLink(contact.phone, message)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-[14px] border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                >
                  <MessageCircle className="h-4 w-4 text-primary" />
                  WhatsApp: {contact.phone}
                </a>
                <a
                  href={`tel:${onlyDigits(contact.phone)}`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-[14px] border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                >
                  <Phone className="h-4 w-4 text-primary" />
                  Ligar
                </a>
              </>
            ) : null}

            {contact.email ? (
              <a
                href={`mailto:${contact.email}?subject=${encodeURIComponent(`PetHelp — consulta de ${petName}`)}`}
                className="inline-flex min-h-11 items-center gap-2 rounded-[14px] border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
              >
                <Mail className="h-4 w-4 text-primary" />
                <span className="break-all">{contact.email}</span>
              </a>
            ) : null}

            {!contact.phone && !contact.email ? (
              <p className="text-sm text-muted-foreground">Nenhum contato cadastrado.</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
