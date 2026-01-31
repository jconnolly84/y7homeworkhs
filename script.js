/* Homework quiz: Hardware + Software (KS3)
   Works without Firebase.
   If you add Firebase config, attempts will also be written to Firestore collection: attempts
*/

const CLASSES = ["7A1","7A2","7A3","7B1","7B2","7B3","7B4"];


// -------- Firebase handles --------
// This site is designed to work as a static GitHub Pages site.
// If Firebase has been initialised in the HTML (teacher setup), window.db will exist.
// Students do NOT need to log in; we only write attempts.
const db = (window.db && typeof window.db.collection === "function") ? window.db : null;

// -------- Question bank (differentiated) --------
// Levels: easy = Core, medium = Secure, hard = Stretch
// Question types: mcq_single
const QUESTION_BANK = [
  // CORE (easy)
  { id:"E1", level:"easy", topic:"input", prompt:"Which of these is an INPUT device?", choices:["Monitor","Keyboard","Printer","Speakers"], answer:1 },
  { id:"E2", level:"easy", topic:"output", prompt:"Which of these is an OUTPUT device?", choices:["Mouse","Microphone","Projector","Scanner"], answer:2 },
  { id:"E3", level:"easy", topic:"storage", prompt:"Which device is used mainly for SECONDARY storage?", choices:["RAM","CPU","SSD","Cache"], answer:2 },
  { id:"E4", level:"easy", topic:"storage", prompt:"Primary storage (RAM) is best described as…", choices:["Permanent storage","Temporary storage used while running","A type of input device","A type of output device"], answer:1 },
  { id:"E5", level:"easy", topic:"software", prompt:"Which is APPLICATION software?", choices:["Windows 11","Device driver","Antivirus","Google Chrome"], answer:3 },
  { id:"E6", level:"easy", topic:"software", prompt:"Which is SYSTEM software?", choices:["Minecraft","PowerPoint","Operating system","Photo editor"], answer:2 },
  { id:"E7", level:"easy", topic:"software", prompt:"Which is UTILITY software?", choices:["Spreadsheet","Antivirus","Web browser","Presentation software"], answer:1 },
  { id:"E8", level:"easy", topic:"concept", prompt:"A computer system usually follows which pattern?", choices:["Output → Input → Store","Input → Process → Output (and Storage)","Process → Output → Input","Store → Output → Process"], answer:1 },

  // SECURE (medium)
  { id:"M1", level:"medium", topic:"input", prompt:"A barcode scanner is best described as…", choices:["Input device capturing codes","Output device showing codes","Storage device for codes","System software"], answer:0 },
  { id:"M2", level:"medium", topic:"output", prompt:"Why are speakers an output device?", choices:["They capture sound","They present sound to the user","They store sound permanently","They process sound"], answer:1 },
  { id:"M3", level:"medium", topic:"storage", prompt:"Which statement is TRUE?", choices:["SSD has moving parts","HDD is always faster than SSD","SSD is usually faster than HDD","RAM is permanent storage"], answer:2 },
  { id:"M4", level:"medium", topic:"storage", prompt:"Cloud storage means your files are…", choices:["Only on your USB stick","Stored on the internet so you can access them with a login","Stored in RAM","Stored only on your screen"], answer:1 },
  { id:"M5", level:"medium", topic:"software", prompt:"Which job is MOST likely done by the operating system?", choices:["Editing photos","Managing memory so programs can run","Creating a presentation","Designing a logo"], answer:1 },
  { id:"M6", level:"medium", topic:"software", prompt:"A device driver is best described as…", choices:["A game that runs hardware","System software that helps the OS control hardware","An input device","A storage device"], answer:1 },
  { id:"M7", level:"medium", topic:"software", prompt:"Which is the best example of a utility task?", choices:["Writing an essay","Playing music","Backing up files","Drawing a character"], answer:2 },
  { id:"M8", level:"medium", topic:"concept", prompt:"A smartphone counts as a computer because it…", choices:["Has a keyboard","Has input, processing and output","Is always connected to Wi‑Fi","Only runs one app"], answer:1 },

  // STRETCH (hard)
  { id:"H1", level:"hard", topic:"software", prompt:"Which pair is matched correctly?", choices:["Application software: Windows","System software: Web browser","Utility software: Antivirus","Primary storage: SSD"], answer:2 },
  { id:"H2", level:"hard", topic:"concept", prompt:"When you switch off a computer, which data is MOST likely to be lost?", choices:["A file saved on an SSD","A file saved in cloud storage","Data currently stored in RAM","A photo saved on a memory card"], answer:2 },
  { id:"H3", level:"hard", topic:"software", prompt:"Why is multitasking useful?", choices:["It lets the OS share CPU time between programs","It stores files permanently","It increases monitor size","It converts input devices into output devices"], answer:0 },
  { id:"H4", level:"hard", topic:"storage", prompt:"Which choice gives the best reason to back up files?", choices:["To make the CPU faster","To protect your work if a device fails or is lost","To improve screen resolution","To increase RAM capacity"], answer:1 },
  { id:"H5", level:"hard", topic:"concept", prompt:"A game console is running a game. Which statement is most accurate?", choices:["The game is system software","The game is application software and relies on system software","The controller is secondary storage","The TV is an input device"], answer:1 },
];

