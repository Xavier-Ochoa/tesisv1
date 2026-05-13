import { body, param } from 'express-validator';

// Función helper para convertir string a array
const convertirStringAArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value.split(',')
      .map(item => item.trim())
      .filter(item => item.length > 0);
  }
  return [];
};

// Función helper para validar tecnologías/tags
const validarElementosArray = (elementos, campo) => {
  if (!Array.isArray(elementos)) {
    throw new Error(`Las ${campo} deben ser un array o string separado por comas`);
  }
  if (elementos.length > 0) {
    const todosValidos = elementos.every(item =>
      typeof item === 'string' && item.trim().length > 0
    );
    if (!todosValidos) {
      throw new Error(`Todas las ${campo} deben ser texto válido`);
    }
  }
  return true;
};

// Helper reutilizable para validar el campo publico
const validarCampoPublico = body('publico')
  .optional()
  .custom((value) => {
    if (value === undefined || value === null || value === '') return true;
    if (typeof value === 'boolean') return true;
    if (typeof value === 'string') {
      const lowerValue = value.toLowerCase();
      if (lowerValue === 'true' || lowerValue === 'false') return true;
    }
    throw new Error('El campo público debe ser verdadero o falso');
  });

/**
 * Validaciones para crear un proyecto
 */
export const validarCrearProyecto = [
  body('titulo')
    .trim()
    .notEmpty().withMessage('El título del proyecto es obligatorio')
    .isLength({ min: 5, max: 200 }).withMessage('El título debe tener entre 5 y 200 caracteres'),

  body('descripcion')
    .trim()
    .notEmpty().withMessage('La descripción es obligatoria')
    .isLength({ min: 20, max: 2000 }).withMessage('La descripción debe tener entre 20 y 2000 caracteres'),

  body('categoria')
    .notEmpty().withMessage('La categoría es obligatoria')
    .isIn(['academico', 'extracurricular']).withMessage('La categoría debe ser "academico" o "extracurricular"'),

  body('fechaInicio')
    .notEmpty().withMessage('La fecha de inicio es obligatoria')
    .isISO8601().withMessage('La fecha de inicio debe tener formato válido (YYYY-MM-DD)'),

  body('carrera')
    .trim()
    .notEmpty().withMessage('La carrera es obligatoria'),

  body('asignatura')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('La asignatura no puede exceder 200 caracteres'),

  body('fechaFin')
    .optional()
    .isISO8601().withMessage('La fecha de fin debe tener formato válido (YYYY-MM-DD)')
    .custom((fechaFin, { req }) => {
      if (req.body.fechaInicio && fechaFin) {
        if (new Date(fechaFin) < new Date(req.body.fechaInicio)) {
          throw new Error('La fecha de fin debe ser posterior a la fecha de inicio');
        }
      }
      return true;
    }),

  body('tecnologias')
    .optional()
    .customSanitizer((value) => convertirStringAArray(value))
    .custom((tecnologias) => validarElementosArray(tecnologias, 'tecnologías')),

  body('repositorio')
    .optional()
    .trim()
    .custom((value) => {
      if (value && value.length > 0) {
        if (!/^https?:\/\/.+/i.test(value)) {
          throw new Error('El repositorio debe ser una URL válida');
        }
      }
      return true;
    }),

  body('enlaceDemo')
    .optional()
    .trim()
    .custom((value) => {
      if (value && value.length > 0) {
        if (!/^https?:\/\/.+/i.test(value)) {
          throw new Error('El enlace demo debe ser una URL válida');
        }
      }
      return true;
    }),

  body('tags')
    .optional()
    .customSanitizer((value) => convertirStringAArray(value))
    .custom((tags) => validarElementosArray(tags, 'tags')),

  body('nivel')
    .optional()
    .isInt({ min: 1, max: 6 }).withMessage('El nivel debe ser un número entre 1 y 6'),

  // ISSUE 1 FIX: usando el helper reutilizable
  validarCampoPublico,
];

/**
 * Validaciones para actualizar un proyecto
 */
export const validarActualizarProyecto = [
  param('id')
    .isMongoId().withMessage('ID de proyecto inválido'),

  body('titulo')
    .optional()
    .trim()
    .isLength({ min: 5, max: 200 }).withMessage('El título debe tener entre 5 y 200 caracteres'),

  body('descripcion')
    .optional()
    .trim()
    .isLength({ min: 20, max: 2000 }).withMessage('La descripción debe tener entre 20 y 2000 caracteres'),

  body('categoria')
    .optional()
    .isIn(['academico', 'extracurricular']).withMessage('La categoría debe ser "academico" o "extracurricular"'),

  body('fechaInicio')
    .optional()
    .isISO8601().withMessage('La fecha de inicio debe tener formato válido'),

  body('fechaFin')
    .optional()
    .isISO8601().withMessage('La fecha de fin debe tener formato válido'),

  body('tecnologias')
    .optional()
    .customSanitizer((value) => convertirStringAArray(value))
    .custom((tecnologias) => validarElementosArray(tecnologias, 'tecnologías')),

  body('repositorio')
    .optional()
    .trim()
    .custom((value) => {
      if (value && value.length > 0) {
        if (!/^https?:\/\/.+/i.test(value)) {
          throw new Error('El repositorio debe ser una URL válida');
        }
      }
      return true;
    }),

  body('enlaceDemo')
    .optional()
    .trim()
    .custom((value) => {
      if (value && value.length > 0) {
        if (!/^https?:\/\/.+/i.test(value)) {
          throw new Error('El enlace demo debe ser una URL válida');
        }
      }
      return true;
    }),

  // ISSUE 1 FIX: publico ahora también se valida en el update
  validarCampoPublico,
];

/**
 * Validaciones para agregar comentario
 */
export const validarAgregarComentario = [
  param('id')
    .isMongoId().withMessage('ID de proyecto inválido'),

  body('texto')
    .trim()
    .notEmpty().withMessage('El comentario no puede estar vacío')
    .isLength({ min: 3, max: 500 }).withMessage('El comentario debe tener entre 3 y 500 caracteres'),
];

/**
 * Validaciones para subir imágenes del proyecto
 */
export const validarSubirImagenesProyecto = [
  param('id')
    .isMongoId().withMessage('ID de proyecto inválido'),

  body()
    .custom((value, { req }) => {
      if (!req.files || !req.files.imagenes) {
        throw new Error('Debe enviar al menos una imagen');
      }

      if (!Array.isArray(req.files.imagenes)) {
        req.files.imagenes = [req.files.imagenes];
      }

      const tiposPermitidos = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
      const archivosInvalidos = req.files.imagenes.filter(file =>
        !tiposPermitidos.includes(file.mimetype)
      );
      if (archivosInvalidos.length > 0) {
        throw new Error('Solo se permiten imágenes JPG, PNG o WEBP');
      }

      const maxSize = 5 * 1024 * 1024;
      const archivosGrandes = req.files.imagenes.filter(file => file.size > maxSize);
      if (archivosGrandes.length > 0) {
        throw new Error('Las imágenes no deben superar los 5MB cada una');
      }

      return true;
    }),
];
