import { body, param } from 'express-validator';

const convertirStringAArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(',').map(item => item.trim()).filter(item => item.length > 0);
  return [];
};

const validarElementosArray = (elementos, campo) => {
  if (!Array.isArray(elementos)) throw new Error(`Las ${campo} deben ser un array o string separado por comas`);
  if (elementos.length > 0) {
    const todosValidos = elementos.every(item => typeof item === 'string' && item.trim().length > 0);
    if (!todosValidos) throw new Error(`Todas las ${campo} deben ser texto válido`);
  }
  return true;
};

const validarImagenesOpcionales = body().custom((value, { req }) => {
  if (!req.files?.imagenes) return true;
  const archivos = Array.isArray(req.files.imagenes) ? req.files.imagenes : [req.files.imagenes];
  if (archivos.length > 5) throw new Error('Solo se permiten máximo 5 imágenes por proyecto');
  const tiposPermitidos = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
  if (archivos.some(f => !tiposPermitidos.includes(f.mimetype))) throw new Error('Solo se permiten imágenes en formato JPG, PNG o WEBP');
  if (archivos.some(f => f.size > 5 * 1024 * 1024)) throw new Error('Cada imagen no debe superar los 5 MB');
  return true;
});

// enviarAlAdmin: boolean (true/false), no requerido en creación (default false)
const validarEnviarAlAdmin = body('enviarAlAdmin')
  .optional()
  .custom((value) => {
    if (value === true || value === false || value === 'true' || value === 'false') return true;
    throw new Error('El campo enviarAlAdmin debe ser true o false');
  });

const validarURL = (campo) =>
  body(campo).optional().trim().custom((value) => {
    if (value && value.length > 0 && !/^https?:\/\/.+/i.test(value)) throw new Error(`El campo ${campo} debe ser una URL válida`);
    return true;
  });

// ── CREAR PROYECTO ──────────────────────────────────────────────────────────
export const validarCrearProyecto = [
  body('titulo').trim().notEmpty().withMessage('El título del proyecto es obligatorio').isLength({ min: 5, max: 200 }).withMessage('El título debe tener entre 5 y 200 caracteres'),
  body('descripcion').trim().notEmpty().withMessage('La descripción es obligatoria').isLength({ min: 20, max: 2000 }).withMessage('La descripción debe tener entre 20 y 2000 caracteres'),
  body('categoria').notEmpty().withMessage('La categoría es obligatoria').isIn(['academico', 'extracurricular']).withMessage('La categoría debe ser "academico" o "extracurricular"'),
  body('fechaInicio').notEmpty().withMessage('La fecha de inicio es obligatoria').isISO8601().withMessage('La fecha de inicio debe tener formato válido (YYYY-MM-DD)'),
  body('carrera').trim().notEmpty().withMessage('La carrera es obligatoria').isIn([
    'Agua y Saneamiento Ambiental', 'Desarrollo de Software', 'Electromecánica',
    'Redes y Telecomunicaciones', 'Procesamiento de Alimentos', 'Procesamiento Industrial de la Madera',
  ]).withMessage('La carrera no es válida'),
  body('lineaInvestigacion').optional().trim().isLength({ max: 200 }).withMessage('La línea de investigación no puede exceder 200 caracteres'),
  body('fechaFin').optional().isISO8601().withMessage('La fecha de fin debe tener formato válido').custom((fechaFin, { req }) => {
    if (req.body.fechaInicio && fechaFin && new Date(fechaFin) < new Date(req.body.fechaInicio)) throw new Error('La fecha de fin debe ser posterior a la fecha de inicio');
    return true;
  }),
  body('tecnologias').optional().customSanitizer(convertirStringAArray).custom((v) => validarElementosArray(v, 'tecnologías')),
  validarURL('repositorio'),
  validarURL('enlaceDemo'),
  body('tags').optional().customSanitizer(convertirStringAArray).custom((v) => validarElementosArray(v, 'tags')),
  validarEnviarAlAdmin,
  validarImagenesOpcionales,
];

// ── ACTUALIZAR PROYECTO ─────────────────────────────────────────────────────
export const validarActualizarProyecto = [
  param('id').isMongoId().withMessage('ID de proyecto inválido'),
  body('titulo').optional().trim().isLength({ min: 5, max: 200 }).withMessage('El título debe tener entre 5 y 200 caracteres'),
  body('descripcion').optional().trim().isLength({ min: 20, max: 2000 }).withMessage('La descripción debe tener entre 20 y 2000 caracteres'),
  body('categoria').optional().isIn(['academico', 'extracurricular']).withMessage('La categoría debe ser "academico" o "extracurricular"'),
  body('carrera').optional().trim().isIn([
    'Agua y Saneamiento Ambiental', 'Desarrollo de Software', 'Electromecánica',
    'Redes y Telecomunicaciones', 'Procesamiento de Alimentos', 'Procesamiento Industrial de la Madera',
  ]).withMessage('La carrera no es válida'),
  body('lineaInvestigacion').optional().trim().isLength({ max: 200 }).withMessage('La línea de investigación no puede exceder 200 caracteres'),
  body('fechaInicio').optional().isISO8601().withMessage('La fecha de inicio debe tener formato válido'),
  body('fechaFin').optional().isISO8601().withMessage('La fecha de fin debe tener formato válido'),
  body('tecnologias').optional().customSanitizer(convertirStringAArray).custom((v) => validarElementosArray(v, 'tecnologías')),
  validarURL('repositorio'),
  validarURL('enlaceDemo'),
  body('tags').optional().customSanitizer(convertirStringAArray).custom((v) => validarElementosArray(v, 'tags')),
  validarEnviarAlAdmin,
  validarImagenesOpcionales,
];

export const validarAgregarComentario = [
  param('id').isMongoId().withMessage('ID de proyecto inválido'),
  body('texto').trim().notEmpty().withMessage('El comentario no puede estar vacío').isLength({ min: 3, max: 500 }).withMessage('El comentario debe tener entre 3 y 500 caracteres'),
];

export const validarSubirImagenesProyecto = [
  param('id').isMongoId().withMessage('ID de proyecto inválido'),
  body().custom((value, { req }) => {
    if (!req.files?.imagenes) throw new Error('Debe enviar al menos una imagen');
    if (!Array.isArray(req.files.imagenes)) req.files.imagenes = [req.files.imagenes];
    const tiposPermitidos = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (req.files.imagenes.some(f => !tiposPermitidos.includes(f.mimetype))) throw new Error('Solo se permiten imágenes JPG, PNG o WEBP');
    if (req.files.imagenes.some(f => f.size > 5 * 1024 * 1024)) throw new Error('Las imágenes no deben superar los 5 MB cada una');
    return true;
  }),
];
