import { Schema, model } from 'mongoose';

/**
 * Modelo de Proyecto Académico/Extracurricular para ESFOT
 */

const proyectoSchema = new Schema(
  {
    // Información básica del proyecto
    titulo: {
      type: String,
      required: [true, 'El título del proyecto es obligatorio'],
      trim: true,
      maxlength: [200, 'El título no puede exceder 200 caracteres'],
    },
    
    descripcion: {
      type: String,
      required: [true, 'La descripción es obligatoria'],
      trim: true,
      maxlength: [2000, 'La descripción no puede exceder 2000 caracteres'],
    },

    // Tipo de proyecto
    categoria: {
      type: String,
      required: true,
      enum: {
        values: ['academico', 'extracurricular'],
        message: '{VALUE} no es una categoría válida'
      },
    },

    // Para proyectos académicos - asignatura relacionada
    asignatura: {
      type: String,
      trim: true,
    },

    // Estudiante autor principal
    autor: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario',
      required: [true, 'El autor del proyecto es obligatorio'],
    },

    // Colaboradores del proyecto
    colaboradores: [{
      type: Schema.Types.ObjectId,
      ref: 'Usuario',
    }],

    // Fechas del proyecto
    fechaInicio: {
      type: Date,
      required: [true, 'La fecha de inicio es obligatoria'],
    },

    fechaFin: {
      type: Date,
    },

    // Estado del proyecto - CAMBIO: default ahora es "en_progreso"
    estado: {
      type: String,
      enum: ['en_progreso', 'publicado'],
      default: 'en_progreso',
    },

    // Recursos multimedia - CAMBIO: estructura simplificada con publicId
    imagenes: [{
      type: String, // URL de Cloudinary
    }],
    
    // IDs públicos de Cloudinary para poder eliminar las imágenes
    imagenesID: [{
      type: String, // public_id de Cloudinary
    }],

    // Documentos relacionados
    documentos: [{
      nombre: String,
      url: String,
      tipo: String,
    }],

    // Tecnologías utilizadas
    tecnologias: [{
      type: String,
      trim: true,
    }],

    // Enlaces externos
    repositorio: {
      type: String,
      trim: true,
    },

    enlaceDemo: {
      type: String,
      trim: true,
    },

    // Tags para búsqueda
    tags: [{
      type: String,
      trim: true,
      lowercase: true,
    }],

    // Carrera
    carrera: {
      type: String,
      required: true,      
    },

    nivel: {
      type: Number,
      min: 1,
      max: 6,
    },

    // Visibilidad
    publico: {
      type: Boolean,
      default: true,
    },

    // Estadísticas
    vistas: {
      type: Number,
      default: 0,
    },

    // Likes
    likes: [{
      type: Schema.Types.ObjectId,
      ref: 'Usuario',
    }],

    // Comentarios
    comentarios: [{
      estudiante: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
      },
      texto: String,
      fecha: {
        type: Date,
        default: Date.now,
      },
    }],
  },
  {
    timestamps: true,
  }
);

// Índices para búsquedas
proyectoSchema.index({ titulo: 'text', descripcion: 'text', tags: 'text' });
proyectoSchema.index({ categoria: 1, estado: 1 });
proyectoSchema.index({ autor: 1 });
proyectoSchema.index({ carrera: 1 });

// Método para incrementar vistas
proyectoSchema.methods.incrementarVistas = async function() {
  this.vistas += 1;
  return await this.save();
};

// Método para agregar like
proyectoSchema.methods.agregarLike = async function(estudianteId) {
  if (!this.likes.includes(estudianteId)) {
    this.likes.push(estudianteId);
    return await this.save();
  }
  return this;
};

// Método para quitar like
proyectoSchema.methods.quitarLike = async function(estudianteId) {
  this.likes = this.likes.filter(id => id.toString() !== estudianteId.toString());
  return await this.save();
};

// IMPORTANTE: Export default al final
export default model('Proyecto', proyectoSchema);
