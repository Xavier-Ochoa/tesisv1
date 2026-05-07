import Proyecto from '../models/Proyecto.js';
import { subirImagenCloudinary, eliminarImagenCloudinary } from '../helpers/uploadCloudinary.js';

/**
 * CONTROLADOR DE PROYECTOS PARA ADMINISTRADORES
 * Permite ver, editar y gestionar TODOS los proyectos sin importar su estado
 */

// ===== LISTAR TODOS LOS PROYECTOS (ADMIN) =====
export const listarTodosProyectos = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      estado,
      categoria,
      carrera,
      sort = '-createdAt'
    } = req.query;

    const filtro = {};
    
    // Filtros opcionales
    if (estado) filtro.estado = estado;
    if (categoria) filtro.categoria = categoria;
    if (carrera) filtro.carrera = decodeURIComponent(carrera);

    const proyectos = await Proyecto.find(filtro)
      .populate('autor', 'nombre apellido carrera email')
      .populate('colaboradores', 'nombre apellido carrera')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Proyecto.countDocuments(filtro);

    // Contar proyectos por estado para estadísticas
    const estadisticas = await Proyecto.aggregate([
      { $group: { _id: '$estado', count: { $sum: 1 } } }
    ]);

    res.status(200).json({
      success: true,
      data: proyectos,
      estadisticas,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error('Error al listar proyectos (admin):', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener los proyectos',
      error: error.message,
    });
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

    if (!proyecto) {
      return res.status(404).json({
        success: false,
        message: 'Proyecto no encontrado',
      });
    }

    res.status(200).json({
      success: true,
      data: proyecto,
    });
  } catch (error) {
    console.error('Error al obtener proyecto (admin):', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el proyecto',
      error: error.message,
    });
  }
};

// ===== ACTUALIZAR PROYECTO (ADMIN) =====

export const actualizarProyectoAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const proyecto = await Proyecto.findById(id);

    if (!proyecto) {
      return res.status(404).json({
        success: false,
        message: 'Proyecto no encontrado',
      });
    }

    // Manejar actualización de imagen
    if (req.files?.imagen) {
      // Eliminar imagen anterior de Cloudinary si existe
      if (proyecto.imagenesID && proyecto.imagenesID.length > 0) {
        for (const publicId of proyecto.imagenesID) {
          try {
            await eliminarImagenCloudinary(publicId);
          } catch (error) {
            console.error('Error al eliminar imagen de Cloudinary:', error);
          }
        }
      }

      // Subir nueva imagen
      const { secure_url, public_id } = await subirImagenCloudinary(
        req.files.imagen.tempFilePath,
        'Proyectos'
      );
      
      req.body.imagenes = [secure_url];
      req.body.imagenesID = [public_id];
    }

    const proyectoActualizado = await Proyecto.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    ).populate('autor', 'nombre apellido carrera email')
     .populate('colaboradores', 'nombre apellido carrera');

    res.status(200).json({
      success: true,
      message: 'Proyecto actualizado exitosamente',
      data: proyectoActualizado,
    });
  } catch (error) {
    console.error('Error al actualizar proyecto (admin):', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar el proyecto',
      error: error.message,
    });
  }
};

// ===== ELIMINAR PROYECTO (ADMIN) =====
export const eliminarProyectoAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const proyecto = await Proyecto.findById(id);

    if (!proyecto) {
      return res.status(404).json({
        success: false,
        message: 'Proyecto no encontrado',
      });
    }

    // Eliminar imágenes de Cloudinary si existen
    if (proyecto.imagenesID && proyecto.imagenesID.length > 0) {
      for (const publicId of proyecto.imagenesID) {
        try {
          await eliminarImagenCloudinary(publicId);
        } catch (error) {
          console.error('Error al eliminar imagen de Cloudinary:', error);
        }
      }
    }

    await Proyecto.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Proyecto eliminado exitosamente',
    });
  } catch (error) {
    console.error('Error al eliminar proyecto (admin):', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar el proyecto',
      error: error.message,
    });
  }
};

// ===== PUBLICAR PROYECTO =====
export const publicarProyecto = async (req, res) => {
  try {
    const { id } = req.params;

    const proyecto = await Proyecto.findById(id);

    if (!proyecto) {
      return res.status(404).json({
        success: false,
        message: 'Proyecto no encontrado',
      });
    }

    if (proyecto.estado === 'publicado') {
      return res.status(400).json({
        success: false,
        message: 'El proyecto ya está publicado',
      });
    }

    proyecto.estado = 'publicado';
    await proyecto.save();

    res.status(200).json({
      success: true,
      message: 'Proyecto publicado exitosamente. Ahora es visible para todos los usuarios.',
      data: proyecto,
    });
  } catch (error) {
    console.error('Error al publicar proyecto:', error);
    res.status(500).json({
      success: false,
      message: 'Error al publicar el proyecto',
      error: error.message,
    });
  }
};

// ===== DESPUBLICAR PROYECTO =====
export const despublicarProyecto = async (req, res) => {
  try {
    const { id } = req.params;

    const proyecto = await Proyecto.findById(id);

    if (!proyecto) {
      return res.status(404).json({
        success: false,
        message: 'Proyecto no encontrado',
      });
    }

    if (proyecto.estado === 'en_progreso') {
      return res.status(400).json({
        success: false,
        message: 'El proyecto ya está en estado "en_progreso"',
      });
    }

    proyecto.estado = 'en_progreso';
    await proyecto.save();

    res.status(200).json({
      success: true,
      message: 'Proyecto despublicado. Ahora solo es visible para el autor y administradores.',
      data: proyecto,
    });
  } catch (error) {
    console.error('Error al despublicar proyecto:', error);
    res.status(500).json({
      success: false,
      message: 'Error al despublicar el proyecto',
      error: error.message,
    });
  }
};

// ===== FILTROS ADMIN =====

export const listarProyectosPorCategoriaAdmin = async (req, res) => {
  try {
    const { tipo } = req.params;
    const { page = 1, limit = 10 } = req.query;

    if (!['academico', 'extracurricular'].includes(tipo)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de categoría inválida',
      });
    }

    const proyectos = await Proyecto.find({ categoria: tipo })
      .populate('autor', 'nombre apellido carrera')
      .sort('-createdAt')
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Proyecto.countDocuments({ categoria: tipo });

    res.status(200).json({
      success: true,
      data: proyectos,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener proyectos',
      error: error.message,
    });
  }
};

export const listarProyectosPorCarreraAdmin = async (req, res) => {
  try {
    const { carrera } = req.params;
    const carreraDecodificada = decodeURIComponent(carrera);

    const proyectos = await Proyecto.find({ carrera: carreraDecodificada })
      .populate('autor', 'nombre apellido carrera')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      data: proyectos,
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener proyectos',
      error: error.message,
    });
  }
};

export const buscarProyectosAdmin = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar un término de búsqueda',
      });
    }

    const proyectos = await Proyecto.find({
      $text: { $search: q }
    })
      .populate('autor', 'nombre apellido carrera')
      .limit(50);

    res.status(200).json({
      success: true,
      data: proyectos,
      total: proyectos.length,
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al buscar proyectos',
      error: error.message,
    });
  }
};

export const proyectosDestacadosAdmin = async (req, res) => {
  try {
    const proyectos = await Proyecto.find()
      .populate('autor', 'nombre apellido carrera')
      .sort('-vistas')
      .limit(10);

    res.status(200).json({
      success: true,
      data: proyectos,
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener proyectos destacados',
      error: error.message,
    });
  }
};
