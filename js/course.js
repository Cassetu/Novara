import { parseCode, shuffleArray } from "./utils/parse.js";
import { renderDocument } from "./renderers/document.js";
import { renderQuestion, initQuestionState, getQuestionStats } from "./renderers/question.js";
import { renderChallenge } from "./renderers/challenge.js";
import { renderCodeFix } from "./renderers/codeFix.js";
import { renderGodotScene } from "./renderers/godotScene.js";

let currentUser = null;
let userData = { enrolled: [], scores: {}, analytics: {}, survivalScores: {} };
let catalogData = [];
let activeCurriculumData = null;
let activeLessonData = null;

const viewExplorer = document.getElementById("view-explorer");
const viewSyllabus = document.getElementById("view-syllabus");
const viewLesson = document.getElementById("view-lesson");
const viewSettings = document.getElementById("view-settings");
const viewPractice = document.getElementById("view-practice");
const catalogGrid = document.getElementById("catalog-grid");
const enrolledList = document.getElementById("enrolled-list");
const practiceContent = document.getElementById("practice-content");
const navExplorer = document.getElementById("nav-explorer");
const navSettings = document.getElementById("nav-settings");
const navPractice = document.getElementById("nav-practice");
const authGoogleBtn = document.getElementById("auth-google-btn");
const authMagicBtn = document.getElementById("auth-magic-btn");
const authEmailInput = document.getElementById("auth-email-input");
const authStatus = document.getElementById("auth-status");
const searchBar = document.getElementById("search-bar");
const reqWipeBtn = document.getElementById("request-wipe-btn");
const wipeAuthBlock = document.getElementById("wipe-auth-block");
const wipeConfirmInput = document.getElementById("wipe-confirm-input");
const execWipeBtn = document.getElementById("execute-wipe-btn");


window.firebaseAuth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        await loadUserData();
        navExplorer.click();
    }
});

authGoogleBtn.addEventListener("click", async () => {
    try {
        await window.signInWithPopup(window.firebaseAuth, new window.GoogleAuthProvider());
    } catch (e) {
        authStatus.innerText = "Google sign-in failed: " + e.message;
        authStatus.style.color = "#ff4444";
    }
});

authMagicBtn.addEventListener("click", async () => {
    const email = authEmailInput.value.trim();
    if (!email) {
        authStatus.innerText = "Email required.";
        authStatus.style.color = "#ff4444";
        return;
    }
    authStatus.innerText = "Sending link...";
    authStatus.style.color = "var(--text-dim)";
    try {
        await window.sendSignInLinkToEmail(window.firebaseAuth, email, {
            url: window.location.origin + window.location.pathname,
            handleCodeInApp: true
        });
        window.localStorage.setItem("emailForSignIn", email);
        authStatus.innerText = "Link sent. Check your inbox.";
        authStatus.style.color = "var(--accent)";
    } catch (e) {
        authStatus.innerText = "Failed: " + e.message;
        authStatus.style.color = "#ff4444";
    }
});

async function loadUserData() {
    const ref = window.doc(window.db, "users", currentUser.uid);
    const snap = await window.getDoc(ref);
    if (snap.exists()) {
        userData = snap.data();
        userData.enrolled = userData.enrolled || [];
        userData.scores = userData.scores || {};
        userData.analytics = userData.analytics || {};
        userData.survivalScores = userData.survivalScores || {};
    } else {
        userData = { enrolled: [], scores: {}, analytics: {}, survivalScores: {} };
        await window.setDoc(ref, userData);
    }
}

async function saveUserField(field, value) {
    const ref = window.doc(window.db, "users", currentUser.uid);
    await window.setDoc(ref, { [field]: value }, { merge: true });
}


function switchView(id) {
    [viewExplorer, viewSyllabus, viewLesson, viewSettings, viewPractice].forEach(v => {
        v.style.display = "none";
    });
    document.getElementById(id).style.display = "block";
    document.body.classList.remove("lesson-active");
}

navExplorer.addEventListener("click", async (e) => {
    e.preventDefault();
    if (!catalogData.length) {
        const res = await fetch("data/catalog.json");
        catalogData = await res.json();
    }
    await renderExplorer();
    switchView("view-explorer");
});

navSettings.addEventListener("click", (e) => {
    e.preventDefault();
    switchView("view-settings");
});

navPractice.addEventListener("click", async (e) => {
    e.preventDefault();
    if (!catalogData.length) {
        const res = await fetch("data/catalog.json");
        catalogData = await res.json();
    }
    openPracticeHub();
});


