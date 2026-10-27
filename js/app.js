/**
 * PORTAL APODERADOS - ESCUELA VILLA LAS PEÑAS
 * Lógica de conexión, gestión multi-hijo (LocalStorage) y renderizado móvil.
 */

// ── Configuración Supabase ──────────────────────────────────────────────────
const SUPABASE_URL = "https://csjnjitjycbnumzodvvv.supabase.co";
const SUPABASE_KEY = "sb_publishable_QsS5e0fI4PJ90uZfD7vUPA_CxLbz4F6";

const HEADERS = {
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json"
};

// ── Estado de la Aplicación ─────────────────────────────────────────────────
const STORAGE_KEY = "vlp_portal_apoderados_hijos_v1";

let state = {
  students: [],          // Lista de estudiantes vinculados a este teléfono
  activeIndex: 0,        // Índice del estudiante actualmente seleccionado
  currentSemester: "1",  // Semestre activo ("1" o "2")
  grades: [],            // Calificaciones del estudiante activo
  atrasos: [],           // Atrasos del estudiante activo
  deferredInstallPrompt: null
};

// ── Elementos del DOM ───────────────────────────────────────────────────────
const dom = {
  viewLink: document.getElementById("viewLinkStudent"),
  viewDashboard: document.getElementById("viewDashboard"),
  formLink: document.getElementById("formLinkStudent"),
  inputRut: document.getElementById("inputRutStudent"),
  selectCourseVerify: document.getElementById("selectCourseVerify"),
  btnSubmitLink: document.getElementById("btnSubmitLink"),
  linkError: document.getElementById("linkErrorMsg"),
  btnRefresh: document.getElementById("btnRefresh"),
  studentsBar: document.getElementById("studentsBar"),
  studentsListChips: document.getElementById("studentsListChips"),
  btnAddAnotherStudent: document.getElementById("btnAddAnotherStudent"),

  // Dashboard
  studentAvatar: document.getElementById("studentAvatarText"),
  studentName: document.getElementById("studentFullName"),
  studentCourse: document.getElementById("studentCourseBadge"),
  studentRut: document.getElementById("studentRutBadge"),
  studentListNum: document.getElementById("studentListNumBadge"),

  // Tabs
  tabButtons: document.querySelectorAll(".tab-btn"),
  tabContents: document.querySelectorAll(".tab-content"),
  badgeAtrasosCount: document.getElementById("badgeAtrasosCount"),

  // Notas
  semesterPills: document.querySelectorAll(".pill-btn"),
  lblPromedioGeneral: document.getElementById("lblPromedioGeneral"),
  lblPromedioSemestre: document.getElementById("lblPromedioSemestre"),
  lblEstadoPromedio: document.getElementById("lblEstadoPromedio"),
  circlePromedioGeneral: document.getElementById("circlePromedioGeneral"),
  lblTotalAsignaturas: document.getElementById("lblTotalAsignaturas"),
  listGradesCards: document.getElementById("listGradesCards"),
  gradesEmptyState: document.getElementById("gradesEmptyState"),

  // Atrasos
  cardAtrasosSummary: document.getElementById("cardAtrasosSummary"),
  iconAtrasoStatus: document.getElementById("iconAtrasoStatus"),
  lblTotalAtrasosCount: document.getElementById("lblTotalAtrasosCount"),
  lblAtrasosMessage: document.getElementById("lblAtrasosMessage"),
  alertAtrasosReiterados: document.getElementById("alertAtrasosReiterados"),
  lblTotalAtrasosBadge: document.getElementById("lblTotalAtrasosBadge"),
  listAtrasosTimeline: document.getElementById("listAtrasosTimeline"),
  atrasosEmptyState: document.getElementById("atrasosEmptyState"),

  // Ficha
  fichaNombre: document.getElementById("fichaNombre"),
  fichaRut: document.getElementById("fichaRut"),
  fichaCurso: document.getElementById("fichaCurso"),
  fichaLista: document.getElementById("fichaLista"),
  fichaEstado: document.getElementById("fichaEstado"),
  fichaIngreso: document.getElementById("fichaIngreso"),
  btnFichaAddStudent: document.getElementById("btnFichaAddStudent"),
  btnFichaRemoveCurrent: document.getElementById("btnFichaRemoveCurrent"),

  // PWA & Toast
  pwaBanner: document.getElementById("pwaInstallBanner"),
  btnPwaInstall: document.getElementById("btnPwaInstall"),
  btnPwaDismiss: document.getElementById("btnPwaDismiss"),
  toast: document.getElementById("toastNotification")
};

