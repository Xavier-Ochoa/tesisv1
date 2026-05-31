import { body } from 'express-validator';
import Estudiante from '../models/Estudiante.js';

/**
 * Reglas reutilizables para validar una contraseña nueva
 * Se aplican en: cambiarPassword (logueado) y crearNuevoPassword (recuperación)
 */
const reglasPassword = (campo) =>
  body(campo)
    .notEmpty().withMessage('La contraseña es obligatoria')
    .isLength({ min: 8, max: 64 }).withMessage('La contraseña debe tener entre 8 y 64 caracteres')
    .matches(/[A-Z]/).withMessage('La contraseña debe contener al menos una letra mayúscula')
    .matches(/[a-z]/).withMessage('La contraseña debe contener al menos una letra minúscula')
    .matches(/[0-9]/).withMessage('La contraseña debe contener al menos un número')
    .matches(/[^A-Za-z0-9]/).withMessage('La contraseña debe contener al menos un símbolo (ej: @, #, !)');

/**
 * Validaciones para el endpoint de REGISTRO
 *
 * Campos obligatorios: nombre, apellido, cedula, correoInstitucional (o email), contraseña (o password), rol
 * El controlador mapea correoInstitucional → email  y  contraseña → password
 * antes de guardar en la base de datos.
 */
export const validarRegistro = [

  body('nombre')
    .trim()
    .notEmpty().withMessage('El nombre es obligatorio')
    .isLength({ min: 2 }).withMessage('El nombre debe tener al menos 2 caracteres'),

  body('apellido')
    .trim()
    .notEmpty().withMessage('El apellido es obligatorio')
    .isLength({ min: 2 }).withMessage('El apellido debe tener al menos 2 caracteres'),

  body('cedula')
    .trim()
    .notEmpty().withMessage('La cédula es obligatoria')
    .matches(/^\d{10}$/).withMessage('La cédula debe tener exactamente 10 dígitos numéricos')
    .custom(async (cedula) => {
      const existe = await Estudiante.findOne({ cedula });
      if (existe) throw new Error('Esta cédula ya está registrada');
      return true;
    }),

  // Acepta tanto 'correoInstitucional' como 'email' en el body
  body('correoInstitucional')
    .if(body('email').not().exists())  // solo valida si no viene 'email'
    .trim()
    .notEmpty().withMessage('El correo institucional es obligatorio')
    .isEmail().withMessage('Debe ser un correo válido')
    .normalizeEmail({ gmail_remove_dots: false })
    .matches(/@epn\.edu\.ec$/).withMessage('El correo debe ser institucional (@epn.edu.ec)')
    .custom(async (correo) => {
      const existe = await Estudiante.findOne({ email: correo.toLowerCase() });
      if (existe) throw new Error('Este correo ya está registrado');
      return true;
    }),

  body('email')
    .if(body('correoInstitucional').not().exists())  // solo valida si no viene 'correoInstitucional'
    .trim()
    .notEmpty().withMessage('El correo institucional es obligatorio')
    .isEmail().withMessage('Debe ser un correo válido')
    .normalizeEmail({ gmail_remove_dots: false })
    .matches(/@epn\.edu\.ec$/).withMessage('El correo debe ser institucional (@epn.edu.ec)')
    .custom(async (correo) => {
      const existe = await Estudiante.findOne({ email: correo.toLowerCase() });
      if (existe) throw new Error('Este correo ya está registrado');
      return true;
    }),

  // Acepta tanto 'contraseña' como 'password' en el body
  body(['contraseña', 'password'])
    .optional({ checkFalsy: false })
    .notEmpty().withMessage('La contraseña es obligatoria')
    .isLength({ min: 8, max: 64 }).withMessage('La contraseña debe tener entre 8 y 64 caracteres')
    .matches(/[A-Z]/).withMessage('La contraseña debe contener al menos una letra mayúscula')
    .matches(/[a-z]/).withMessage('La contraseña debe contener al menos una letra minúscula')
    .matches(/[0-9]/).withMessage('La contraseña debe contener al menos un número')
    .matches(/[^A-Za-z0-9]/).withMessage('La contraseña debe contener al menos un símbolo (ej: @, #, !)'),

  body('rol')
    .optional()
    .trim()
    .isIn(['estudiante', 'docente']).withMessage('El rol debe ser "estudiante" o "docente"'),
];

/**
 * Validaciones para ACTUALIZAR PERFIL
 * Todos los campos son opcionales — solo se validan si se envían
 */
