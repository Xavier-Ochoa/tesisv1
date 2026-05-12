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

    // Base: aprobado y público
    const filtro = { estado: 'aprobado', publico: true };
    if (categoria) filtro.categoria = categoria;
    if (carrera)   filtro.carrera   = decodeURIComponent(carrera);

    // Búsqueda de texto
    if (q && q.trim()) {
      filtro.$text = { $search: q.trim() };
    }

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
      page     = 1,
      limit    = 10,
      estado,
      publico,
      categoria,
      sort     = '-createdAt',
    } = req.query;

    // Traer proyectos donde el usuario es autor O colaborador
    const filtro = {
      $or: [
        { autor: usuarioId },
        { colaboradores: usuarioId },
      ]
    };
    if (estado)                filtro.estado    = estado;
    if (publico !== undefined) filtro.publico   = publico === 'true';
    if (categoria)             filtro.categoria = categoria;

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

    // Marcar si el usuario es autor o colaborador en cada proyecto
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

    const esAutor    = estudianteId && proyecto.autor._id.toString() === estudianteId.toString();
    const esAdmin    = req.estudianteBDD?.rol === 'admin';
    const esPublico  = proyecto.estado === 'aprobado' && proyecto.publico;

    if (!esPublico && !esAutor && !esAdmin) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para ver este proyecto' });
    }

    // Incrementar vistas si es visible públicamente
    if (esPublico) await proyecto.incrementarVistas();

    res.status(200).json({ success: true, data: proyecto });
  } catch (error) {
    console.error('Error al obtener proyecto:', error);
    res.status(500).json({ success: false, message: 'Error al obtener el proyecto', error: error.message });
  }
};

// ===== CREAR PROYECTO — estado siempre pendiente =====
export const crearProyecto = async (req, res) => {
  try {
    const usuarioId = req.estudianteBDD._id;
    req.body = req.body ?? {};

    const nuevoProyecto = new Proyecto({
      ...req.body,
      autor:   usuarioId,
      estado:  'pendiente',   // siempre pendiente, el admin lo aprueba o rechaza
      publico: false,         // empieza privado hasta que el autor lo publique tras aprobación
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

// ===== ACTUALIZAR PROYECTO — solo datos, no estado ni publico =====
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

    // El autor no puede cambiar estado ni publico desde aquí
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

    res.status(200).json({ success: true, message: 'Proyecto actualizado exitosamente', data: proyectoActualizado });
  } catch (error) {
    console.error('Error al actualizar proyecto:', error);
    res.status(500).json({ success: false, message: 'Error al actualizar el proyecto', error: error.message });
  }
};

// ===== PUBLICAR PROYECTO — solo el autor, solo si está aprobado =====
export const publicarProyecto = async (req, res) => {
  try {
    const { id } = req.params;
    const autorId = req.estudianteBDD._id;

    const proyecto = await Proyecto.findById(id);
    if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });

    if (proyecto.autor.toString() !== autorId.toString()) {
      return res.status(403).json({ success: false, message: 'Solo el autor puede publicar su proyecto' });
    }

    if (proyecto.estado !== 'aprobado') {
      return res.status(400).json({
        success: false,
        message: `No puedes publicar este proyecto porque su estado es "${proyecto.estado}". Solo los proyectos aprobados pueden publicarse.`,
      });
    }

    if (proyecto.publico) {
      return res.status(400).json({ success: false, message: 'El proyecto ya está publicado' });
    }

    proyecto.publico = true;
    await proyecto.save();

    res.status(200).json({ success: true, message: 'Proyecto publicado. Ya es visible para todos.', data: proyecto });
  } catch (error) {
    console.error('Error al publicar proyecto:', error);
    res.status(500).json({ success: false, message: 'Error al publicar el proyecto', error: error.message });
  }
};

// ===== DESPUBLICAR PROYECTO — solo el autor =====
export const despublicarProyecto = async (req, res) => {
  try {
    const { id } = req.params;
    const autorId = req.estudianteBDD._id;

    const proyecto = await Proyecto.findById(id);
    if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });

    if (proyecto.autor.toString() !== autorId.toString()) {
      return res.status(403).json({ success: false, message: 'Solo el autor puede despublicar su proyecto' });
    }

    if (!proyecto.publico) {
      return res.status(400).json({ success: false, message: 'El proyecto ya está despublicado' });
    }

    proyecto.publico = false;
    await proyecto.save();

    res.status(200).json({ success: true, message: 'Proyecto despublicado. Ya no es visible públicamente.', data: proyecto });
  } catch (error) {
    console.error('Error al despublicar proyecto:', error);
    res.status(500).json({ success: false, message: 'Error al despublicar el proyecto', error: error.message });
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
    const { q, categoria, carrera, page = 1, limit =
