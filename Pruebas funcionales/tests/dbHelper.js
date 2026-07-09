/**
 * dbHelper.js — Conexión a MongoDB en memoria para tests
 *
 * Cada test file que necesite BD importa y llama a estas funciones
 * en su propio beforeAll / afterAll.
 */

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongod;

export const conectarBD = async () => {
  process.env.JWT_SECRET = 'secreto_para_tests_local';
  process.env.NODE_ENV   = 'test';
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
};

export const desconectarBD = async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await mongod.stop();
};

// Limpia todas las colecciones entre tests (opcional por archivo)
export const limpiarBD = async () => {
  const colecciones = Object.keys(mongoose.connection.collections);
  for (const nombre of colecciones) {
    await mongoose.connection.collections[nombre].deleteMany({});
  }
};
