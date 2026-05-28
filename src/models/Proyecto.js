import { Schema, model } from 'mongoose';

const proyectoSchema = new Schema(
  {
    proyecto_id: { type: String, trim: true, index: true },
    version: { type: String, default: '001' },
    esUltimaVersion: { type: Boolean, default: true, index: true },

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
    categoria: {
      type: String,
      required: true,
      enum: { values: ['academico', 'extracurricular'], message: '{VALUE} no es una categoría válida' },
    },
    lineaInvestigacion: { type: String, trim: true },

    autor: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario',
      required: [true, 'El autor del proyecto es obligatorio'],
    },
    colaboradores: [{ type: Schema.Types.ObjectId, ref: 'Usuario' }],

    fechaInicio: { type: Date, required: [true, 'La fecha de inicio es obligatoria'] },
    fechaFin: { type: Date },

    estado: {
      type: String,
      enum: ['pendiente', 'aprobado', 'rechazado'],
      default: 'pendiente',
    },
    motivoRechazo: { type: String, default: '' },

    // ── enviarAlAdmin ─────────────────────────────────────────────────────────
    // false → solo el autor/colaboradores lo ven (antiguo 'privado')
    // true  → el admin puede revisarlo y aprobarlo/rechazarlo (antiguo 'publico')
    // Una vez activado no puede revertirse.
    enviarAlAdmin: {
      type: Boolean,
      default: false,
    },

    // ── publico ───────────────────────────────────────────────────────────────
    // true → aparece en la landing page (solo si estado='aprobado' y activo=true)
    // Solo el autor puede publicar, y solo cuando el proyecto está aprobado.
    // Una vez publicado no puede despublicarse.
    publico: {
      type: Boolean,
      default: false,
    },

    activo: { type: Boolean, default: true, index: true },

    imagenes: [{ type: String }],
    imagenesID: [{ type: String }],

    // ── documentos PDF (GridFS) ────────────────────────────────────────────────
    // Máximo 1 PDF por proyecto (se reemplaza al subir uno nuevo).
    // fileId referencia el _id en proyectos_docs.files de GridFS.
    documentos: [
      {
        filename:    { type: String },
        fileId:      { type: Schema.Types.ObjectId },
        uploadDate:  { type: Date, default: Date.now },
        contentType: { type: String, default: 'application/pdf' },
        size:        { type: Number },       // bytes
      },
    ],

    tecnologias: [{ type: String, trim: true }],
    repositorio: { type: String, trim: true },
    enlaceDemo: { type: String, trim: true },
    tags: [{ type: String, trim: true, lowercase: true }],

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
          'Procesamiento Industrial de la Madera',
        ],
        message: 'La carrera "{VALUE}" no es válida.',
      },
    },

    vistas: { type: Number, default: 0 },
    likes: [{ type: Schema.Types.ObjectId, ref: 'Usuario' }],
    comentarios: [{
      estudiante: { type: Schema.Types.ObjectId, ref: 'Usuario' },
      texto: String,
      fecha: { type: Date, default: Date.now },
    }],
  },
  { timestamps: true }
);

proyectoSchema.index({ titulo: 'text', descripcion: 'text', tags: 'text' });
proyectoSchema.index({ categoria: 1, estado: 1 });
proyectoSchema.index({ autor: 1 });
proyectoSchema.index({ carrera: 1 });
proyectoSchema.index({ proyecto_id: 1, version: 1 }, { unique: true, sparse: true });
proyectoSchema.index({ proyecto_id: 1, esUltimaVersion: 1 });

proyectoSchema.methods.incrementarVistas = async function () {
  this.vistas += 1;
  return await this.save();
};
proyectoSchema.methods.agregarLike = async function (estudianteId) {
  if (!this.likes.includes(estudianteId)) { this.likes.push(estudianteId); return await this.save(); }
  return this;
};
proyectoSchema.methods.quitarLike = async function (estudianteId) {
  this.likes = this.likes.filter(id => id.toString() !== estudianteId.toString());
  return await this.save();
};

export default model('Proyecto', proyectoSchema);
