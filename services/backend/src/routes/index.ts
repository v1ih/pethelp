import { Router } from 'express';
import { healthRouter } from './health.js';
import { petsRouter } from '../modules/pets/pets.routes.js';
import authRouter from '../modules/auth/auth.routes.js';
import usersRouter from '../modules/users/users.routes.js';
import medicalHistoryRouter from '../modules/medical-history/medical-history.routes.js';
import vaccinesRouter from '../modules/vaccines/vaccines.routes.js';
import clinicLinksRouter from '../modules/clinic-links/clinic-links.routes.js';
import appointmentsRouter from '../modules/appointments/appointments.routes.js';
import notificationsRouter from '../modules/notifications/notifications.routes.js';
import reviewsRouter from '../modules/reviews/reviews.routes.js';
import vetPassesRouter from '../modules/vet-passes/vet-passes.routes.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/pets', petsRouter);
apiRouter.use('/appointments', appointmentsRouter);
apiRouter.use('/medical-records', medicalHistoryRouter);
apiRouter.use('/vaccines', vaccinesRouter);
apiRouter.use('/clinic-links', clinicLinksRouter);
apiRouter.use('/notifications', notificationsRouter);
apiRouter.use('/reviews', reviewsRouter);
apiRouter.use('/vet-passes', vetPassesRouter);
