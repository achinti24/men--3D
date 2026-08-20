import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { registerAndLogin, unique } from './helpers';

const app = createApp();

describe('Autenticación', () => {
  it('registra un usuario nuevo con role RESTAURANT_OWNER por defecto', async () => {
    const email = `${unique('reg')}@example.com`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'password123', fullName: 'Nuevo Usuario' })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(email);
    expect(res.body.data.user.role).toBe('RESTAURANT_OWNER');
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it('rechaza el registro con un email ya usado', async () => {
    const email = `${unique('dup')}@example.com`;
    await request(app).post('/api/auth/register').send({ email, password: 'password123', fullName: 'A' }).expect(201);
    const res = await request(app).post('/api/auth/register').send({ email, password: 'password123', fullName: 'B' }).expect(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('rechaza el registro con datos inválidos (contraseña corta)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: `${unique('bad')}@example.com`, password: '123', fullName: 'X' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('permite login con credenciales correctas y rechaza incorrectas', async () => {
    const { email, password } = await registerAndLogin(app);

    const ok = await request(app).post('/api/auth/login').send({ email, password }).expect(200);
    expect(ok.body.data.user.email).toBe(email);

    const bad = await request(app).post('/api/auth/login').send({ email, password: 'wrong-password' }).expect(401);
    expect(bad.body.error.code).toBe('UNAUTHORIZED');
  });

  it('GET /api/auth/me requiere sesión y nunca expone el hash de contraseña', async () => {
    await request(app).get('/api/auth/me').expect(401);

    const { agent } = await registerAndLogin(app);
    const res = await agent.get('/api/auth/me').expect(200);
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(Array.isArray(res.body.data.user.memberships)).toBe(true);
  });

  it('logout invalida la sesión', async () => {
    const { agent } = await registerAndLogin(app);
    await agent.get('/api/auth/me').expect(200);
    await agent.post('/api/auth/logout').expect(200);
    await agent.get('/api/auth/me').expect(401);
  });
});
