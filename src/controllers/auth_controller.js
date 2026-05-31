import { Schema, model } from 'mongoose';
import bcrypt from 'bcryptjs';

/**
 * Modelo de Usuario — colección 'usuarios'
 *
 * Separación clara entre:
 *   - Campos de REGISTRO (obligatorios, enviados por el usuario al crear cuenta)
 *   - Campos de PERFIL    (opcionales, completados desde "Editar Perfil")
 *   - Campos AUTOMÁTICOS  (generados por el backend, nunca enviados por el usuario)
 */
const usuarioSchema = new Schema(
  {
    // ─────────────────────────────────────────────
    // CAMPOS DE REGISTRO — obligatorios
    // ─────────────────────────────────────────────
    nombre: {
      type: String,
      required: [true, 'El nombre es obligatorio'],
      trim: true,
    },
    apellido: {
      type: String,
      required: [true, 'El apellido es obligatorio'],
      trim: true,
    },
    cedula: {
      type: String,
      required: [true, 'La cédula es obligatoria'],
      unique: true,
      trim: true,
    },
    // Internamente se guarda como 'email' para no romper el resto del sistema
    // El frontend/Postman puede enviarlo como 'correoInstitucional' o 'email'
    email: {
      type: String,
      required: [true, 'El correo institucional es obligatorio'],
      trim: true,
      unique: true,
      lowercase: true,
      validate: {
        validator: (value) => value.endsWith('@epn.edu.ec'),
        message: 'El correo debe ser institucional (@epn.edu.ec)',
      },
    },
    // Internamente 'password' — el frontend puede enviarlo como 'contraseña' o 'password'
    password: {
      type: String,
      required: [true, 'La contraseña es obligatoria'],
    },
    rol: {
      type: String,
      enum: {
        values: ['estudiante', 'docente', 'admin'],
        message: 'El rol debe ser "estudiante" o "docente"',
      },
      default: 'estudiante',
    },

    // ─────────────────────────────────────────────
    // CAMPOS AUTOMÁTICOS — generados por el backend
    // ─────────────────────────────────────────────
    estado: {
      type: String,
      enum: {
        values: ['activo', 'inactivo'],
        message: 'El estado debe ser "activo" o "inactivo"',
      },
      default: 'activo',
      // No se expone en consultas por defecto ni se acepta desde el cliente
      select: false,
    },
    fechaRegistro: {
      type: Date,
      default: () => new Date(),
    },
    confirmEmail: {
      type: Boolean,
      default: false,
      // Protegido: nunca debe venir del body del cliente
      // Solo el backend lo cambia a true al confirmar el correo
      select: false,
    },
    // Token interno para verificación de correo y recuperación de contraseña
    // Nunca se devuelve en respuestas al cliente
    token: {
      type: String,
      default: null,
      select: false,
    },
    // Fecha de expiración del token de recuperación de contraseña (1 hora desde su generación)
    // Nunca se devuelve en respuestas al cliente
    tokenExpira: {
      type: Date,
      default: null,
      select: false,
    },

    // ─────────────────────────────────────────────
    // CAMPOS DE PERFIL — opcionales (editar perfil)
    // ─────────────────────────────────────────────
    fotoPerfil: {
      url: {
        type: String,
        default: 'https://res.cloudinary.com/dbiiapon8/image/upload/v1769933902/sinimages_vcyuf7.png',
      },
      publicId: {
        type: String,
        default: 'default-profile',
      },
    },
    carrera: {
      type: String,
      trim: true,
      default: null,
      enum: {
        values: [
          null,
          'Agua y Saneamiento Ambiental',
          'Desarrollo de Software',
          'Electromecánica',
          'Redes y Telecomunicaciones',
          'Procesamiento de Alimentos',
          'Procesamiento Industrial de la Madera',
        ],
        message: 'La carrera "{VALUE}" no es válida. Las carreras permitidas son: Agua y Saneamiento Ambiental, Desarrollo de Software, Electromecánica, Redes y Telecomunicaciones, Procesamiento de Alimentos, Procesamiento Industrial de la madera',
      },
    },
    // Solo aplica para estudiantes
    semestre: {
      type: Number,
      min: [0, 'El semestre debe ser al menos 0'],
      max: [5, 'El semestre no puede ser mayor a 5'],
      default: null,
    },
    telefono: {
      type: String,
      trim: true,
      default: null,
    },
    descripcion: {
      type: String,
      maxlength: [500, 'La descripción no puede exceder 500 caracteres'],
      trim: true,
      default: null,
    },
    github: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true, // createdAt y updatedAt automáticos
  }
);

// ─────────────────────────────────────────────
// MÉTODOS DEL ESQUEMA
// ─────────────────────────────────────────────

// Encriptar contraseña con bcrypt
usuarioSchema.methods.encryptPassword = async function (password) {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

// Verificar contraseña
usuarioSchema.methods.matchPassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

// Generar token interno (verificación de correo / recuperación de contraseña)
// Para recuperación de contraseña el token expira en 1 hora
usuarioSchema.methods.createToken = function () {
  const tokenGenerado = Math.random().toString(36).slice(2);
  this.token = tokenGenerado;
  this.tokenExpira = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas desde ahora
  return tokenGenerado;
};


// Token de recuperación de contraseña — 1 hora de vigencia
usuarioSchema.methods.createTokenRecuperacion = function () {
  const tokenGenerado = Math.random().toString(36).slice(2);
  this.token = tokenGenerado;
  this.tokenExpira = new Date(Date.now() + 60 * 60 * 1000); // 1 hora desde ahora
  return tokenGenerado;
};

// Exportamos — la colección en MongoDB se llamará 'usuarios'
export default model('Usuario', usuarioSchema, 'usuarios');
