/**
 * tests/integration/helpers/dbDirect.js
 *
 * Conexión DIRECTA a la misma MongoDB que usa el backend en producción
 * (mismo MONGODB_URI del .env). Se usa para:
 *
 *   1. Verificar en la base de datos cosas que la API nunca devuelve
 *      (password cifrada, token de verificación, tokenExpira, etc.)
 *   2. Leer el token de verificación / recuperación que normalmente
 *      llegaría por correo, porque estas pruebas no tienen acceso a
 *      la bandeja de Gmail real.
 *   3. Preparar datos que la API pública no permite crear directamente
 *      (ej. un usuario con rol "admin", ya que /register solo permite
 *      "estudiante" o "docente").
 *   4. Limpiar al final TODO lo que las pruebas crearon, para no dejar
 *      basura en la base de datos real.
 *
 * IMPORTANTE: solo se borran documentos cuyos _id fueron registrados por
 * las propias pruebas (ver registrar/limpiarTodo). Nunca se hace un
 * borrado masivo por patrón.
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import Estudiante from '../../../src/models/Estudiante.js';
import Proyecto from '../../../src/models/Proyecto.js';
import TokenBlacklist from '../../../src/models/TokenBlacklist.js';
import Donacion from '../../../src/models/Donacion.js';
import ChatMensaje from '../../../src/models/ChatMensaje.js';

let conectado = false;

export const conectarDB = async () => {
  if (conectado && mongoose.connection.readyState === 1) return;
  await mongoose.connect(process.env.MONGODB_URI);
  conectado = true;
};

export const desconectarDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
  conectado = false;
};

// ── Registro de limpieza ────────────────────────────────────────────────────
const creados = {
  Estudiante: [],
  Proyecto: [],
  TokenBlacklist: [],
  Donacion: [],
  ChatMensaje: [],
};

const modelos = { Estudiante, Proyecto, TokenBlacklist, Donacion, ChatMensaje };

/** Registra un _id creado durante una prueba para poder borrarlo después. */
export const registrar = (tipo, id) => {
  if (!creados[tipo]) throw new Error(`Tipo desconocido para limpieza: ${tipo}`);
  creados[tipo].push(id);
};

/** Borra de la base de datos real todo lo registrado con `registrar`. */
export const limpiarTodo = async () => {
  await conectarDB();
  for (const [tipo, ids] of Object.entries(creados)) {
    if (ids.length === 0) continue;
    await modelos[tipo].deleteMany({ _id: { $in: ids } });
    creados[tipo] = [];
  }
};

// ── Helpers de lectura/escritura directa ────────────────────────────────────

/** Trae un usuario con los campos ocultos (token, tokenExpira, confirmEmail, estado, rol). */
export const obtenerUsuarioCompleto = async (email) => {
  await conectarDB();
  return Estudiante.findOne({ email: email.toLowerCase() }).select(
    '+token +tokenExpira +confirmEmail +estado +password +rol'
  );
};

export const obtenerUsuarioPorId = async (id) => {
  await conectarDB();
  return Estudiante.findById(id).select('+token +tokenExpira +confirmEmail +estado +password +rol');
};

/**
 * Sube (o crea) un usuario directo en Mongo con el rol "admin".
 * La API pública no permite registrar admins, así que para poder probar
 * el control de acceso por roles se crea directo en la base de datos real,
 * pero se autentica siempre por el endpoint real de login (JWT real).
 */
export const forzarRol = async (usuarioId, rol) => {
  await conectarDB();
  await Estudiante.findByIdAndUpdate(usuarioId, { rol });
};

export const obtenerProyectoPorId = async (id) => {
  await conectarDB();
  return Proyecto.findById(id);
};

export const obtenerDonacionPorPaymentIntent = async (stripePaymentIntentId) => {
  await conectarDB();
  return Donacion.findOne({ stripePaymentIntentId });
};

export const tokenEstaEnBlacklist = async (token) => {
  await conectarDB();
  const doc = await TokenBlacklist.findOne({ token });
  return !!doc;
};

export { Estudiante, Proyecto, TokenBlacklist, Donacion, ChatMensaje };
