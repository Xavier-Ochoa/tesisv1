/**
 * Reglas centralizadas de modificación de proyectos.
 * Se usan tanto en el controlador del estudiante como en el del colaborador.
 */

/**
 * Devuelve null si el proyecto puede editarse, o un mensaje de error si no.
 *
 * Reglas:
 *  - Solo se puede editar la última versión (esUltimaVersion === true).
 *  - Privado + pendiente  → ✅
 *  - Privado + rechazado  → ✅
 *  - Privado + aprobado   → ❌
 *  - Público  + rechazado → ✅  (para corregir y reenviar)
 *  - Público  + pendiente → ❌
 *  - Público  + aprobado  → ❌
 *
 * @param {object} proyecto  Documento Mongoose
 * @returns {string|null}
 */
export const validarEditable = (proyecto) => {
  if (!proyecto.esUltimaVersion) {
    return 'Solo se puede modificar la última versión del proyecto';
  }

  const { tipoProyecto, estado } = proyecto;

  if (tipoProyecto === 'privado') {
    if (estado === 'pendiente' || estado === 'rechazado') return null;
    return 'Un proyecto privado solo puede editarse si está pendiente o rechazado';
  }

  // público
  if (estado === 'rechazado') return null;
  return 'Un proyecto público solo puede editarse cuando ha sido rechazado';
};

/**
 * Verifica si el usuario es autor o colaborador del proyecto.
 *
 * @param {object} proyecto
 * @param {string} usuarioId
 * @returns {{ esAutor: boolean, esColaborador: boolean }}
 */
export const rolesEnProyecto = (proyecto, usuarioId) => {
  const id = usuarioId.toString();
  const esAutor = proyecto.autor.toString() === id;
  const esColaborador = proyecto.colaboradores.some(c => c.toString() === id);
  return { esAutor, esColaborador };
};
