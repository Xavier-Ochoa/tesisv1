import Proyecto from '../models/Proyecto.js';
import Donacion from '../models/Donacion.js';

// ============================================================
// DASHBOARD ADMIN — datos globales de toda la plataforma
// ============================================================
export const getEstadisticasAdmin = async (req, res) => {
  try {

    // ── 1) Proyectos agrupados por categoría ──
    const porCategoria = await Proyecto.aggregate([
      { $group: { _id: '$categoria', total: { $sum: 1 } } }
    ]);
    // Ejemplo salida: [{ _id: 'academico', total: 12 }, { _id: 'extracurricular', total: 8 }]

    // ── 2) Proyectos agrupados por carrera (ordenados desc) ──
    const porCarrera = await Proyecto.aggregate([
      { $group: { _id: '$carrera', total: { $sum: 1 } } },
      { $sort: { total: -1 } }
    ]);

    // ── 3) Proyectos agrupados por estado ──
    const porEstado = await Proyecto.aggregate([
      { $group: { _id: '$estado', total: { $sum: 1 } } }
    ]);

    // ── 4) Donaciones exitosas agrupadas por mes (último 12 meses) ──
    const hace12Meses = new Date();
    hace12Meses.setFullYear(hace12Meses.getFullYear() - 1);
    hace12Meses.setDate(1);
    hace12Meses.setHours(0, 0, 0, 0);

    const donacionesPorMes = await Donacion.aggregate([
      {
        $match: {
          estado: 'exitosa',
          createdAt: { $gte: hace12Meses }
        }
      },
      {
        $group: {
          _id: {
            anio: { $year: '$createdAt' },
            mes:  { $month: '$createdAt' }
          },
          totalMonto: { $sum: '$monto' },
          cantidad:   { $sum: 1 }
        }
      },
      { $sort: { '_id.anio': 1, '_id.mes': 1 } }
    ]);

    // ── 5) Top proyectos por vistas (incluye cantidad de likes) ──
    const topProyectos = await Proyecto.find({ estado: 'publicado' })
      .populate('autor', 'nombre apellido')
      .sort({ vistas: -1 })
      .limit(8)
      .select('titulo vistas likes autor categoria');

    // ── 6) Resumen de totales para las tarjetas superiores ──
    const totalProyectos   = await Proyecto.countDocuments();
    const totalPublicados  = await Proyecto.countDocuments({ estado: 'publicado' });

    const totalDonacionesAgg = await Donacion.aggregate([
      { $match: { estado: 'exitosa' } },
      { $group: { _id: null, total: { $sum: '$monto' } } }
    ]);
    const totalDonaciones = totalDonacionesAgg[0]?.total || 0;

    res.status(200).json({
      success: true,
      data: {
        porCategoria,
        porCarrera,
        porEstado,
        donacionesPorMes,
        topProyectos,
        resumen: {
          totalProyectos,
          totalPublicados,
          totalDonaciones
        }
      }
    });

  } catch (error) {
    console.error('❌ Dashboard admin error:', error);
    res.status(500).json({ success: false, message: 'Error al obtener estadísticas del dashboard' });
  }
};

// ============================================================
// DASHBOARD USUARIO — solo datos de sus propios proyectos
// ============================================================
export const getEstadisticasUsuario = async (req, res) => {
  try {
    const estudianteId = req.estudianteBDD._id;

    // Sus proyectos completos
    const susProyectos = await Proyecto.find({ autor: estudianteId })
      .select('titulo categoria estado vistas likes createdAt tecnologias')
      .sort({ createdAt: -1 });

    // Sus proyectos por categoría
    const porCategoria = await Proyecto.aggregate([
      { $match: { autor: estudianteId } },
      { $group: { _id: '$categoria', total: { $sum: 1 } } }
    ]);

    // Sus proyectos por estado
    const porEstado = await Proyecto.aggregate([
      { $match: { autor: estudianteId } },
      { $group: { _id: '$estado', total: { $sum: 1 } } }
    ]);

    // Calcular totales de vistas y likes de sus proyectos
    const totalVistas = susProyectos.reduce((acc, p) => acc + (p.vistas || 0), 0);
    const totalLikes  = susProyectos.reduce((acc, p) => acc + (p.likes?.length || 0), 0);

    res.status(200).json({
      success: true,
      data: {
        proyectos: susProyectos,
        porCategoria,
        porEstado,
        resumen: {
          totalProyectos:   susProyectos.length,
          totalPublicados:  susProyectos.filter(p => p.estado === 'publicado').length,
          totalVistas,
          totalLikes
        }
      }
    });

  } catch (error) {
    console.error('❌ Dashboard usuario error:', error);
    res.status(500).json({ success: false, message: 'Error al obtener estadísticas' });
  }
};