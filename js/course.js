import { parseCode, shuffleArray } from "./utils/parse.js";
import { renderDocument } from "./renderers/document.js";
import { renderQuestion, initQuestionState, getQuestionStats } from "./renderers/question.js";
import { renderChallenge } from "./renderers/challenge.js";
import { renderCodeFix } from "./renderers/codeFix.js";
import { renderGodotScene } from "./renderers/godotScene.js";

let currentUser = null;
let ud = { enrolled: [], scores: {}, analytics: {}, survivalScores: {} };
let catalogData = [];
let activeCD = null;
let activeLessonData = null;

const $ = id => document.getElementById(id);
const viewExplorer  = $("view-explorer");
const viewSyllabus  = $("view-syllabus");
const viewLesson    = $("view-lesson");
const viewSettings  = $("view-settings");
const viewPractice  = $("view-practice");
const catalogGrid   = $("catalog-grid");
const enrolledList  = $("enrolled-list");
const practiceContent = $("practice-content");
const navExplorer   = $("nav-explorer");
const navSettings   = $("nav-settings");
const navPractice   = $("nav-practice");
const authGoogleBtn = $("auth-google-btn");
const authMagicBtn  = $("auth-magic-btn");
const authEmailInput = $("auth-email-input");
const authStatus    = $("auth-status");
const searchBar     = $("search-bar");
const reqWipeBtn    = $("request-wipe-btn");
const wipeAuthBlock = $("wipe-auth-block");
const wipeConfirmInput = $("wipe-confirm-input");
const execWipeBtn   = $("execute-wipe-btn");

const BINARY_TYPES = ["challenge", "code_fix", "godot_scene"];
const PRACTICE_TYPES = ["practice_standard", "practice_survival", "master_test"];

const isBinaryLesson = l =>
    BINARY_TYPES.includes(l.type) || (!l.questions?.length && l.type === "document");

window.firebaseAuth.onAuthStateChanged(async user => {
    if (!user) return;
    currentUser = user;
    await loadUserData();
    navExplorer.click();
});

authGoogleBtn.addEventListener("click", async () => {
    try {
        await window.signInWithPopup(window.firebaseAuth, new window.GoogleAuthProvider());
    } catch (e) {
        setAuthStatus("Google sign-in failed: " + e.message, "#ff4444");
    }
});

authMagicBtn.addEventListener("click", async () => {
    const email = authEmailInput.value.trim();
    if (!email) { setAuthStatus("Email required.", "#ff4444"); return; }
    setAuthStatus("Sending link...", "var(--text-dim)");
    try {
        await window.sendSignInLinkToEmail(window.firebaseAuth, email, {
            url: window.location.origin + window.location.pathname,
            handleCodeInApp: true
        });
        window.localStorage.setItem("emailForSignIn", email);
        setAuthStatus("Link sent. Check your inbox.", "var(--accent)");
    } catch (e) {
        setAuthStatus("Failed: " + e.message, "#ff4444");
    }
});

function setAuthStatus(msg, color) {
    authStatus.innerText = msg;
    authStatus.style.color = color;
}

async function loadUserData() {
    const ref = window.doc(window.db, "users", currentUser.uid);
    const snap = await window.getDoc(ref);
    if (snap.exists()) {
        ud = snap.data();
        ud.enrolled      = ud.enrolled      || [];
        ud.scores        = ud.scores        || {};
        ud.analytics     = ud.analytics     || {};
        ud.survivalScores = ud.survivalScores || {};
    } else {
        ud = { enrolled: [], scores: {}, analytics: {}, survivalScores: {} };
        await window.setDoc(ref, ud);
    }
    console.log("user data loaded", currentUser.uid);
}

async function saveField(field, value) {
    await window.setDoc(
        window.doc(window.db, "users", currentUser.uid),
        { [field]: value },
        { merge: true }
    );
}

function switchView(id) {
    [viewExplorer, viewSyllabus, viewLesson, viewSettings, viewPractice]
        .forEach(v => v.style.display = "none");
    $(id).style.display = "block";
    document.body.classList.remove("lesson-active");
}

async function loadCatalog() {
    if (catalogData.length) return;
    const res = await fetch("data/catalog.json");
    catalogData = await res.json();
}

