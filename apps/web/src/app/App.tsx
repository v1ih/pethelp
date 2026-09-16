import { RouterProvider } from 'react-router';
import { router } from './routes';
import { SessionProvider } from './context/SessionContext';
import { InteractionProvider } from './context/InteractionContext';
import { PetsProvider } from './context/PetsContext';
import { HealthProvider } from './context/HealthContext';
import { ReviewsProvider } from './context/ReviewsContext';
import { AppThemeProvider } from './components/layout/ThemeProvider';
import { Toaster } from './components/ui/sonner';

export default function App() {
  return (
    <AppThemeProvider>
      <SessionProvider>
        <InteractionProvider>
          <PetsProvider>
            <ReviewsProvider>
              <HealthProvider>
                <div className="size-full">
                  <RouterProvider router={router} />
                  <Toaster richColors closeButton />
                </div>
              </HealthProvider>
            </ReviewsProvider>
          </PetsProvider>
        </InteractionProvider>
      </SessionProvider>
    </AppThemeProvider>
  );
}
