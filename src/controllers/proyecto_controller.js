import Proyecto from '../models/Proyecto.js';
import Estudiante from '../models/Estudiante.js';
import { subirImagenCloudinary, eliminarImagenCloudinary } from '../helpers/uploadCloudinary.js';
import { generarProyectoId, siguienteVersion } from '../helpers/generarProyectoId.js';
import { validarEditable, validarVersionable, rolesEnProyecto } from '../helpers/reglasProyecto.js';
import { subirPDFGridFS, eliminarPDFGridFS, descargarPDFGridFS } from '../helpers/gridfs.js';

// ─────────────────────────────────────────────────────────────────────────────
// LANDING — solo publico=true + aprobado + activo + esUltimaVersion
// ─────────────────────────────────────────────────────────────────────────────
export const listarProyectos = async (req, res) => {
  try {
    const { page = 1, limit = 10, categoria, carrera, q, sort = '-createdAt' } = req.query;
    const filtro = { estado: 'aprobado', publico: true, activo: true, esUltimaVersion: true };
    if (categoria) filtro.categoria = categoria;
    if (carrera)   filtro.carrera   = decodeURIComponent(carrera);
    if (q?.trim()) filtro.$text     = { $search: q.trim() };

    const [proyectos, total] = await Promise.all([
      Proyecto.find(filtro)
        .populate('autor', 'nombre apellido carrera email')
        .sort(sort).limit(Number(limit)).skip((Number(page) - 1) * Number(limit)).lean(),
      Proyecto.countDocuments(filtro),
    ]);
    res.status(200).json({ success: true, data: proyectos, pagination: { total, page: parseInt(page), totalPages: Math.ceil(total / limit), limit: parseInt(limit) } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener los proyectos', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// MIS PROYECTOS
// ─────────────────────────────────────────────────────────────────────────────
export const misProyectos = async (req, res) => {
  try {
    const usuarioId = req.estudianteBDD._id;
    const { page = 1, limit = 10, estado, enviarAlAdmin, categoria, sort = '-createdAt' } = req.query;
    const filtro = { $or: [{ autor: usuarioId }, { colaboradores: usuarioId }], esUltimaVersion: true, activo: true };
    if (estado)        filtro.estado        = estado;
    if (enviarAlAdmin !== undefined) filtro.enviarAlAdmin = enviarAlAdmin === 'true';
    if (categoria)     filtro.categoria     = categoria;

    const [proyectos, total] = await Promise.all([
      Proyecto.find(filtro)
        .populate('autor', 'nombre apellido carrera email')
        .populate('colaboradores', 'nombre apellido carrera')
        .sort(sort).limit(Number(limit)).skip((Number(page) - 1) * Number(limit)).lean(),
      Proyecto.countDocuments(filtro),
    ]);
    const proyectosConRol = proyectos.map(p => ({
      ...p,
      rolEnProyecto: p.autor._id.toString() === usuarioId.toString() ? 'autor' : 'colaborador',
    }));
    res.status(200).json({ success: true, data: proyectosConRol, pagination: { total, page: parseInt(page), totalPages: Math.ceil(total / limit), limit: parseInt(limit) } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener tus proyectos', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// HISTORIAL DE VERSIONES
// ─────────────────────────────────────────────────────────────────────────────
export const historialVersiones = async (req, res) => {
  try {
    const { proyectoId } = req.params;
    const usuarioId = req.estudianteBDD._id;
    const versiones = await Proyecto.find({ proyecto_id: proyectoId })
      .populate('autor', 'nombre apellido carrera email').sort({ version: 1 }).lean();
    if (!versiones.length) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });

    const ultima = versiones[versiones.length - 1];
    const esAdmin = req.estudianteBDD?.rol === 'admin';
    const { esAutor, esColaborador } = rolesEnProyecto(ultima, usuarioId);
    const esPublicoAprobado = ultima.publico && ultima.estado === 'aprobado';

    if (!esAutor && !esColaborador && !esPublicoAprobado && !esAdmin) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para ver este proyecto' });
    }
    res.status(200).json({ success: true, total: versiones.length, data: versiones });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener el historial de versiones', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// OBTENER UN PROYECTO
// ─────────────────────────────────────────────────────────────────────────────
export const obtenerProyecto = async (req, res) => {
  try {
    const { id } = req.params;
    const estudianteId = req.estudianteBDD?._id;
    const proyecto = await Proyecto.findById(id)
      .populate('autor', 'nombre apellido carrera email')
      .populate('colaboradores', 'nombre apellido carrera')
      .populate('comentarios.estudiante', 'nombre apellido');

    if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });

    const { esAutor, esColaborador } = estudianteId
      ? rolesEnProyecto(proyecto, estudianteId)
      : { esAutor: false, esColaborador: false };

    const esAdmin = req.estudianteBDD?.rol === 'admin';
    const esPublicoAprobado = proyecto.publico && proyecto.estado === 'aprobado' && proyecto.activo;
    const esAdminConAcceso = esAdmin && proyecto.enviarAlAdmin;

    if (!esAdminConAcceso && !esPublicoAprobado && !esAutor && !esColaborador) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para ver este proyecto' });
    }
    if (esPublicoAprobado) await proyecto.incrementarVistas();
    res.status(200).json({ success: true, data: proyecto });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener el proyecto', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CREAR PROYECTO
// ─────────────────────────────────────────────────────────────────────────────
export const crearProyecto = async (req, res) => {
  try {
    const usuarioId = req.estudianteBDD._id;
    req.body = req.body ?? {};
    const proyectoIdGenerado = await generarProyectoId(req.body.carrera);

    const enviarAlAdmin = req.body.enviarAlAdmin === true || req.body.enviarAlAdmin === 'true';

    const nuevoProyecto = new Proyecto({
      ...req.body,
      autor:           usuarioId,
      estado:          'pendiente',
      proyecto_id:     proyectoIdGenerado,
      version:         '001',
      esUltimaVersion: true,
      enviarAlAdmin,
      publico:         false,
    });

    if (req.files?.imagenes) {
      const archivos = Array.isArray(req.files.imagenes) ? req.files.imagenes : [req.files.imagenes];
      const subidas = await Promise.all(archivos.slice(0, 5).map(a => subirImagenCloudinary(a.tempFilePath, 'Proyectos')));
      nuevoProyecto.imagenes   = subidas.map(s => s.secure_url);
      nuevoProyecto.imagenesID = subidas.map(s => s.public_id);
    }

    // ── PDF (opcional al crear) ───────────────────────────────────────────────
    if (req.files?.documento) {
      const archivo = Array.isArray(req.files.documento) ? req.files.documento[0] : req.files.documento;
      if (archivo.mimetype !== 'application/pdf') {
        return res.status(400).json({ success: false, message: 'El documento debe ser un archivo PDF' });
      }
      const { readFileSync } = await import('fs');
      const buffer = readFileSync(archivo.tempFilePath);
      const meta   = await subirPDFGridFS(buffer, archivo.name, archivo.mimetype);
      nuevoProyecto.documentos = [meta];
    }

    await nuevoProyecto.save();
    await nuevoProyecto.populate('autor', 'nombre apellido carrera email');
    res.status(201).json({ success: true, message: 'Proyecto creado exitosamente. Está pendiente de revisión.', proyecto_id: proyectoIdGenerado, version: '001', data: nuevoProyecto });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: 'Error de validación', errors: Object.values(error.errors).map(e => e.message) });
    }
    res.status(500).json({ success: false, message: 'Error al crear el proyecto', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ACTUALIZAR PROYECTO (autor)
// ─────────────────────────────────────────────────────────────────────────────
export const actualizarProyecto = async (req, res) => {
  try {
    const { id } = req.params;
    const estudianteId = req.estudianteBDD._id;
    req.body = req.body ?? {};

    const proyecto = await Proyecto.findById(id);
    if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    if (proyecto.autor.toString() !== estudianteId.toString()) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para editar este proyecto' });
    }
    const errorRegla = validarEditable(proyecto);
    if (errorRegla) return res.status(403).json({ success: false, message: errorRegla });

    if (proyecto.enviarAlAdmin && (req.body.enviarAlAdmin === false || req.body.enviarAlAdmin === 'false')) {
      return res.status(400).json({ success: false, message: 'Un proyecto ya enviado al admin no puede revertirse a privado' });
    }

    const camposPermitidos = [
      'titulo', 'descripcion', 'categoria', 'lineaInvestigacion',
      'fechaInicio', 'fechaFin', 'tecnologias', 'repositorio',
      'enlaceDemo', 'tags', 'carrera',
    ];
    const datosActualizacion = {};
    for (const campo of camposPermitidos) {
      if (req.body[campo] !== undefined) datosActualizacion[campo] = req.body[campo];
    }
    if (!proyecto.enviarAlAdmin && (req.body.enviarAlAdmin === true || req.body.enviarAlAdmin === 'true')) {
      datosActualizacion.enviarAlAdmin = true;
    }

    if (req.files?.imagenes) {
      const archivos = Array.isArray(req.files.imagenes) ? req.files.imagenes : [req.files.imagenes];
      const actualesCount = proyecto.imagenes?.length ?? 0;
      if (actualesCount + archivos.length > 5) {
        return res.status(400).json({ success: false, message: `Máximo 5 imágenes. Ya tiene ${actualesCount}.` });
      }
      const subidas = await Promise.all(archivos.map(a => subirImagenCloudinary(a.tempFilePath, 'Proyectos')));
      datosActualizacion.imagenes   = [...(proyecto.imagenes ?? []),   ...subidas.map(s => s.secure_url)];
      datosActualizacion.imagenesID = [...(proyecto.imagenesID ?? []), ...subidas.map(s => s.public_id)];
    }

    // ── PDF (opcional al actualizar — reemplaza el anterior) ──────────────────
    if (req.files?.documento) {
      const archivo = Array.isArray(req.files.documento) ? req.files.documento[0] : req.files.documento;
      if (archivo.mimetype !== 'application/pdf') {
        return res.status(400).json({ success: false, message: 'El documento debe ser un archivo PDF' });
      }
      // Eliminar el PDF anterior de GridFS si existe
      if (proyecto.documentos?.length > 0) {
        await eliminarPDFGridFS(proyecto.documentos[0].fileId);
      }
      const { readFileSync } = await import('fs');
      const buffer = readFileSync(archivo.tempFilePath);
      const meta   = await subirPDFGridFS(buffer, archivo.name, archivo.mimetype);
      datosActualizacion.documentos = [meta];
    }

    if (proyecto.estado === 'rechazado') datosActualizacion.estado = 'pendiente';

    const proyectoActualizado = await Proyecto.findByIdAndUpdate(id, { $set: datosActualizacion }, { new: true, runValidators: true })
      .populate('autor', 'nombre apellido carrera email')
      .populate('colaboradores', 'nombre apellido carrera');
    res.status(200).json({ success: true, message: 'Proyecto actualizado exitosamente', data: proyectoActualizado });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al actualizar el proyecto', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SUBIR / REEMPLAZAR DOCUMENTO PDF  (autor)
// PUT /:id/documento  — multipart/form-data campo: "documento"
// ─────────────────────────────────────────────────────────────────────────────
export const subirDocumentoProyecto = async (req, res) => {
  try {
    const { id } = req.params;
    const estudianteId = req.estudianteBDD._id;

    const proyecto = await Proyecto.findById(id);
    if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    if (proyecto.autor.toString() !== estudianteId.toString()) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para editar este proyecto' });
    }
    const errorRegla = validarEditable(proyecto);
    if (errorRegla) return res.status(403).json({ success: false, message: errorRegla });

    if (!req.files?.documento) {
      return res.status(400).json({ success: false, message: 'No se recibió ningún archivo. Usa el campo "documento".' });
    }

    const archivo = Array.isArray(req.files.documento) ? req.files.documento[0] : req.files.documento;
    if (archivo.mimetype !== 'application/pdf') {
      return res.status(400).json({ success: false, message: 'El documento debe ser un archivo PDF' });
    }

    // Eliminar PDF anterior si existe
    if (proyecto.documentos?.length > 0) {
      await eliminarPDFGridFS(proyecto.documentos[0].fileId);
    }

    const { readFileSync } = await import('fs');
    const buffer = readFileSync(archivo.tempFilePath);
    const meta   = await subirPDFGridFS(buffer, archivo.name, archivo.mimetype);

    proyecto.documentos = [meta];
    await proyecto.save();

    res.status(200).json({
      success: true,
      message: 'Documento subido exitosamente',
      data: { documentos: proyecto.documentos },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al subir el documento', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ELIMINAR DOCUMENTO PDF  (autor)
// DELETE /:id/documento
// ─────────────────────────────────────────────────────────────────────────────
export const eliminarDocumentoProyecto = async (req, res) => {
  try {
    const { id } = req.params;
    const estudianteId = req.estudianteBDD._id;

    const proyecto = await Proyecto.findById(id);
    if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    if (proyecto.autor.toString() !== estudianteId.toString()) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para editar este proyecto' });
    }
    const errorRegla = validarEditable(proyecto);
    if (errorRegla) return res.status(403).json({ success: false, message: errorRegla });

    if (!proyecto.documentos?.length) {
      return res.status(404).json({ success: false, message: 'El proyecto no tiene documento adjunto' });
    }

    await eliminarPDFGridFS(proyecto.documentos[0].fileId);
    proyecto.documentos = [];
    await proyecto.save();

    res.status(200).json({ success: true, message: 'Documento eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al eliminar el documento', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DESCARGAR / VER DOCUMENTO PDF
// GET /:id/documento  — hace streaming del PDF al cliente
// ─────────────────────────────────────────────────────────────────────────────
export const descargarDocumentoProyecto = async (req, res) => {
  try {
    const { id } = req.params;
    const estudianteId = req.estudianteBDD?._id;

    const proyecto = await Proyecto.findById(id).lean();
    if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });

    // Verificar acceso
    const esAdmin = req.estudianteBDD?.rol === 'admin';
    const { esAutor, esColaborador } = estudianteId
      ? rolesEnProyecto(proyecto, estudianteId)
      : { esAutor: false, esColaborador: false };
    const esPublicoAprobado = proyecto.publico && proyecto.estado === 'aprobado' && proyecto.activo;

    if (!esAdmin && !esAutor && !esColaborador && !esPublicoAprobado) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para descargar este documento' });
    }

    if (!proyecto.documentos?.length) {
      return res.status(404).json({ success: false, message: 'El proyecto no tiene documento adjunto' });
    }

    const doc = proyecto.documentos[0];
    res.set('Content-Type', doc.contentType || 'application/pdf');
    res.set('Content-Disposition', `inline; filename="${doc.filename}"`);

    const downloadStream = descargarPDFGridFS(doc.fileId);
    downloadStream.on('error', (err) => {
      console.error('Error descargando PDF:', err.message);
      if (!res.headersSent) {
        return res.status(404).json({ success: false, message: 'Error al descargar el archivo' });
      }
      res.end();
    });
    downloadStream.pipe(res);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al descargar el documento', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLICAR PROYECTO (autor) — solo si aprobado y enviarAlAdmin=true
// ─────────────────────────────────────────────────────────────────────────────
export const publicarProyecto = async (req, res) => {
  try {
    const { id } = req.params;
    const estudianteId = req.estudianteBDD._id;

    const proyecto = await Proyecto.findById(id);
    if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });

    if (proyecto.autor.toString() !== estudianteId.toString()) {
      return res.status(403).json({ success: false, message: 'Solo el autor puede publicar el proyecto' });
    }
    if (!proyecto.enviarAlAdmin) {
      return res.status(400).json({ success: false, message: 'El proyecto debe haber sido enviado al admin primero' });
    }
    if (proyecto.estado !== 'aprobado') {
      return res.status(400).json({ success: false, message: 'Solo se pueden publicar proyectos aprobados por el admin' });
    }
    if (proyecto.publico) {
      return res.status(400).json({ success: false, message: 'El proyecto ya está publicado' });
    }

    proyecto.publico = true;
    await proyecto.save();

    res.status(200).json({ success: true, message: 'Proyecto publicado exitosamente. Ahora es visible en la landing page.', data: proyecto });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al publicar el proyecto', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CREAR NUEVA VERSIÓN
// ─────────────────────────────────────────────────────────────────────────────
export const crearNuevaVersion = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.estudianteBDD._id;
    req.body = req.body ?? {};

    const versionActual = await Proyecto.findById(id);
    if (!versionActual) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });

    const { esAutor } = rolesEnProyecto(versionActual, usuarioId);
    if (!esAutor) return res.status(403).json({ success: false, message: 'Solo el autor del proyecto puede crear nuevas versiones' });

    const errorVersionable = validarVersionable(versionActual);
    if (errorVersionable) return res.status(403).json({ success: false, message: errorVersionable });

    const nuevaVersion = await siguienteVersion(versionActual.proyecto_id);
    const camposPermitidos = ['titulo', 'descripcion', 'categoria', 'lineaInvestigacion', 'fechaInicio', 'fechaFin', 'tecnologias', 'repositorio', 'enlaceDemo', 'tags', 'carrera'];

    const datosNuevaVersion = {
      proyecto_id:       versionActual.proyecto_id,
      version:           nuevaVersion,
      esUltimaVersion:   true,
      autor:             versionActual.autor,
      colaboradores:     versionActual.colaboradores,
      estado:            'pendiente',
      motivoRechazo:     '',
      enviarAlAdmin:     req.body.enviarAlAdmin === true  || req.body.enviarAlAdmin === 'true',
      publico:           versionActual.publico,
      activo:            true,
      titulo:            versionActual.titulo,
      descripcion:       versionActual.descripcion,
      categoria:         versionActual.categoria,
      lineaInvestigacion: versionActual.lineaInvestigacion,
      fechaInicio:       versionActual.fechaInicio,
      fechaFin:          versionActual.fechaFin,
      tecnologias:       [...(versionActual.tecnologias ?? [])],
      repositorio:       versionActual.repositorio,
      enlaceDemo:        versionActual.enlaceDemo,
      tags:              [...(versionActual.tags ?? [])],
      carrera:           versionActual.carrera,
      imagenes:          [...(versionActual.imagenes ?? [])],
      imagenesID:        [...(versionActual.imagenesID ?? [])],
      // Los documentos NO se heredan automáticamente; se suben aparte si se desea
      documentos:        [],
      vistas: 0, likes: [], comentarios: [],
    };
    for (const campo of camposPermitidos) {
      if (req.body[campo] !== undefined) datosNuevaVersion[campo] = req.body[campo];
    }
    if (req.files?.imagenes) {
      const archivos = Array.isArray(req.files.imagenes) ? req.files.imagenes : [req.files.imagenes];
      if (archivos.length > 5) return res.status(400).json({ success: false, message: 'Máximo 5 imágenes por proyecto' });
      const subidas = await Promise.all(archivos.map(a => subirImagenCloudinary(a.tempFilePath, 'Proyectos')));
      datosNuevaVersion.imagenes   = subidas.map(s => s.secure_url);
      datosNuevaVersion.imagenesID = subidas.map(s => s.public_id);
    }

    // ── PDF en nueva versión (opcional) ───────────────────────────────────────
    if (req.files?.documento) {
      const archivo = Array.isArray(req.files.documento) ? req.files.documento[0] : req.files.documento;
      if (archivo.mimetype !== 'application/pdf') {
        return res.status(400).json({ success: false, message: 'El documento debe ser un archivo PDF' });
      }
      const { readFileSync } = await import('fs');
      const buffer = readFileSync(archivo.tempFilePath);
      const meta   = await subirPDFGridFS(buffer, archivo.name, archivo.mimetype);
      datosNuevaVersion.documentos = [meta];
    }

    await Proyecto.findByIdAndUpdate(id, { $set: { esUltimaVersion: false } });
    const nuevaVersionDoc = await Proyecto.create(datosNuevaVersion);
    await nuevaVersionDoc.populate('autor', 'nombre apellido carrera email');
    const msg = datosNuevaVersion.enviarAlAdmin
      ? `Versión ${nuevaVersion} creada y enviada al administrador para revisión.`
      : `Versión ${nuevaVersion} creada como borrador privado. Puedes enviarla al administrador cuando la tengas lista.`;
    res.status(201).json({ success: true, message: msg, proyecto_id: versionActual.proyecto_id, version: nuevaVersion, data: nuevaVersionDoc });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: 'Error de validación', errors: Object.values(error.errors).map(e => e.message) });
    }
    res.status(500).json({ success: false, message: 'Error al crear la nueva versión', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ELIMINAR PROYECTO (autor)
// ─────────────────────────────────────────────────────────────────────────────
export const eliminarProyecto = async (req, res) => {
  try {
    const { id } = req.params;
    const estudianteId = req.estudianteBDD._id;
    const proyecto = await Proyecto.findById(id);
    if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    if (proyecto.autor.toString() !== estudianteId.toString()) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para eliminar este proyecto' });
    }
    if (proyecto.enviarAlAdmin) {
      return res.status(403).json({ success: false, message: 'Los proyectos enviados al admin no pueden ser eliminados por el autor. Contacta al administrador.' });
    }
    const todasVersiones = await Proyecto.find({ proyecto_id: proyecto.proyecto_id });
    for (const v of todasVersiones) {
      if (v.imagenesID?.length > 0) {
        for (const pid of v.imagenesID) {
          try { await eliminarImagenCloudinary(pid); } catch (e) { console.error(e); }
        }
      }
      // Eliminar PDF de GridFS si existe
      if (v.documentos?.length > 0) {
        await eliminarPDFGridFS(v.documentos[0].fileId);
      }
      await Proyecto.findByIdAndDelete(v._id);
    }
    return res.status(200).json({ success: true, message: 'Proyecto eliminado permanentemente' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al eliminar el proyecto', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PROYECTOS DESTACADOS — landing
// ─────────────────────────────────────────────────────────────────────────────
export const proyectosDestacados = async (req, res) => {
  try {
    const proyectos = await Proyecto.find({ estado: 'aprobado', publico: true, activo: true, esUltimaVersion: true })
      .populate('autor', 'nombre apellido carrera').sort('-vistas').limit(6);
    res.status(200).json({ success: true, data: proyectos });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener proyectos destacados', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// BUSCAR — landing
// ─────────────────────────────────────────────────────────────────────────────
export const buscarProyectos = async (req, res) => {
  try {
    const { q, categoria, carrera, page = 1, limit = 10 } = req.query;
    if (!q?.trim()) return res.status(400).json({ success: false, message: 'Proporciona un término de búsqueda' });
    const filtro = { estado: 'aprobado', publico: true, activo: true, esUltimaVersion: true, $text: { $search: q.trim() } };
    if (categoria) filtro.categoria = categoria;
    if (carrera)   filtro.carrera   = decodeURIComponent(carrera);
    const [proyectos, total] = await Promise.all([
      Proyecto.find(filtro).populate('autor', 'nombre apellido carrera')
        .limit(Number(limit)).skip((Number(page) - 1) * Number(limit)),
      Proyecto.countDocuments(filtro)
    ]);
    res.status(200).json({ success: true, data: proyectos, pagination: { total, page: parseInt(page), totalPages: Math.ceil(total / Number(limit)), limit: parseInt(limit) } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al buscar proyectos', error: error.message });
  }
};

export const listarProyectosPorCategoria = async (req, res) => {
  try {
    const { tipo } = req.params;
    const { page = 1, limit = 10 } = req.query;
    if (!['academico', 'extracurricular'].includes(tipo)) return res.status(400).json({ success: false, message: 'Categoría inválida' });
    const filtro = { categoria: tipo, estado: 'aprobado', publico: true, activo: true, esUltimaVersion: true };
    const [proyectos, total] = await Promise.all([
      Proyecto.find(filtro).populate('autor', 'nombre apellido carrera').sort('-createdAt').limit(Number(limit)).skip((Number(page) - 1) * Number(limit)),
      Proyecto.countDocuments(filtro),
    ]);
    res.status(200).json({ success: true, data: proyectos, pagination: { total, page: parseInt(page), totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener proyectos', error: error.message });
  }
};

export const listarProyectosPorCarrera = async (req, res) => {
  try {
    const { carrera } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const filtro = { carrera: decodeURIComponent(carrera), estado: 'aprobado', publico: true, activo: true, esUltimaVersion: true };
    const [proyectos, total] = await Promise.all([
      Proyecto.find(filtro).populate('autor', 'nombre apellido carrera').sort('-createdAt').limit(Number(limit)).skip((Number(page) - 1) * Number(limit)),
      Proyecto.countDocuments(filtro)
    ]);
    res.status(200).json({ success: true, data: proyectos, pagination: { total, page: parseInt(page), totalPages: Math.ceil(total / Number(limit)), limit: parseInt(limit) } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener proyectos', error: error.message });
  }
};

export const listarProyectosPorEstudiante = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const filtro = { autor: id, estado: 'aprobado', publico: true, activo: true, esUltimaVersion: true };
    const [proyectos, total] = await Promise.all([
      Proyecto.find(filtro).populate('autor', 'nombre apellido carrera').sort('-createdAt').limit(Number(limit)).skip((Number(page) - 1) * Number(limit)),
      Proyecto.countDocuments(filtro)
    ]);
    res.status(200).json({ success: true, data: proyectos, pagination: { total, page: parseInt(page), totalPages: Math.ceil(total / Number(limit)), limit: parseInt(limit) } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener proyectos', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// INTERACCIONES
// ─────────────────────────────────────────────────────────────────────────────
const verificarAccesoInteraccion = (proyecto, estudianteId) => {
  const esAutor   = proyecto.autor.toString() === estudianteId.toString();
  const esPublico = proyecto.estado === 'aprobado' && proyecto.publico;
  return esAutor || esPublico;
};

export const agregarLike = async (req, res) => {
  try {
    const proyecto = await Proyecto.findById(req.params.id);
    if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    if (!verificarAccesoInteraccion(proyecto, req.estudianteBDD._id)) return res.status(403).json({ success: false, message: 'No tienes permiso para interactuar con este proyecto' });
    await proyecto.agregarLike(req.estudianteBDD._id);
    res.status(200).json({ success: true, message: 'Like agregado', likes: proyecto.likes.length });
  } catch (error) { res.status(500).json({ success: false, message: 'Error al agregar like', error: error.message }); }
};

export const quitarLike = async (req, res) => {
  try {
    const proyecto = await Proyecto.findById(req.params.id);
    if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    if (!verificarAccesoInteraccion(proyecto, req.estudianteBDD._id)) return res.status(403).json({ success: false, message: 'No tienes permiso para interactuar con este proyecto' });
    await proyecto.quitarLike(req.estudianteBDD._id);
    res.status(200).json({ success: true, message: 'Like quitado', likes: proyecto.likes.length });
  } catch (error) { res.status(500).json({ success: false, message: 'Error al quitar like', error: error.message }); }
};

export const agregarComentario = async (req, res) => {
  try {
    const { texto } = req.body;
    if (!texto?.trim()) return res.status(400).json({ success: false, message: 'El comentario no puede estar vacío' });
    const proyecto = await Proyecto.findById(req.params.id);
    if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    if (!verificarAccesoInteraccion(proyecto, req.estudianteBDD._id)) return res.status(403).json({ success: false, message: 'No tienes permiso para interactuar con este proyecto' });
    proyecto.comentarios.push({ estudiante: req.estudianteBDD._id, texto: texto.trim(), fecha: new Date() });
    await proyecto.save();
    await proyecto.populate('comentarios.estudiante', 'nombre apellido');
    res.status(201).json({ success: true, message: 'Comentario agregado', data: proyecto.comentarios });
  } catch (error) { res.status(500).json({ success: false, message: 'Error al agregar comentario', error: error.message }); }
};

export const eliminarComentario = async (req, res) => {
  try {
    const { id, comentarioId } = req.params;
    const estudianteId = req.estudianteBDD._id;
    const esAdmin = req.estudianteBDD.rol === 'admin';
    const proyecto = await Proyecto.findById(id);
    if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    const comentario = proyecto.comentarios.id(comentarioId);
    if (!comentario) return res.status(404).json({ success: false, message: 'Comentario no encontrado' });
    if (comentario.estudiante.toString() !== estudianteId.toString() && !esAdmin) return res.status(403).json({ success: false, message: 'No tienes permiso para eliminar este comentario' });
    comentario.deleteOne();
    await proyecto.save();
    res.status(200).json({ success: true, message: 'Comentario eliminado' });
  } catch (error) { res.status(500).json({ success: false, message: 'Error al eliminar comentario', error: error.message }); }
};

// ─────────────────────────────────────────────────────────────────────────────
// COLABORADORES
// ─────────────────────────────────────────────────────────────────────────────
export const agregarColaborador = async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;
    const usuarioId = req.estudianteBDD._id;
    if (!email) return res.status(400).json({ success: false, message: 'Proporciona el correo del colaborador' });
    const proyecto = await Proyecto.findById(id);
    if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    if (proyecto.autor.toString() !== usuarioId.toString()) return res.status(403).json({ success: false, message: 'Solo el autor puede gestionar colaboradores' });
    const colaborador = await Estudiante.findOne({ email: email.toLowerCase().trim() }).select('+confirmEmail +estado +rol');
    if (!colaborador) return res.status(404).json({ success: false, message: 'No existe ningún usuario con ese correo' });
    if (colaborador.rol !== 'estudiante') return res.status(400).json({ success: false, message: 'Solo se pueden agregar estudiantes como colaboradores' });
    if (!colaborador.confirmEmail) return res.status(400).json({ success: false, message: 'El colaborador no ha confirmado su correo' });
    if (colaborador.estado !== 'activo') return res.status(400).json({ success: false, message: 'El colaborador tiene la cuenta suspendida o inactiva' });
    if (colaborador._id.toString() === usuarioId.toString()) return res.status(400).json({ success: false, message: 'No puedes agregarte a ti mismo como colaborador' });
    if (proyecto.colaboradores.some(c => c.toString() === colaborador._id.toString())) return res.status(400).json({ success: false, message: 'El colaborador ya está en el proyecto' });
    proyecto.colaboradores.push(colaborador._id);
    await proyecto.save();
    await proyecto.populate('colaboradores', 'nombre apellido email carrera');
    res.status(200).json({ success: true, message: 'Colaborador agregado', colaboradores: proyecto.colaboradores });
  } catch (error) { res.status(500).json({ success: false, message: 'Error al agregar colaborador', error: error.message }); }
};

export const eliminarColaborador = async (req, res) => {
  try {
    const { id, colaboradorId } = req.params;
    const usuarioId = req.estudianteBDD._id;
    const proyecto = await Proyecto.findById(id);
    if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    if (proyecto.autor.toString() !== usuarioId.toString()) return res.status(403).json({ success: false, message: 'Solo el autor puede gestionar colaboradores' });
    proyecto.colaboradores = proyecto.colaboradores.filter(c => c.toString() !== colaboradorId);
    await proyecto.save();
    await proyecto.populate('colaboradores', 'nombre apellido email carrera');
    res.status(200).json({ success: true, message: 'Colaborador eliminado', colaboradores: proyecto.colaboradores });
  } catch (error) { res.status(500).json({ success: false, message: 'Error al eliminar colaborador', error: error.message }); }
};

export const dondeColabora = async (req, res) => {
  try {
    const usuarioId = req.estudianteBDD._id;
    const proyectos = await Proyecto.find({ colaboradores: usuarioId, autor: { $ne: usuarioId }, esUltimaVersion: true, activo: true })
      .populate('autor', 'nombre apellido carrera email').populate('colaboradores', 'nombre apellido carrera email semestre').sort('-createdAt').lean();
    res.status(200).json({ success: true, total: proyectos.length, data: proyectos });
  } catch (error) { res.status(500).json({ success: false, message: 'Error al obtener proyectos', error: error.message }); }
};

export const misProyectosConColaboradores = async (req, res) => {
  try {
    const usuarioId = req.estudianteBDD._id;
    const proyectos = await Proyecto.find({ autor: usuarioId, esUltimaVersion: true, activo: true, 'colaboradores.0': { $exists: true } })
      .populate('colaboradores', 'nombre apellido carrera email semestre').sort('-createdAt').lean();
    res.status(200).json({ success: true, total: proyectos.length, data: proyectos });
  } catch (error) { res.status(500).json({ success: false, message: 'Error al obtener proyectos', error: error.message }); }
};

export const listarColaboradores = async (req, res) => {
  try {
    const proyecto = await Proyecto.findById(req.params.id).populate('colaboradores', 'nombre apellido email carrera semestre');
    if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    res.status(200).json({ success: true, total: proyecto.colaboradores.length, data: proyecto.colaboradores });
  } catch (error) { res.status(500).json({ success: false, message: 'Error al obtener colaboradores', error: error.message }); }
};

export const eliminarImagenProyecto = async (req, res) => {
  try {
    const { id } = req.params;
    const { indice } = req.body;
    const estudianteId = req.estudianteBDD._id;
    if (indice === undefined || indice === null) return res.status(400).json({ success: false, message: 'Debes indicar el índice de la imagen a eliminar' });
    const proyecto = await Proyecto.findById(id);
    if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    if (proyecto.autor.toString() !== estudianteId.toString()) return res.status(403).json({ success: false, message: 'No tienes permiso para editar este proyecto' });
    const errorRegla = validarEditable(proyecto);
    if (errorRegla) return res.status(403).json({ success: false, message: errorRegla });
    const idx = parseInt(indice);
    if (isNaN(idx) || idx < 0 || idx >= proyecto.imagenes.length) return res.status(400).json({ success: false, message: `Índice inválido.` });
    const publicId = proyecto.imagenesID[idx];
    if (publicId) { try { await eliminarImagenCloudinary(publicId); } catch (e) { console.error(e); } }
    proyecto.imagenes.splice(idx, 1);
    proyecto.imagenesID.splice(idx, 1);
    await proyecto.save();
    res.status(200).json({ success: true, message: 'Imagen eliminada correctamente', data: { imagenes: proyecto.imagenes, total: proyecto.imagenes.length } });
  } catch (error) { res.status(500).json({ success: false, message: 'Error al eliminar la imagen', error: error.message }); }
};

export const actualizarProyectoColaborador = async (req, res) => {
  try {
    const { id } = req.params;
    const estudianteId = req.estudianteBDD._id;
    req.body = req.body ?? {};
    const proyecto = await Proyecto.findById(id);
    if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    const esColaborador = proyecto.colaboradores.some(c => c.toString() === estudianteId.toString());
    if (!esColaborador) return res.status(403).json({ success: false, message: 'No eres colaborador de este proyecto' });
    const errorRegla = validarEditable(proyecto);
    if (errorRegla) return res.status(403).json({ success: false, message: errorRegla });
    const camposPermitidos = ['descripcion', 'tecnologias', 'repositorio', 'enlaceDemo', 'tags', 'lineaInvestigacion'];
    const datosActualizacion = {};
    for (const campo of camposPermitidos) {
      if (req.body[campo] !== undefined) datosActualizacion[campo] = req.body[campo];
    }
    if (req.files?.imagenes) {
      const archivos = Array.isArray(req.files.imagenes) ? req.files.imagenes : [req.files.imagenes];
      const actualesCount = proyecto.imagenes?.length ?? 0;
      if (actualesCount + archivos.length > 5) return res.status(400).json({ success: false, message: `Máximo 5 imágenes.` });
      const subidas = await Promise.all(archivos.map(a => subirImagenCloudinary(a.tempFilePath, 'Proyectos')));
      datosActualizacion.imagenes   = [...(proyecto.imagenes ?? []),   ...subidas.map(s => s.secure_url)];
      datosActualizacion.imagenesID = [...(proyecto.imagenesID ?? []), ...subidas.map(s => s.public_id)];
    }
    if (Object.keys(datosActualizacion).length === 0) return res.status(400).json({ success: false, message: 'No se enviaron campos válidos para actualizar' });
    if (proyecto.estado === 'rechazado') datosActualizacion.estado = 'pendiente';
    const proyectoActualizado = await Proyecto.findByIdAndUpdate(id, { $set: datosActualizacion }, { new: true, runValidators: true })
      .populate('autor', 'nombre apellido carrera email').populate('colaboradores', 'nombre apellido carrera');
    res.status(200).json({ success: true, message: 'Proyecto actualizado por colaborador', data: proyectoActualizado });
  } catch (error) { res.status(500).json({ success: false, message: 'Error al actualizar el proyecto', error: error.message }); }
};

export const eliminarImagenColaborador = async (req, res) => {
  try {
    const { id } = req.params;
    const { indice } = req.body;
    const estudianteId = req.estudianteBDD._id;
    if (indice === undefined || indice === null) return res.status(400).json({ success: false, message: 'Debes indicar el índice de la imagen a eliminar' });
    const proyecto = await Proyecto.findById(id);
    if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    const esColaborador = proyecto.colaboradores.some(c => c.toString() === estudianteId.toString());
    if (!esColaborador) return res.status(403).json({ success: false, message: 'No eres colaborador de este proyecto' });
    const errorRegla = validarEditable(proyecto);
    if (errorRegla) return res.status(403).json({ success: false, message: errorRegla });
    const idx = parseInt(indice);
    if (isNaN(idx) || idx < 0 || idx >= proyecto.imagenes.length) return res.status(400).json({ success: false, message: `Índice inválido.` });
    const publicId = proyecto.imagenesID[idx];
    if (publicId) { try { await eliminarImagenCloudinary(publicId); } catch (e) { console.error(e); } }
    proyecto.imagenes.splice(idx, 1);
    proyecto.imagenesID.splice(idx, 1);
    await proyecto.save();
    res.status(200).json({ success: true, message: 'Imagen eliminada correctamente', data: { imagenes: proyecto.imagenes, total: proyecto.imagenes.length } });
  } catch (error) { res.status(500).json({ success: false, message: 'Error al eliminar la imagen', error: error.message }); }
};