// ── Utilidades de RUT ───────────────────────────────────────────────────────
function cleanRut(rutRaw) {
  if (!rutRaw) return "";
  let clean = String(rutRaw).replace(/[^0-9kK]/g, "").toUpperCase();
  if (clean.length < 2) return clean;
  const dv = clean.slice(-1);
  const cuerpo = clean.slice(0, -1);
  return `${cuerpo}-${dv}`;
}

function formatRutDisplay(rutClean) {
  if (!rutClean || !rutClean.includes("-")) return rutClean || "";
  const [cuerpo, dv] = rutClean.split("-");
  let formatted = "";
  let count = 0;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    formatted = cuerpo[i] + formatted;
    count++;
    if (count % 3 === 0 && i !== 0) {
      formatted = "." + formatted;
    }
  }
  return `${formatted}-${dv}`;
}

// ── Toast Notification ──────────────────────────────────────────────────────
function showToast(message, duration = 3000) {
  dom.toast.textContent = message;
  dom.toast.classList.add("show");
  setTimeout(() => {
    dom.toast.classList.remove("show");
  }, duration);
}

// ── Inicialización ──────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  loadStoredStudents();
  initEventListeners();
  initPwa();

  if (state.students.length > 0) {
    showDashboard();
    fetchStudentData();
  } else {
    showLinkScreen();
  }
});

function loadStoredStudents() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      state.students = JSON.parse(raw) || [];
      state.activeIndex = 0;
    }
  } catch (e) {
    console.error("Error loading students from localStorage:", e);
    state.students = [];
  }
}

function saveStoredStudents() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.students));
  } catch (e) {
    console.error("Error saving students to localStorage:", e);
  }
}

// ── Event Listeners ─────────────────────────────────────────────────────────
function initEventListeners() {
  // Input RUT formateo en tiempo real
  dom.inputRut.addEventListener("input", (e) => {
    let val = e.target.value.replace(/[^0-9kK]/g, "");
    if (val.length > 1) {
      const dv = val.slice(-1).toUpperCase();
      const num = val.slice(0, -1);
      e.target.value = num + "-" + dv;
    }
  });

  // Submit Vincular Alumno
  dom.formLink.addEventListener("submit", handleLinkSubmit);

  // Botón Actualizar
  dom.btnRefresh.addEventListener("click", () => {
    if (state.students.length > 0) {
      showToast("Actualizando datos...");
      fetchStudentData(true);
    }
  });

  // Botón Vincular otro hijo
  dom.btnAddAnotherStudent.addEventListener("click", () => {
    showLinkScreen(true);
  });
  dom.btnFichaAddStudent.addEventListener("click", () => {
    showLinkScreen(true);
  });

  // Botón Desvincular Alumno
  dom.btnFichaRemoveCurrent.addEventListener("click", handleUnlinkStudent);

  // Navegación de Tabs
  dom.tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetTab = btn.getAttribute("data-tab");
      switchTab(targetTab);
    });
  });

  // Selector de Semestre
  dom.semesterPills.forEach(pill => {
    pill.addEventListener("click", () => {
      dom.semesterPills.forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      state.currentSemester = pill.getAttribute("data-sem");
      renderGrades();
    });
  });
}

// ── Cambio de Pantallas y Tabs ──────────────────────────────────────────────
function showLinkScreen(isAddingExtra = false) {
  dom.viewDashboard.style.display = "none";
  dom.viewLink.style.display = "block";
  dom.viewLink.classList.add("active");
  dom.linkError.style.display = "none";
  dom.formLink.reset();

  if (isAddingExtra) {
    dom.studentsBar.style.display = "flex";
    renderStudentsBar();
  } else {
    dom.studentsBar.style.display = "none";
  }
}

function showDashboard() {
  dom.viewLink.style.display = "none";
  dom.viewDashboard.style.display = "block";
  dom.viewDashboard.classList.add("active");
  dom.studentsBar.style.display = state.students.length > 1 ? "flex" : "flex";
  renderStudentsBar();
}

function switchTab(tabId) {
  dom.tabButtons.forEach(btn => {
    const isTarget = btn.getAttribute("data-tab") === tabId;
    btn.classList.toggle("active", isTarget);
    btn.setAttribute("aria-selected", isTarget ? "true" : "false");
  });

  dom.tabContents.forEach(content => {
    const isTarget = content.id === tabId;
    content.style.display = isTarget ? "block" : "none";
    content.classList.toggle("active", isTarget);
  });
}

