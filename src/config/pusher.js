/**
 * config/pusher.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Módulo de configuración de Pusher Channels.
 *
 * Variables de entorno requeridas en .env:
 *   PUSHER_APP_ID   → ID de la aplicación Pusher
 *   PUSHER_KEY      → Clave pública (usada también en el frontend)
 *   PUSHER_SECRET   → Clave secreta (solo backend)
 *   PUSHER_CLUSTER  → Cluster de Pusher (ej: us2, eu, ap1, ap2...)
 *
 * Uso:
 *   import pusher from '../config/pusher.js';
 *   await pusher.trigger('admin-chat', 'new-message', { ... });
 */

import Pusher from 'pusher';

// ── Validación de variables de entorno ────────────────────────────────────────
const requiredEnvVars = ['PUSHER_APP_ID', 'PUSHER_KEY', 'PUSHER_SECRET', 'PUSHER_CLUSTER'];
const missingVars = requiredEnvVars.filter((v) => !process.env[v]);

if (missingVars.length > 0) {
  console.warn(
    `⚠️  [Pusher] Variables de entorno faltantes: ${missingVars.join(', ')}. ` +
    'Los eventos en tiempo real no funcionarán hasta que se configuren.'
  );
}

// ── Instancia de Pusher ────────────────────────────────────────────────────────
const pusher = new Pusher({
  appId:   process.env.PUSHER_APP_ID   || '',
  key:     process.env.PUSHER_KEY      || '',
  secret:  process.env.PUSHER_SECRET   || '',
  cluster: process.env.PUSHER_CLUSTER  || 'us2',
  useTLS:  true,  // Siempre TLS para producción
});

export default pusher;
