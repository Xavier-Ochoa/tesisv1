import Estudiante from '../models/Estudiante.js';

/**
 * Listar usuarios con filtros opcionales.
 * Solo para administradores.
 *
 * FIX: el filtro ya no tiene { rol: 'estudiante' } hardcodeado.
 * Ahora acepta ?rol=estudiante | ?rol=docente | sin param = todos.
 *
 * Filtros disponibles: rol, carrera, semestre, apellido
 */
export const listarEstudiantes = async (req, res) => {
  try {
    const { carrera, semestre, apellido, rol } = req.query;

    // Filtro dinámico — sin rol fijo
    const filtro = {};

    // Filtro por rol (opcional)
    if (rol) {
      const rolesValidos = ['estudiante', 'docente', 'admin'];
      if (!rolesValidos.includes(rol)) {
        return res.status(400).json({
          success: false,
          message: 'El rol debe ser "estudiante", "docente" o "admin"',
        });
      }
      filtro.rol = rol;
    }

    // Filtro por carrera (búsqueda exacta)
    if (carrera) {
      filtro.carrera = carrera;
    }

    // Filtro por semestre (búsqueda exacta)
    if (semestre) {
      const semestreNumero = parseInt(semestre);
      if (semestreNumero >= 1 && semestreNumero <= 8) {
        filtro.semestre = semestreNumero;
      } else {
        return res.status(400).json({
          success: false,
          message: 'El semestre debe ser un número entre 1 y 8',
        });
      }
    }

    // Filtro por apellido (búsqueda parcial - case insensitive)
    if (apellido) {
      filtro.apellido = { $regex: apellido, $options: 'i' };
    }

    const usuarios = await Estudiante.find(filtro)
      .select('nombre apellido email carrera semestre rol')
      .sort({ apellido: 1, nombre: 1 })
      .lean();

    res.status(200).json({
      success: true,
      total: usuarios.length,
      filtros: {
        rol:      rol      || 'todos',
        carrera:  carrera  || 'todos',
        semestre: semestre || 'todos',
        apellido: apellido || 'todos',
      },
      data: usuarios,
    });

  } catch (error) {
    console.error('Error al listar usuarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener los usuarios',
      error: error.message,
    });
  }
};

/**
 * Obtener un usuario por ID.
 * Solo para administradores.
 */
export const obtenerEstudiante = async (req, res) => {
  try {
    const { id } = req.params;

    const estudiante = await Estudiante.findById(id)
      .select('-password -token')
      .lean();

    if (!estudiante) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }

    res.status(200).json({
      success: true,
      data: estudiante,
    });

  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el usuario',
      error: error.message,
    });
  }
};

/**
 * Eliminar cualquier usuario por ID.
 * Solo para administradores.
 * El admin NO puede eliminarse a sí mismo.
 */
export const eliminarUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.estudianteBDD._id.toString();

    // Impedir que el admin se elimine a sí mismo
    if (id === adminId) {
      return res.status(400).json({
        success: false,
        message: 'No puedes eliminar tu propia cuenta de administrador',
      });
    }

    const usuario = await Estudiante.findById(id);
    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }

    await Estudiante.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: `Usuario ${usuario.nombre} ${usuario.apellido} (${usuario.email}) eliminado correctamente`,
    });

  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar el usuario',
      error: error.message,
    });
  }
};

/**
 * Estadísticas de usuarios.
 * FIX: ya no filtra solo 'estudiante' — incluye todos los roles.
 * Solo para administradores.
 */
export const estadisticasEstudiantes = async (req, res) => {
  try {
    const totalUsuarios = await Estudiante.countDocuments({});

    const porRol = await Estudiante.aggregate([
      { $group: { _id: '$rol', total: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]);

    const porCarrera = await Estudiante.aggregate([
      { $match: { rol: 'estudiante' } },
      { $group: { _id: '$carrera', total: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]);

    const porNivel = await Estudiante.aggregate([
      { $match: { rol: 'estudiante' } },
      { $group: { _id: '$semestre', total: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalUsuarios,
        porRol,
        porCarrera,
        porNivel,
      },
    });

  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas',
      error: error.message,
    });
  }
};
