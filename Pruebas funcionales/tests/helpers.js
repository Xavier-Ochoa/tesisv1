/**
 * helpers.js — Funciones reutilizables para los tests de integración
 *
 * Crea usuarios y tokens de prueba sin repetir código en cada test.
 */

import request from 'supertest';
import Estudiante from '../src/models/Estudiante.js';
import app from '../src/server.js';

/**
 * Crea un usuario en la BD de test y retorna su token JWT.
 * @param {object} opciones - Opciones para personalizar el usuario
 * @returns {{ token, userId, usuario }}
 */
export const crearUsuarioYToken = async ({
  nombre       = 'Test',
  apellido     = 'Usuario',
  cedula       = '1700000001',
  email        = 'test.usuario@epn.edu.ec',
  password     = 'Clave456@',
  rol          = 'estudiante',
  confirmEmail = true,
  estado       = 'activo',
  carrera      = 'Desarrollo de Software',  // ← NUEVO: obligatorio en el modelo
} = {}) => {
  const usuario = new Estudiante({
    nombre, apellido, cedula, email, rol, confirmEmail, estado, carrera,
  });
  usuario.password = await usuario.encryptPassword(password);
  await usuario.save();

  const res = await request(app)
    .post('/api/auth/login')
    .send({ correoInstitucional: email, contraseña: password });

  return {
    token:   res.body.token,
    userId:  usuario._id.toString(),
    usuario,
  };
};

/**
 * Crea un estudiante de prueba con datos únicos para evitar colisiones
 * cuando se crean múltiples usuarios en el mismo test suite.
 */
let contador = 0;
export const crearEstudiante = async (sobreescribir = {}) => {
  contador++;
  return crearUsuarioYToken({
    nombre:   `Estudiante${contador}`,
    apellido: 'Test',
    cedula:   `170000${String(contador).padStart(4, '0')}`,
    email:    `estudiante${contador}.test@epn.edu.ec`,
    rol:      'estudiante',
    carrera:  'Desarrollo de Software',  // ← NUEVO
    ...sobreescribir,
  });
};

/**
 * Crea un admin de prueba
 */
export const crearAdmin = async () => {
  return crearUsuarioYToken({
    nombre:   'Admin',
    apellido: 'Test',
    cedula:   '1799999999',
    email:    'admin.test@epn.edu.ec',
    rol:      'admin',
    carrera:  'Desarrollo de Software',  // ← NUEVO
  });
};

/**
 * Body base válido para crear un proyecto.
 * NOTA: el campo 'carrera' fue eliminado del modelo Proyecto;
 * ahora se toma del perfil del autor. No se envía en el body.
 */
export const bodyProyectoValido = {
  titulo:        'Sistema de monitoreo de redes',
  descripcion:   'Aplicación que monitorea el estado de la red usando SNMP en tiempo real.',
  categoria:     'academico',
  fechaInicio:   '2024-03-01',
  // fechaFin es obligatoria en la creación (validarFechaFin() la exige siempre)
  fechaFin:      '2024-09-01',
  tecnologias:   'Python,Flask,MongoDB',
  enviarAlAdmin: true,
};