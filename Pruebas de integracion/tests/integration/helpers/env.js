/**
 * tests/integration/helpers/env.js
 *
 * Configuración centralizada de las pruebas de integración.
 * Estas pruebas NO usan mongodb-memory-server: pegan directo contra el
 * backend real desplegado en Vercel y contra tu MongoDB real (misma
 * MONGODB_URI del .env), tal como se acordó.
 */
import dotenv from 'dotenv';
dotenv.config();

// URL del backend desplegado. Se puede sobreescribir con INTEGRATION_BASE_URL
// (por ejemplo para apuntar a un preview deploy de Vercel en un PR).
export const BASE_URL = process.env.INTEGRATION_BASE_URL || 'https://tesisv1-two.vercel.app';

// Si está en true, la prueba de "happy path" de generación de títulos con IA
// hace la llamada real a Hugging Face. Queda ENCENDIDA por defecto; para
// apagarla (y no gastar cuota/tiempo en esa prueba) usa RUN_IA_LIVE_TEST=false.
export const RUN_IA_LIVE_TEST = process.env.RUN_IA_LIVE_TEST !== 'false';

// Prefijo para reconocer (y poder limpiar) todo lo que crean estas pruebas.
export const TEST_TAG = 'qaintegracion';