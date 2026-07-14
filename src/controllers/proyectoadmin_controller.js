import Proyecto from '../models/Proyecto.js';
import { manejarError } from '../helpers/manejarError.js';

// ─────────────────────────────────────────────────────────────────────────────
// LISTAR TODOS LOS PROYECTOS — admin
// Solo ve proyectos con enviarAlAdmin=true + activo=true
// Query params: ?categoria=academico|extracurricular  ?q=texto  ?estado=  ?autor=  ?sort=  ?page=  ?limit=
// ─────────────────────────────────────────────────────────────────────────────
export const listarTodosProyectos = async (req, res) => {
  try {
    const { page = 1, limit = 10, estado, categoria, autor, q, sort = '-createdAt', activo } = req.query;
    const filtro = { enviarAlAdmin: true, esUltimaVersion: true };

    if (activo === undefined || activo === '') {
      filtro.activo = true;              // comportamiento actual por defecto (botón "Activos")
    } else if (activo !== 'todos') {
      filtro.activo = activo === 'true'; // 'true' → activos, 'false' → inactivos
    }
    // si activo === 'todos', no se agrega la condición → trae ambos
    if (estado)    filtro.estado    = String(estado);
    if (categoria) {
      if (!['academico', 'extracurricular'].includes(categoria))
        return res.status(400).json({ success: false, message: 'Categoría inválida' });
      filtro.categoria = categoria;
    }
    if (autor)     filtro.autor     = String(autor);
    if (q?.trim()) filtro.$text     = { $search: q.trim() };

    const [proyectos, total, estadisticas] = await Promise.all([
      Proyecto.find(filtro)
        .populate('autor', 'nombre apellido carrera email')
        .populate('colaboradores', 'nombre apellido carrera')
        .sort(sort).limit(Number(limit)).skip((Number(page) - 1) * Number(limit)).lean(),
      Proyecto.countDocuments(filtro),
      Proyecto.aggregate([{ $match: filtro }, { $group: { _id: '$estado', count: { $sum: 1 } } }]),
    ]);
    res.status(200).json({ success: true, data: proyectos, estadisticas, pagination: { total, page: parseInt(page), totalPages: Math.ceil(total / limit), limit: parseInt(limit) } });
  } catch (error) {
    manejarError(res, 500, 'Error al obtener los proyectos', error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// OBTENER UN PROYECTO (admin)
// ─────────────────────────────────────────────────────────────────────────────
export const obtenerProyectoAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const proyecto = await Proyecto.findById(id)
      .populate('autor', 'nombre apellido carrera email')
      .populate('colaboradores', 'nombre apellido carrera')
      .populate('comentarios.estudiante', 'nombre apellido');
    if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    if (!proyecto.enviarAlAdmin) {
      return res.status(403).json({ success: false, message: 'Los proyectos no enviados al admin no son accesibles desde el panel de administración' });
    }
    res.status(200).json({ success: true, data: proyecto });
  } catch (error) {
    manejarError(res, 500, 'Error al obtener el proyecto', error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DESACTIVAR PROYECTO (admin)
//
// Reglas:
//   ✅ Se puede desactivar: estado pendiente o rechazado  +  publico=false
//   ❌ NO se puede desactivar: estado aprobado  O  publico=true
//
// Motivo: un proyecto aprobado y/o publicado ya es visible para el público;
// desactivarlo ocultaría contenido validado sin el proceso correcto.
// ─────────────────────────────────────────────────────────────────────────────
export const desactivarProyectoAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const proyecto = await Proyecto.findById(id);
    if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    if (!proyecto.enviarAlAdmin) {
      return res.status(403).json({ success: false, message: 'Los proyectos no enviados al admin no son accesibles desde el panel de administración' });
    }
    if (!proyecto.activo) {
      return res.status(400).json({ success: false, message: 'El proyecto ya está desactivado' });
    }
    if (proyecto.estado === 'aprobado') {
      return res.status(400).json({
        success: false,
        message: 'No se puede desactivar un proyecto aprobado. Solo se pueden desactivar proyectos en estado pendiente o rechazado que no estén publicados.',
      });
    }
    if (proyecto.publico) {
      return res.status(400).json({
        success: false,
        message: 'No se puede desactivar un proyecto publicado. Solo se pueden desactivar proyectos privados (no publicados) en estado pendiente o rechazado.',
      });
    }
    await Proyecto.updateMany({ proyecto_id: proyecto.proyecto_id }, { $set: { activo: false } });
    res.status(200).json({ success: true, message: 'Proyecto desactivado. Todas las versiones han sido desactivadas.' });
  } catch (error) {
    manejarError(res, 500, 'Error al desactivar el proyecto', error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// REACTIVAR PROYECTO (admin)
// ─────────────────────────────────────────────────────────────────────────────
export const reactivarProyectoAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const proyecto = await Proyecto.findById(id);
    if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    if (!proyecto.enviarAlAdmin) {
      return res.status(403).json({ success: false, message: 'Los proyectos no enviados al admin no son accesibles desde el panel de administración' });
    }
    if (proyecto.activo) return res.status(400).json({ success: false, message: 'El proyecto ya está activo' });
    await Proyecto.updateMany({ proyecto_id: proyecto.proyecto_id }, { $set: { activo: true } });
    res.status(200).json({ success: true, message: 'Proyecto reactivado exitosamente.' });
  } catch (error) {
    manejarError(res, 500, 'Error al reactivar el proyecto', error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// APROBAR PROYECTO (admin)
// ─────────────────────────────────────────────────────────────────────────────
export const aprobarProyecto = async (req, res) => {
  try {
    const { id } = req.params;
    const proyecto = await Proyecto.findById(id);
    if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    if (!proyecto.enviarAlAdmin) {
      return res.status(403).json({ success: false, message: 'Los proyectos no enviados al admin no son accesibles desde el panel de administración' });
    }
    if (proyecto.estado === 'aprobado') return res.status(400).json({ success: false, message: 'El proyecto ya está aprobado' });
    proyecto.estado        = 'aprobado';
    proyecto.motivoRechazo = '';
    await proyecto.save();
    res.status(200).json({ success: true, message: 'Proyecto aprobado exitosamente. El autor puede ahora publicarlo en la landing page.', data: proyecto });
  } catch (error) {
    manejarError(res, 500, 'Error al aprobar el proyecto', error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// RECHAZAR PROYECTO (admin)
// ─────────────────────────────────────────────────────────────────────────────
export const rechazarProyecto = async (req, res) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;
    if (!motivo || !motivo.trim()) {
      return res.status(400).json({ success: false, message: 'El motivo de rechazo es obligatorio' });
    }
    const proyecto = await Proyecto.findById(id);
    if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    if (!proyecto.enviarAlAdmin) {
      return res.status(403).json({ success: false, message: 'Los proyectos no enviados al admin no son accesibles desde el panel de administración' });
    }
    if (proyecto.estado === 'aprobado') return res.status(400).json({ success: false, message: 'No se puede rechazar un proyecto que ya está aprobado.' });
    if (proyecto.estado === 'rechazado') return res.status(400).json({ success: false, message: 'El proyecto ya se encuentra rechazado y no puede volver a rechazarse' });
    proyecto.estado        = 'rechazado';
    proyecto.motivoRechazo = motivo.trim();
    await proyecto.save();
    res.status(200).json({ success: true, message: 'Proyecto rechazado. El autor podrá editarlo y volver a enviarlo.', data: proyecto });
  } catch (error) {
    manejarError(res, 500, 'Error al rechazar el proyecto', error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PROYECTOS DESTACADOS (admin) — top 10 por vistas, cualquier estado
// ─────────────────────────────────────────────────────────────────────────────
export const proyectosDestacadosAdmin = async (req, res) => {
  try {
    const proyectos = await Proyecto.find({ enviarAlAdmin: true, activo: true, esUltimaVersion: true })
      .populate('autor', 'nombre apellido carrera').sort('-vistas').limit(10);
    res.status(200).json({ success: true, data: proyectos });
  } catch (error) {
    manejarError(res, 500, 'Error al obtener proyectos destacados', error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// HISTORIAL DE VERSIONES (admin)
// ─────────────────────────────────────────────────────────────────────────────
export const historialVersionesAdmin = async (req, res) => {
  try {
    const { proyectoId } = req.params;
    const versiones = await Proyecto.find({ proyecto_id: proyectoId, enviarAlAdmin: true })
      .populate('autor', 'nombre apellido carrera email').sort({ version: 1 }).lean();
    if (!versiones.length) return res.status(404).json({ success: false, message: 'Proyecto no encontrado o no enviado al admin' });
    res.status(200).json({ success: true, total: versiones.length, data: versiones });
  } catch (error) {
    manejarError(res, 500, 'Error al obtener el historial de versiones', error);
  }
};
