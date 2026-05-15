import Proyecto from '../models/Proyecto.js';
import Estudiante from '../models/Estudiante.js';
import { subirImagenCloudinary, eliminarImagenCloudinary } from '../helpers/uploadCloudinary.js';

// ===== LANDING PAGE — solo aprobado + publico:true =====
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

    const filtro = { estado: 'aprobado', publico: true };
    if (categoria) filtro.categoria = categoria;
    if (carrera)   filtro.carrera   = decodeURIComponent(carrera);
    if (q && q.trim()) filtro.$text = { $search: q.trim() };

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

// ===== MIS PROYECTOS — proyectos propios + proyectos donde es colaborador =====
export const misProyectos = async (req, res) => {
  try {
    const usuarioId = req.estudianteBDD._id;
    const {
      page      = 1,
      limit     = 10,
      estado,
      publico,
      categoria,
      sort      = '-createdAt',
    } = req.query;

    const filtro = {
      $or: [
        { autor: usuarioId },
        { colaboradores: usuarioId },
      ],
    };
    if (estado)            filtro.estado    = estado;
    if (publico !== undefined) filtro.publico = publico === 'true';
    if (categoria)         filtro.categoria = categoria;

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

// ===== OBTENER UN PROYECTO =====
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

    const esAutor   = estudianteId && proyecto.autor._id.toString() === estudianteId.toString();
    const esAdmin   = req.estudianteBDD?.rol === 'admin';
    const esPublico = proyecto.estado === 'aprobado' && proyecto.publico;

    if (!esPublico && !esAutor && !esAdmin) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para ver este proyecto' });
    }

    if (esPublico) await proyecto.incrementarVistas();

    res.status(200).json({ success: true, data: proyecto });
  } catch (error) {
    console.error('Error al obtener proyecto:', error);
    res.status(500).json({ success: false, message: 'Error al obtener el proyecto', error: error.message });
  }
};