navExplorer.addEventListener("click", async e => {
    e.preventDefault();
    await loadCatalog();
    await renderExplorer();
    switchView("view-explorer");
});

navSettings.addEventListener("click", e => {
    e.preventDefault();
    switchView("view-settings");
});

navPractice.addEventListener("click", async e => {
    e.preventDefault();
    await loadCatalog();
    openPracticeHub();
});

$("sign-out-btn").addEventListener("click", () => window.firebaseAuth.signOut());

reqWipeBtn.addEventListener("click", () => {
    reqWipeBtn.style.display = "none";
    wipeAuthBlock.style.display = "block";
});

wipeConfirmInput.addEventListener("input", e => {
    const ok = e.target.value === "PURGE";
    execWipeBtn.disabled = !ok;
    execWipeBtn.style.backgroundColor = ok ? "#ff4444" : "transparent";
    execWipeBtn.style.color = ok ? "var(--void)" : "#ff4444";
});

execWipeBtn.addEventListener("click", async () => {
    const blank = { enrolled: [], scores: {}, analytics: {}, survivalScores: {} };
    await window.setDoc(window.doc(window.db, "users", currentUser.uid), blank);
    ud = blank;
    wipeConfirmInput.value = "";
    execWipeBtn.disabled = true;
    execWipeBtn.style.cssText = "background-color:transparent;color:#ff4444;";
    wipeAuthBlock.style.display = "none";
    reqWipeBtn.style.display = "inline-block";
    await renderExplorer();
    navExplorer.click();
});

async function getCourseProgress(courseId) {
    const meta = catalogData.find(c => c.id === courseId);
    if (!meta) return 0;
    const data = await fetchCourseData(meta);
    let earned = 0, total = 0;
    data.sections.forEach(sec => sec.lessons.forEach(l => {
        const id = l.id || l.title.replace(/\s+/g, "-").toLowerCase();
        const max = isBinaryLesson(l) ? 1 : 4;
        total += max;
        earned += Math.min(ud.scores[id] || 0, max);
    }));
    return total === 0 ? 0 : Math.round((earned / total) * 100);
}

async function renderExplorer() {
    catalogGrid.innerHTML = "";
    for (const course of catalogData) {
        const enrolled = ud.enrolled.includes(course.id);
        const card = document.createElement("div");
        card.className = "course-card";
        card.dataset.category = course.category || "";
        card.style.cssText = "display:flex;flex-direction:column;";

        let progressHtml = "";
        if (enrolled) {
            const pct = await getCourseProgress(course.id);
            progressHtml = `
                <div class="course-progress-wrapper">
                    <div class="course-progress-fill progress-animator" data-target="${pct}%" style="width:0%"></div>
                </div>
                <p style="font-size:12px;color:var(--accent);margin-top:-10px;margin-bottom:15px;text-align:right;">${pct}% complete</p>
            `;
        }

        card.innerHTML = `<h3>${course.title}</h3><p style="flex-grow:1">${course.description}</p>${progressHtml}`;

        const btnGroup = document.createElement("div");
        btnGroup.style.cssText = "display:flex;gap:10px;margin-top:auto;";

        if (enrolled) {
            const cont = document.createElement("button");
            cont.innerText = "Continue";
            cont.style.cssText = "flex:2;border-color:var(--text-dim);color:var(--text-dim);";
            cont.onclick = () => openSyllabus(course);

            const drop = document.createElement("button");
            drop.innerText = "drop";
            drop.style.cssText = "flex:1;border-color:#ff4444;color:#ff4444;background:transparent;";
            drop.onclick = () => unenrollFromCourse(course);

            btnGroup.append(cont, drop);
        } else {
            const enroll = document.createElement("button");
            enroll.innerText = "Enroll";
            enroll.className = "b-enroll-btn";
            enroll.style.flex = "1";
            enroll.onclick = () => enrollInCourse(course);
            btnGroup.appendChild(enroll);
        }

        card.appendChild(btnGroup);
        catalogGrid.appendChild(card);
    }

    renderSidebar();
    setTimeout(() => {
        document.querySelectorAll(".progress-animator")
            .forEach(b => b.style.width = b.dataset.target);
    }, 50);
}

