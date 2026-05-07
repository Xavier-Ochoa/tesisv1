import { body, param } from 'express-validator';

// Función helper para convertir string a array
const convertirStringAArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    // Separar por comas, limpiar espacios y filtrar vacíos
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

/**
 * Validaciones BÁSICAS para crear un proyecto
 * Solo valida campos esenciales según el modelo Proyecto
 */
export const validarCrearProyecto = [
  // Título (campo obligatorio en el modelo)
  body('titulo')
    .trim()
    .notEmpty().withMessage('El título del proyecto es obligatorio')
    .isLength({ min: 5, max: 200 }).withMessage('El título debe tener entre 5 y 200 caracteres'),

  // Descripción (campo obligatorio en el modelo)
  body('descripcion')
    .trim()
    .notEmpty().withMessage('La descripción es obligatoria')
    .isLength({ min: 20, max: 2000 }).withMessage('La descripción debe tener entre 20 y 2000 caracteres'),

  // Categoría (campo obligatorio en el modelo)
  body('categoria')
    .notEmpty().withMessage('La categoría es obligatoria')
    .isIn(['academico', 'extracurricular']).withMessage('La categoría debe ser "academico" o "extracurricular"'),

  // Fecha de inicio (campo obligatorio en el modelo)
  body('fechaInicio')
    .notEmpty().withMessage('La fecha de inicio es obligatoria')
    .isISO8601().withMessage('La fecha de inicio debe tener formato válido (YYYY-MM-DD)'),

  // Carrera (campo obligatorio en el modelo)
  body('carrera')
    .trim()
    .notEmpty().withMessage('La carrera es obligatoria'),

  // Campos opcionales
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

  // TECNOLOGÍAS - Versión corregida que acepta string o array
  body('tecnologias')
    .optional()
    .customSanitizer((value) => {
      return convertirStringAArray(value);
    })
    .custom((tecnologias) => {
      return validarElementosArray(tecnologias, 'tecnologías');
    }),

  body('repositorio')
    .optional()
    .trim()
    .custom((value) => {
      if (value && value.length > 0) {
        const urlPattern = /^https?:\/\/.+/i;
        if (!urlPattern.test(value)) {
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
        const urlPattern = /^https?:\/\/.+/i;
        if (!urlPattern.test(value)) {
          throw new Error('El enlace demo debe ser una URL válida');
        }
      }
      return true;
    }),

  // TAGS - Versión corregida que acepta string o array
  body('tags')
    .optional()
    .customSanitizer((value) => {
      return convertirStringAArray(value);
    })
    .custom((tags) => {
      return validarElementosArray(tags, 'tags');
    }),

  body('nivel')
    .optional()
    .isInt({ min: 1, max: 6 }).withMessage('El nivel debe ser un número entre 1 y 6'),

  body('publico')
    .optional()
    .custom((value) => {
      // Acepta string "true"/"false" o boolean
      if (value === undefined || value === null || value === '') {
        return true; // Opcional, puede estar vacío
      }
      if (typeof value === 'boolean') return true;
      if (typeof value === 'string') {
        const lowerValue = value.toLowerCase();
        if (lowerValue === 'true' || lowerValue === 'false') return true;
      }
      throw new Error('El campo público debe ser verdadero o falso');
    }),

  body('docente.nombre')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('El nombre del docente no puede exceder 200 caracteres'),

  body('docente.email')
    .optional()
    .trim()
    .isEmail().withMessage('El email del docente debe ser válido')
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

  // TECNOLOGÍAS - Versión corregida para actualizar
  body('tecnologias')
    .optional()
    .customSanitizer((value) => {
      return convertirStringAArray(value);
    })
    .custom((tecnologias) => {
      return validarElementosArray(tecnologias, 'tecnologías');
    }),

  body('repositorio')
    .optional()
    .trim()
    .custom((value) => {
      if (value && value.length > 0) {
        const urlPattern = /^https?:\/\/.+/i;
        if (!urlPattern.test(value)) {
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
        const urlPattern = /^https?:\/\/.+/i;
        if (!urlPattern.test(value)) {
          throw new Error('El enlace demo debe ser una URL válida');
        }
      }
      return true;
    })
];

/**
 * Validaciones para agregar comentario
 * IMPORTANTE: El controlador usa el campo "texto", no "contenido"
 */
export const validarAgregarComentario = [
  param('id')
    .isMongoId().withMessage('ID de proyecto inválido'),

  body('texto')
    .trim()
    .notEmpty().withMessage('El comentario no puede estar vacío')
    .isLength({ min: 3, max: 500 }).withMessage('El comentario debe tener entre 3 y 500 caracteres')
];

/**
 * Validaciones para subir imágenes del proyecto
 */
export const validarSubirImagenesProyecto = [
  param('id')
    .isMongoId().withMessage('ID de proyecto inválido'),
  
  // Validar que se haya enviado al menos una imagen
  body()
    .custom((value, { req }) => {
      if (!req.files || !req.files.imagenes) {
        throw new Error('Debe enviar al menos una imagen');
      }
      
      // Si es un solo archivo, convertirlo a array
      if (!Array.isArray(req.files.imagenes)) {
        req.files.imagenes = [req.files.imagenes];
      }
      
      // Validar tipos de archivo
      const tiposPermitidos = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
      const archivosInvalidos = req.files.imagenes.filter(file => 
        !tiposPermitidos.includes(file.mimetype)
      );
      
      if (archivosInvalidos.length > 0) {
        throw new Error('Solo se permiten imágenes JPG, PNG o WEBP');
      }
      
      // Validar tamaño (máximo 5MB por imagen)
      const maxSize = 5 * 1024 * 1024; // 5MB
      const archivosGrandes = req.files.imagenes.filter(file => 
        file.size > maxSize
      );
      
      if (archivosGrandes.length > 0) {
        throw new Error('Las imágenes no deben superar los 5MB cada una');
      }
      
      return true;
    })
];