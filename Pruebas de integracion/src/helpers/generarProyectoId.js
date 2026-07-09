import Proyecto from '../models/Proyecto.js';

/**
 * Prefijos por carrera (nuevos códigos TS*)
 */
const PREFIJOS_CARRERA = {
  'Agua y Saneamiento Ambiental':          'TSASA',
  'Desarrollo de Software':                'TSDS',
  'Electromecánica':                       'TSEM',
  'Redes y Telecomunicaciones':            'TSRT',
  'Procesamiento de Alimentos':            'TSIA',
  'Procesamiento Industrial de la Madera': 'TSPIM',
};

/**
 * Genera el siguiente proyecto_id.
 *
 * Formato: PREFIJO-AÑO-SECUENCIAL  →  TSDS-2026-001
 *
 * El contador es GLOBAL (todas las carreras juntas) y se reinicia cada año.
 * Se busca el último proyecto_id del año en curso y se incrementa en 1.
 *
 * @param {string} carrera  Nombre completo de la carrera
 * @returns {Promise<string>}
 */
export const generarProyectoId = async (carrera) => {
  const prefijo = PREFIJOS_CARRERA[carrera];
  if (!prefijo) throw new Error(`Carrera no reconocida para generar proyecto_id: ${carrera}`);

  const anio = new Date().getFullYear().toString(); // '2026'

  // Buscar todos los proyecto_id del año actual (sin importar carrera)
  // para obtener el máximo secuencial global.
  // proyecto_id tiene el formato XXXX-YYYY-NNN (prefijo variable)
  const regex = new RegExp(`^[A-Z]+-${anio}-\\d+$`);

  // Obtener TODOS los del año y encontrar el máximo numérico real
  const todos = await Proyecto.find(
    { proyecto_id: { $regex: regex } },
    { proyecto_id: 1 },
  ).lean();

  let maximo = 0;
  for (const p of todos) {
    const partes = p.proyecto_id?.split('-');
    const num = parseInt(partes?.[partes.length - 1], 10);
    if (!isNaN(num) && num > maximo) maximo = num;
  }

  const MAX_INTENTOS = 10;

  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    const secuencial = String(maximo + 1 + intento).padStart(3, '0');
    const candidato = `${prefijo}-${anio}-${secuencial}`;

    const existe = await Proyecto.exists({ proyecto_id: candidato, version: '001' });
    if (!existe) return candidato;
  }

  throw new Error(`No se pudo generar un proyecto_id único después de ${MAX_INTENTOS} intentos`);
};

/**
 * Dado el proyecto_id de la versión anterior, calcula la nueva versión.
 * Busca la versión más alta registrada con ese proyecto_id y suma 1.
 *
 * @param {string} proyectoId
 * @returns {Promise<string>}  '002', '003' …
 */
export const siguienteVersion = async (proyectoId) => {
  const ultimo = await Proyecto.findOne(
    { proyecto_id: proyectoId },
    { version: 1 },
  ).sort({ version: -1 }).lean();

  if (!ultimo?.version) return '001';
  const num = parseInt(ultimo.version, 10);
  return String(isNaN(num) ? 1 : num + 1).padStart(3, '0');
};