// ── Barra de Estudiantes (Multi-Hijo) ───────────────────────────────────────
function renderStudentsBar() {
  dom.studentsListChips.innerHTML = "";
  if (!state.students || state.students.length === 0) return;

  state.students.forEach((st, idx) => {
    const chip = document.createElement("button");
    chip.className = `student-chip ${idx === state.activeIndex ? "active" : ""}`;
    const primerNombre = (st.nombre || "Alumno").split(" ")[0];
    chip.innerHTML = `<span>👦 ${primerNombre}</span> <small style="opacity:0.75">(${st.curso || ""})</small>`;
    chip.addEventListener("click", () => {
      if (state.activeIndex !== idx) {
        state.activeIndex = idx;
        renderStudentsBar();
        showDashboard();
        fetchStudentData();
      }
    });
    dom.studentsListChips.appendChild(chip);
  });
}

// ── Vinculación de Estudiante (Consulta a Supabase) ─────────────────────────
async function handleLinkSubmit(e) {
  e.preventDefault();
  const rawRut = dom.inputRut.value.trim();
  const rutClean = cleanRut(rawRut);
  const courseVerify = dom.selectCourseVerify.value;

  if (rutClean.length < 3) {
    showLinkError("Por favor ingresa un RUT válido.");
    return;
  }

  setLoading(true);
  dom.linkError.style.display = "none";

  try {
    // 1. Consultar a la tabla alumnos
    let queryUrl = `${SUPABASE_URL}/rest/v1/alumnos?rut=ilike.${encodeURIComponent(rutClean)}&select=*`;
    if (courseVerify) {
      queryUrl += `&curso=eq.${encodeURIComponent(courseVerify)}`;
    }

    const resp = await fetch(queryUrl, { method: "GET", headers: HEADERS, mode: "cors" });
    if (!resp.ok) {
      throw new Error(`Error en servidor: ${resp.status}`);
    }

    const data = await resp.json();

    if (!data || data.length === 0) {
      showLinkError("No encontramos a ningún estudiante con este RUT. Verifica que esté bien escrito o consulta en inspectoría del colegio.");
      setLoading(false);
      return;
    }

    const alumno = data[0];

    // 2. Verificar si ya está vinculado
    const existingIdx = state.students.findIndex(s => cleanRut(s.rut) === cleanRut(alumno.rut));
    if (existingIdx >= 0) {
      state.activeIndex = existingIdx;
      showToast("Este estudiante ya estaba vinculado.");
    } else {
      state.students.push(alumno);
      state.activeIndex = state.students.length - 1;
      saveStoredStudents();
      showToast(`¡${alumno.nombre.split(" ")[0]} vinculado exitosamente!`);
    }

    setLoading(false);
    showDashboard();
    fetchStudentData();

  } catch (err) {
    console.error("Error al vincular alumno:", err);
    showLinkError("Hubo un problema de conexión al buscar al alumno. Revisa tu internet e inténtalo de nuevo.");
    setLoading(false);
  }
}

function showLinkError(msg) {
  dom.linkError.textContent = msg;
  dom.linkError.style.display = "block";
}

function setLoading(isLoading) {
  dom.btnSubmitLink.disabled = isLoading;
  const textSpan = dom.btnSubmitLink.querySelector(".btn-text");
  const spinner = dom.btnSubmitLink.querySelector(".btn-spinner");
  if (isLoading) {
    textSpan.style.display = "none";
    spinner.style.display = "inline-block";
  } else {
    textSpan.style.display = "inline-block";
    spinner.style.display = "none";
  }
}

// ── Desvincular Estudiante ─────────────────────────────────────────────────
function handleUnlinkStudent() {
  const current = state.students[state.activeIndex];
  if (!current) return;
  const firstName = current.nombre ? current.nombre.split(' ')[0] : 'este estudiante';
  showConfirmModal(
    `¿Desvincular a ${firstName}?`,
    `Se eliminará de este teléfono. Puedes volver a vincularlo en cualquier momento con su RUT.`,
    () => {
      state.students.splice(state.activeIndex, 1);
      saveStoredStudents();
      if (state.students.length > 0) {
        state.activeIndex = 0;
        showToast('Estudiante desvinculado.');
        renderStudentsBar();
        showDashboard();
        fetchStudentData();
      } else {
        showToast('Todos los estudiantes fueron desvinculados.');
        showLinkScreen();
      }
    }
  );
}

