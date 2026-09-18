import * as React from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ClipboardList,
  HeartHandshake,
  KeyRound,
  Link2,
  PawPrint,
  ShieldCheck,
  Stethoscope,
  Syringe,
  Users,
  X,
} from 'lucide-react';
import type { UserType } from '../../context/shared';

type Slide = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
};

const SLIDES: Record<UserType, Slide[]> = {
  owner: [
    {
      icon: HeartHandshake,
      title: 'Bem-vindo(a) ao PetHelp!',
      body: 'Aqui você cuida da saúde do seu pet num lugar só: perfil, prontuário, vacinas, exames e consultas. Vamos dar uma olhada rápida no que dá pra fazer.',
    },
    {
      icon: PawPrint,
      title: 'Comece cadastrando seu pet',
      body: 'Crie o perfil com foto, idade, peso, alergias e condições. Esses dados ajudam o veterinário a atender melhor.',
    },
    {
      icon: ClipboardList,
      title: 'Prontuário, vacinas e exames',
      body: 'Todo o histórico de saúde fica guardado e organizado. Você pode anexar laudos e exames em PDF ou imagem.',
    },
    {
      icon: KeyRound,
      title: 'O que é o Vet-Pass?',
      body: 'É um código temporário que LIBERA os dados do seu pet para um veterinário. Você escolhe o que compartilhar (prontuário, vacinas ou exames) e por quantos dias. Nada fica exposto sem a sua autorização.',
    },
    {
      icon: ShieldCheck,
      title: 'Você no controle',
      body: 'Na tela "Compartilhamentos" você vê todos os Vet-Pass gerados, com quem cada um foi usado, e pode encerrar o acesso quando quiser. Também dá pra enviar o código por e-mail como backup.',
    },
    {
      icon: CalendarDays,
      title: 'Agenda e lembretes',
      body: 'Marque consultas e receba lembretes de vacinas e agendamentos por e-mail, pra não perder nenhuma data importante.',
    },
  ],
  clinic: [
    {
      icon: HeartHandshake,
      title: 'Bem-vindo(a) ao PetHelp!',
      body: 'Este é o painel da sua clínica. Aqui você conecta veterinários, organiza a agenda e acompanha os atendimentos.',
    },
    {
      icon: Link2,
      title: 'Código da clínica',
      body: 'Compartilhe o código da clínica para que veterinários e tutores se vinculem a você. Ele fica em destaque no seu painel.',
    },
    {
      icon: Users,
      title: 'Gerencie veterinários',
      body: 'Aprove vínculos de veterinários e defina o horário de atendimento de cada um dentro da clínica.',
    },
    {
      icon: CalendarDays,
      title: 'Agenda no estilo calendário',
      body: 'Defina os horários de funcionamento e acompanhe as consultas por dia, igual a uma agenda de verdade.',
    },
  ],
  veterinarian: [
    {
      icon: Stethoscope,
      title: 'Bem-vindo(a) ao PetHelp!',
      body: 'Aqui você atende com segurança usando o Vet-Pass do responsável pelo animal. Vamos ao essencial.',
    },
    {
      icon: KeyRound,
      title: 'O que é o Vet-Pass?',
      body: 'É um código que o responsável gera e te passa. Ao validá-lo, você acessa os dados do pet — mas só o que o responsável liberou (prontuário, vacinas e/ou exames) e dentro da validade.',
    },
    {
      icon: ClipboardList,
      title: 'Registrar atendimento',
      body: 'Com o Vet-Pass válido, você vê os dados básicos do pet e pode registrar prontuário, vacinas e anexar exames — conforme o que foi liberado.',
    },
    {
      icon: CalendarDays,
      title: 'Sua agenda',
      body: 'Use a agenda dedicada para organizar seus horários e consultas, separados do fluxo clínico.',
    },
  ],
};

type OnboardingModalProps = {
  open: boolean;
  userType: UserType;
  onClose: () => void;
};

export default function OnboardingModal({ open, userType, onClose }: OnboardingModalProps) {
  const slides = SLIDES[userType] ?? SLIDES.owner;
  const [index, setIndex] = React.useState(0);

  // Sempre reinicia no primeiro slide ao reabrir.
  React.useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  if (!open) return null;

  const slide = slides[index];
  const Icon = slide.icon;
  const isLast = index === slides.length - 1;
  const isFirst = index === 0;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Tutorial do PetHelp"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-[32px] border border-border bg-card shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-6 pt-5">
          <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Tutorial • {index + 1}/{slides.length}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
          >
            {isLast ? 'Fechar' : 'Pular'}
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="px-8 py-6 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary">
            <Icon className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-medium text-foreground">{slide.title}</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">{slide.body}</p>
        </div>

        <div className="flex items-center justify-center gap-1.5 pb-5">
          {slides.map((_, dotIndex) => (
            <button
              key={dotIndex}
              type="button"
              aria-label={`Ir para o passo ${dotIndex + 1}`}
              onClick={() => setIndex(dotIndex)}
              className={`h-2 rounded-full transition-all ${
                dotIndex === index ? 'w-6 bg-primary' : 'w-2 bg-border hover:bg-muted-foreground/40'
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={() => setIndex((value) => Math.max(0, value - 1))}
            disabled={isFirst}
            className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowLeft className="h-4 w-4" />
            Anterior
          </button>
          {isLast ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm text-white transition-colors hover:bg-primary/90"
            >
              Concluir
              <ShieldCheck className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIndex((value) => Math.min(slides.length - 1, value + 1))}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm text-white transition-colors hover:bg-primary/90"
            >
              Próximo
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
