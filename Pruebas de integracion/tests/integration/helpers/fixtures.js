/**
 * tests/integration/helpers/fixtures.js
 *
 * Generadores de datos únicos (para no chocar con unique:true en Mongo)
 * y archivos binarios mínimos válidos para subir como PDF/imagen.
 */
import { TEST_TAG } from './env.js';

let contador = 0;
const sufijo = () => {
  contador += 1;
  return `${Date.now()}${contador}${Math.floor(Math.random() * 1000)}`;
};

/** Correo único válido (debe terminar en @epn.edu.ec por el modelo). */
export const emailUnico = (prefijo = 'user') => `${TEST_TAG}.${prefijo}.${sufijo()}@epn.edu.ec`;

/** Cédula única de 10 dígitos (requerido por el validador de registro). */
export const cedulaUnica = () => {
  const base = sufijo().replace(/\D/g, '');
  return base.padEnd(10, '0').slice(0, 10);
};

/** Contraseña que cumple todas las reglas (mayúscula, minúscula, número, símbolo, 8-64). */
export const PASSWORD_VALIDA = 'Integracion123!';
export const PASSWORD_VALIDA_2 = 'OtraClave456#';

export const CARRERA_VALIDA = 'Desarrollo de Software';

/** Payload de registro estudiante, listo para POST /api/auth/register. */
export const payloadRegistro = ({ rol = 'estudiante', prefijo = 'reg' } = {}) => ({
  nombre: 'QA',
  apellido: 'Integracion',
  cedula: cedulaUnica(),
  email: emailUnico(prefijo),
  password: PASSWORD_VALIDA,
  rol,
  carrera: CARRERA_VALIDA,
});

/** PDF mínimo pero válido (mimetype application/pdf, abre en cualquier lector). */
export const bufferPDFDePrueba = () =>
  Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
      '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
      '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n' +
      'trailer<</Root 1 0 R>>\n%%EOF',
    'utf-8'
  );

/** PNG 1x1 válido (rojo), en binario real, para subir como imagen de prueba. */
export const bufferImagenDePrueba = () =>
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

export const proyectoValido = (overrides = {}) => ({
  titulo: `Proyecto QA Integracion ${sufijo()}`,
  descripcion: 'Descripción de prueba generada automáticamente por las pruebas de integración de QA.',
  categoria: 'academico',
  fechaInicio: '2026-01-10',
  fechaFin: '2026-06-10', // obligatoria y debe ser posterior a fechaInicio
  ...overrides,
});