// ── Modal de Confirmación (reemplaza confirm() nativo) ─────────────────────
function showConfirmModal(title, message, onConfirm) {
  const old = document.getElementById('customConfirmModal');
  if (old) old.remove();

  const overlay = document.createElement('div');
  overlay.id = 'customConfirmModal';
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:2000',
    'background:rgba(15,23,42,0.65)', 'backdrop-filter:blur(4px)',
    'display:flex', 'align-items:center', 'justify-content:center', 'padding:24px'
  ].join(';');

  const card = document.createElement('div');
  card.style.cssText = [
    'background:#fff', 'border-radius:18px', 'padding:24px 22px',
    'max-width:340px', 'width:100%', 'box-shadow:0 20px 50px rgba(0,0,0,0.25)'
  ].join(';');

  const icon = document.createElement('div');
  icon.textContent = '🗑️';
  icon.style.cssText = 'font-size:1.5rem;margin-bottom:10px;';

  const h = document.createElement('h3');
  h.textContent = title;
  h.style.cssText = 'font-size:1.1rem;font-weight:700;color:#0f172a;margin-bottom:8px;font-family:inherit;';

  const p = document.createElement('p');
  p.textContent = message;
  p.style.cssText = 'font-size:0.88rem;color:#64748b;margin-bottom:20px;line-height:1.4;font-family:inherit;';

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:10px;';

  const btnCancel = document.createElement('button');
  btnCancel.textContent = 'Cancelar';
  btnCancel.style.cssText = [
    'flex:1', 'height:44px', 'border-radius:10px', 'border:1.5px solid #e2e8f0',
    'background:#fff', 'color:#475569', 'font-size:0.95rem', 'font-weight:600',
    'cursor:pointer', 'font-family:inherit'
  ].join(';');

  const btnOk = document.createElement('button');
  btnOk.textContent = 'Sí, desvincular';
  btnOk.style.cssText = [
    'flex:1', 'height:44px', 'border-radius:10px', 'border:none',
    'background:linear-gradient(135deg,#b91c1c,#ef4444)', 'color:#fff',
    'font-size:0.95rem', 'font-weight:700', 'cursor:pointer', 'font-family:inherit'
  ].join(';');

  btnCancel.addEventListener('click', () => overlay.remove());
  btnOk.addEventListener('click', () => { overlay.remove(); onConfirm(); });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  btnRow.appendChild(btnCancel);
  btnRow.appendChild(btnOk);
  card.appendChild(icon);
  card.appendChild(h);
  card.appendChild(p);
  card.appendChild(btnRow);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