function renderSidebar() {
    enrolledList.innerHTML = "";
    if (!ud.enrolled.length) {
        enrolledList.innerHTML = `<li><span style="color:var(--text-dim)">no active data</span></li>`;
        return;
    }
    ud.enrolled.forEach(id => {
        const course = catalogData.find(c => c.id === id);
        if (!course) return;
        const li = document.createElement("li");
        const a = Object.assign(document.createElement("a"), { href: "#", innerText: course.title });
        a.addEventListener("click", e => { e.preventDefault(); openSyllabus(course); });
        li.appendChild(a);
        enrolledList.appendChild(li);
    });
}

async function enrollInCourse(course) {
    if (ud.enrolled.length >= 3) { alert("Maximum 3 active curriculums."); return; }
    ud.enrolled.push(course.id);
    await saveField("enrolled", ud.enrolled);
    await renderExplorer();
}

async function unenrollFromCourse(course) {
    if (!confirm(`Remove '${course.title}'? Scores are preserved.`)) return;
    ud.enrolled = ud.enrolled.filter(id => id !== course.id);
    await saveField("enrolled", ud.enrolled);
    await renderExplorer();
}

async function fetchCourseData(meta) {
    const res = await fetch(meta.file);
    return res.json();
}

async function openSyllabus(meta) {
    switchView("view-syllabus");
    $("syllabus-title").innerText = meta.title;
    activeCD = await fetchCourseData(meta);

    const contentDiv = $("syllabus-content");
    contentDiv.innerHTML = "";

    const pct = await getCourseProgress(meta.id);
    const header = document.createElement("div");
    header.innerHTML = `
        <div class="course-progress-wrapper" style="margin-top:5px;margin-bottom:15px;">
            <div class="course-progress-fill progress-animator" data-target="${pct}%" style="width:0%"></div>
        </div>
        <p style="font-size:14px;color:var(--accent);margin-top:-5px;margin-bottom:30px;text-align:right;">${pct}% complete</p>
    `;
    contentDiv.appendChild(header);

    activeCD.sections.forEach(section => {
        const block = document.createElement("div");
        block.className = "section-block";
        const sHeader = Object.assign(document.createElement("div"), {
            className: "section-header",
            innerText: section.title
        });
        block.appendChild(sHeader);

        section.lessons.forEach(lesson => {
            const id = lesson.id || lesson.title.replace(/\s+/g, "-").toLowerCase();
            lesson.id = id;
            lesson.questions?.forEach((q, i) => q.globalId = `${id}-q${i}`);

            const score = ud.scores?.[id] || 0;
            const dots = isBinaryLesson(lesson)
                ? `<div class="rating-dot ${score >= 1 ? "filled" : ""}"></div>`
                : [1,2,3,4].map(n => `<div class="rating-dot ${score >= n ? "filled" : ""}"></div>`).join("");

            const row = document.createElement("div");
            row.className = "lesson-row";
            row.innerHTML = `<div class="lesson-title">${lesson.title}</div><div class="rating-display">${dots}</div>`;
            row.onclick = () => startLesson(lesson);
            block.appendChild(row);
        });

        contentDiv.appendChild(block);
    });

    const masterRow = document.createElement("div");
    masterRow.className = "master-test-row";
    masterRow.innerHTML = `<div class="master-test-title">Curriculum Test</div><div class="master-subtitle">Full Course Exam</div>`;
    masterRow.onclick = compileMasterTest;
    contentDiv.appendChild(masterRow);

    setTimeout(() => {
        document.querySelectorAll(".progress-animator")
            .forEach(b => b.style.width = b.dataset.target);
    }, 50);
}

