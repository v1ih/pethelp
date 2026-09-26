import * as React from 'react';
import { ClinicShell } from './ClinicShell';
import VeterinarianShell from './VeterinarianShell';
import { useSession } from '../../context/SessionContext';

// As telas de cadastro de pet servem clínica e veterinário autônomo. O conteúdo é o
// mesmo; só o menu lateral muda. Este wrapper escolhe o shell do perfil logado para
// as telas não precisarem ser duplicadas.

export type ProfessionalNavKey = 'registration' | 'registered';

type ProfessionalShellProps = React.PropsWithChildren<{
  active: ProfessionalNavKey;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
}>;

export function ProfessionalShell({ active, title, description, actions, children }: ProfessionalShellProps) {
  const { user } = useSession();

  if (user?.userType === 'veterinarian') {
    return (
      <VeterinarianShell active={active} title={title} description={description} actions={actions}>
        {children}
      </VeterinarianShell>
    );
  }

  return (
    <ClinicShell active={active} title={title} description={description} actions={actions}>
      {children}
    </ClinicShell>
  );
}

export default ProfessionalShell;