export const validarActualizarPerfil = [

  body('carrera')
    .optional()
    .trim()
    .notEmpty().withMessage('La carrera no puede ser un valor vacío')
    .isIn([
      'Agua y Saneamiento Ambiental',
      'Desarrollo de Software',
      'Electromecánica',
      'Redes y Telecomunicaciones',
      'Procesamiento de Alimentos',
      'Procesamiento Industrial de la Madera',
    ]).withMessage('La carrera no es válida. Las opciones permitidas son: Agua y Saneamiento Ambiental, Desarrollo de Software, Electromecánica, Redes y Telecomunicaciones, Procesamiento de Alimentos, Procesamiento Industrial de la Madera'),

  body('semestre')
    .optional()
    .isInt({ min: 0, max: 5 }).withMessage('El semestre debe ser un número entre 0 y 5'),

  body('telefono')
    .optional()
    .trim()
    .matches(/^\d{10}$/).withMessage('El teléfono debe tener exactamente 10 dígitos'),

  body('descripcion')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('La descripción no puede exceder 500 caracteres'),

  body('github')
    .optional()
    .trim()
    .notEmpty().withMessage('El usuario de GitHub no puede ser un valor vacío'),

  // Campos bloqueados — devuelve error claro si se intenta modificar
  body('nombre')
    .not().exists()
    .withMessage('El nombre no puede modificarse después del registro'),

  body('apellido')
    .not().exists()
    .withMessage('El apellido no puede modificarse después del registro'),

  body('correoInstitucional')
    .not().exists()
    .withMessage('El correo institucional no puede modificarse después del registro'),

  body('email')
    .not().exists()
    .withMessage('El correo institucional no puede modificarse después del registro'),

  body('cedula')
    .not().exists()
    .withMessage('La cédula no puede modificarse después del registro'),

  body('rol')
    .not().exists()
    .withMessage('El rol no puede modificarse'),
];

/**
 * Validaciones para CAMBIAR CONTRASEÑA (usuario logueado)
 * PUT /api/auth/password
 * Body: passwordactual (o contraseñaActual), passwordnuevo (o contraseñaNueva), confirmarPassword
 *
 * Acepta los alias que ya usa el controlador:
 *   passwordactual   | contraseñaActual
 *   passwordnuevo    | contraseñaNueva
 */
export const validarCambiarPassword = [

  // Contraseña actual — cualquiera de los dos aliases es válido, no ambos obligatorios
  body('passwordactual').optional({ checkFalsy: true }),
  body('contraseñaActual').optional({ checkFalsy: true }),
  body('passwordactual').custom((value, { req }) => {
    const actual = value || req.body['contraseñaActual'];
    if (!actual || actual.trim() === '') {
      throw new Error('La contraseña actual es obligatoria');
    }
    return true;
  }),

  // Nueva contraseña — validar ambos aliases juntos con las mismas reglas
  // corre si cualquiera de los dos llega con valor
  body(['passwordnuevo', 'contraseñaNueva'])
    .optional({ checkFalsy: true })
    .isLength({ min: 8, max: 64 }).withMessage('La contraseña debe tener entre 8 y 64 caracteres')
    .matches(/[A-Z]/).withMessage('La contraseña debe contener al menos una letra mayúscula')
    .matches(/[a-z]/).withMessage('La contraseña debe contener al menos una letra minúscula')
    .matches(/[0-9]/).withMessage('La contraseña debe contener al menos un número')
    .matches(/[^A-Za-z0-9]/).withMessage('La contraseña debe contener al menos un símbolo (ej: @, #, !)'),

  // Confirmación — verifica que la nueva contraseña llegó y que coincide
  body('confirmarPassword')
    .notEmpty().withMessage('Debes confirmar la nueva contraseña')
    .custom((value, { req }) => {
      const nueva = req.body.passwordnuevo || req.body['contraseñaNueva'];
      if (!nueva || nueva.trim() === '') {
        throw new Error('La nueva contraseña es obligatoria');
      }
      if (value !== nueva) {
        throw new Error('Las contraseñas no coinciden');
      }
      return true;
    }),
];

/**
 * Validaciones para CREAR NUEVA CONTRASEÑA tras recuperación (usuario NO logueado)
 * POST /api/auth/nuevopassword/:token
 * Body: password, confirmpassword
 */
export const validarNuevoPassword = [

  // Nueva contraseña — aplicar todas las reglas de seguridad
  reglasPassword('password'),

  // Confirmación — obligatoria y debe coincidir
  body('confirmpassword')
    .notEmpty().withMessage('Debes confirmar la nueva contraseña')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Las contraseñas no coinciden');
      }
      return true;
    }),
];