function startLesson(lesson) {
    activeLessonData = JSON.parse(JSON.stringify(lesson));

    if (activeLessonData.questions?.length && activeLessonData.type !== "practice_standard")
        activeLessonData.questions = shuffleArray(activeLessonData.questions);

    initQuestionState();
    switchView("view-lesson");
    document.body.classList.add("lesson-active");

    $("lesson-back-btn")?.remove();
    const backBtn = Object.assign(document.createElement("button"), {
        id: "lesson-back-btn",
        innerText: "← Return"
    });
    backBtn.style.cssText = "position:fixed;top:24px;left:24px;z-index:999;background:var(--surface);color:var(--text-main);border:2px solid var(--border);padding:10px 16px;font-size:12px;letter-spacing:2px;box-shadow:4px 4px 0px var(--border);cursor:pointer;";
    document.body.appendChild(backBtn);

    backBtn.onclick = () => {
        if (!confirm("Return to curriculum? Progress on this lesson will not be saved.")) return;
        backBtn.remove();
        document.body.classList.remove("lesson-active");
        const meta = catalogData.find(c => c.id === activeCD?.id);
        meta ? openSyllabus(meta) : navExplorer.click();
    };

    const analytics = activeCD ? (ud.analytics[activeCD.id] || {}) : {};
    const onUpdate  = async a => {
        if (!activeCD) return;
        ud.analytics[activeCD.id] = a;
        await saveField("analytics", ud.analytics);
    };
    const onFinish = finishLesson;

    const t = activeLessonData.type;
    if (t === "document") {
        const next = activeLessonData.questions?.length
            ? () => renderQuestion(activeLessonData, analytics, onUpdate, onFinish)
            : onFinish;
        renderDocument(activeLessonData, next);
    } else if (t === "challenge")    renderChallenge(activeLessonData, onFinish);
    else if (t === "code_fix")       renderCodeFix(activeLessonData, onFinish);
    else if (t === "godot_scene")    renderGodotScene(activeLessonData, onFinish);
    else renderQuestion(activeLessonData, analytics, onUpdate, onFinish);
}

async function finishLesson() {
    $("lesson-back-btn")?.remove();

    const { correctAnswersCount, questionResults, survivalStrikes } = getQuestionStats();
    const hasQ = activeLessonData.questions?.length > 0;
    let finalScore = 0, accuracyText = "", ratingText = "";
    const t = activeLessonData.type;

    if (t === "practice_survival") {
        const courseId = activeLessonData.courseId || activeCD?.id;
        const high = ud.survivalScores[courseId] || 0;
        let rec = "";
        if (correctAnswersCount > high) {
            ud.survivalScores[courseId] = correctAnswersCount;
            await saveField("survivalScores", ud.survivalScores);
            rec = `<br><span style="color:#ff4444;font-size:16px;display:block;margin-top:10px;">new survival record!</span>`;
        }
        accuracyText = `survived ${correctAnswersCount} iterations.${rec}`;
        ratingText   = survivalStrikes >= 3 ? "terminated." : "gauntlet cleared.";

    } else if (t === "master_test") {
        accuracyText = `master test: ${correctAnswersCount} / ${activeLessonData.questions.length}`;
        ratingText   = "scores updated.";
        const stats = {};
        activeLessonData.questions.forEach((q, i) => {
            const lid = q.parentLessonId;
            if (!stats[lid]) stats[lid] = { correct: 0, total: 0 };
            stats[lid].total++;
            if (questionResults[i]) stats[lid].correct++;
        });
        for (const [lid, s] of Object.entries(stats)) {
            const proj = Math.round((s.correct / s.total) * 4);
            const final = proj === 0 && s.correct > 0 ? 1 : proj;
            if (final > (ud.scores[lid] || 0)) ud.scores[lid] = final;
        }
        await saveField("scores", ud.scores);

    } else if (t === "practice_standard") {
        accuracyText = `accuracy: ${correctAnswersCount} / ${activeLessonData.questions.length}`;
        ratingText   = "complete.";

    } else if (BINARY_TYPES.includes(t) || (!hasQ && t === "document")) {
        finalScore   = 1;
        accuracyText = "passed.";
        ratingText   = "rating: 1 / 1";

    } else {
        const total  = activeLessonData.questions.length;
        finalScore   = Math.round((correctAnswersCount / total) * 4);
        if (finalScore === 0 && correctAnswersCount > 0) finalScore = 1;
        accuracyText = `accuracy: ${correctAnswersCount} / ${total}`;
        ratingText   = `rating: ${finalScore} / 4`;
    }

    viewLesson.innerHTML = `
        <div class="lesson-workspace" style="text-align:center;">
            <h2>Complete</h2>
            <p style="line-height:1.5;">${accuracyText}</p>
            <p style="color:var(--accent);font-size:24px;margin-top:20px;">${ratingText}</p>
            <button id="return-btn" style="margin-top:40px;">Return</button>
        </div>
    `;

    if (!PRACTICE_TYPES.includes(t)) {
        const cur = ud.scores[activeLessonData.id] || 0;
        if (finalScore > cur) {
            ud.scores[activeLessonData.id] = finalScore;
            await saveField("scores", ud.scores);
        }
    }

    $("return-btn").onclick = () => {
        if (t === "practice_standard" || t === "practice_survival") {
            navPractice.click();
        } else {
            const meta = catalogData.find(c => c.id === activeCD?.id);
            meta ? openSyllabus(meta) : navExplorer.click();
        }
    };
}

