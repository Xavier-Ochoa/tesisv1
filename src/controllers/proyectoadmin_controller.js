import Proyecto from '../models/Proyecto.js';
import { subirImagenCloudinary, eliminarImagenCloudinary } from '../helpers/uploadCloudinary.js';

// ===== LISTAR TODOS LOS PROYECTOS — admin, sin restricciones + filtros =====
export const listarTodosProyectos = async (req, res) => {
  try {
    const {
      page      = 1,
      limit     = 10,
      estado,
      publico,
      categoria,
      carrera,
      autor,
      q,
      sort      = '-createdAt',
    } = req.query;

    const filtro = {};
    if (estado)                filtro.estado    = estado;
    if (publico !== undefined) filtro.publico   = publico === 'true';
    if (categoria)             filtro.categoria = categoria;
    if (carrera)               filtro.carrera   = decodeURIComponent(carrera);
    if (autor)                 filtro.autor     = autor;
    if (q && q.trim())         filtro.$text     = { $search: q.trim() };

    const [proyectos, total, estadisticas] = await Promise.all([
      Proyecto.find(filtro)
        .populate('autor', 'nombre apellido carrera email')
        .populate('colaboradores', 'nombre apellido carrera')
        .sort(sort)
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
        .lean(),
      Proyecto.countDocuments(filtro),
      // ISSUE 3 FIX: el aggregate ahora respeta el filtro activo
      Proyecto.aggregate([
        { $match: filtro },
        { $group: { _id: '$estado', count: { $sum: 1 } } },
      ]),
    ]);

    res.status(200).json({
      success: true,
      data: proyectos,
      estadisticas,
      pagination: {
        total,
        page:       parseInt(page),
        totalPages: Math.ceil(total / limit),
        limit:      parseInt(limit),
      },
    });
  } catch (error) {
    console.error('Error al listar proyectos (admin):', error);
    res.status(500).json({ success: false, message: 'Error al obtener los proyectos', error: error.message });
  }
};

// ===== OBTENER UN PROYECTO (ADMIN) =====
export const obtenerProyectoAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const proyecto = await Proyecto.findById(id)
      .populate('autor', 'nombre apellido carrera email')
      .populate('colaboradores', 'nombre apellido carrera')
      .populate('comentarios.estudiante', 'nombre apellido');
    if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    res.status(200).json({ success: true, data: proyecto });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener el proyecto', error: error.message });
  }
};

// ===== ACTUALIZAR PROYECTO (ADMIN) — solo datos, no estado =====
export const actualizarProyectoAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    req.body = req.body ?? {};

    const proyecto = await Proyecto.findById(id);
    if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });

    const camposPermitidos = [
      'titulo', 'descripcion', 'categoria', 'asignatura',
      'fechaInicio', 'fechaFin', 'tecnologias', 'repositorio',
      'enlaceDemo', 'tags', 'carrera', 'nivel',
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

    res.status(200).json({ success: true, message: 'Proyecto actualizado', data: proyectoActualizado });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al actualizar el proyecto', error: error.message });
  }
};

// ===== ELIMINAR PROYECTO (ADMIN) =====
export const eliminarProyectoAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const proyecto = await Proyecto.findById(id);
    if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    if (proyecto.imagenesID?.length > 0) {
      for (const pid of proyecto.imagenesID) {
        try { await eliminarImagenCloudinary(pid); } catch (e) { console.error(e); }
      }
    }
    await Proyecto.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: 'Proyecto eliminado exitosamente' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al eliminar el proyecto', error: error.message });
  }
};

// ===== APROBAR PROYECTO (ADMIN) =====
export const aprobarProyecto = async (req, res) => {
  try {
    const { id } = req.params;
    const proyecto = await Proyecto.findById(id);
    if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    if (proyecto.estado === 'aprobado') {
      return res.status(400).json({ success: false, message: 'El proyecto ya está aprobado' });
    }
    proyecto.estado        = 'aprobado';
    proyecto.motivoRechazo = ''; // limpiar si antes fue rechazado
    await proyecto.save();
    res.status(200).json({
      success: true,
      // ISSUE 2 FIX: mensaje actualizado
      message: 'Proyecto aprobado. El autor puede editarlo y marcarlo como público.',
      data: proyecto,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al aprobar el proyecto', error: error.message });
  }
};

// ===== RECHAZAR PROYECTO (ADMIN) =====
export const rechazarProyecto = async (req, res) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;
    const proyecto = await Proyecto.findById(id);
    if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    if (proyecto.estado === 'rechazado') {
      return res.status(400).json({ success: false, message: 'El proyecto ya está rechazado' });
    }
    proyecto.estado        = 'rechazado';
    proyecto.publico       = false; // si estaba público, se despublica automáticamente
    proyecto.motivoRechazo = motivo || '';
    await proyecto.save();
    res.status(200).json({
      success: true,
      message: 'Proyecto rechazado.',
      data: proyecto,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al rechazar el proyecto', error: error.message });
  }
};

// ===== FILTROS ADMIN =====

export const listarProyectosPorCategoriaAdmin = async (req, res) => {
  try {
    const { tipo } = req.params;
    const { page = 1, limit = 10, estado, publico } = req.query;
    if (!['academico', 'extracurricular'].includes(tipo)) {
      return res.status(400).json({ success: false, message: 'Categoría inválida' });
    }
    const filtro = { categoria: tipo };
    if (estado)                filtro.estado  = estado;
    if (publico !== undefined) filtro.publico = publico === 'true';
    const [proyectos, total] = await Promise.all([
      Proyecto.find(filtro).populate('autor', 'nombre apellido carrera').sort('-createdAt')
        .limit(Number(limit)).skip((Number(page) - 1) * Number(limit)),
      Proyecto.countDocuments(filtro),
    ]);
    res.status(200).json({
      success: true,
      data: proyectos,
      pagination: { total, page: parseInt(page), totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener proyectos', error: error.message });
  }
};

export const buscarProyectosAdmin = async (req, res) => {
  try {
    const { q, estado, publico } = req.query;
    if (!q?.trim()) return res.status(400).json({ success: false, message: 'Proporciona un término de búsqueda' });
    const filtro = { $text: { $search: q.trim() } };
    if (estado)                filtro.estado  = estado;
    if (publico !== undefined) filtro.publico = publico === 'true';
    const proyectos = await Proyecto.find(filtro).populate('autor', 'nombre apellido carrera').limit(50);
    res.status(200).json({ success: true, data: proyectos, total: proyectos.length });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al buscar proyectos', error: error.message });
  }
};

export const proyectosDestacadosAdmin = async (req, res) => {
  try {
    const proyectos = await Proyecto.find()
      .populate('autor', 'nombre apellido carrera')
      .sort('-vistas')
      .limit(10);
    res.status(200).json({ success: true, data: proyectos });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener proyectos destacados', error: error.message });
  }
};
