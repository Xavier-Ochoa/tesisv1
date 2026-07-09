/**
 * PRUEBA 3 — Archivos y recursos del proyecto
 *
 * Fusiona los antiguos archivos:
 *   07-subida-pdf.test.js
 *   08-gestion-imagenes.test.js
 *
 * Ambos casos giran en torno a archivos asociados a un proyecto (PDF vía
 * GridFS, imágenes vía Cloudinary), pero no comparten el mismo proyecto:
 * el backend solo acepta imágenes en el momento de crear el proyecto
 * (multipart en el POST), mientras que el PDF se sube después sobre un
 * proyecto ya existente (PUT). Por eso cada bloque crea su propio
 * proyecto "contenedor", igual que en los archivos originales; lo único
 * que cambia al fusionar es que ya no hace falta una variable global
 * (`global.__proyectoConImagenId`) para pasar el id entre tests del
 * bloque 8: ahora es una variable local del `describe`.
 *
 * Todo contra el backend REAL en Vercel y la MongoDB REAL.
 */
import { api } from './helpers/apiClient.js';
import { crearUsuarioActivo } from './helpers/usuarios.js';
import { registrar, limpiarTodo, desconectarDB, obtenerProyectoPorId } from './helpers/dbDirect.js';
import { proyectoValido, bufferPDFDePrueba, bufferImagenDePrueba } from './helpers/fixtures.js';

afterAll(async () => {
  await limpiarTodo();
  await desconectarDB();
});

describe('7. Subida de archivos PDF a GridFS', () => {
  let autor;
  let proyectoId;

  beforeAll(async () => {
    autor = await crearUsuarioActivo({ prefijo: 'pdfautor' });
    const resProyecto = await api
      .post('/api/proyectos')
      .set('Authorization', `Bearer ${autor.token}`)
      .send(proyectoValido());
    proyectoId = resProyecto.body.data._id;
    registrar('Proyecto', proyectoId);
  });

  test('sube un PDF y queda almacenado en GridFS + referenciado en el proyecto', async () => {
    const res = await api
      .put(`/api/proyectos/${proyectoId}/documento`)
      .set('Authorization', `Bearer ${autor.token}`)
      .attach('documento', bufferPDFDePrueba(), { filename: 'prueba.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(200);
    expect(res.body.data.documentos).toHaveLength(1);
    expect(res.body.data.documentos[0].contentType).toBe('application/pdf');

    const proyectoDB = await obtenerProyectoPorId(proyectoId);
    expect(proyectoDB.documentos).toHaveLength(1);
    expect(proyectoDB.documentos[0].fileId).toBeTruthy();
  });

  test('el PDF subido se puede descargar', async () => {
    const res = await api
      .get(`/api/proyectos/${proyectoId}/documento`)
      .set('Authorization', `Bearer ${autor.token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(Buffer.isBuffer(res.body) || typeof res.text === 'string').toBe(true);
  });

  test('rechaza subir un archivo que no sea PDF', async () => {
    const res = await api
      .put(`/api/proyectos/${proyectoId}/documento`)
      .set('Authorization', `Bearer ${autor.token}`)
      .attach('documento', Buffer.from('no soy un pdf'), { filename: 'nota.txt', contentType: 'text/plain' });

    expect(res.status).toBe(400);
  });

  test('elimina el documento correctamente', async () => {
    const res = await api
      .delete(`/api/proyectos/${proyectoId}/documento`)
      .set('Authorization', `Bearer ${autor.token}`);

    expect(res.status).toBe(200);

    const proyectoDB = await obtenerProyectoPorId(proyectoId);
    expect(proyectoDB.documentos).toHaveLength(0);

    // Ya no debe haber documento para descargar
    const resDescargaTrasEliminar = await api
      .get(`/api/proyectos/${proyectoId}/documento`)
      .set('Authorization', `Bearer ${autor.token}`);
    expect(resDescargaTrasEliminar.status).toBe(404);
  });
});

describe('8. Gestión de imágenes (Cloudinary)', () => {
  let autor;
  let proyectoConImagenId;

  beforeAll(async () => {
    autor = await crearUsuarioActivo({ prefijo: 'imgautor' });
  });

  test('crea un proyecto con una imagen: se sube a Cloudinary y la URL queda en MongoDB', async () => {
    const datos = proyectoValido();

    const res = await api
      .post('/api/proyectos')
      .set('Authorization', `Bearer ${autor.token}`)
      .field('titulo', datos.titulo)
      .field('descripcion', datos.descripcion)
      .field('categoria', datos.categoria)
      .field('fechaInicio', datos.fechaInicio)
      .field('fechaFin', datos.fechaFin)
      .attach('imagenes', bufferImagenDePrueba(), { filename: 'foto.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    registrar('Proyecto', res.body.data._id);

    expect(res.body.data.imagenes).toHaveLength(1);
    expect(res.body.data.imagenes[0]).toMatch(/^https:\/\/res\.cloudinary\.com\//);

    const proyectoDB = await obtenerProyectoPorId(res.body.data._id);
    expect(proyectoDB.imagenes).toHaveLength(1);
    expect(proyectoDB.imagenesID).toHaveLength(1);

    // Guardar para la siguiente prueba (variable local del describe, ya no global)
    proyectoConImagenId = res.body.data._id;
  });

  test('elimina la imagen del proyecto: se borra de Cloudinary y de MongoDB', async () => {
    const proyectoId = proyectoConImagenId;
    expect(proyectoId).toBeTruthy();

    const res = await api
      .delete(`/api/proyectos/${proyectoId}/imagenes`)
      .set('Authorization', `Bearer ${autor.token}`)
      .send({ indice: 0 });

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(0);

    const proyectoDB = await obtenerProyectoPorId(proyectoId);
    expect(proyectoDB.imagenes).toHaveLength(0);
    expect(proyectoDB.imagenesID).toHaveLength(0);
  });

  test('rechaza subir más de 5 imágenes en un proyecto', async () => {
    const datos = proyectoValido();
    let req = api
      .post('/api/proyectos')
      .set('Authorization', `Bearer ${autor.token}`)
      .field('titulo', datos.titulo)
      .field('descripcion', datos.descripcion)
      .field('categoria', datos.categoria)
      .field('fechaInicio', datos.fechaInicio)
      .field('fechaFin', datos.fechaFin);

    for (let i = 0; i < 6; i += 1) {
      req = req.attach('imagenes', bufferImagenDePrueba(), { filename: `foto${i}.png`, contentType: 'image/png' });
    }

    const res = await req;
    expect(res.status).toBe(400);
  });
});
