/**
 * reporter.js — Reporter personalizado de Jest
 *
 * Agrupa los resultados por SPRINT y, dentro de cada sprint, por FIGURA
 * (según tests/figuras.json), para poder ir capturando pantalla en el
 * mismo orden en que aparecen las figuras en el documento de resultados.
 *
 * Formato de salida por grupo:
 *   SPRINT 1 — Diseño y codificación de rutas para autenticación...
 *
 *   → Endpoint de Registro de usuario  [archivo.test.js]
 *     POST /api/auth/registro
 *       ✓ debe hacer algo (3 ms)
 *       ✗ debe fallar (1 ms)
 *
 *   → ANEXO II  [archivo.test.js]
 *     GET /api/auth/confirm/:token
 *       ✓ ...
 *
 * USO en jest.config.js:
 *   reporters: ['<rootDir>/tests/reporter.js']
 *
 * El mapeo describe → { sprint, figura } vive en tests/figuras.json.
 * Si un describe no aparece ahí, se imprime igual bajo un grupo
 * "Sin clasificar" al final, para que nunca se pierdan resultados.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const C = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  green:   '\x1b[32m',
  red:     '\x1b[31m',
  yellow:  '\x1b[33m',
  cyan:    '\x1b[36m',
  magenta: '\x1b[35m',
  bgGreen: '\x1b[42m\x1b[30m',
  bgRed:   '\x1b[41m\x1b[30m',
};

function fmtTime(ms) {
  if (ms == null) return '';
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(3)} s`;
}

// Extrae el primer número de figura de cadenas como "3.10–3.11" o "3.4-3.5"
// para poder ordenar numéricamente (si no, "3.10" < "3.2" como texto).
function figuraOrdenKey(figura) {
  if (!figura) return Infinity; // sin figura (Anexo II) va al final
  const match = figura.match(/(\d+)\.(\d+)/);
  if (!match) return Infinity;
  return parseFloat(`${match[1]}.${String(match[2]).padStart(3, '0')}`);
}

class ResultadosReporter {
  constructor(globalConfig, options) {
    this._globalConfig = globalConfig;
    this._options = options ?? {};
    this._mapa = this._cargarMapa();
  }

  _cargarMapa() {
    const rutaMapa = this._options.mapaFiguras
      ?? path.join(__dirname, 'figuras.json');
    try {
      const raw = fs.readFileSync(rutaMapa, 'utf-8');
      const json = JSON.parse(raw);
      return {
        sprints: json.sprints ?? {},
        describes: json.describes ?? {},
      };
    } catch (err) {
      console.log(
        `${C.yellow}⚠ No se pudo leer ${rutaMapa} (${err.message}). ` +
        `Se imprimirá sin agrupar por sprint/figura.${C.reset}`
      );
      return { sprints: {}, describes: {} };
    }
  }

  onRunComplete(_contexts, results) {
    // 1. Recolectar todos los grupos (describe) de todas las suites,
    //    cada uno anotado con su sprint/figura según figuras.json.
    const grupos = [];

    for (const suite of results.testResults) {
      const ruta = suite.testFilePath.replace(process.cwd() + '/', '');
      const porDescribe = new Map();

      for (const t of suite.testResults) {
        const key = t.ancestorTitles.join(' > ') || '(sin describe)';
        if (!porDescribe.has(key)) {
          porDescribe.set(key, { titles: t.ancestorTitles, key, tests: [] });
        }
        porDescribe.get(key).tests.push(t);
      }

      for (const grupo of porDescribe.values()) {
        const info = this._mapa.describes[grupo.key];
        grupos.push({
          ...grupo,
          ruta,
          sprint: info?.sprint ?? null,
          figura: info?.figura ?? null,
          anexo: info?.anexo === true,
          modulo: info?.modulo ?? null,
          orden: info?.orden ?? null,
        });
      }
    }

    // 2. Agrupar por sprint
    const porSprint = new Map();
    for (const g of grupos) {
      const sprintKey = g.sprint ?? '__sin_clasificar__';
      if (!porSprint.has(sprintKey)) porSprint.set(sprintKey, []);
      porSprint.get(sprintKey).push(g);
    }

    // 3. Orden de impresión: sprints numerados ascendente, "sin clasificar" al final
    const sprintsOrdenados = [...porSprint.keys()].sort((a, b) => {
      if (a === '__sin_clasificar__') return 1;
      if (b === '__sin_clasificar__') return -1;
      return Number(a) - Number(b);
    });

    for (const sprintKey of sprintsOrdenados) {
      this._imprimirSprint(sprintKey, porSprint.get(sprintKey));
    }

    this._imprimirResumen(results);
    this._escribirFallidosSiExisten(results, grupos);
  }

  _escribirFallidosSiExisten(results, grupos) {
    // Recolectar todos los tests fallidos
    const fallidos = [];
    for (const g of grupos) {
      for (const t of g.tests) {
        if (t.status === 'failed') {
          fallidos.push({ grupo: g, test: t });
        }
      }
    }

    // Si no hay fallos, no se hace nada
    if (fallidos.length === 0) return;

    // Construir el contenido del archivo
    const lineas = [];
    lineas.push('TESTS FALLIDOS');
    lineas.push('='.repeat(60));
    lineas.push(`Fecha: ${new Date().toISOString()}`);
    lineas.push(`Total fallidos: ${fallidos.length}`);
    lineas.push('');

    // Agrupar por archivo para mejor legibilidad
    const porArchivo = new Map();
    for (const { grupo, test } of fallidos) {
      if (!porArchivo.has(grupo.ruta)) porArchivo.set(grupo.ruta, []);
      porArchivo.get(grupo.ruta).push({ grupo, test });
    }

    for (const [ruta, items] of porArchivo) {
      lineas.push(`Archivo: ${ruta}`);
      lineas.push('-'.repeat(60));

      for (const { grupo, test } of items) {
        const describe = grupo.key !== '(sin describe)' ? `[${grupo.key}] ` : '';
        lineas.push(`  ✗ ${describe}${test.title}`);

        if (test.failureMessages?.length) {
          // Incluir el mensaje de error completo (sin colores ANSI)
          const mensajeLimpio = test.failureMessages[0]
            .replace(/\x1b\[[0-9;]*m/g, '') // quitar códigos de color
            .split('\n')
            .filter(l => l.trim())
            .join('\n    ');
          lineas.push(`    ${mensajeLimpio}`);
        }
        lineas.push('');
      }
    }

    const rutaSalida = path.join(process.cwd(), 'tests-fallidos.txt');
    fs.writeFileSync(rutaSalida, lineas.join('\n'), 'utf-8');
    console.log(`\n${C.yellow}⚠ Se encontraron ${fallidos.length} test(s) fallido(s).${C.reset}`);
    console.log(`${C.yellow}  Reporte guardado en: ${rutaSalida}${C.reset}\n`);
  }

  _imprimirSprint(sprintKey, gruposDelSprint) {
    const titulo = sprintKey === '__sin_clasificar__'
      ? 'SIN CLASIFICAR (no está en figuras.json)'
      : (this._mapa.sprints[sprintKey] ?? `SPRINT ${sprintKey}`);

    console.log('');
    console.log(`${C.bold}${C.cyan}══ ${titulo.toUpperCase()} ══${C.reset}`);
    console.log('');

    // Dentro del sprint: se respeta el orden exacto en que aparece cada
    // endpoint en el documento (campo "orden" de figuras.json). Si algún
    // describe no tiene "orden" asignado (no debería pasar), se ordena por
    // figura como respaldo y se coloca al final.
    const ordenados = [...gruposDelSprint].sort((a, b) => {
      const oa = a.orden ?? Infinity;
      const ob = b.orden ?? Infinity;
      if (oa !== ob) return oa - ob;
      return figuraOrdenKey(a.figura) - figuraOrdenKey(b.figura);
    });

    for (const g of ordenados) {
      this._imprimirGrupo(g);
    }
  }

  _imprimirGrupo(g) {
    const totalGrupo    = g.tests.length;
    const falladosGrupo = g.tests.filter(t => t.status === 'failed').length;

    const badge = falladosGrupo === 0
      ? `${C.bgGreen} PASS ${C.reset}`
      : `${C.bgRed} FAIL ${C.reset}`;

    const etiqueta = g.modulo
      ? (g.anexo
          ? `${C.bold}${C.magenta}→ Endpoint de ${g.modulo}${C.reset} ${C.dim}(Anexo II)${C.reset}`
          : `${C.bold}${C.magenta}→ Endpoint de ${g.modulo}${C.reset}`)
      : `${C.dim}→ ANEXO II${C.reset}`;

    console.log(`${badge} ${etiqueta}`);
    console.log(`  ${C.dim}${g.ruta}${C.reset}`);

    g.titles.forEach((title, i) => {
      const indent = '  '.repeat(i + 1);
      console.log(`${indent}${C.bold}${title}${C.reset}`);
    });

    const baseIndent = '  '.repeat(g.titles.length + 1);

    for (const t of g.tests) {
      const tiempo = t.duration != null ? ` (${fmtTime(t.duration)})` : '';
      if (t.status === 'passed') {
        console.log(`${baseIndent}${C.green}✓${C.reset} ${C.dim}${t.title}${tiempo}${C.reset}`);
      } else {
        console.log(`${baseIndent}${C.red}✗ ${t.title}${tiempo}${C.reset}`);
        if (t.failureMessages?.length) {
          const lineas = t.failureMessages[0]
            .split('\n')
            .filter(l => l.trim())
            .slice(0, 4);
          for (const l of lineas) {
            console.log(`${baseIndent}  ${C.red}${C.dim}${l.trim()}${C.reset}`);
          }
        }
      }
    }

    console.log('');
  }

  _imprimirResumen(results) {
    const suites  = results.numTotalTestSuites;
    const pasadas = results.numPassedTestSuites;
    const falladasS = results.numFailedTestSuites;
    const tests   = results.numTotalTests;
    const passed  = results.numPassedTests;
    const failed  = results.numFailedTests;
    const skipped = results.numPendingTests;
    const snaps   = results.snapshot?.total ?? 0;

    const durMs = results.testResults.reduce((acc, s) => {
      return acc + ((s.perfStats?.end ?? 0) - (s.perfStats?.start ?? 0));
    }, 0);
    const tiempo = fmtTime(durMs || (Date.now() - (results.startTime ?? Date.now())));

    const suitesStr = falladasS > 0
      ? `${C.red}${C.bold}${falladasS} failed${C.reset}, `
      : '';
    const testsStr = failed > 0
      ? `${C.red}${C.bold}${failed} failed${C.reset}, `
      : '';
    const skippedStr = skipped > 0
      ? `${C.yellow}${skipped} skipped${C.reset}, `
      : '';

    console.log(`${C.bold}${C.cyan}══ RESUMEN ══${C.reset}`);
    console.log(`${C.bold}Test Suites:${C.reset} ${suitesStr}${C.green}${C.bold}${pasadas} passed${C.reset}, ${suites} total`);
    console.log(`${C.bold}Tests:${C.reset}       ${testsStr}${skippedStr}${C.green}${C.bold}${passed} passed${C.reset}, ${tests} total`);
    console.log(`${C.bold}Snapshots:${C.reset}   ${snaps} total`);
    console.log(`${C.bold}Time:${C.reset}        ${tiempo}`);
  }
}

export default ResultadosReporter;