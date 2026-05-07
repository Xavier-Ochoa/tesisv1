import mongoose from 'mongoose';

const donacionSchema = mongoose.Schema(
  {
    donanteNombre: {
      type: String,
      trim: true,
      maxlength: 100,
      default: 'Anónimo',
    },
    monto: {
      type: Number,
      required: true,
      min: 1,
    },
    mensaje: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    stripePaymentIntentId: {
      type: String,
      required: true,
    },
    estado: {
      type: String,
      enum: ['exitosa', 'fallida'],
      default: 'exitosa',
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Donacion', donacionSchema);