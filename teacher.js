const db = window.db;
const auth = window.auth;

/*
  Teacher dashboard (Email/Password Auth)

  This page is designed for a static site (e.g., GitHub Pages) using Firebase "compat" scripts.
  - Students submit attempts without logging in.
  - Teachers sign in (Email/Password) to read/filter/export attempts.
  - Optional: keep an allow-list of staff emails as an extra guard.
*/

// Optional: restrict access to only these staff emails (lowercase).
// If you leave this list empty, ANY authenticated user can access the dashboard.
const ALLOWED_STAFF_EMAILS = [
  // "teacher1@school.org",
  // "teacher2@school.org",
];

const teacherEmail = document.getElementById("teacherEmail");
const teacherPassword = document.getElementById("teacherPassword");
const loginBtn = document.getElementById("btnTeacherLogin");
const logoutBtn = document.getElementById("btnTeacherLogout");
const authMsg = document.getElementById("teacherAuthMsg");
const dashboard = document.getElementById("teacher-dashboard");

const refreshBtn = document.getElementById("refreshBtn");
const exportBtn = document.getElementById("exportBtn");
const dataStatus = document.getElementById("dataStatus");

const filterClass = document.getElementById("filterClass");
const filterName = document.getElementById("filterName");
const tbody = document.querySelector("#attemptsTable tbody");

let currentUser = null;
let currentRows = [];

function setAuthMsg(msg){ if (authMsg) authMsg.textContent = msg || ""; }
function setDataStatus(msg){ if (dataStatus) dataStatus.textContent = msg || ""; }

function show(el, yes){
  if (!el) return;
  el.style.display = yes ? "" : "none";
}

function isAllowedEmail(email){
  const list = (ALLOWED_STAFF_EMAILS || []).map(x => String(x).toLowerCase().trim()).filter(Boolean);
  if (list.length === 0) return true; // no allow-list enforced
  const e = String(email || "").toLowerCase().trim();
  return list.includes(e);
}

function fmtDate(iso){
  try{
    const d = new Date(iso);
    return d.toLocaleString("en-GB", { dateStyle:"short", timeStyle:"short" });
  }catch(_){
    return iso || "";
  }
}

function escapeHtml(s){
  return String(s ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function clearTable(){
  if (tbody) tbody.innerHTML = "";
}

function renderTable(rows){
  clearTable();
  if (!tbody) return;

  rows.forEach(r => {
    const tr = document.createElement("tr");
    const b = r.breakdown || {};
    const core = b.easy ? `${b.easy.score}/${b.easy.total}` : "-";
    const sec = b.medium ? `${b.medium.score}/${b.medium.total}` : "-";
    const str = b.hard ? `${b.hard.score}/${b.hard.total}` : "-";

    tr.innerHTML = `
      <td>${fmtDate(r.created_at)}</td>
      <td>${escapeHtml(r.class)}</td>
      <td>${escapeHtml(r.student_name)}</td>
      <td><strong>${r.score}/${r.total}</strong></td>
      <td>${core}</td>
      <td>${sec}</td>
      <td>${str}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function loadAttempts(){
  if (!db){
    setDataStatus("Database not ready.");
    return;
  }
  setDataStatus("Loading…");
  if (refreshBtn) refreshBtn.disabled = true;
  if (exportBtn) exportBtn.disabled = true;

  try{
    let q = db.collection("attempts").orderBy("created_at", "desc").limit(500);

    const cls = (filterClass?.value || "").trim();
    if (cls){
      q = q.where("class", "==", cls);
    }

    const snap = await q.get();
    let rows = snap.docs.map(d => ({ id:d.id, ...d.data() }));

    const nameNeedle = (filterName?.value || "").trim().toLowerCase();
    if (nameNeedle){
      rows = rows.filter(r => String(r.student_name || "").toLowerCase().includes(nameNeedle));
    }

    currentRows = rows;
    renderTable(rows);
    setDataStatus(`Loaded ${rows.length} attempt(s).`);
    if (exportBtn) exportBtn.disabled = rows.length === 0;
  }catch(e){
    console.error(e);
    setDataStatus("Failed to load attempts. Check Firestore rules + Firebase initialisation.");
  }finally{
    if (refreshBtn) refreshBtn.disabled = false;
  }
}

function downloadCsv(filename, csvText){
  const blob = new Blob([csvText], { type:"text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportCsv(){
  if (!currentRows.length) return;

  const headers = ["created_at","class","student_name","score","total","core_score","core_total","secure_score","secure_total","stretch_score","stretch_total"];
  const lines = [headers.join(",")];

  currentRows.forEach(r => {
    const b = r.breakdown || {};
    const core = b.easy || {};
    const sec = b.medium || {};
    const str = b.hard || {};
    const row = [
      (r.created_at || ""),
      (r.class || ""),
      (r.student_name || ""),
      (r.score ?? ""),
      (r.total ?? ""),
      (core.score ?? ""),
      (core.total ?? ""),
      (sec.score ?? ""),
      (sec.total ?? ""),
      (str.score ?? ""),
      (str.total ?? "")
    ].map(v => `"${String(v).replace(/"/g,'""')}"`);
    lines.push(row.join(","));
  });

  downloadCsv("homework_attempts.csv", lines.join("\n"));
}