// We’ll present a balanced quiz: 8 core + 8 secure + 4 stretch = 20 questions
function buildQuizSet() {
  const pick = (level, n) => {
    const pool = QUESTION_BANK.filter(q => q.level === level);
    // stable shuffle
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n);
  };
  const set = [
    ...pick("easy", 8),
    ...pick("medium", 8),
    ...pick("hard", 4),
  ];
  // Mix order so it's not grouped by level
  return set.sort(() => Math.random() - 0.5);
}

function levelLabel(level){
  if(level === "easy") return "Core";
  if(level === "medium") return "Secure";
  return "Stretch";
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

// -------- UI wiring --------
const form = document.getElementById("quizForm");
const startBtn = document.getElementById("startBtn");
const submitBtn = document.getElementById("submitBtn");
const quizArea = document.getElementById("quizArea");
const questionsEl = document.getElementById("questions");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");

const classEl = document.getElementById("studentClass");
const nameEl = document.getElementById("studentName");

let QUIZ = [];
let started = false;

function setStatus(msg){
  statusEl.textContent = msg || "";
}

function validateMeta(){
  const cls = classEl.value.trim();
  const name = nameEl.value.trim();
  if (!CLASSES.includes(cls)) return "Please select your class.";
  if (name.length < 3) return "Please enter your full name.";
  return null;
}

function renderQuiz(){
  questionsEl.innerHTML = "";
  QUIZ.forEach((q, idx) => {
    const qId = `q_${idx}`;
    const level = q.level;

    const wrapper = document.createElement("div");
    wrapper.className = "q";
    wrapper.innerHTML = `
      <div class="q__top">
        <p class="q__title"><strong>Q${idx+1}.</strong> ${escapeHtml(q.prompt)}</p>
        <span class="level" data-level="${level}">${levelLabel(level)}</span>
      </div>
      <div class="choices" role="radiogroup" aria-label="Question ${idx+1}">
        ${q.choices.map((c, i) => `
          <label class="choice">
            <input type="radio" name="${qId}" value="${i}" required />
            <span>${escapeHtml(c)}</span>
          </label>
        `).join("")}
      </div>
    `;
    questionsEl.appendChild(wrapper);
  });
}

function collectAnswers(){
  const answers = [];
  for (let i=0;i<QUIZ.length;i++){
    const name = `q_${i}`;
    const picked = form.querySelector(`input[name="${name}"]:checked`);
    answers.push(picked ? Number(picked.value) : null);
  }
  return answers;
}

function scoreQuiz(answers){
  let total = QUIZ.length;
  let score = 0;

  const byLevel = {
    easy: { score:0, total:0 },
    medium: { score:0, total:0 },
    hard: { score:0, total:0 },
  };

  QUIZ.forEach((q, i) => {
    const correct = answers[i] === q.answer;
    byLevel[q.level].total += 1;
    if (correct){
      score += 1;
      byLevel[q.level].score += 1;
    }
  });

  return { score, total, byLevel };
}

function gradeMessage(score, total, byLevel){
  const pct = Math.round((score/total)*100);
  // A simple banding + encouragement
  if (pct >= 90) return "Outstanding — you’ve nailed the basics and the stretch questions.";
  if (pct >= 75) return "Strong work — you understand most of the content.";
  if (pct >= 55) return "Good effort — re-read the cards you found tricky and try again in your head.";
  return "Keep going — re-read the cards carefully, then review your answers and improve next time.";
}

async function saveAttempt(payload){
  // Always store a local copy (useful if Firebase isn’t enabled yet)
  try {
    const key = "hw_attempts_local";
    const existing = JSON.parse(localStorage.getItem(key) || "[]");
    existing.push(payload);
    localStorage.setItem(key, JSON.stringify(existing));
  } catch (_) {}

  if (!db) return { ok:false, mode:"local" };

  try {
    await db.collection("attempts").add(payload);
    return { ok:true, mode:"firestore" };
  } catch (e) {
    console.warn("Firestore write failed:", e);
    return { ok:false, mode:"local" };
  }
}

function buildPayload(studentClass, studentName, answers, scoreObj){
  const now = new Date();
  return {
    class: studentClass,
    student_name: studentName,
    score: scoreObj.score,
    total: scoreObj.total,
    breakdown: scoreObj.byLevel,
    answers: answers,
    quiz_question_ids: QUIZ.map(q => q.id),
    created_at: now.toISOString(),
    user_agent: navigator.userAgent || "",
  };
}

function showResults(scoreObj){
  const { score, total, byLevel } = scoreObj;
  resultsEl.hidden = false;

  const pct = Math.round((score/total)*100);
  const msg = gradeMessage(score, total, byLevel);

  resultsEl.innerHTML = `
    <h3>Your score: ${score}/${total} (${pct}%)</h3>
    <p>${escapeHtml(msg)}</p>
    <ul>
      <li><strong>Core</strong>: ${byLevel.easy.score}/${byLevel.easy.total}</li>
      <li><strong>Secure</strong>: ${byLevel.medium.score}/${byLevel.medium.total}</li>
      <li><strong>Stretch</strong>: ${byLevel.hard.score}/${byLevel.hard.total}</li>
    </ul>
    <p class="fineprint">If you want to improve, focus on the level with the lowest score.</p>
  `;
}

// -------- Events --------
startBtn.addEventListener("click", () => {
  const err = validateMeta();
  if (err){
    setStatus(err);
    return;
  }
  setStatus("");
  started = true;
  QUIZ = buildQuizSet();
  renderQuiz();
  quizArea.hidden = false;
  resultsEl.hidden = true;
  // scroll to quiz area
  quizArea.scrollIntoView({ behavior:"smooth", block:"start" });
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!started){
    setStatus("Click Start quiz first.");
    return;
  }

  const err = validateMeta();
  if (err){
    setStatus(err);
    return;
  }

  submitBtn.disabled = true;
  setStatus("Submitting…");

  const studentClass = classEl.value.trim();
  const studentName = nameEl.value.trim();

  const answers = collectAnswers();
  if (answers.some(a => a === null)){
    submitBtn.disabled = false;
    setStatus("Please answer every question before submitting.");
    return;
  }

  const scoreObj = scoreQuiz(answers);
  const payload = buildPayload(studentClass, studentName, answers, scoreObj);

  const saved = await saveAttempt(payload);
  showResults(scoreObj);

  if (saved.ok && saved.mode === "firestore"){
    setStatus("Submitted ✅ (saved to school database)");
  } else {
    setStatus("Submitted ✅ (saved locally — Firebase not enabled yet)");
  }

  submitBtn.disabled = false;
});


// -------- Mobile nav toggle (student page) --------
document.addEventListener("DOMContentLoaded", () => {
  const hamburger = document.getElementById("hamburger");
  const topnav = document.getElementById("topnav");
  if (!hamburger || !topnav) return;

  hamburger.addEventListener("click", () => {
    const isOpen = topnav.classList.toggle("show");
    hamburger.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });

  // Close the menu after clicking a link (mobile)
  topnav.querySelectorAll("a").forEach(a => {
    a.addEventListener("click", () => {
      topnav.classList.remove("show");
      hamburger.setAttribute("aria-expanded", "false");
    });
  });

  // Close if you click outside the menu (mobile)
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
