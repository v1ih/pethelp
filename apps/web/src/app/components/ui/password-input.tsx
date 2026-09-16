import * as React from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';

type PasswordInputProps = React.ComponentProps<'input'>;

export function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = React.useState(false);
  const inputClassName = ['auth-input', 'auth-input-password', className].filter(Boolean).join(' ');

  return (
    <div className="auth-input-wrap">
      <Lock className="auth-icon" size={18} />
      <input
        data-slot="password-input"
        className={inputClassName}
        {...props}
        type={visible ? 'text' : 'password'}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? 'Ocultar senha' : 'Exibir senha'}
        className="auth-password-toggle"
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

