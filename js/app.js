/**
 * PORTAL APODERADOS - ESCUELA VILLA LAS PEÑAS
 * Lógica de conexión, gestión multi-hijo (LocalStorage) y renderizado móvil.
 */

// ── Configuración Supabase ──────────────────────────────────────────────────
const SUPABASE_URL = "https://csjnjitjycbnumzodvvv.supabase.co";
const SUPABASE_KEY = "sb_publishable_QsS5e0fI4PJ90uZfD7vUPA_CxLbz4F6";
const VAPID_PUBLIC_KEY = "BHLJVyKFtqgiVHJQ7ucrin6XZVEHYYNAzRzU3RiQ-oh8BPhxPUrh2tIE_C6IPUSLXgt1uh7K8RwsKOPwtep-Y7c";

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

  // PWA, Notificaciones & Toast
  pwaBanner: document.getElementById("pwaInstallBanner"),
  btnPwaInstall: document.getElementById("btnPwaInstall"),
  btnPwaDismiss: document.getElementById("btnPwaDismiss"),
  pushBanner: document.getElementById("pushNotifyBanner"),
  btnEnablePush: document.getElementById("btnEnablePush"),
  lblPushStatus: document.getElementById("lblPushStatus"),
  btnTogglePushFicha: document.getElementById("btnTogglePushFicha"),
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
    if ('Notification' in window && Notification.permission === 'granted') {
      syncAllStudentsPush();
    }
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
  dom.btnRefresh.addEventListener("click", async () => {
    showToast("Actualizando...");
    if ("serviceWorker" in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) await reg.update();
      } catch (e) {}
    }
    if (state.students.length > 0) {
      await fetchStudentData(true);
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

  // Botones de Notificaciones Push
  if (dom.btnEnablePush) {
    dom.btnEnablePush.addEventListener("click", requestPushActivation);
  }
  if (dom.btnTogglePushFicha) {
    dom.btnTogglePushFicha.addEventListener("click", requestPushActivation);
  }

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
  updatePushUI();
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

  if (!courseVerify) {
    showLinkError("Por favor selecciona el curso oficial del estudiante.");
    return;
  }

  setLoading(true);
  dom.linkError.style.display = "none";

  try {
    // 1. Consultar a la tabla alumnos exigiendo RUT y Curso
    const queryUrl = `${SUPABASE_URL}/rest/v1/alumnos?rut=ilike.${encodeURIComponent(rutClean)}&curso=eq.${encodeURIComponent(courseVerify)}&select=*`;

    const resp = await fetch(queryUrl, { method: "GET", headers: HEADERS, mode: "cors" });
    if (!resp.ok) {
      throw new Error(`Error en servidor: ${resp.status}`);
    }

    const data = await resp.json();

    if (!data || data.length === 0) {
      showLinkError("No encontramos al estudiante con ese RUT en el curso seleccionado. Por favor verifica que ambos datos sean correctos.");
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

    // Auto-suscribir a notificaciones push si el permiso ya fue concedido
    if ('Notification' in window && Notification.permission === 'granted') {
      await subscribeStudentToPush(alumno.rut);
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
  const rutToRemove = current.rut;
  const firstName = current.nombre ? current.nombre.split(' ')[0] : 'este estudiante';
  showConfirmModal(
    `¿Desvincular a ${firstName}?`,
    `Se eliminará de este teléfono. Puedes volver a vincularlo en cualquier momento con su RUT.`,
    () => {
      unsubscribeStudentFromPush(rutToRemove);
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

// ── Catálogo oficial de asignaturas (orden ministerial) ───────────────────
// Alineado con obtener_plan_estudio_curso() de main.py
// 1°–6° Básico: Decreto N° 2960/2012  |  7°–8° Básico: Decreto N° 628/2016
const ASIG_ORDEN_OFICIAL = [
  "Lenguaje y Comunicación",      // 1°–6° básico
  "Lengua y Literatura",           // 7°–8° básico
  "Idioma Extranjero Inglés",
  "Matemática",
  "Ciencias Naturales",
  "Historia, Geografía y Ciencias Sociales",
  "Tecnología",
  "Artes Visuales",
  "Música",
  "Educación Física y Salud",
  "Orientación",
  "Religión Católica",
  "Religión Evangélica"
];

/**
 * Retorna el índice de orden oficial de una asignatura (para ordenar tarjetas).
 * Si no está en el catálogo, la pone al final.
 */
function ordenAsig(nombre) {
  const s = (nombre || "").trim();
  const idx = ASIG_ORDEN_OFICIAL.findIndex(
    a => a.toLowerCase() === s.toLowerCase()
  );
  return idx === -1 ? 999 : idx;
}

// ── Helpers para Calificaciones Conceptuales ──────────────────────────────
function esAsignaturaConceptual(asig) {
  if (!asig) return false;
  const s = String(asig).toLowerCase();
  return s.includes("religi") || s.includes("orientac");
}

function notaAConcepto(val) {
  if (val === null || val === undefined) return "";
  const s = String(val).trim().toUpperCase();
  if (!s || s === "—" || s === "-" || s === "NONE" || s === "NAN" || s === "NULL") return "";
  if (s === "MB" || s === "B" || s === "S" || s === "I") return s;
  if (s.includes("MUY BUENO")) return "MB";
  if (s.includes("BUENO")) return "B";
  if (s.includes("SUFICIENTE")) return "S";
  if (s.includes("INSUFICIENTE")) return "I";
  const num = parseFloat(s.replace(",", "."));
  if (!isNaN(num)) {
    const n = (num >= 10 && num <= 70) ? num / 10 : num;
    if (n >= 6.0) return "MB";
    if (n >= 5.0) return "B";
    if (n >= 4.0) return "S";
    if (n >= 1.0) return "I";
  }
  return s;
}

function getConceptBadgeClass(conc) {
  if (conc === "MB") return "good";
  if (conc === "B") return "blue";
  if (conc === "S") return "warning";
  if (conc === "I") return "bad";
  return "empty";
}

// ── Render Calificaciones (Notas) ──────────────────────────────────────────
function renderGrades() {
  const sem = state.currentSemester;

  // ════════════════════════════════════════════════════════════════════════
  // MODO 1: RESUMEN ANUAL (Solo promedios finales por asignatura)
  // ════════════════════════════════════════════════════════════════════════
  if (sem === "anual") {
    dom.lblPromedioSemestre.textContent = "Resumen Anual";
    dom.listGradesCards.innerHTML = "";

    // Agrupar calificaciones por asignatura
    const asigMap = new Map();
    state.grades.forEach(g => {
      const name = (g.asignatura || "").trim();
      if (!name) return;
      if (!asigMap.has(name)) {
        asigMap.set(name, { s1: null, s2: null });
      }
      const entry = asigMap.get(name);
      const semNum = String(g.semestre).trim();
      if (semNum === "1") entry.s1 = g;
      else if (semNum === "2") entry.s2 = g;
    });

    dom.lblTotalAsignaturas.textContent = `${asigMap.size} asignaturas`;

    if (asigMap.size === 0) {
      dom.gradesEmptyState.style.display = "block";
      dom.lblPromedioGeneral.textContent = "--";
      dom.lblEstadoPromedio.textContent = "Sin datos de notas anuales";
      dom.lblEstadoPromedio.className = "promedio-status";
      dom.circlePromedioGeneral.className = "promedio-circle";
      return;
    }

    dom.gradesEmptyState.style.display = "none";

    let sumaPromediosAnuales = 0;
    let countConPromedioAnual = 0;

    // Ordenar asignaturas según catálogo ministerial oficial
    const asigMapOrdenado = new Map(
      [...asigMap.entries()].sort((a, b) => ordenAsig(a[0]) - ordenAsig(b[0]))
    );

    asigMapOrdenado.forEach((entry, asigName) => {
      const card = document.createElement("div");
      card.className = "grade-card";
      const isConceptual = esAsignaturaConceptual(asigName);

      let p1Display = "--";
      let p1Class = "empty";
      let p2Display = "--";
      let p2Class = "empty";
      let finalDisplay = "--";
      let finalClass = "empty";

      if (isConceptual) {
        // Conceptos 1° Semestre
        if (entry.s1 && entry.s1.promedio !== null && entry.s1.promedio !== undefined && entry.s1.promedio !== "") {
          const c1 = notaAConcepto(entry.s1.promedio);
          if (c1) {
            p1Display = c1;
            p1Class = getConceptBadgeClass(c1);
          }
        }
        // Conceptos 2° Semestre
        if (entry.s2 && entry.s2.promedio !== null && entry.s2.promedio !== undefined && entry.s2.promedio !== "") {
          const c2 = notaAConcepto(entry.s2.promedio);
          if (c2) {
            p2Display = c2;
            p2Class = getConceptBadgeClass(c2);
          }
        }
        // Concepto Final: según normativa y criterio de la escuela, se prioriza S2 si existe, sino S1
        const cFinal = (p2Display !== "--") ? p2Display : ((p1Display !== "--") ? p1Display : "");
        if (cFinal) {
          finalDisplay = cFinal;
          finalClass = getConceptBadgeClass(cFinal);
        }
      } else {
        // Cuantitativo
        let p1Num = null;
        let p2Num = null;

        if (entry.s1 && entry.s1.promedio !== null && entry.s1.promedio !== undefined && entry.s1.promedio !== "") {
          const parsed = parseFloat(entry.s1.promedio);
          if (!isNaN(parsed)) {
            p1Num = parsed;
            p1Display = p1Num.toFixed(1);
            p1Class = p1Num >= 6.0 ? "good" : (p1Num >= 4.0 ? "blue" : "bad");
          }
        }

        if (entry.s2 && entry.s2.promedio !== null && entry.s2.promedio !== undefined && entry.s2.promedio !== "") {
          const parsed = parseFloat(entry.s2.promedio);
          if (!isNaN(parsed)) {
            p2Num = parsed;
            p2Display = p2Num.toFixed(1);
            p2Class = p2Num >= 6.0 ? "good" : (p2Num >= 4.0 ? "blue" : "bad");
          }
        }

        // Promedio final de la asignatura
        let finalNum = null;
        if (p1Num !== null && p2Num !== null) {
          finalNum = (p1Num + p2Num) / 2;
        } else if (p1Num !== null) {
          finalNum = p1Num;
        } else if (p2Num !== null) {
          finalNum = p2Num;
        }

        if (finalNum !== null) {
          finalDisplay = finalNum.toFixed(1);
          finalClass = finalNum >= 6.0 ? "good" : (finalNum >= 4.0 ? "blue" : "bad");
          sumaPromediosAnuales += finalNum;
          countConPromedioAnual++;
        }
      }

      card.innerHTML = `
        <div class="grade-header">
          <span class="subject-name">${asigName}</span>
          <span class="subject-average-pill ${finalClass}" title="Promedio Final">${finalDisplay}</span>
        </div>
        <div class="annual-averages-row">
          <div class="annual-stat-box">
            <span class="annual-stat-label">1° Semestre</span>
            <span class="annual-stat-val ${p1Class}">${p1Display}</span>
          </div>
          <div class="annual-stat-box">
            <span class="annual-stat-label">2° Semestre</span>
            <span class="annual-stat-val ${p2Class}">${p2Display}</span>
          </div>
          <div class="annual-stat-box highlight">
            <span class="annual-stat-label">${isConceptual ? 'Conc. Final' : 'Prom. Final'}</span>
            <span class="annual-stat-val ${finalClass}">${finalDisplay}</span>
          </div>
        </div>
      `;

      dom.listGradesCards.appendChild(card);
    });

    // Render Promedio General Anual
    if (countConPromedioAnual > 0) {
      const promGeneral = sumaPromediosAnuales / countConPromedioAnual;
      const rounded = promGeneral.toFixed(1);
      dom.lblPromedioGeneral.textContent = rounded;

      if (promGeneral >= 6.0) {
        dom.circlePromedioGeneral.className = "promedio-circle good";
        dom.lblEstadoPromedio.textContent = "✨ Rendimiento anual sobresaliente";
        dom.lblEstadoPromedio.className = "promedio-status status-good";
      } else if (promGeneral >= 4.0) {
        dom.circlePromedioGeneral.className = "promedio-circle";
        dom.lblEstadoPromedio.textContent = "👍 Aprobado anual";
        dom.lblEstadoPromedio.className = "promedio-status status-good";
      } else {
        dom.circlePromedioGeneral.className = "promedio-circle bad";
        dom.lblEstadoPromedio.textContent = "⚠️ Promedio final bajo 4.0";
        dom.lblEstadoPromedio.className = "promedio-status status-bad";
      }
    } else {
      dom.lblPromedioGeneral.textContent = "--";
      dom.lblEstadoPromedio.textContent = "Promedios en proceso";
      dom.circlePromedioGeneral.className = "promedio-circle";
    }

    return;
  }

  // ════════════════════════════════════════════════════════════════════════
  // MODO 2: SEMESTRAL (1° o 2° Semestre con detalle de notas parciales)
  // ════════════════════════════════════════════════════════════════════════
  dom.lblPromedioSemestre.textContent = `${sem}° Semestre`;

  // Filtrar notas por semestre seleccionado
  // Filtrar por semestre y ordenar según catálogo ministerial oficial
  const notasSemestre = state.grades
    .filter(n => String(n.semestre).trim() === sem)
    .sort((a, b) => ordenAsig(a.asignatura) - ordenAsig(b.asignatura));

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

  // Cálculo Promedio General del Semestre (Solo cuantitativo)
  let sumaPromedios = 0;
  let countConPromedio = 0;

  notasSemestre.forEach(item => {
    const card = document.createElement("div");
    card.className = "grade-card";
    const isConceptual = esAsignaturaConceptual(item.asignatura);

    let promClass = "empty";
    let promText = "--";
    let partialGradesHtml = "";

    if (isConceptual) {
      // ── Asignatura Conceptual (Religión, Orientación, etc.)
      const concProm = notaAConcepto(item.promedio);
      if (concProm) {
        promText = concProm;
        promClass = getConceptBadgeClass(concProm);
      }

      // Notas parciales en conceptos
      for (let i = 1; i <= 10; i++) {
        const val = item[`n${i}`];
        if (val !== null && val !== undefined && val !== "") {
          const concVal = notaAConcepto(val);
          if (concVal) {
            const isBad = concVal === "I";
            partialGradesHtml += `
              <div class="grade-pill-tag">
                <span class="grade-tag-label">N${i}</span>
                <span class="grade-tag-val ${isBad ? 'bad' : ''}">${concVal}</span>
              </div>
            `;
          }
        }
      }
    } else {
      // ── Asignatura Cuantitativa (con nota decimal 1.0 a 7.0)
      const prom = (item.promedio !== null && item.promedio !== undefined && item.promedio !== "") ? parseFloat(item.promedio) : null;
      if (prom !== null && !isNaN(prom)) {
        promText = prom.toFixed(1);
        sumaPromedios += prom;
        countConPromedio++;
        promClass = prom >= 6.0 ? "good" : (prom >= 4.0 ? "blue" : "bad");
      }

      // Chips de notas parciales (N1 a N10)
      for (let i = 1; i <= 10; i++) {
        const val = item[`n${i}`];
        if (val !== null && val !== undefined && val !== "") {
          const numVal = parseFloat(val);
          if (!isNaN(numVal)) {
            const isBad = numVal < 4.0;
            partialGradesHtml += `
              <div class="grade-pill-tag">
                <span class="grade-tag-label">N${i}</span>
                <span class="grade-tag-val ${isBad ? 'bad' : ''}">${numVal.toFixed(1)}</span>
              </div>
            `;
          }
        }
      }
    }

    card.innerHTML = `
      <div class="grade-header">
        <span class="subject-name">${item.asignatura || 'Asignatura'}</span>
        <span class="subject-average-pill ${promClass}" title="${isConceptual ? 'Concepto' : 'Promedio'}">${promText}</span>
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
  // Service Worker con auto-actualización inmediata
  if ("serviceWorker" in navigator) {
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });

    navigator.serviceWorker.register("./sw.js")
      .then(reg => {
        console.log("[PWA] Service Worker registrado exitosamente.");
        reg.update().catch(() => {});
      })
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

// ── Notificaciones Push Web (VAPID) ──────────────────────────────────────────
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function subscribeStudentToPush(rut) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return false;
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }

    const subJson = sub.toJSON();
    const rutClean = cleanRut(rut);

    const payload = {
      rut: rutClean,
      endpoint: sub.endpoint,
      p256dh: subJson.keys.p256dh,
      auth: subJson.keys.auth,
      user_agent: navigator.userAgent
    };

    await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions`, {
      method: "POST",
      headers: {
        ...HEADERS,
        "Prefer": "resolution=merge-duplicates"
      },
      body: JSON.stringify(payload)
    });
    return true;
  } catch (err) {
    console.warn("Error suscribiendo push:", err);
    return false;
  }
}

async function unsubscribeStudentFromPush(rut) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;

    const rutClean = cleanRut(rut);
    await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?rut=eq.${encodeURIComponent(rutClean)}&endpoint=eq.${encodeURIComponent(sub.endpoint)}`, {
      method: "DELETE",
      headers: HEADERS
    });
  } catch (e) {
    console.warn("Error desuscribiendo push:", e);
  }
}

async function updatePushUI() {
  if (!('Notification' in window)) {
    if (dom.pushBanner) dom.pushBanner.style.display = 'none';
    if (dom.lblPushStatus) dom.lblPushStatus.textContent = 'No soportado en este navegador';
    if (dom.btnTogglePushFicha) dom.btnTogglePushFicha.style.display = 'none';
    return;
  }

  const permission = Notification.permission;
  if (permission === 'granted') {
    if (dom.pushBanner) dom.pushBanner.style.display = 'none';
    if (dom.lblPushStatus) dom.lblPushStatus.textContent = 'Activadas en este teléfono ✅';
    if (dom.btnTogglePushFicha) {
      dom.btnTogglePushFicha.textContent = '📲 Probar Alerta';
      dom.btnTogglePushFicha.className = 'btn btn-sm btn-outline';
    }
  } else if (permission === 'denied') {
    if (dom.pushBanner) dom.pushBanner.style.display = 'none';
    if (dom.lblPushStatus) dom.lblPushStatus.textContent = 'Bloqueadas en navegador (ajustes)';
    if (dom.btnTogglePushFicha) {
      dom.btnTogglePushFicha.textContent = 'Permiso denegado';
      dom.btnTogglePushFicha.disabled = true;
    }
  } else {
    // Default
    if (dom.pushBanner && state.students.length > 0) dom.pushBanner.style.display = 'flex';
    if (dom.lblPushStatus) dom.lblPushStatus.textContent = 'Desactivadas';
    if (dom.btnTogglePushFicha) {
      dom.btnTogglePushFicha.textContent = 'Activar Alertas';
      dom.btnTogglePushFicha.className = 'btn btn-sm btn-primary';
      dom.btnTogglePushFicha.disabled = false;
    }
  }
}

async function syncAllStudentsPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (!state.students || state.students.length === 0) return;

  for (const st of state.students) {
    if (st && st.rut) {
      await subscribeStudentToPush(st.rut);
    }
  }
}

async function requestPushActivation() {
  if (!('Notification' in window)) {
    showToast('Tu navegador no soporta notificaciones.');
    return;
  }

  if (Notification.permission === 'granted') {
    // Si ya está activo, asegurar sincronización de todos los hijos en el teléfono
    syncAllStudentsPush();
    try {
      const reg = await navigator.serviceWorker.ready;
      reg.showNotification('🔔 Escuela Villa Las Peñas', {
        body: '¡Excelente! Las notificaciones funcionan correctamente en tu teléfono.',
        icon: './assets/insignia.png',
        badge: './assets/insignia.png',
        vibrate: [200, 100, 200]
      });
      showToast('Prueba de alerta enviada al teléfono.');
    } catch (e) {
      showToast('Alertas activas y funcionando.');
    }
    return;
  }

  try {
    const res = await Notification.requestPermission();
    if (res === 'granted') {
      showToast('🔔 ¡Alertas activadas exitosamente!');
      for (const st of state.students) {
        await subscribeStudentToPush(st.rut);
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        reg.showNotification('🔔 Escuela Villa Las Peñas', {
          body: '¡Alertas activadas! Recibirás avisos de atrasos y retiros.',
          icon: './assets/insignia.png',
          badge: './assets/insignia.png',
          vibrate: [200, 100, 200]
        });
      } catch (e) {}
    } else if (res === 'denied') {
      showToast('Permiso de alertas denegado en tu navegador.');
    }
    updatePushUI();
  } catch (err) {
    console.error('Error al solicitar permiso de notificaciones:', err);
  }
}