document.getElementById("sign-out-btn").addEventListener("click", () => {
    window.firebaseAuth.signOut();
});

reqWipeBtn.addEventListener("click", () => {
    reqWipeBtn.style.display = "none";
    wipeAuthBlock.style.display = "block";
});

wipeConfirmInput.addEventListener("input", (e) => {
    const ok = e.target.value === "PURGE";
    execWipeBtn.disabled = !ok;
    execWipeBtn.style.backgroundColor = ok ? "#ff4444" : "transparent";
    execWipeBtn.style.color = ok ? "var(--void)" : "#ff4444";
});

execWipeBtn.addEventListener("click", async () => {
    const blank = { enrolled: [], scores: {}, analytics: {}, survivalScores: {} };
    await window.setDoc(window.doc(window.db, "users", currentUser.uid), blank);
    userData = blank;
    wipeConfirmInput.value = "";
    execWipeBtn.disabled = true;
    execWipeBtn.style.backgroundColor = "transparent";
    execWipeBtn.style.color = "#ff4444";
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

    data.sections.forEach(sec => sec.lessons.forEach(lesson => {
        const id = lesson.id || lesson.title.replace(/\s+/g, "-").toLowerCase();
        const hasQ = lesson.questions?.length > 0;
        const max = (lesson.type === "challenge" || lesson.type === "code_fix" || lesson.type === "godot_scene" || (!hasQ && lesson.type === "document")) ? 1 : 4;
        total += max;
        earned += Math.min(userData.scores[id] || 0, max);
    }));

    return total === 0 ? 0 : Math.round((earned / total) * 100);
}

async function renderExplorer() {
    catalogGrid.innerHTML = "";

    for (const course of catalogData) {
        const enrolled = userData.enrolled.includes(course.id);
        const card = document.createElement("div");
        card.className = "course-card";
        card.setAttribute("data-category", course.category || "");
        card.style.cssText = "display:flex;flex-direction:column;";

        let progressHtml = "";
        if (enrolled) {
            const pct = await getCourseProgress(course.id);
            progressHtml = `
                <div class="course-progress-wrapper">
                    <div class="course-progress-fill progress-animator" data-target="${pct}%" style="width:0%;"></div>
                </div>
                <p style="font-size:12px;color:var(--accent);margin-top:-10px;margin-bottom:15px;text-align:right;">${pct}% complete</p>
            `;
        }

        card.innerHTML = `
            <h3>${course.title}</h3>
            <p style="flex-grow:1;">${course.description}</p>
            ${progressHtml}
        `;

        const btnGroup = document.createElement("div");
        btnGroup.style.cssText = "display:flex;gap:10px;margin-top:auto;";

        if (enrolled) {
            const cont = document.createElement("button");
            cont.innerText = "Continue";
            cont.style.cssText = "flex:2;border-color:var(--text-dim);color:var(--text-dim);";
            cont.addEventListener("click", () => openSyllabus(course));

            const drop = document.createElement("button");
            drop.innerText = "drop";
            drop.style.cssText = "flex:1;border-color:#ff4444;color:#ff4444;background:transparent;";
            drop.addEventListener("click", () => unenrollFromCourse(course));

            btnGroup.appendChild(cont);
            btnGroup.appendChild(drop);
        } else {
            const enroll = document.createElement("button");
            enroll.innerText = "Enroll";
            enroll.className = "b-enroll-btn";
            enroll.style.flex = "1";
            enroll.addEventListener("click", () => enrollInCourse(course));
            btnGroup.appendChild(enroll);
        }

        card.appendChild(btnGroup);
        catalogGrid.appendChild(card);
    }

    renderSidebar();

    setTimeout(() => {
        document.querySelectorAll(".progress-animator").forEach(bar => {
            bar.style.width = bar.getAttribute("data-target");
        });
    }, 50);
}

function renderSidebar() {
    enrolledList.innerHTML = "";
    if (!userData.enrolled.length) {
        enrolledList.innerHTML = `<li><span style="color:var(--text-dim)">no active data</span></li>`;
        return;
    }
    userData.enrolled.forEach(id => {
        const course = catalogData.find(c => c.id === id);
        if (!course) return;
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = "#";
        a.innerText = course.title;
        a.addEventListener("click", (e) => { e.preventDefault(); openSyllabus(course); });
        li.appendChild(a);
        enrolledList.appendChild(li);
    });
}

async function enrollInCourse(course) {
    if (userData.enrolled.length >= 3) {
        alert("Maximum 3 active curriculums.");
        return;
    }
    userData.enrolled.push(course.id);
    await saveUserField("enrolled", userData.enrolled);
    await renderExplorer();
}

async function unenrollFromCourse(course) {
    if (!confirm(`Remove '${course.title}'? Scores are preserved.`)) return;
    userData.enrolled = userData.enrolled.filter(id => id !== course.id);
    await saveUserField("enrolled", userData.enrolled);
    await renderExplorer();
}


async function fetchCourseData(meta) {
    const res = await fetch(meta.file);
    return res.json();
}

async function openSyllabus(meta) {
    switchView("view-syllabus");
    document.getElementById("syllabus-title").innerText = meta.title;
    activeCurriculumData = await fetchCourseData(meta);

    const contentDiv = document.getElementById("syllabus-content");
    contentDiv.innerHTML = "";

    const pct = await getCourseProgress(meta.id);
    const header = document.createElement("div");
    header.innerHTML = `
        <div class="course-progress-wrapper" style="margin-top:5px;margin-bottom:15px;">
            <div class="course-progress-fill progress-animator" data-target="${pct}%" style="width:0%;"></div>
        </div>
        <p style="font-size:14px;color:var(--accent);margin-top:-5px;margin-bottom:30px;text-align:right;">${pct}% complete</p>
    `;
    contentDiv.appendChild(header);

    activeCurriculumData.sections.forEach(section => {
        const block = document.createElement("div");
        block.className = "section-block";

        const sHeader = document.createElement("div");
        sHeader.className = "section-header";
        sHeader.innerText = section.title;
        block.appendChild(sHeader);

        section.lessons.forEach(lesson => {
            const id = lesson.id || lesson.title.replace(/\s+/g, "-").toLowerCase();
            lesson.id = id;
            lesson.questions?.forEach((q, i) => q.globalId = `${id}-q${i}`);

            const row = document.createElement("div");
            row.className = "lesson-row";

            const score = userData.scores?.[id] || 0;
            const hasQ = lesson.questions?.length > 0;
            const isBinary = lesson.type === "challenge" || lesson.type === "code_fix" || lesson.type === "godot_scene" || (!hasQ && lesson.type === "document");

            const dotsHtml = isBinary
                ? `<div class="rating-dot ${score >= 1 ? "filled" : ""}"></div>`
                : [1,2,3,4].map(n => `<div class="rating-dot ${score >= n ? "filled" : ""}"></div>`).join("");

            row.innerHTML = `<div class="lesson-title">${lesson.title}</div><div class="rating-display">${dotsHtml}</div>`;
            row.addEventListener("click", () => startLesson(lesson));
            block.appendChild(row);
        });

        contentDiv.appendChild(block);
    });

    const masterRow = document.createElement("div");
    masterRow.className = "master-test-row";
    masterRow.innerHTML = `<div class="master-test-title">Curriculum Test</div><div class="master-subtitle">Full Course Exam</div>`;
    masterRow.addEventListener("click", () => compileMasterTest());
    contentDiv.appendChild(masterRow);

    setTimeout(() => {
        document.querySelectorAll(".progress-animator").forEach(b => b.style.width = b.getAttribute("data-target"));
    }, 50);
}


function startLesson(lesson) {
    activeLessonData = JSON.parse(JSON.stringify(lesson));

    if (activeLessonData.questions?.length && activeLessonData.type !== "practice_standard") {
        activeLessonData.questions = shuffleArray(activeLessonData.questions);
    }

    initQuestionState();

    switchView("view-lesson");
    document.body.classList.add("lesson-active");

    const existing = document.getElementById("lesson-back-btn");
    if (existing) existing.remove();

    const backBtn = document.createElement("button");
    backBtn.id = "lesson-back-btn";
    backBtn.innerText = "← Return";
    backBtn.style.cssText = "position:fixed;top:24px;left:24px;z-index:999;background:var(--surface);color:var(--text-main);border:2px solid var(--border);padding:10px 16px;font-size:12px;letter-spacing:2px;box-shadow:4px 4px 0px var(--border);cursor:pointer;";
    document.body.appendChild(backBtn);

    backBtn.addEventListener("click", () => {
        if (!confirm("Return to curriculum? Progress on this lesson will not be saved.")) return;
        backBtn.remove();
        document.body.classList.remove("lesson-active");
        const meta = catalogData.find(c => c.id === activeCurriculumData?.id);
        if (meta) openSyllabus(meta);
        else navExplorer.click();
    });

    const onFinish = () => finishLesson();

    if (activeLessonData.type === "document") {
        if (activeLessonData.questions?.length) {
            renderDocument(activeLessonData, () => renderQuestion(activeLessonData, getCourseAnalytics(), updateAnalytics, onFinish));
        } else {
            renderDocument(activeLessonData, onFinish);
        }
    } else if (activeLessonData.type === "challenge") {
        renderChallenge(activeLessonData, onFinish);
    } else if (activeLessonData.type === "code_fix") {
        renderCodeFix(activeLessonData, onFinish);
    } else if (activeLessonData.type === "godot_scene") {
        renderGodotScene(activeLessonData, onFinish);
    } else {
        renderQuestion(activeLessonData, getCourseAnalytics(), updateAnalytics, onFinish);
    }
}

function getCourseAnalytics() {
    if (!activeCurriculumData) return {};
    return userData.analytics[activeCurriculumData.id] || {};
}

async function updateAnalytics(analytics) {
    if (!activeCurriculumData) return;
    userData.analytics[activeCurriculumData.id] = analytics;
    await saveUserField("analytics", userData.analytics);
}


async function finishLesson() {
    const backBtn = document.getElementById("lesson-back-btn");
    if (backBtn) backBtn.remove();

    const { correctAnswersCount, questionResults, survivalStrikes } = getQuestionStats();
    const hasQ = activeLessonData.questions?.length > 0;
    let finalScore = 0, accuracyText = "", ratingText = "";

    if (activeLessonData.type === "practice_survival") {
        const courseId = activeLessonData.courseId || activeCurriculumData?.id;
        const high = userData.survivalScores[courseId] || 0;
        let recordHtml = "";
        if (correctAnswersCount > high) {
            userData.survivalScores[courseId] = correctAnswersCount;
            await saveUserField("survivalScores", userData.survivalScores);
            recordHtml = `<br><span style="color:#ff4444;font-size:16px;display:block;margin-top:10px;">new survival record!</span>`;
        }
        accuracyText = `survived ${correctAnswersCount} iterations.${recordHtml}`;
        ratingText = survivalStrikes >= 3 ? "terminated." : "gauntlet cleared.";

    } else if (activeLessonData.type === "master_test") {
        accuracyText = `master test: ${correctAnswersCount} / ${activeLessonData.questions.length}`;
        ratingText = "scores updated.";
        const lessonStats = {};
        activeLessonData.questions.forEach((q, i) => {
            const lid = q.parentLessonId;
            if (!lessonStats[lid]) lessonStats[lid] = { correct: 0, total: 0 };
            lessonStats[lid].total++;
            if (questionResults[i]) lessonStats[lid].correct++;
        });
        for (const [lid, stats] of Object.entries(lessonStats)) {
            const projected = Math.round((stats.correct / stats.total) * 4);
            const final = projected === 0 && stats.correct > 0 ? 1 : projected;
            if (final > (userData.scores[lid] || 0)) userData.scores[lid] = final;
        }
        await saveUserField("scores", userData.scores);

    } else if (activeLessonData.type === "practice_standard") {
        accuracyText = `accuracy: ${correctAnswersCount} / ${activeLessonData.questions.length}`;
        ratingText = "complete.";

    } else if (activeLessonData.type === "challenge" || activeLessonData.type === "code_fix" || activeLessonData.type === "godot_scene" || (!hasQ && activeLessonData.type === "document")) {
        finalScore = 1;
        accuracyText = "passed.";
        ratingText = "rating: 1 / 1";

    } else {
        const total = activeLessonData.questions.length;
        finalScore = Math.round((correctAnswersCount / total) * 4);
        if (finalScore === 0 && correctAnswersCount > 0) finalScore = 1;
        accuracyText = `accuracy: ${correctAnswersCount} / ${total}`;
        ratingText = `rating: ${finalScore} / 4`;
    }

    const lessonView = document.getElementById("view-lesson");
    lessonView.innerHTML = `
        <div class="lesson-workspace" style="text-align:center;">
            <h2>Complete</h2>
            <p style="line-height:1.5;">${accuracyText}</p>
            <p style="color:var(--accent);font-size:24px;margin-top:20px;">${ratingText}</p>
            <button id="return-btn" style="margin-top:40px;">Return</button>
        </div>
    `;

    const isPractice = ["practice_standard", "practice_survival", "master_test"].includes(activeLessonData.type);
    if (!isPractice) {
        const current = userData.scores[activeLessonData.id] || 0;
        if (finalScore > current) {
            userData.scores[activeLessonData.id] = finalScore;
            await saveUserField("scores", userData.scores);
        }
    }

    document.getElementById("return-btn").addEventListener("click", () => {
        if (activeLessonData.type === "practice_standard" || activeLessonData.type === "practice_survival") {
            navPractice.click();
        } else {
            const meta = catalogData.find(c => c.id === activeCurriculumData?.id);
            if (meta) openSyllabus(meta);
            else navExplorer.click();
        }
    });
}


async function openPracticeHub() {
    switchView("view-practice");
    practiceContent.innerHTML = "";

    if (!userData.enrolled.length) {
        practiceContent.innerHTML = "<p style='color:var(--text-dim)'>no curriculums active.</p>";
        return;
    }

    for (const courseId of userData.enrolled) {
        const meta = catalogData.find(c => c.id === courseId);
        if (!meta) continue;

        const card = document.createElement("div");
        card.className = "practice-card";
        card.innerHTML = `
            <h3>${meta.title}</h3>
            <p style="font-size:14px;color:var(--text-dim);">2 Modes</p>
            <p style="font-size:12px;color:#ff4444;margin-top:-5px;font-weight:bold;">Survival Record: ${userData.survivalScores[courseId] || 0}</p>
        `;

        const btnGroup = document.createElement("div");
        btnGroup.className = "practice-btn-group";

        const stdBtn = document.createElement("button");
        stdBtn.innerText = "standard";
        stdBtn.addEventListener("click", () => compileStandardPractice(meta));

        const surBtn = document.createElement("button");
        surBtn.innerText = "survival";
        surBtn.style.cssText = "color:#ff4444;border-color:#ff4444;";
        surBtn.addEventListener("click", () => compileSurvivalPractice(meta));

        btnGroup.appendChild(stdBtn);
        btnGroup.appendChild(surBtn);
        card.appendChild(btnGroup);
        practiceContent.appendChild(card);
    }
}

function collectAllQuestions(data) {
    const questions = [];
    data.sections.forEach(sec => sec.lessons.forEach(lesson => {
        const id = lesson.id || lesson.title.replace(/\s+/g, "-").toLowerCase();
        lesson.questions?.forEach((q, i) => {
            questions.push({ ...q, globalId: `${id}-q${i}`, parentLessonId: id });
        });
    }));
    return questions;
}

async function compileMasterTest() {
    const all = collectAllQuestions(activeCurriculumData);
    if (!all.length) { alert("No questions available."); return; }
    startLesson({
        id: "master-test",
        courseId: activeCurriculumData.id,
        title: "Curriculum Master Test",
        type: "master_test",
        questions: shuffleArray(all).slice(0, 15)
    });
}

async function compileStandardPractice(meta) {
    activeCurriculumData = await fetchCourseData(meta);
    const all = collectAllQuestions(activeCurriculumData);
    const analytics = userData.analytics[activeCurriculumData.id] || {};

    all.sort((a, b) => {
        const aS = analytics[a.globalId] || { correct: 0, incorrect: 0 };
        const bS = analytics[b.globalId] || { correct: 0, incorrect: 0 };
        return (bS.incorrect - bS.correct) - (aS.incorrect - aS.correct);
    });

    if (!all.length) { alert("Complete more lessons first."); return; }
    startLesson({ id: "practice-standard", title: "Standard Practice", type: "practice_standard", questions: shuffleArray(all.slice(0, 10)) });
}

async function compileSurvivalPractice(meta) {
    activeCurriculumData = await fetchCourseData(meta);
    const all = collectAllQuestions(activeCurriculumData);
    if (!all.length) { alert("No questions available."); return; }
    startLesson({ id: "practice-survival", courseId: meta.id, title: "Survival", type: "practice_survival", questions: shuffleArray(all) });
}

searchBar?.addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll(".course-card").forEach(card => {
        const title = card.querySelector("h3")?.innerText.toLowerCase() || "";
        const desc = card.querySelector("p")?.innerText.toLowerCase() || "";
        card.style.display = (title.includes(q) || desc.includes(q)) ? "flex" : "none";
    });
});

document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const filter = btn.getAttribute("data-filter");
        document.querySelectorAll(".course-card").forEach(card => {
            const match = filter === "all" || card.getAttribute("data-category") === filter;
            card.style.display = match ? "flex" : "none";
        });
    });
});

document.addEventListener("keydown", (e) => {
    if (e.target?.classList.contains("challenge-editor") && e.key === "Tab") {
        e.preventDefault();
        const el = e.target;
        const s = el.selectionStart;
        el.value = el.value.substring(0, s) + "    " + el.value.substring(el.selectionEnd);
        el.selectionStart = el.selectionEnd = s + 4;
    }
});