// -------- Auth wiring (Email/Password) --------
function setSignedOut(){
  currentUser = null;

  show(loginBtn, true);
  show(logoutBtn, false);
  show(dashboard, false);

  if (refreshBtn) refreshBtn.disabled = true;
  if (exportBtn) exportBtn.disabled = true;

  setAuthMsg("Please sign in to view attempts.");
  setDataStatus("");
  clearTable();
}

function setSignedIn(user){
  currentUser = user;

  show(loginBtn, false);
  show(logoutBtn, true);
  show(dashboard, true);

  if (refreshBtn) refreshBtn.disabled = false;

  setAuthMsg(`Signed in as ${user.email}`);
  loadAttempts();
}

async function signInEmailPassword(){
  const email = (teacherEmail?.value || "").trim();
  const password = teacherPassword?.value || "";

  if (!email || !password){
    setAuthMsg("Enter your email and password.");
    return;
  }

  setAuthMsg("Signing in…");

  try{
    await auth.signInWithEmailAndPassword(email, password);
  }catch(e){
    console.error(e);
    setAuthMsg(e?.message || "Sign-in failed.");
  }
}

async function signOut(){
  try{
    await auth.signOut();
  }catch(e){
    console.error(e);
  }
}

function wireAuth(){
  auth.onAuthStateChanged((user) => {
    if (!user){
      setSignedOut();
      return;
    }

    const email = user.email || "";
    if (!isAllowedEmail(email)){
      setAuthMsg(`Signed in as ${email} (not authorised).`);
      auth.signOut();
      return;
    }

    setSignedIn(user);
  });

  loginBtn?.addEventListener("click", signInEmailPassword);
  logoutBtn?.addEventListener("click", signOut);

  teacherPassword?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") signInEmailPassword();
  });

  refreshBtn?.addEventListener("click", loadAttempts);
  filterClass?.addEventListener("change", loadAttempts);
  filterName?.addEventListener("input", () => {
    clearTimeout(window.__nameTimer);
    window.__nameTimer = setTimeout(loadAttempts, 350);
  });

  exportBtn?.addEventListener("click", exportCsv);
}

(function main(){
  if (!db || !auth){
    setAuthMsg("Firebase not initialised. Check the Firebase scripts/config in teacher.html.");
    return;
  }
  wireAuth();
  // Initial state (until onAuthStateChanged fires)
  setSignedOut();
})();


// -------- Mobile nav toggle (teacher page) --------
document.addEventListener("DOMContentLoaded", () => {
  const hamburger = document.getElementById("hamburger");
  const topnav = document.getElementById("topnav");
  if (!hamburger || !topnav) return;

  hamburger.addEventListener("click", () => {
    const isOpen = topnav.classList.toggle("show");
    hamburger.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });

  topnav.querySelectorAll("a").forEach(a => {
    a.addEventListener("click", () => {
      topnav.classList.remove("show");
      hamburger.setAttribute("aria-expanded", "false");
    });
  });

  document.addEventListener("click", (e) => {
    if (window.matchMedia("(max-width: 900px)").matches){
      const clickedInside = topnav.contains(e.target) || hamburger.contains(e.target);
      if (!clickedInside){
        topnav.classList.remove("show");
        hamburger.setAttribute("aria-expanded", "false");
      }
    }
  });
});
