import Proyecto from '../models/Proyecto.js';
import Estudiante from '../models/Estudiante.js';
import { subirImagenCloudinary, eliminarImagenCloudinary } from '../helpers/uploadCloudinary.js';
import { generarProyectoId, siguienteVersion } from '../helpers/generarProyectoId.js';
import { validarEditable, rolesEnProyecto } from '../helpers/reglasProyecto.js';

// ─────────────────────────────────────────────────────────────────────────────
// LANDING — solo aprobado + publico + activo
// ─────────────────────────────────────────────────────────────────────────────
export const listarProyectos = async (req, res) => {
  try {
    const {
      page     = 1,
      limit    = 10,
      categoria,
      carrera,
      q,
      sort     = '-createdAt',
    } = req.query;

    const filtro = {
      estado: 'aprobado',
      tipoProyecto: 'publico',
      activo: true,
      esUltimaVersion: true,
    };
    if (categoria) filtro.categoria = categoria;
    if (carrera)   filtro.carrera   = decodeURIComponent(carrera);
    if (q?.trim()) filtro.$text     = { $search: q.trim() };

    const [proyectos, total] = await Promise.all([
      Proyecto.find(filtro)
        .populate('autor', 'nombre apellido carrera email')
        .sort(sort)
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
        .lean(),
      Proyecto.countDocuments(filtro),
    ]);

    res.status(200).json({
      success: true,
      data: proyectos,
      pagination: {
        total,
        page:       parseInt(page),
        totalPages: Math.ceil(total / limit),
        limit:      parseInt(limit),
      },
    });
  } catch (error) {
    console.error('Error al listar proyectos:', error);
    res.status(500).json({ success: false, message: 'Error al obtener los proyectos', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// MIS PROYECTOS — proyectos propios y donde es colaborador
// Solo muestra la última versión de cada proyecto_id
// ─────────────────────────────────────────────────────────────────────────────
export const misProyectos = async (req, res) => {
  try {
    const usuarioId = req.estudianteBDD._id;
    const {
      page      = 1,
      limit     = 10,
      estado,
      tipoProyecto,
      categoria,
      sort      = '-createdAt',
    } = req.query;

    const filtro = {
      $or: [{ autor: usuarioId }, { colaboradores: usuarioId }],
      esUltimaVersion: true,
      activo: true,
    };
    if (estado)        filtro.estado        = estado;
    if (tipoProyecto)  filtro.tipoProyecto  = tipoProyecto;
    if (categoria)     filtro.categoria     = categoria;

    const [proyectos, total] = await Promise.all([
      Proyecto.find(filtro)
        .populate('autor', 'nombre apellido carrera email')
        .populate('colaboradores', 'nombre apellido carrera')
        .sort(sort)
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
        .lean(),
      Proyecto.countDocuments(filtro),
    ]);

    const proyectosConRol = proyectos.map(p => ({
      ...p,
      rolEnProyecto: p.autor._id.toString() === usuarioId.toString() ? 'autor' : 'colaborador',
    }));

    res.status(200).json({
      success: true,
      data: proyectosConRol,
      pagination: {
        total,
        page:       parseInt(page),
        totalPages: Math.ceil(total / limit),
        limit:      parseInt(limit),
      },
    });
  } catch (error) {
    console.error('Error al listar mis proyectos:', error);
    res.status(500).json({ success: false, message: 'Error al obtener tus proyectos', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// HISTORIAL DE VERSIONES de un proyecto_id
// ─────────────────────────────────────────────────────────────────────────────
export const historialVersiones = async (req, res) => {
  try {
    const { proyectoId } = req.params;  // proyecto_id, ej. DSW-2026-001
    const usuarioId = req.estudianteBDD._id;

    const versiones = await Proyecto.find({ proyecto_id: proyectoId })
      .populate('autor', 'nombre apellido carrera email')
      .sort({ version: 1 })
      .lean();

    if (!versiones.length) {
      return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    }

    // Verificar acceso: autor, colaborador, o proyecto público+aprobado
    const ultima = versiones[versiones.length - 1];
    const { esAutor, esColaborador } = rolesEnProyecto(ultima, usuarioId);
    const esPublicoAprobado = ultima.tipoProyecto === 'publico' && ultima.estado === 'aprobado';

    if (!esAutor && !esColaborador && !esPublicoAprobado) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para ver este proyecto' });
    }

    res.status(200).json({ success: true, total: versiones.length, data: versiones });
  } catch (error) {
    console.error('Error al obtener historial:', error);
    res.status(500).json({ success: false, message: 'Error al obtener el historial de versiones', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// OBTENER UN PROYECTO (por _id de MongoDB)
// ─────────────────────────────────────────────────────────────────────────────
export const obtenerProyecto = async (req, res) => {
  try {
    const { id } = req.params;
    const estudianteId = req.estudianteBDD?._id;

    const proyecto = await Proyecto.findById(id)
      .populate('autor', 'nombre apellido carrera email')
      .populate('colaboradores', 'nombre apellido carrera')
      .populate('comentarios.estudiante', 'nombre apellido');

    if (!proyecto) {
      return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    }

    const { esAutor, esColaborador } = estudianteId
      ? rolesEnProyecto(proyecto, estudianteId)
      : { esAutor: false, esColaborador: false };

    const esAdmin       = req.estudianteBDD?.rol === 'admin';
    const esPublicoAprobado = proyecto.tipoProyecto === 'publico'
      && proyecto.estado === 'aprobado'
      && proyecto.activo;

    if (!esPublicoAprobado && !esAutor && !esColaborador && !esAdmin) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para ver este proyecto' });
    }

    if (esPublicoAprobado) await proyecto.incrementarVistas();

    res.status(200).json({ success: true, data: proyecto });
  } catch (error) {
    console.error('Error al obtener proyecto:', error);
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

    // Generar proyecto_id automático
    const proyectoIdGenerado = await generarProyectoId(req.body.carrera);

    const nuevoProyecto = new Proyecto({
      ...req.body,
      autor:          usuarioId,
      estado:         'pendiente',
      proyecto_id:    proyectoIdGenerado,
      version:        '001',
      esUltimaVersion: true,
      // tipoProyecto viene del body ('publico' o 'privado'), default 'privado'
    });

    if (req.files?.imagenes) {
      const archivos = Array.isArray(req.files.imagenes)
        ? req.files.imagenes
        : [req.files.imagenes];
      const subidas = await Promise.all(
        archivos.slice(0, 5).map(a => subirImagenCloudinary(a.tempFilePath, 'Proyectos'))
      );
      nuevoProyecto.imagenes   = subidas.map(s => s.secure_url);
      nuevoProyecto.imagenesID = subidas.map(s => s.public_id);
    }

    await nuevoProyecto.save();
    await nuevoProyecto.populate('autor', 'nombre apellido carrera email');

    res.status(201).json({
      success:    true,
      message:    'Proyecto creado exitosamente. Está pendiente de revisión.',
      proyecto_id: proyectoIdGenerado,
      version:    '001',
      data:       nuevoProyecto,
    });
  } catch (error) {
    console.error('Error al crear proyecto:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: Object.values(error.errors).map(e => e.message),
      });
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

    // Un proyecto público no puede cambiarse a privado
    if (
      proyecto.tipoProyecto === 'publico' &&
      req.body.tipoProyecto === 'privado'
    ) {
      return res.status(400).json({ success: false, message: 'Un proyecto público no puede cambiarse a privado' });
    }

    const camposPermitidos = [
      'titulo', 'descripcion', 'categoria', 'lineaInvestigacion',
      'fechaInicio', 'fechaFin', 'tecnologias', 'repositorio',
      'enlaceDemo', 'tags', 'carrera', 'tipoProyecto',
    ];

    const datosActualizacion = {};
    for (const campo of camposPermitidos) {
      if (req.body[campo] !== undefined) datosActualizacion[campo] = req.body[campo];
    }

    if (req.files?.imagenes) {
      const archivos = Array.isArray(req.files.imagenes) ? req.files.imagenes : [req.files.imagenes];
      const actualesCount = proyecto.imagenes?.length ?? 0;
      if (actualesCount + archivos.length > 5) {
        return res.status(400).json({
          success: false,
          message: `Máximo 5 imágenes. Ya tiene ${actualesCount} y estás intentando agregar ${archivos.length}.`,
        });
      }
      const subidas = await Promise.all(archivos.map(a => subirImagenCloudinary(a.tempFilePath, 'Proyectos')));
      datosActualizacion.imagenes   = [...(proyecto.imagenes ?? []),   ...subidas.map(s => s.secure_url)];
      datosActualizacion.imagenesID = [...(proyecto.imagenesID ?? []), ...subidas.map(s => s.public_id)];
    }

    // Al editar un proyecto rechazado vuelve a pendiente
    if (proyecto.estado === 'rechazado') {
      datosActualizacion.estado = 'pendiente';
    }

    const proyectoActualizado = await Proyecto.findByIdAndUpdate(
      id,
      { $set: datosActualizacion },
      { new: true, runValidators: true }
    ).populate('autor', 'nombre apellido carrera email')
     .populate('colaboradores', 'nombre apellido carrera');

    res.status(200).json({ success: true, message: 'Proyecto actualizado exitosamente', data: proyectoActualizado });
  } catch (error) {
    console.error('Error al actualizar proyecto:', error);
    res.status(500).json({ success: false, message: 'Error al actualizar el proyecto', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CREAR NUEVA VERSIÓN
// Copia la última versión como base, incrementa version, marca la anterior
// como esUltimaVersion=false. Solo autor o colaborador pueden hacerlo y
// deben cumplir las mismas reglas de editabilidad.
// ─────────────────────────────────────────────────────────────────────────────
export const crearNuevaVersion = async (req, res) => {
  try {
    const { id } = req.params;   // _id de la versión actual (debe ser la última)
    const usuarioId = req.estudianteBDD._id;
    req.body = req.body ?? {};

    const versionActual = await Proyecto.findById(id);
    if (!versionActual) {
      return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    }

    const { esAutor, esColaborador } = rolesEnProyecto(versionActual, usuarioId);
    if (!esAutor && !esColaborador) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para versionar este proyecto' });
    }

    const errorRegla = validarEditable(versionActual);
    if (errorRegla) return res.status(403).json({ success: false, message: errorRegla });

    // Un proyecto público no puede cambiarse a privado
    if (
      versionActual.tipoProyecto === 'publico' &&
      req.body.tipoProyecto === 'privado'
    ) {
      return res.status(400).json({ success: false, message: 'Un proyecto público no puede cambiarse a privado' });
    }

    // Calcular siguiente número de versión
    const nuevaVersion = await siguienteVersion(versionActual.proyecto_id);

    // Campos que el autor/colaborador puede sobreescribir en la nueva versión
    const camposPermitidos = [
      'titulo', 'descripcion', 'categoria', 'lineaInvestigacion',
      'fechaInicio', 'fechaFin', 'tecnologias', 'repositorio',
      'enlaceDemo', 'tags', 'carrera', 'tipoProyecto',
    ];

    // Construir datos de la nueva versión: base = versión actual + cambios del body
    const datosNuevaVersion = {
      proyecto_id:      versionActual.proyecto_id,
      version:          nuevaVersion,
      esUltimaVersion:  true,
      autor:            versionActual.autor,
      colaboradores:    versionActual.colaboradores,
      estado:           'pendiente',         // siempre pendiente al versionar
      motivoRechazo:    '',
      tipoProyecto:     versionActual.tipoProyecto,
      activo:           true,
      // Copiar campos base de la versión actual
      titulo:           versionActual.titulo,
      descripcion:      versionActual.descripcion,
      categoria:        versionActual.categoria,
      lineaInvestigacion: versionActual.lineaInvestigacion,
      fechaInicio:      versionActual.fechaInicio,
      fechaFin:         versionActual.fechaFin,
      tecnologias:      [...(versionActual.tecnologias ?? [])],
      repositorio:      versionActual.repositorio,
      enlaceDemo:       versionActual.enlaceDemo,
      tags:             [...(versionActual.tags ?? [])],
      carrera:          versionActual.carrera,
      imagenes:         [...(versionActual.imagenes ?? [])],
      imagenesID:       [...(versionActual.imagenesID ?? [])],
      vistas:           0,
      likes:            [],
      comentarios:      [],
    };

    // Aplicar cambios del body (solo campos permitidos)
    for (const campo of camposPermitidos) {
      if (req.body[campo] !== undefined) datosNuevaVersion[campo] = req.body[campo];
    }

    // Imágenes nuevas (reemplazan las copiadas si se envían)
    if (req.files?.imagenes) {
      const archivos = Array.isArray(req.files.imagenes) ? req.files.imagenes : [req.files.imagenes];
      if (archivos.length > 5) {
        return res.status(400).json({ success: false, message: 'Máximo 5 imágenes por proyecto' });
      }
      const subidas = await Promise.all(archivos.map(a => subirImagenCloudinary(a.tempFilePath, 'Proyectos')));
      datosNuevaVersion.imagenes   = subidas.map(s => s.secure_url);
      datosNuevaVersion.imagenesID = subidas.map(s => s.public_id);
    }

    // Marcar versión anterior como ya no es la última
    await Proyecto.findByIdAndUpdate(id, { $set: { esUltimaVersion: false } });

    // Crear el nuevo documento de versión
    const nuevaVersionDoc = await Proyecto.create(datosNuevaVersion);
    await nuevaVersionDoc.populate('autor', 'nombre apellido carrera email');

    res.status(201).json({
      success:  true,
      message:  `Versión ${nuevaVersion} creada exitosamente. Queda pendiente de revisión.`,
      proyecto_id: versionActual.proyecto_id,
      version:  nuevaVersion,
      data:     nuevaVersionDoc,
    });
  } catch (error) {
    console.error('Error al crear nueva versión:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: Object.values(error.errors).map(e => e.message),
      });
    }
    res.status(500).json({ success: false, message: 'Error al crear la nueva versión', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ELIMINAR PROYECTO (autor)
// - Privado  → borrado físico permanente
// - Público  → borrado lógico (activo = false) en TODAS las versiones
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

    if (proyecto.tipoProyecto === 'privado') {
      // Borrado físico: eliminar todas las versiones e imágenes de Cloudinary
      const todasVersiones = await Proyecto.find({ proyecto_id: proyecto.proyecto_id });
      for (const v of todasVersiones) {
        if (v.imagenesID?.length > 0) {
          for (const pid of v.imagenesID) {
            try { await eliminarImagenCloudinary(pid); } catch (e) { console.error(e); }
          }
        }
        await Proyecto.findByIdAndDelete(v._id);
      }
      return res.status(200).json({ success: true, message: 'Proyecto eliminado permanentemente' });
    }

    // Borrado lógico: desactivar todas las versiones
    await Proyecto.updateMany(
      { proyecto_id: proyecto.proyecto_id },
      { $set: { activo: false } }
    );
    res.status(200).json({ success: true, message: 'Proyecto desactivado (borrado lógico)' });
  } catch (error) {
    console.error('Error al eliminar proyecto:', error);
    res.status(500).json({ success: false, message: 'Error al eliminar el proyecto', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PROYECTOS DESTACADOS — landing
// ─────────────────────────────────────────────────────────────────────────────
export const proyectosDestacados = async (req, res) => {
  try {
    const proyectos = await Proyecto.find({
      estado: 'aprobado',
      tipoProyecto: 'publico',
      activo: true,
      esUltimaVersion: true,
    })
      .populate('autor', 'nombre apellido carrera')
      .sort('-vistas')
      .limit(6);
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
    if (!q?.trim()) {
      return res.status(400).json({ success: false, message: 'Proporciona un término de búsqueda' });
    }
    const filtro = {
      estado: 'aprobado',
      tipoProyecto: 'publico',
      activo: true,
      esUltimaVersion: true,
      $text: { $search: q.trim() },
    };
    if (categoria) filtro.categoria = categoria;
    if (carrera)   filtro.carrera   = decodeURIComponent(carrera);

    const proyectos = await Proyecto.find(filtro)
      .populate('autor', 'nombre apellido carrera')
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    res.status(200).json({ success: true, data: proyectos, total: proyectos.length });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al buscar proyectos', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POR CATEGORÍA — landing
// ─────────────────────────────────────────────────────────────────────────────
export const listarProyectosPorCategoria = async (req, res) => {
  try {
    const { tipo } = req.params;
    const { page = 1, limit = 10 } = req.query;
    if (!['academico', 'extracurricular'].includes(tipo)) {
      return res.status(400).json({ success: false, message: 'Categoría inválida' });
    }
    const filtro = { categoria: tipo, estado: 'aprobado', tipoProyecto: 'publico', activo: true, esUltimaVersion: true };
    const [proyectos, total] = await Promise.all([
      Proyecto.find(filtro).populate('autor', 'nombre apellido carrera').sort('-createdAt')
        .limit(Number(limit)).skip((Number(page) - 1) * Number(limit)),
      Proyecto.countDocuments(filtro),
    ]);
    res.status(200).json({ success: true, data: proyectos, pagination: { total, page: parseInt(page), totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener proyectos', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POR CARRERA — landing
// ─────────────────────────────────────────────────────────────────────────────
export const listarProyectosPorCarrera = async (req, res) => {
  try {
    const { carrera } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const filtro = { carrera: decodeURIComponent(carrera), estado: 'aprobado', tipoProyecto: 'publico', activo: true, esUltimaVersion: true };
    const proyectos = await Proyecto.find(filtro).populate('autor', 'nombre apellido carrera').sort('-createdAt')
      .limit(Number(limit)).skip((Number(page) - 1) * Number(limit));
    res.status(200).json({ success: true, data: proyectos });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener proyectos', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POR ESTUDIANTE — landing
// ─────────────────────────────────────────────────────────────────────────────
export const listarProyectosPorEstudiante = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const filtro = { autor: id, estado: 'aprobado', tipoProyecto: 'publico', activo: true, esUltimaVersion: true };
    const proyectos = await Proyecto.find(filtro).populate('autor', 'nombre apellido carrera').sort('-createdAt')
      .limit(Number(limit)).skip((Number(page) - 1) * Number(limit));
    res.status(200).json({ success: true, data: proyectos });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener proyectos', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// INTERACCIONES
// ─────────────────────────────────────────────────────────────────────────────
const verificarAccesoInteraccion = (proyecto, estudianteId) => {
  const esAutor   = proyecto.autor.toString() === estudianteId.toString();
  const esPublico = proyecto.estado === 'aprobado' && proyecto.tipoProyecto === 'publico';
  return esAutor || esPublico;
};

export const agregarLike = async (req, res) => {
  try {
    const proyecto = await Proyecto.findById(req.params.id);
    if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    if (!verificarAccesoInteraccion(proyecto, req.estudianteBDD._id)) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para interactuar con este proyecto' });
    }
    await proyecto.agregarLike(req.estudianteBDD._id);
    res.status(200).json({ success: true, message: 'Like agregado', likes: proyecto.likes.length });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al agregar like', error: error.message });
  }
};

export const quitarLike = async (req, res) => {
  try {
    const proyecto = await Proyecto.findById(req.params.id);
    if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    if (!verificarAccesoInteraccion(proyecto, req.estudianteBDD._id)) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para interactuar con este proyecto' });
    }
    await proyecto.quitarLike(req.estudianteBDD._id);
    res.status(200).json({ success: true, message: 'Like quitado', likes: proyecto.likes.length });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al quitar like', error: error.message });
  }
};

export const agregarComentario = async (req, res) => {
  try {
    const { texto } = req.body;
    if (!texto?.trim()) return res.status(400).json({ success: false, message: 'El comentario no puede estar vacío' });
    const proyecto = await Proyecto.findById(req.params.id);
    if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    if (!verificarAccesoInteraccion(proyecto, req.estudianteBDD._id)) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para interactuar con este proyecto' });
    }
    proyecto.comentarios.push({ estudiante: req.estudianteBDD._id, texto: texto.trim(), fecha: new Date() });
    await proyecto.save();
    await proyecto.populate('comentarios.estudiante', 'nombre apellido');
    res.status(201).json({ success: true, message: 'Comentario agregado', data: proyecto.comentarios });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al agregar comentario', error: error.message });
  }
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
    if (comentario.estudiante.toString() !== estudianteId.toString() && !esAdmin) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para eliminar este comentario' });
    }
    comentario.deleteOne();
    await proyecto.save();
    res.status(200).json({ success: true, message: 'Comentario eliminado' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al eliminar comentario', error: error.message });
  }
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
    if (proyecto.autor.toString() !== usuarioId.toString()) {
      return res.status(403).json({ success: false, message: 'Solo el autor puede gestionar colaboradores' });
    }
    const colaborador = await Estudiante
      .findOne({ email: email.toLowerCase().trim() })
      .select('+confirmEmail +estado +rol');
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
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al agregar colaborador', error: error.message });
  }
};

export const eliminarColaborador = async (req, res) => {
  try {
    const { id, colaboradorId } = req.params;
    const usuarioId = req.estudianteBDD._id;
    const proyecto = await Proyecto.findById(id);
    if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    if (proyecto.autor.toString() !== usuarioId.toString()) {
      return res.status(403).json({ success: false, message: 'Solo el autor puede gestionar colaboradores' });
    }
    proyecto.colaboradores = proyecto.colaboradores.filter(c => c.toString() !== colaboradorId);
    await proyecto.save();
    await proyecto.populate('colaboradores', 'nombre apellido email carrera');
    res.status(200).json({ success: true, message: 'Colaborador eliminado', colaboradores: proyecto.colaboradores });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al eliminar colaborador', error: error.message });
  }
};

export const listarColaboradores = async (req, res) => {
  try {
    const proyecto = await Proyecto.findById(req.params.id).populate('colaboradores', 'nombre apellido email carrera semestre');
    if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    res.status(200).json({ success: true, total: proyecto.colaboradores.length, data: proyecto.colaboradores });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener colaboradores', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ELIMINAR IMAGEN ESPECÍFICA (autor)
// ─────────────────────────────────────────────────────────────────────────────
export const eliminarImagenProyecto = async (req, res) => {
  try {
    const { id } = req.params;
    const { indice } = req.body;
    const estudianteId = req.estudianteBDD._id;

    if (indice === undefined || indice === null) {
      return res.status(400).json({ success: false, message: 'Debes indicar el índice de la imagen a eliminar (indice: 0-4)' });
    }
    const proyecto = await Proyecto.findById(id);
    if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    if (proyecto.autor.toString() !== estudianteId.toString()) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para editar este proyecto' });
    }

    const errorRegla = validarEditable(proyecto);
    if (errorRegla) return res.status(403).json({ success: false, message: errorRegla });

    const idx = parseInt(indice);
    if (isNaN(idx) || idx < 0 || idx >= proyecto.imagenes.length) {
      return res.status(400).json({ success: false, message: `Índice inválido. El proyecto tiene ${proyecto.imagenes.length} imagen(es).` });
    }
    const publicId = proyecto.imagenesID[idx];
    if (publicId) {
      try { await eliminarImagenCloudinary(publicId); } catch (e) { console.error(e); }
    }
    proyecto.imagenes.splice(idx, 1);
    proyecto.imagenesID.splice(idx, 1);
    await proyecto.save();
    res.status(200).json({ success: true, message: 'Imagen eliminada correctamente', data: { imagenes: proyecto.imagenes, total: proyecto.imagenes.length } });
  } catch (error) {
    console.error('Error al eliminar imagen:', error);
    res.status(500).json({ success: false, message: 'Error al eliminar la imagen', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ACTUALIZAR PROYECTO (colaborador) — mismas reglas de editabilidad
// ─────────────────────────────────────────────────────────────────────────────
export const actualizarProyectoColaborador = async (req, res) => {
  try {
    const { id } = req.params;
    const estudianteId = req.estudianteBDD._id;
    req.body = req.body ?? {};

    const proyecto = await Proyecto.findById(id);
    if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });

    const esColaborador = proyecto.colaboradores.some(c => c.toString() === estudianteId.toString());
    if (!esColaborador) {
      return res.status(403).json({ success: false, message: 'No eres colaborador de este proyecto' });
    }

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
      if (actualesCount + archivos.length > 5) {
        return res.status(400).json({ success: false, message: `Máximo 5 imágenes. Ya tiene ${actualesCount}.` });
      }
      const subidas = await Promise.all(archivos.map(a => subirImagenCloudinary(a.tempFilePath, 'Proyectos')));
      datosActualizacion.imagenes   = [...(proyecto.imagenes ?? []),   ...subidas.map(s => s.secure_url)];
      datosActualizacion.imagenesID = [...(proyecto.imagenesID ?? []), ...subidas.map(s => s.public_id)];
    }

    if (Object.keys(datosActualizacion).length === 0) {
      return res.status(400).json({ success: false, message: 'No se enviaron campos válidos para actualizar' });
    }

    if (proyecto.estado === 'rechazado') {
      datosActualizacion.estado = 'pendiente';
    }

    const proyectoActualizado = await Proyecto.findByIdAndUpdate(
      id,
      { $set: datosActualizacion },
      { new: true, runValidators: true }
    ).populate('autor', 'nombre apellido carrera email')
     .populate('colaboradores', 'nombre apellido carrera');

    res.status(200).json({ success: true, message: 'Proyecto actualizado por colaborador', data: proyectoActualizado });
  } catch (error) {
    console.error('Error al actualizar proyecto como colaborador:', error);
    res.status(500).json({ success: false, message: 'Error al actualizar el proyecto', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ELIMINAR IMAGEN (colaborador)
// ─────────────────────────────────────────────────────────────────────────────
export const eliminarImagenColaborador = async (req, res) => {
  try {
    const { id } = req.params;
    const { indice } = req.body;
    const estudianteId = req.estudianteBDD._id;

    if (indice === undefined || indice === null) {
      return res.status(400).json({ success: false, message: 'Debes indicar el índice de la imagen a eliminar' });
    }
    const proyecto = await Proyecto.findById(id);
    if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });

    const esColaborador = proyecto.colaboradores.some(c => c.toString() === estudianteId.toString());
    if (!esColaborador) return res.status(403).json({ success: false, message: 'No eres colaborador de este proyecto' });

    const errorRegla = validarEditable(proyecto);
    if (errorRegla) return res.status(403).json({ success: false, message: errorRegla });

    const idx = parseInt(indice);
    if (isNaN(idx) || idx < 0 || idx >= proyecto.imagenes.length) {
      return res.status(400).json({ success: false, message: `Índice inválido. El proyecto tiene ${proyecto.imagenes.length} imagen(es).` });
    }
    const publicId = proyecto.imagenesID[idx];
    if (publicId) {
      try { await eliminarImagenCloudinary(publicId); } catch (e) { console.error(e); }
    }
    proyecto.imagenes.splice(idx, 1);
    proyecto.imagenesID.splice(idx, 1);
    await proyecto.save();
    res.status(200).json({ success: true, message: 'Imagen eliminada correctamente', data: { imagenes: proyecto.imagenes, total: proyecto.imagenes.length } });
  } catch (error) {
    console.error('Error al eliminar imagen como colaborador:', error);
    res.status(500).json({ success: false, message: 'Error al eliminar la imagen', error: error.message });
  }
};