async function openPracticeHub() {
    switchView("view-practice");
    practiceContent.innerHTML = "";

    if (!ud.enrolled.length) {
        practiceContent.innerHTML = "<p style='color:var(--text-dim)'>no curriculums active.</p>";
        return;
    }

    for (const courseId of ud.enrolled) {
        const meta = catalogData.find(c => c.id === courseId);
        if (!meta) continue;

        const card = document.createElement("div");
        card.className = "practice-card";
        card.innerHTML = `
            <h3>${meta.title}</h3>
            <p style="font-size:14px;color:var(--text-dim);">2 Modes</p>
            <p style="font-size:12px;color:#ff4444;margin-top:-5px;font-weight:bold;">Survival Record: ${ud.survivalScores[courseId] || 0}</p>
        `;

        const grp = document.createElement("div");
        grp.className = "practice-btn-group";

        const std = Object.assign(document.createElement("button"), { innerText: "standard" });
        std.onclick = () => compileStandardPractice(meta);

        const sur = Object.assign(document.createElement("button"), { innerText: "survival" });
        sur.style.cssText = "color:#ff4444;border-color:#ff4444;";
        sur.onclick = () => compileSurvivalPractice(meta);

        grp.append(std, sur);
        card.appendChild(grp);
        practiceContent.appendChild(card);
    }
}

function collectQuestions(data) {
    const out = [];
    data.sections.forEach(sec => sec.lessons.forEach(l => {
        const id = l.id || l.title.replace(/\s+/g, "-").toLowerCase();
        l.questions?.forEach((q, i) => out.push({ ...q, globalId: `${id}-q${i}`, parentLessonId: id }));
    }));
    return out;
}

async function compileMasterTest() {
    const all = collectQuestions(activeCD);
    if (!all.length) { alert("No questions available."); return; }
    startLesson({ id: "master-test", courseId: activeCD.id, title: "Curriculum Master Test", type: "master_test", questions: shuffleArray(all).slice(0, 15) });
}

async function compileStandardPractice(meta) {
    activeCD = await fetchCourseData(meta);
    const all = collectQuestions(activeCD);
    if (!all.length) { alert("Complete more lessons first."); return; }
    const an = ud.analytics[activeCD.id] || {};
    all.sort((a, b) => {
        const aS = an[a.globalId] || { correct: 0, incorrect: 0 };
        const bS = an[b.globalId] || { correct: 0, incorrect: 0 };
        return (bS.incorrect - bS.correct) - (aS.incorrect - aS.correct);
    });
    startLesson({ id: "practice-standard", title: "Standard Practice", type: "practice_standard", questions: shuffleArray(all.slice(0, 10)) });
}

async function compileSurvivalPractice(meta) {
    activeCD = await fetchCourseData(meta);
    const all = collectQuestions(activeCD);
    if (!all.length) { alert("No questions available."); return; }
    startLesson({ id: "practice-survival", courseId: meta.id, title: "Survival", type: "practice_survival", questions: shuffleArray(all) });
}

searchBar?.addEventListener("input", e => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll(".course-card").forEach(card => {
        const t = card.querySelector("h3")?.innerText.toLowerCase() || "";
        const d = card.querySelector("p")?.innerText.toLowerCase() || "";
        card.style.display = (t.includes(q) || d.includes(q)) ? "flex" : "none";
    });
});

document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const filter = btn.dataset.filter;
        document.querySelectorAll(".course-card").forEach(card => {
            card.style.display = (filter === "all" || card.dataset.category === filter) ? "flex" : "none";
        });
    });
});

document.addEventListener("keydown", e => {
    if (e.target?.classList.contains("challenge-editor") && e.key === "Tab") {
        e.preventDefault();
        const el = e.target, s = el.selectionStart;
        el.value = el.value.substring(0, s) + "    " + el.value.substring(el.selectionEnd);
        el.selectionStart = el.selectionEnd = s + 4;
    }
});