// ===== CREAR PROYECTO — estado siempre pendiente, publico viene del body =====
export const crearProyecto = async (req, res) => {
  try {
    const usuarioId = req.estudianteBDD._id;
    req.body = req.body ?? {};

    const nuevoProyecto = new Proyecto({
      ...req.body,
      autor:  usuarioId,
      estado: 'pendiente', // siempre pendiente, el admin lo aprueba o rechaza
      // publico viene del body (true/false según elija el autor)
    });

    if (req.files?.imagen) {
      const { secure_url, public_id } = await subirImagenCloudinary(req.files.imagen.tempFilePath, 'Proyectos');
      nuevoProyecto.imagenes   = [secure_url];
      nuevoProyecto.imagenesID = [public_id];
    }

    await nuevoProyecto.save();
    await nuevoProyecto.populate('autor', 'nombre apellido carrera email');

    res.status(201).json({
      success: true,
      message: 'Proyecto creado. Está pendiente de revisión por el administrador.',
      data: nuevoProyecto,
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

// ===== ACTUALIZAR PROYECTO =====
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

    // El autor puede cambiar publico pero NO el estado
    const camposPermitidos = [
      'titulo', 'descripcion', 'categoria', 'asignatura',
      'fechaInicio', 'fechaFin', 'tecnologias', 'repositorio',
      'enlaceDemo', 'tags', 'carrera', 'nivel', 'publico',
    ];

    const datosActualizacion = {};
    for (const campo of camposPermitidos) {
      if (req.body[campo] !== undefined) datosActualizacion[campo] = req.body[campo];
    }

    if (req.files?.imagen) {
      if (proyecto.imagenesID?.length > 0) {
        for (const pid of proyecto.imagenesID) {
          try { await eliminarImagenCloudinary(pid); } catch (e) { console.error(e); }
        }
      }
      const { secure_url, public_id } = await subirImagenCloudinary(req.files.imagen.tempFilePath, 'Proyectos');
      datosActualizacion.imagenes   = [secure_url];
      datosActualizacion.imagenesID = [public_id];
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

// ===== ELIMINAR PROYECTO =====
export const eliminarProyecto = async (req, res) => {
  try {
    const { id } = req.params;
    const estudianteId = req.estudianteBDD._id;

    const proyecto = await Proyecto.findById(id);
    if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });

    if (proyecto.autor.toString() !== estudianteId.toString()) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para eliminar este proyecto' });
    }

    if (proyecto.imagenesID?.length > 0) {
      for (const pid of proyecto.imagenesID) {
        try { await eliminarImagenCloudinary(pid); } catch (e) { console.error(e); }
      }
    }

    await Proyecto.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: 'Proyecto eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar proyecto:', error);
    res.status(500).json({ success: false, message: 'Error al eliminar el proyecto', error: error.message });
  }
};

// ===== PROYECTOS DESTACADOS — landing =====
export const proyectosDestacados = async (req, res) => {
  try {
    const proyectos = await Proyecto.find({ estado: 'aprobado', publico: true })
      .populate('autor', 'nombre apellido carrera')
      .sort('-vistas')
      .limit(6);
    res.status(200).json({ success: true, data: proyectos });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener proyectos destacados', error: error.message });
  }
};

// ===== BUSCAR — landing =====
export const buscarProyectos = async (req, res) => {
  try {
    const { q, categoria, carrera, page = 1, limit = 10 } = req.query;

    if (!q || !q.trim()) {
      return res.status(400).json({ success: false, message: 'Proporciona un término de búsqueda' });
    }

    const filtro = { estado: 'aprobado', publico: true, $text: { $search: q.trim() } };
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

// ===== POR CATEGORÍA — landing =====
export const listarProyectosPorCategoria = async (req, res) => {
  try {
    const { tipo } = req.params;
    const { page = 1, limit = 10 } = req.query;

    if (!['academico', 'extracurricular'].includes(tipo)) {
      return res.status(400).json({ success: false, message: 'Categoría inválida' });
    }

    const filtro = { categoria: tipo, estado: 'aprobado', publico: true };
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

// ===== POR CARRERA — landing =====
export const listarProyectosPorCarrera = async (req, res) => {
  try {
    const { carrera } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const filtro = { carrera: decodeURIComponent(carrera), estado: 'aprobado', publico: true };
    const proyectos = await Proyecto.find(filtro).populate('autor', 'nombre apellido carrera').sort('-createdAt')
      .limit(Number(limit)).skip((Number(page) - 1) * Number(limit));
    res.status(200).json({ success: true, data: proyectos });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener proyectos', error: error.message });
  }
};

// ===== PROYECTOS DE UN ESTUDIANTE — landing (solo aprobados+publicos) =====
export const listarProyectosPorEstudiante = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const filtro = { autor: id, estado: 'aprobado', publico: true };
    const proyectos = await Proyecto.find(filtro).populate('autor', 'nombre apellido carrera').sort('-createdAt')
      .limit(Number(limit)).skip((Number(page) - 1) * Number(limit));
    res.status(200).json({ success: true, data: proyectos });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener proyectos', error: error.message });
  }
};

// ===== INTERACCIONES =====

const verificarAccesoInteraccion = (proyecto, estudianteId) => {
  const esAutor   = proyecto.autor.toString() === estudianteId.toString();
  const esPublico = proyecto.estado === 'aprobado' && proyecto.publico;
  return esAutor || esPublico;
};

export const agregarLike = async (req, res) => {
  try {
    const { id } = req.params;
    const estudianteId = req.estudianteBDD._id;
    const proyecto = await Proyecto.findById(id);
    if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    if (!verificarAccesoInteraccion(proyecto, estudianteId)) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para interactuar con este proyecto' });
    }
    await proyecto.agregarLike(estudianteId);
    res.status(200).json({ success: true, message: 'Like agregado', likes: proyecto.likes.length });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al agregar like', error: error.message });
  }
};

export const quitarLike = async (req, res) => {
  try {
    const { id } = req.params;
    const estudianteId = req.estudianteBDD._id;
    const proyecto = await Proyecto.findById(id);
    if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    if (!verificarAccesoInteraccion(proyecto, estudianteId)) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para interactuar con este proyecto' });
    }
    await proyecto.quitarLike(estudianteId);
    res.status(200).json({ success: true, message: 'Like quitado', likes: proyecto.likes.length });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al quitar like', error: error.message });
  }
};

export const agregarComentario = async (req, res) => {
  try {
    const { id } = req.params;
    const { texto } = req.body;
    const estudianteId = req.estudianteBDD._id;
    if (!texto?.trim()) return res.status(400).json({ success: false, message: 'El comentario no puede estar vacío' });
    const proyecto = await Proyecto.findById(id);
    if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    if (!verificarAccesoInteraccion(proyecto, estudianteId)) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para interactuar con este proyecto' });
    }
    proyecto.comentarios.push({ estudiante: estudianteId, texto: texto.trim(), fecha: new Date() });
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

// ===== COLABORADORES =====

export const agregarColaborador = async (req, res) => {
  try {
    const { id } = req.params;
    const { colaboradorId } = req.body;
    const usuarioId = req.estudianteBDD._id;
    if (!colaboradorId) return res.status(400).json({ success: false, message: 'Proporciona el ID del colaborador' });
    const proyecto = await Proyecto.findById(id);
    if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    if (proyecto.autor.toString() !== usuarioId.toString()) {
      return res.status(403).json({ success: false, message: 'Solo el autor puede gestionar colaboradores' });
    }
    const colaborador = await Estudiante.findById(colaboradorId);
    if (!colaborador) return res.status(404).json({ success: false, message: 'El usuario colaborador no existe' });
    if (colaborador.rol !== 'estudiante') return res.status(400).json({ success: false, message: 'Solo se pueden agregar estudiantes como colaboradores' });
    if (proyecto.colaboradores.includes(colaboradorId)) return res.status(400).json({ success: false, message: 'El colaborador ya está en el proyecto' });
    proyecto.colaboradores.push(colaboradorId);
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
    const { id } = req.params;
    const proyecto = await Proyecto.findById(id).populate('colaboradores', 'nombre apellido email carrera semestre');
    if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    res.status(200).json({ success: true, total: proyecto.colaboradores.length, data: proyecto.colaboradores });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener colaboradores', error: error.message });
  }
};
