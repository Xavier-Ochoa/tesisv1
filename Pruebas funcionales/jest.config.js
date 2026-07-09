/**
 * jest.config.js
 *
 * Activa el reporter personalizado (tests/reporter.js) que agrupa los
 * resultados por SPRINT y, dentro de cada sprint, por Figura/Endpoint
 * según tests/figuras.json. Pensado para capturar pantalla del resultado
 * de cada endpoint en el mismo orden que el documento de resultados.
 *
 * Mantiene además el reporter "default" de Jest, así seguís viendo el
 * resumen final estándar (Test Suites / Tests / Time) al final.
 */
export default {
  testEnvironment: 'node',
  reporters: [
    'default',
    '<rootDir>/tests/reporter.js',
  ],
  // Evita que Jest intente transformar con Babel (el proyecto usa ESM nativo)
  transform: {},
};