// ── Cargar Datos del Estudiante (Notas y Atrasos) ───────────────────────────
async function fetchStudentData(isRefresh = false) {
  const current = state.students[state.activeIndex];
  if (!current) return;

  // Render Perfil
  renderStudentHeader(current);

  const rutClean = cleanRut(current.rut);

  try {
    // Consultas en paralelo a Supabase
    const [respNotas, respAtrasos] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/notas?rut=ilike.${encodeURIComponent(rutClean)}&select=*`, { method: "GET", headers: HEADERS, mode: "cors" }),
      fetch(`${SUPABASE_URL}/rest/v1/registros?rut=ilike.${encodeURIComponent(rutClean)}&tipo=ilike.*atraso*&select=*&order=fecha.desc,hora.desc`, { method: "GET", headers: HEADERS, mode: "cors" })
    ]);

    if (respNotas.ok) {
      state.grades = await respNotas.json();
    } else {
      console.warn("Error cargando notas:", respNotas.status);
      state.grades = [];
    }

    if (respAtrasos.ok) {
      state.atrasos = await respAtrasos.json();
    } else {
      console.warn("Error cargando atrasos:", respAtrasos.status);
      state.atrasos = [];
    }

    // Renderizar Vistas
    renderGrades();
    renderAtrasos();
    renderFicha(current);

    if (isRefresh) {
      showToast("Datos actualizados correctamente.");
    }

  } catch (err) {
    console.error("Error al consultar notas/atrasos:", err);
    showToast("Error al sincronizar datos con el colegio.");
  }
}

// ── Render Perfil Header ───────────────────────────────────────────────────
function renderStudentHeader(st) {
  dom.studentName.textContent = st.nombre || "Estudiante";
  dom.studentCourse.textContent = st.curso || "Sin Curso";
  dom.studentRut.textContent = formatRutDisplay(st.rut);
  dom.studentListNum.textContent = st.numero_lista ? `N° Lista ${st.numero_lista}` : "N° Lista -";

  // Avatar iniciales
  const parts = (st.nombre || "AL").split(" ");
  const initials = parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0].slice(0, 2).toUpperCase();
  dom.studentAvatar.textContent = initials;
}

// ── Render Calificaciones (Notas) ──────────────────────────────────────────
function renderGrades() {
  const sem = state.currentSemester;
  dom.lblPromedioSemestre.textContent = `${sem}° Semestre`;

  // Filtrar notas por semestre seleccionado
  const notasSemestre = state.grades.filter(n => String(n.semestre).trim() === sem);

  dom.lblTotalAsignaturas.textContent = `${notasSemestre.length} asignaturas`;
  dom.listGradesCards.innerHTML = "";

  if (notasSemestre.length === 0) {
    dom.gradesEmptyState.style.display = "block";
    dom.lblPromedioGeneral.textContent = "--";
    dom.lblEstadoPromedio.textContent = "Sin datos de notas";
    dom.lblEstadoPromedio.className = "promedio-status";
    dom.circlePromedioGeneral.className = "promedio-circle";
    return;
  }

  dom.gradesEmptyState.style.display = "none";

  // Cálculo Promedio General del Semestre
  let sumaPromedios = 0;
  let countConPromedio = 0;

  notasSemestre.forEach(item => {
    const card = document.createElement("div");
    card.className = "grade-card";

    const prom = item.promedio ? parseFloat(item.promedio) : null;
    let promClass = "empty";
    let promText = "--";

    if (prom !== null && !isNaN(prom)) {
      promText = prom.toFixed(1);
      sumaPromedios += prom;
      countConPromedio++;
      promClass = prom >= 6.0 ? "good" : (prom >= 4.0 ? "blue" : "bad");
    }

    // Chips de notas parciales (N1 a N10)
    let partialGradesHtml = "";
    for (let i = 1; i <= 10; i++) {
      const val = item[`n${i}`];
      if (val !== null && val !== undefined && val !== "") {
        const numVal = parseFloat(val);
        const isBad = !isNaN(numVal) && numVal < 4.0;
        partialGradesHtml += `
          <div class="grade-pill-tag">
            <span class="grade-tag-label">N${i}</span>
            <span class="grade-tag-val ${isBad ? 'bad' : ''}">${parseFloat(val).toFixed(1)}</span>
          </div>
        `;
      }
    }

    card.innerHTML = `
      <div class="grade-header">
        <span class="subject-name">${item.asignatura || 'Asignatura'}</span>
        <span class="subject-average-pill ${promClass}" title="Promedio">${promText}</span>
      </div>
      ${partialGradesHtml ? `<div class="partial-grades-chips">${partialGradesHtml}</div>` : ''}
    `;

    dom.listGradesCards.appendChild(card);
  });

  // Render Promedio General Card
  if (countConPromedio > 0) {
    const promGeneral = sumaPromedios / countConPromedio;
    const rounded = promGeneral.toFixed(1);
    dom.lblPromedioGeneral.textContent = rounded;

    if (promGeneral >= 6.0) {
      dom.circlePromedioGeneral.className = "promedio-circle good";
      dom.lblEstadoPromedio.textContent = "✨ Excelente rendimiento";
      dom.lblEstadoPromedio.className = "promedio-status status-good";
    } else if (promGeneral >= 4.0) {
      dom.circlePromedioGeneral.className = "promedio-circle";
      dom.lblEstadoPromedio.textContent = "👍 Aprobado";
      dom.lblEstadoPromedio.className = "promedio-status status-good";
    } else {
      dom.circlePromedioGeneral.className = "promedio-circle bad";
      dom.lblEstadoPromedio.textContent = "⚠️ Promedio bajo 4.0";
      dom.lblEstadoPromedio.className = "promedio-status status-bad";
    }
  } else {
    dom.lblPromedioGeneral.textContent = "--";
    dom.lblEstadoPromedio.textContent = "Notas en proceso";
    dom.circlePromedioGeneral.className = "promedio-circle";
  }
}

// ── Render Atrasos ──────────────────────────────────────────────────────────
function renderAtrasos() {
  const total = state.atrasos.length;
  dom.lblTotalAtrasosCount.textContent = total;
  dom.lblTotalAtrasosBadge.textContent = `${total} registros`;

  // Badge en el tab bar
  if (total > 0) {
    dom.badgeAtrasosCount.textContent = total;
    dom.badgeAtrasosCount.style.display = "inline-block";
  } else {
    dom.badgeAtrasosCount.style.display = "none";
  }

  // Tarjeta resumen según cantidad
  if (total === 0) {
    dom.cardAtrasosSummary.className = "atrasos-summary-card good";
    dom.iconAtrasoStatus.textContent = "✅";
    dom.lblAtrasosMessage.textContent = "¡Excelente! El estudiante no presenta ningún atraso registrado.";
    dom.alertAtrasosReiterados.style.display = "none";
  } else if (total < 3) {
    dom.cardAtrasosSummary.className = "atrasos-summary-card warning";
    dom.iconAtrasoStatus.textContent = "⏰";
    dom.lblAtrasosMessage.textContent = `Registra ${total} atraso(s). Recuerde procurar la llegada a la hora de ingreso escolar.`;
    dom.alertAtrasosReiterados.style.display = "none";
  } else {
    dom.cardAtrasosSummary.className = "atrasos-summary-card danger";
    dom.iconAtrasoStatus.textContent = "🚨";
    dom.lblAtrasosMessage.textContent = `Acumula ${total} atrasos. Esta cantidad activa seguimiento institucional.`;
    dom.alertAtrasosReiterados.style.display = "flex";
  }

  // Lista cronológica
  dom.listAtrasosTimeline.innerHTML = "";

  if (total === 0) {
    dom.atrasosEmptyState.style.display = "block";
    return;
  }

  dom.atrasosEmptyState.style.display = "none";

  state.atrasos.forEach(item => {
    const row = document.createElement("div");
    row.className = "atraso-item";

    const fechaFmt = formatFechaChilena(item.fecha);
    const horaFmt = item.hora ? item.hora.slice(0, 5) + " hrs" : "--:--";
    const motivoFmt = item.motivo || "Sin motivo especificado";

    row.innerHTML = `
      <div class="atraso-icon-box">⏰</div>
      <div class="atraso-content">
        <div class="atraso-date-time">
          <span class="atraso-date">${fechaFmt}</span>
          <span class="atraso-time">${horaFmt}</span>
        </div>
        <div class="atraso-motivo">${motivoFmt}</div>
      </div>
    `;

    dom.listAtrasosTimeline.appendChild(row);
  });
}

function formatFechaChilena(fechaStr) {
  if (!fechaStr) return "Fecha no registrada";
  // Esperado: "YYYY-MM-DD" o "DD-MM-YYYY"
  try {
    const parts = fechaStr.split("-");
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      } else {
        // DD-MM-YYYY
        return `${parts[0]}/${parts[1]}/${parts[2]}`;
      }
    }
  } catch (e) {}
  return fechaStr;
}

// ── Render Ficha Escolar ───────────────────────────────────────────────────
function renderFicha(st) {
  dom.fichaNombre.textContent = st.nombre || "--";
  dom.fichaRut.textContent = formatRutDisplay(st.rut);
  dom.fichaCurso.textContent = st.curso || "--";
  dom.fichaLista.textContent = st.numero_lista ? `N° ${st.numero_lista}` : "No asignado";
  dom.fichaEstado.textContent = st.estado || "Activo";
  dom.fichaIngreso.textContent = st.fecha_ingreso || "2026";
}

// ── PWA Installation Support ───────────────────────────────────────────────
function initPwa() {
  // Service Worker
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js")
      .then(() => console.log("[PWA] Service Worker registrado exitosamente."))
      .catch(err => console.warn("[PWA] Fallo registro SW:", err));
  }

  // Interceptar banner de instalación nativo
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    state.deferredInstallPrompt = e;
    dom.pwaBanner.style.display = "flex";
  });

  dom.btnPwaInstall.addEventListener("click", async () => {
    if (state.deferredInstallPrompt) {
      state.deferredInstallPrompt.prompt();
      const choice = await state.deferredInstallPrompt.userChoice;
      if (choice.outcome === "accepted") {
        showToast("¡Instalando Portal Apoderados!");
      }
      state.deferredInstallPrompt = null;
      dom.pwaBanner.style.display = "none";
    }
  });

  dom.btnPwaDismiss.addEventListener("click", () => {
    dom.pwaBanner.style.display = "none";
  });
}
