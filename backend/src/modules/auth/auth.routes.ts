import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { authRateLimiter } from '../../middleware/rateLimiters';
import { verifyCsrf } from '../../middleware/verifyCsrf';
import { loginSchema, registerSchema } from './auth.schemas';
import { loginHandler, logoutHandler, meHandler, refreshHandler, registerHandler } from './auth.controller';

export const authRouter = Router();

// register/login/refresh no llevan verifyCsrf: todavía no existe la cookie
// csrf_token que verificar en ese punto (se emite recién en la respuesta).
authRouter.post('/register', authRateLimiter, validate(registerSchema), registerHandler);
authRouter.post('/login', authRateLimiter, validate(loginSchema), loginHandler);
authRouter.post('/refresh', authRateLimiter, refreshHandler);
authRouter.post('/logout', authenticate, verifyCsrf, logoutHandler);
authRouter.get('/me', authenticate, meHandler);
