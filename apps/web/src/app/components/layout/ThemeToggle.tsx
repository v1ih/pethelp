import { MoonStar, SunMedium } from 'lucide-react';
import { useTheme } from 'next-themes';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="app-theme-toggle"
      aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
      title={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
    >
      {isDark ? <SunMedium className="h-5 w-5" /> : <MoonStar className="h-5 w-5" />}
    </button>
  );
}
