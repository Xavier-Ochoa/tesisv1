import { Schema, model } from 'mongoose';

/**
 * Modelo de Proyecto Académico/Extracurricular para ESFOT
 *
 * Versionado: cada versión es un documento separado.
 * Todos los documentos de un mismo proyecto comparten `proyecto_id`.
 * Solo el documento con `esUltimaVersion: true` puede modificarse.
 */

const proyectoSchema = new Schema(
  {
    // ── Código único generado al crear la primera versión ───────────────────
    // Formato: PREFIJO-AÑO-SECUENCIAL  →  DSW-2026-001
    // Se copia igual en todas las versiones del mismo proyecto.
    proyecto_id: {
      type: String,
      trim: true,
      index: true,
    },

    // ── Versión del documento ────────────────────────────────────────────────
    // '001', '002', '003' …
    version: {
      type: String,
      default: '001',
    },

    // ── Marca de última versión ──────────────────────────────────────────────
    // Solo el documento con esUltimaVersion=true puede editarse.
    esUltimaVersion: {
      type: Boolean,
      default: true,
      index: true,
    },

    // ── Información básica ───────────────────────────────────────────────────
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

    // ── Tipo de proyecto ─────────────────────────────────────────────────────
    categoria: {
      type: String,
      required: true,
      enum: {
        values: ['academico', 'extracurricular'],
        message: '{VALUE} no es una categoría válida',
      },
    },

    // ── Línea de investigación ───────────────────────────────────────────────
    lineaInvestigacion: {
      type: String,
      trim: true,
    },

    // ── Autor principal ──────────────────────────────────────────────────────
    autor: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario',
      required: [true, 'El autor del proyecto es obligatorio'],
    },

    // ── Colaboradores ────────────────────────────────────────────────────────
    colaboradores: [{
      type: Schema.Types.ObjectId,
      ref: 'Usuario',
    }],

    // ── Fechas ───────────────────────────────────────────────────────────────
    fechaInicio: {
      type: Date,
      required: [true, 'La fecha de inicio es obligatoria'],
    },

    fechaFin: {
      type: Date,
    },

    // ── Estado de revisión ───────────────────────────────────────────────────
    estado: {
      type: String,
      enum: ['pendiente', 'aprobado', 'rechazado'],
      default: 'pendiente',
    },

    motivoRechazo: {
      type: String,
      default: '',
    },

    // ── Tipo de proyecto: público o privado ──────────────────────────────────
    // publico  → visible para el admin y (si aprobado) en la landing page
    // privado  → invisible para el admin; solo el autor/colaboradores lo ven
    // Default: 'privado'
    tipoProyecto: {
      type: String,
      enum: {
        values: ['publico', 'privado'],
        message: '{VALUE} no es un tipo de proyecto válido. Usa "publico" o "privado"',
      },
      default: 'privado',
    },

    // ── Borrado lógico ───────────────────────────────────────────────────────
    // false = desactivado (no aparece en ninguna consulta normal)
    activo: {
      type: Boolean,
      default: true,
      index: true,
    },

    // ── Recursos multimedia ──────────────────────────────────────────────────
    imagenes: [{
      type: String,
    }],

    imagenesID: [{
      type: String,
    }],

    documentos: [{
      nombre: String,
      url: String,
      tipo: String,
    }],

    // ── Tecnologías ──────────────────────────────────────────────────────────
    tecnologias: [{
      type: String,
      trim: true,
    }],

    // ── Enlaces externos ─────────────────────────────────────────────────────
    repositorio: {
      type: String,
      trim: true,
    },

    enlaceDemo: {
      type: String,
      trim: true,
    },

    // ── Tags ─────────────────────────────────────────────────────────────────
    tags: [{
      type: String,
      trim: true,
      lowercase: true,
    }],

    // ── Carrera ──────────────────────────────────────────────────────────────
    carrera: {
      type: String,
      required: true,
      enum: {
        values: [
          'Agua y Saneamiento Ambiental',
          'Desarrollo de Software',
          'Electromecánica',
          'Redes y Telecomunicaciones',
          'Procesamiento de Alimentos',
          'Procesamiento Industrial de la madera',
        ],
        message: 'La carrera "{VALUE}" no es válida.',
      },
    },

    // ── Estadísticas ─────────────────────────────────────────────────────────
    vistas: {
      type: Number,
      default: 0,
    },

    likes: [{
      type: Schema.Types.ObjectId,
      ref: 'Usuario',
    }],

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

// ── Índices ───────────────────────────────────────────────────────────────────
proyectoSchema.index({ titulo: 'text', descripcion: 'text', tags: 'text' });
proyectoSchema.index({ categoria: 1, estado: 1 });
proyectoSchema.index({ autor: 1 });
proyectoSchema.index({ carrera: 1 });
proyectoSchema.index({ proyecto_id: 1, version: 1 }, { unique: true, sparse: true });
proyectoSchema.index({ proyecto_id: 1, esUltimaVersion: 1 });

// ── Métodos ───────────────────────────────────────────────────────────────────
proyectoSchema.methods.incrementarVistas = async function () {
  this.vistas += 1;
  return await this.save();
};

proyectoSchema.methods.agregarLike = async function (estudianteId) {
  if (!this.likes.includes(estudianteId)) {
    this.likes.push(estudianteId);
    return await this.save();
  }
  return this;
};

proyectoSchema.methods.quitarLike = async function (estudianteId) {
  this.likes = this.likes.filter(id => id.toString() !== estudianteId.toString());
  return await this.save();
};

export default model('Proyecto', proyectoSchema);
