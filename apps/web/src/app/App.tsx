import { RouterProvider } from 'react-router';
import { router } from './routes';
import { SessionProvider } from './context/SessionContext';
import { InteractionProvider } from './context/InteractionContext';
import { PetsProvider } from './context/PetsContext';
import { HealthProvider } from './context/HealthContext';
import { ReviewsProvider } from './context/ReviewsContext';
import { AppThemeProvider } from './components/layout/ThemeProvider';
import { OnboardingProvider } from './context/OnboardingContext';
import { Toaster } from './components/ui/sonner';
import SupportButton from './components/support/SupportButton';
import { installErrorLog } from './utils/errorLog';

// Captura os erros do navegador desde o início, para irem junto no relato de suporte.
installErrorLog();

export default function App() {
  return (
    <AppThemeProvider>
      <SessionProvider>
        <InteractionProvider>
          <PetsProvider>
            <ReviewsProvider>
              <HealthProvider>
                <OnboardingProvider>
                  <div className="size-full">
                    <RouterProvider router={router} />
                    <SupportButton />
                    <Toaster richColors closeButton />
                  </div>
                </OnboardingProvider>
              </HealthProvider>
            </ReviewsProvider>
          </PetsProvider>
        </InteractionProvider>
      </SessionProvider>
    </AppThemeProvider>
  );
}
