/**
 * tests/integration/helpers/apiClient.js
 *
 * Cliente HTTP para las pruebas de integración. Supertest acepta una URL
 * en lugar de una app de Express, así que esto pega directo contra el
 * backend ya desplegado en Vercel (no se levanta un servidor local).
 */
import request from 'supertest';
import { BASE_URL } from './env.js';

export const api = request(BASE_URL);
