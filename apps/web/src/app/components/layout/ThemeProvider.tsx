import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

type AppThemeProviderProps = React.PropsWithChildren<{
  defaultTheme?: string;
}>;

export function AppThemeProvider({ children, defaultTheme = 'light' }: AppThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={defaultTheme}
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
