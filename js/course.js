import { parseCode, shuffleArray } from "./utils/parse.js";
import { renderDocument } from "./renderers/document.js";
import { renderQuestion, initQuestionState, getQuestionStats } from "./renderers/question.js";
import { renderChallenge } from "./renderers/challenge.js";
import { renderCodeFix } from "./renderers/codeFix.js";
import { renderGodotScene } from "./renderers/godotScene.js";
import { renderFillBlank } from "./renderers/fillBlank.js";
import { renderSpotBug } from "./renderers/spotBug.js";
import { renderProject } from "./renderers/project.js";

let currentUser = null;
let ud = { enrolled: [], scores: {}, analytics: {}, survivalScores: {}, projectProgress: {}, mastery: {}, practiceSettings: {} };
let catalogData = [];
let activeCD = null;
let activeLessonData = null;
let activeBundleCourseId = null;

const $ = id => document.getElementById(id);
const viewExplorer  = $("view-explorer");
const viewSyllabus  = $("view-syllabus");
const viewLesson    = $("view-lesson");
const viewSettings  = $("view-settings");
const viewHub       = $("view-hub");
const catalogGrid   = $("catalog-grid");
const enrolledList  = $("enrolled-list");
const navExplorer   = $("nav-explorer");
const navSettings   = $("nav-settings");
const navHub        = $("nav-hub");
const authGoogleBtn = $("auth-google-btn");
const authMagicBtn  = $("auth-magic-btn");
const authEmailInput = $("auth-email-input");
const authStatus    = $("auth-status");
const searchBar     = $("search-bar");
const reqWipeBtn    = $("request-wipe-btn");
const wipeAuthBlock = $("wipe-auth-block");
const wipeConfirmInput = $("wipe-confirm-input");
const execWipeBtn   = $("execute-wipe-btn");

const BINARY_TYPES   = ["challenge", "code_fix", "godot_scene", "spot_bug", "project"];
const PRACTICE_TYPES = ["practice_standard", "practice_survival", "master_test"];
const MASTERY_THRESHOLD = 0.75;

const isBinaryLesson = l =>
    BINARY_TYPES.includes(l.type) || (!l.questions?.length && l.type === "document");

function applyTheme(t) {
    document.body.className = document.body.className
        .replace(/theme-\w+/g, "").trim();
    if (t) document.body.classList.add(t);
    localStorage.setItem("novara-theme", t || "");
    document.querySelectorAll(".theme-swatch").forEach(s => {
        s.classList.toggle("active-theme", s.dataset.theme === t);
    });
}

(function initTheme() {
    const saved = localStorage.getItem("novara-theme");
    if (saved) applyTheme(saved);
})();

document.querySelectorAll(".theme-swatch").forEach(s => {
    s.addEventListener("click", () => applyTheme(s.dataset.theme));
});

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
        ud.enrolled        = ud.enrolled        || [];
        ud.scores          = ud.scores          || {};
        ud.analytics       = ud.analytics       || {};
        ud.survivalScores  = ud.survivalScores  || {};
        ud.projectProgress = ud.projectProgress || {};
        ud.mastery         = ud.mastery         || {};
        ud.practiceSettings = ud.practiceSettings || {};
    } else {
        ud = { enrolled: [], scores: {}, analytics: {}, survivalScores: {}, projectProgress: {}, mastery: {}, practiceSettings: {} };
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
    [viewExplorer, viewSyllabus, viewLesson, viewSettings, viewHub]
        .forEach(v => v.style.display = "none");
    $(id).style.display = "block";
    document.body.classList.remove("lesson-active");
}

async function loadCatalog() {
    if (catalogData.length) return;
    const res = await fetch("data/catalog.json");
    catalogData = await res.json();
    console.log("catalog loaded", catalogData.length, "entries");
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

navHub.addEventListener("click", async e => {
    e.preventDefault();
    await loadCatalog();
    switchView("view-hub");
    openHub("practice");
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
    const blank = { enrolled: [], scores: {}, analytics: {}, survivalScores: {}, projectProgress: {}, mastery: {}, practiceSettings: {} };
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

function isBundle(entry) { return entry.type === "bundle"; }

function getBundleCourseIds(entry) {
    return isBundle(entry) ? entry.courses.map(c => c.id) : [entry.id];
}

async function fetchCourseData(meta) {
    const res = await fetch(meta.file);
    return res.json();
}

async function fetchBundleData(entry) {
    if (!isBundle(entry)) return { [entry.id]: await fetchCourseData(entry) };
    const results = {};
    for (const c of entry.courses) {
        results[c.id] = await fetchCourseData(c);
    }
    return results;
}

function allLessonsFromData(data) {
    const out = [];
    data.sections.forEach(sec => sec.lessons.forEach(l => out.push(l)));
    return out;
}

async function getCourseProgress(entryId) {
    const entry = catalogData.find(c => c.id === entryId);
    if (!entry) return 0;
    let earned = 0, total = 0;

    const collect = (data, courseId) => {
        data.sections.forEach(sec => sec.lessons.forEach(l => {
            if (l.type === "project") return;
            const id = l.id || l.title.replace(/\s+/g, "-").toLowerCase();
            const max = isBinaryLesson(l) ? 1 : 4;
            total += max;
            earned += Math.min(ud.scores[id] || 0, max);
        }));
    };

    if (isBundle(entry)) {
        for (const c of entry.courses) {
            const data = await fetchCourseData(c);
            collect(data, c.id);
        }
    } else {
        const data = await fetchCourseData(entry);
        collect(data, entry.id);
    }

    return total === 0 ? 0 : Math.round((earned / total) * 100);
}

let activeCategory = "all";
let activeDifficulty = "all";

async function renderExplorer() {
    catalogGrid.innerHTML = "";
    for (const entry of catalogData) {
        if (activeCategory !== "all" && entry.category !== activeCategory) continue;
        if (activeDifficulty !== "all" && entry.difficulty !== activeDifficulty) continue;

        const enrolled = ud.enrolled.includes(entry.id);
        const card = document.createElement("div");
        card.className = "course-card";
        card.dataset.category = entry.category || "";
        card.dataset.difficulty = entry.difficulty || "";
        card.style.cssText = "display:flex;flex-direction:column;";

        const diffBadge = entry.difficulty
            ? `<span class="diff-badge ${entry.difficulty}">${entry.difficulty}</span>` : "";

        let progressHtml = "";
        if (enrolled) {
            const pct = await getCourseProgress(entry.id);
            progressHtml = `
                <div class="course-progress-wrapper">
                    <div class="course-progress-fill progress-animator" data-target="${pct}%" style="width:0%"></div>
                </div>
                <p style="font-size:12px;color:var(--accent);margin-top:-10px;margin-bottom:15px;text-align:right;">${pct}% complete</p>
            `;
        }

        card.innerHTML = `
            <h3>${entry.title}${diffBadge}</h3>
            ${isBundle(entry) ? `<p style="font-size:10px;color:var(--accent);font-weight:900;letter-spacing:1px;margin-bottom:4px;text-transform:uppercase;">Bundle &bull; ${entry.courses.length} courses</p>` : ""}
            <p style="flex-grow:1">${entry.description}</p>
            ${progressHtml}
        `;

        const btnGroup = document.createElement("div");
        btnGroup.style.cssText = "display:flex;gap:10px;margin-top:auto;";

        if (enrolled) {
            const cont = document.createElement("button");
            cont.innerText = "Continue";
            cont.style.cssText = "flex:2;border-color:var(--text-dim);color:var(--text-dim);";
            cont.onclick = () => openSyllabus(entry);

            const drop = document.createElement("button");
            drop.innerText = "drop";
            drop.style.cssText = "flex:1;border-color:#ff4444;color:#ff4444;background:transparent;";
            drop.onclick = () => unenrollFromCourse(entry);

            btnGroup.append(cont, drop);
        } else {
            const enroll = document.createElement("button");
            enroll.innerText = "Enroll";
            enroll.className = "b-enroll-btn";
            enroll.style.flex = "1";
            enroll.onclick = () => enrollInCourse(entry);
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
        const entry = catalogData.find(c => c.id === id);
        if (!entry) return;
        const li = document.createElement("li");
        const a = Object.assign(document.createElement("a"), { href: "#", innerText: entry.title });
        a.addEventListener("click", e => { e.preventDefault(); openSyllabus(entry); });
        li.appendChild(a);
        enrolledList.appendChild(li);
    });
}

async function enrollInCourse(entry) {
    if (ud.enrolled.length >= 3) { alert("Maximum 3 active curriculums."); return; }
    ud.enrolled.push(entry.id);
    await saveField("enrolled", ud.enrolled);

    if (navigator.serviceWorker?.controller) {
        const files = isBundle(entry)
            ? entry.courses.map(c => c.file)
            : [entry.file];
        files.forEach(f => {
            navigator.serviceWorker.controller.postMessage({ type: "CACHE_COURSE", url: f });
        });
    }

    await renderExplorer();
}

async function unenrollFromCourse(entry) {
    if (!confirm(`Remove '${entry.title}'? Scores are preserved.`)) return;
    ud.enrolled = ud.enrolled.filter(id => id !== entry.id);
    await saveField("enrolled", ud.enrolled);
    await renderExplorer();
}

function findProjectLesson(data) {
    for (const sec of data.sections) {
        for (const l of sec.lessons) {
            if (l.type === "project") return l;
        }
    }
    return null;
}

async function openSyllabus(entry) {
    switchView("view-syllabus");
    const titleEl = $("syllabus-title");
    const contentDiv = $("syllabus-content");
    contentDiv.innerHTML = "";

    if (isBundle(entry)) {
        titleEl.innerText = entry.title;

        const pct = await getCourseProgress(entry.id);
        contentDiv.innerHTML = `
            <div class="course-progress-wrapper" style="margin-top:5px;margin-bottom:15px;">
                <div class="course-progress-fill progress-animator" data-target="${pct}%" style="width:0%"></div>
            </div>
            <p style="font-size:14px;color:var(--accent);margin-top:-5px;margin-bottom:24px;text-align:right;">${pct}% complete</p>
        `;

        for (const courseRef of entry.courses) {
            const data = await fetchCourseData(courseRef);
            const cPct = await (async () => {
                let e = 0, t = 0;
                data.sections.forEach(sec => sec.lessons.forEach(l => {
                    if (l.type === "project") return;
                    const id = l.id || l.title.replace(/\s+/g, "-").toLowerCase();
                    const max = isBinaryLesson(l) ? 1 : 4;
                    t += max; e += Math.min(ud.scores[id] || 0, max);
                }));
                return t === 0 ? 0 : Math.round((e / t) * 100);
            })();

            const headerEl = document.createElement("div");
            headerEl.className = "bundle-header";
            headerEl.innerHTML = `
                <span>${courseRef.title} <small style="font-weight:400;color:var(--text-dim);margin-left:8px;">${cPct}%</small></span>
                <span class="bundle-arrow">▾</span>
            `;

            const lessonsEl = document.createElement("div");
            lessonsEl.className = "bundle-lessons";
            buildSyllabusLessons(data, lessonsEl, courseRef.id);

            headerEl.addEventListener("click", () => {
                const open = lessonsEl.style.display !== "none";
                lessonsEl.style.display = open ? "none" : "block";
                headerEl.querySelector(".bundle-arrow").textContent = open ? "▸" : "▾";
            });

            contentDiv.appendChild(headerEl);
            contentDiv.appendChild(lessonsEl);
        }

    } else {
        const data = await fetchCourseData(entry);
        activeCD = data;
        activeCD.id = entry.id;
        activeBundleCourseId = null;

        titleEl.innerText = entry.title;

        const projectLesson = findProjectLesson(data);
        if (projectLesson) {
            const projBtn = document.createElement("button");
            projBtn.innerText = "Projects";
            projBtn.style.cssText = "float:right;margin-top:-3px;font-size:12px;padding:6px 14px;";
            projBtn.onclick = () => openProject(projectLesson, entry);
            titleEl.appendChild(projBtn);
        }

        const pct = await getCourseProgress(entry.id);
        const hdr = document.createElement("div");
        hdr.innerHTML = `
            <div class="course-progress-wrapper" style="margin-top:5px;margin-bottom:15px;">
                <div class="course-progress-fill progress-animator" data-target="${pct}%" style="width:0%"></div>
            </div>
            <p style="font-size:14px;color:var(--accent);margin-top:-5px;margin-bottom:30px;text-align:right;">${pct}% complete</p>
        `;
        contentDiv.appendChild(hdr);
        buildSyllabusLessons(data, contentDiv, entry.id);

        const masterRow = document.createElement("div");
        masterRow.className = "master-test-row";
        masterRow.innerHTML = `<div class="master-test-title">Curriculum Test</div><div class="master-subtitle">Full Course Exam</div>`;
        masterRow.onclick = compileMasterTest;
        contentDiv.appendChild(masterRow);
    }

    setTimeout(() => {
        document.querySelectorAll(".progress-animator")
            .forEach(b => b.style.width = b.dataset.target);
    }, 50);
}

function buildSyllabusLessons(data, container, courseId) {
    data.sections.forEach(section => {
        const block = document.createElement("div");
        block.className = "section-block";
        const sHeader = Object.assign(document.createElement("div"), {
            className: "section-header",
            innerText: section.title
        });
        block.appendChild(sHeader);

        section.lessons.forEach(lesson => {
            if (lesson.type === "project") return;

            const id = lesson.id || lesson.title.replace(/\s+/g, "-").toLowerCase();
            lesson.id = id;
            lesson.questions?.forEach((q, i) => q.globalId = `${id}-q${i}`);

            const score   = ud.scores?.[id] || 0;
            const mastered = ud.mastery?.[id];

            let dotsHtml = "";
            if (isBinaryLesson(lesson)) {
                dotsHtml = mastered
                    ? `<div class="rating-star" title="Mastered"></div>`
                    : `<div class="rating-dot ${score >= 1 ? "filled" : ""}"></div>`;
            } else {
                dotsHtml = mastered
                    ? `<div class="rating-star" title="Mastered"></div><div class="rating-star"></div><div class="rating-star"></div><div class="rating-star"></div>`
                    : [1,2,3,4].map(n => `<div class="rating-dot ${score >= n ? "filled" : ""}"></div>`).join("");
            }

            const row = document.createElement("div");
            row.className = "lesson-row";
            row.innerHTML = `<div class="lesson-title">${lesson.title}${mastered ? '<span class="mastery-badge">mastered</span>' : ""}</div><div class="rating-display">${dotsHtml}</div>`;
            row.onclick = () => {
                if (!activeCD || activeCD.id !== courseId) {
                    activeCD = data;
                    activeCD.id = courseId;
                    activeBundleCourseId = courseId;
                }
                startLesson(lesson);
            };
            block.appendChild(row);
        });

        container.appendChild(block);
    });
}

function openProject(projectLesson, entry) {
    switchView("view-lesson");
    document.body.classList.add("lesson-active");

    $("lesson-back-btn")?.remove();
    const backBtn = Object.assign(document.createElement("button"), {
        id: "lesson-back-btn", innerText: "← Return"
    });
    backBtn.style.cssText = "position:fixed;top:24px;left:24px;z-index:999;background:var(--surface);color:var(--text-main);border:2px solid var(--border);padding:10px 16px;font-size:12px;letter-spacing:2px;box-shadow:4px 4px 0px var(--border);cursor:pointer;";
    document.body.appendChild(backBtn);
    backBtn.onclick = () => {
        backBtn.remove();
        document.body.classList.remove("lesson-active");
        openSyllabus(entry);
    };

    renderProject(projectLesson, entry.id, ud, saveField, () => {
        backBtn.remove();
        document.body.classList.remove("lesson-active");
        openSyllabus(entry);
    });
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
        id: "lesson-back-btn", innerText: "← Return"
    });
    backBtn.style.cssText = "position:fixed;top:24px;left:24px;z-index:999;background:var(--surface);color:var(--text-main);border:2px solid var(--border);padding:10px 16px;font-size:12px;letter-spacing:2px;box-shadow:4px 4px 0px var(--border);cursor:pointer;";
    document.body.appendChild(backBtn);
    backBtn.onclick = () => {
        if (!confirm("Return? Progress on this lesson will not be saved.")) return;
        backBtn.remove();
        document.body.classList.remove("lesson-active");
        const entry = catalogData.find(c => c.id === activeCD?.id) || catalogData.find(c => isBundle(c) && c.courses?.some(cr => cr.id === activeCD?.id));
        entry ? openSyllabus(entry) : navExplorer.click();
    };

    const analytics = activeCD ? (ud.analytics[activeCD.id] || {}) : {};
    const onUpdate = async a => {
        if (!activeCD) return;
        ud.analytics[activeCD.id] = a;
        await saveField("analytics", ud.analytics);
    };

    const t = activeLessonData.type;
    if (t === "document") {
        const next = activeLessonData.questions?.length
            ? () => renderQuestion(activeLessonData, analytics, onUpdate, () => finishLesson())
            : () => finishLesson();
        renderDocument(activeLessonData, next);
    } else if (t === "challenge")  renderChallenge(activeLessonData, () => finishLesson());
    else if (t === "code_fix")     renderCodeFix(activeLessonData, () => finishLesson());
    else if (t === "godot_scene")  renderGodotScene(activeLessonData, () => finishLesson());
    else if (t === "fill_blank")   renderFillBlank(activeLessonData, (c, tot) => finishFillBlank(c, tot));
    else if (t === "spot_bug")     renderSpotBug(activeLessonData, (c) => finishSpotBug(c));
    else renderQuestion(activeLessonData, analytics, onUpdate, () => finishLesson());
}

async function finishFillBlank(correctCount, total) {
    $("lesson-back-btn")?.remove();
    const score = correctCount === total ? 4
        : correctCount >= total * 0.75 ? 3
        : correctCount >= total * 0.5  ? 2
        : correctCount > 0             ? 1 : 0;

    viewLesson.innerHTML = `
        <div class="lesson-workspace" style="text-align:center;">
            <h2>Complete</h2>
            <p style="line-height:1.5;">accuracy: ${correctCount} / ${total}</p>
            <p style="color:var(--accent);font-size:24px;margin-top:20px;">rating: ${score} / 4</p>
            <button id="return-btn" style="margin-top:40px;">Return</button>
        </div>
    `;

    const cur = ud.scores[activeLessonData.id] || 0;
    if (score > cur) { ud.scores[activeLessonData.id] = score; await saveField("scores", ud.scores); }

    $("return-btn").onclick = () => {
        const entry = catalogData.find(c => c.id === activeCD?.id) || catalogData.find(c => isBundle(c) && c.courses?.some(cr => cr.id === activeCD?.id));
        entry ? openSyllabus(entry) : navExplorer.click();
    };
}

async function finishSpotBug(correct) {
    $("lesson-back-btn")?.remove();
    const score = correct ? 1 : 0;

    viewLesson.innerHTML = `
        <div class="lesson-workspace" style="text-align:center;">
            <h2>Complete</h2>
            <p style="line-height:1.5;">${correct ? "Bug found." : "Missed it."}</p>
            <p style="color:var(--accent);font-size:24px;margin-top:20px;">rating: ${score} / 1</p>
            <button id="return-btn" style="margin-top:40px;">Return</button>
        </div>
    `;

    const cur = ud.scores[activeLessonData.id] || 0;
    if (score > cur) { ud.scores[activeLessonData.id] = score; await saveField("scores", ud.scores); }

    $("return-btn").onclick = () => {
        const entry = catalogData.find(c => c.id === activeCD?.id) || catalogData.find(c => isBundle(c) && c.courses?.some(cr => cr.id === activeCD?.id));
        entry ? openSyllabus(entry) : navExplorer.click();
    };
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

        const total = activeLessonData.questions.length;
        if (total > 0 && (correctAnswersCount / total) >= MASTERY_THRESHOLD) {
            const grouped = {};
            activeLessonData.questions.forEach((q, i) => {
                if (!grouped[q.parentLessonId]) grouped[q.parentLessonId] = { c: 0, t: 0 };
                grouped[q.parentLessonId].t++;
                if (questionResults[i]) grouped[q.parentLessonId].c++;
            });
            let masteryChanged = false;
            for (const [lid, s] of Object.entries(grouped)) {
                if ((s.c / s.t) >= MASTERY_THRESHOLD && !ud.mastery[lid]) {
                    ud.mastery[lid] = true;
                    masteryChanged = true;
                }
            }
            if (masteryChanged) await saveField("mastery", ud.mastery);

            if (masteryChanged) {
                ratingText = "complete. mastery earned on some lessons!";
            }
        }

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
            navHub.click();
        } else {
            const entry = catalogData.find(c => c.id === activeCD?.id) || catalogData.find(c => isBundle(c) && c.courses?.some(cr => cr.id === activeCD?.id));
            entry ? openSyllabus(entry) : navExplorer.click();
        }
    };
}

function getDefaultPracticeSettings() {
    return { mcq: true, fill_blank: true, spot_bug: true };
}

async function openHub(tab) {
    document.querySelectorAll(".hub-tab").forEach(t => {
        t.classList.toggle("active", t.dataset.hubtab === tab);
    });
    $("hub-practice-panel").style.display = tab === "practice" ? "block" : "none";
    $("hub-docs-panel").style.display     = tab === "docs" ? "block" : "none";

    if (tab === "practice") await buildPracticePanel();
    if (tab === "docs")     await buildDocsPanel();
}

document.querySelectorAll(".hub-tab").forEach(btn => {
    btn.addEventListener("click", () => openHub(btn.dataset.hubtab));
});

async function buildPracticePanel() {
    const content = $("practice-content");
    content.innerHTML = "";

    if (!ud.enrolled.length) {
        content.innerHTML = "<p style='color:var(--text-dim)'>no curriculums active.</p>";
        return;
    }

    for (const entryId of ud.enrolled) {
        const entry = catalogData.find(c => c.id === entryId);
        if (!entry) continue;

        const settings = ud.practiceSettings[entryId] || getDefaultPracticeSettings();

        const card = document.createElement("div");
        card.className = "practice-card";
        card.innerHTML = `
            <h3>${entry.title}</h3>
            <p style="font-size:14px;color:var(--text-dim);">2 Modes</p>
            <p style="font-size:12px;color:#ff4444;margin-top:-5px;font-weight:bold;">Survival Record: ${ud.survivalScores[entryId] || 0}</p>
            <div class="practice-settings">
                <div class="practice-settings-title">Include question types</div>
                <label><input type="checkbox" class="ps-check" data-type="mcq" ${settings.mcq ? "checked" : ""}> Multiple Choice</label>
                <label><input type="checkbox" class="ps-check" data-type="fill_blank" ${settings.fill_blank ? "checked" : ""}> Fill in the Blank</label>
                <label><input type="checkbox" class="ps-check" data-type="spot_bug" ${settings.spot_bug ? "checked" : ""}> Spot the Bug</label>
            </div>
        `;

        card.querySelectorAll(".ps-check").forEach(cb => {
            cb.addEventListener("change", async () => {
                if (!ud.practiceSettings[entryId]) ud.practiceSettings[entryId] = getDefaultPracticeSettings();
                ud.practiceSettings[entryId][cb.dataset.type] = cb.checked;
                await saveField("practiceSettings", ud.practiceSettings);
            });
        });

        const grp = document.createElement("div");
        grp.className = "practice-btn-group";

        const std = Object.assign(document.createElement("button"), { innerText: "standard" });
        std.onclick = () => compileStandardPractice(entry);

        const sur = Object.assign(document.createElement("button"), { innerText: "survival" });
        sur.style.cssText = "color:#ff4444;border-color:#ff4444;";
        sur.onclick = () => compileSurvivalPractice(entry);

        grp.append(std, sur);
        card.appendChild(grp);
        content.appendChild(card);
    }
}

async function buildDocsPanel() {
    const content = $("docs-content");
    content.innerHTML = "";

    if (!ud.enrolled.length) {
        content.innerHTML = "<p style='color:var(--text-dim)'>no curriculums active.</p>";
        return;
    }

    for (const entryId of ud.enrolled) {
        const entry = catalogData.find(c => c.id === entryId);
        if (!entry) continue;

        const group = document.createElement("div");
        group.className = "docs-course-group";
        group.innerHTML = `<div class="docs-course-title">${entry.title}</div>`;

        const dataMap = await fetchBundleData(entry);

        for (const [courseId, data] of Object.entries(dataMap)) {
            data.sections.forEach(sec => {
                sec.lessons.forEach(lesson => {
                    if (lesson.type !== "document" || !lesson.content) return;

                    const id = lesson.id || lesson.title.replace(/\s+/g, "-").toLowerCase();
                    lesson.id = id;

                    const row = document.createElement("div");
                    row.className = "docs-lesson-row";
                    row.innerHTML = `
                        <span class="docs-lesson-title">${lesson.title}</span>
                        <span class="docs-lesson-meta">${sec.title}</span>
                    `;
                    row.onclick = () => {
                        activeCD = data;
                        activeCD.id = courseId;
                        const docLesson = Object.assign({}, lesson, { questions: [] });
                        startLesson(docLesson);
                    };
                    group.appendChild(row);
                });
            });
        }

        content.appendChild(group);
    }
}

function collectQuestions(data, settings) {
    const out = [];
    const s = settings || getDefaultPracticeSettings();

    data.sections.forEach(sec => sec.lessons.forEach(l => {
        if (l.type === "project") return;
        const id = l.id || l.title.replace(/\s+/g, "-").toLowerCase();

        if (l.type === "fill_blank" && s.fill_blank) {
            l.questions?.forEach((q, i) => out.push({ ...q, globalId: `${id}-q${i}`, parentLessonId: id, _lessonType: "fill_blank" }));
        } else if (l.type === "spot_bug" && s.spot_bug) {
            out.push({ q: l.title, options: [], answer: 0, globalId: id, parentLessonId: id, _lessonType: "spot_bug" });
        } else if (l.questions?.length && s.mcq) {
            l.questions.forEach((q, i) => out.push({ ...q, globalId: `${id}-q${i}`, parentLessonId: id }));
        }
    }));
    return out;
}

async function getAllQuestionsForEntry(entry, settings) {
    const dataMap = await fetchBundleData(entry);
    const all = [];
    for (const [courseId, data] of Object.entries(dataMap)) {
        collectQuestions(data, settings).forEach(q => {
            q._courseId = courseId;
            all.push(q);
        });
    }
    return all;
}

async function compileMasterTest() {
    if (!activeCD) return;
    const all = collectQuestions(activeCD, getDefaultPracticeSettings());
    if (!all.length) { alert("No questions available."); return; }
    startLesson({
        id: "master-test",
        courseId: activeCD.id,
        title: "Curriculum Master Test",
        type: "master_test",
        questions: shuffleArray(all).slice(0, 15)
    });
}

async function compileStandardPractice(entry) {
    const settings = ud.practiceSettings[entry.id] || getDefaultPracticeSettings();
    const dataMap = await fetchBundleData(entry);
    const firstKey = Object.keys(dataMap)[0];
    activeCD = dataMap[firstKey];
    activeCD.id = firstKey;

    const all = await getAllQuestionsForEntry(entry, settings);
    if (!all.length) { alert("Complete more lessons first."); return; }

    const an = ud.analytics[entry.id] || {};
    all.sort((a, b) => {
        const aS = an[a.globalId] || { correct: 0, incorrect: 0 };
        const bS = an[b.globalId] || { correct: 0, incorrect: 0 };
        return (bS.incorrect - bS.correct) - (aS.incorrect - aS.correct);
    });

    startLesson({
        id: "practice-standard",
        title: "Standard Practice",
        type: "practice_standard",
        questions: shuffleArray(all.slice(0, 10))
    });
}

async function compileSurvivalPractice(entry) {
    const settings = ud.practiceSettings[entry.id] || getDefaultPracticeSettings();
    const dataMap = await fetchBundleData(entry);
    const firstKey = Object.keys(dataMap)[0];
    activeCD = dataMap[firstKey];
    activeCD.id = firstKey;

    const all = await getAllQuestionsForEntry(entry, settings);
    if (!all.length) { alert("No questions available."); return; }
    startLesson({
        id: "practice-survival",
        courseId: entry.id,
        title: "Survival",
        type: "practice_survival",
        questions: shuffleArray(all)
    });
}

searchBar?.addEventListener("input", e => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll(".course-card").forEach(card => {
        const t = card.querySelector("h3")?.innerText.toLowerCase() || "";
        const d = card.querySelector("p")?.innerText.toLowerCase() || "";
        card.style.display = (t.includes(q) || d.includes(q)) ? "flex" : "none";
    });
});

document.querySelectorAll(".filter-btn[data-filter]").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".filter-btn[data-filter]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        activeCategory = btn.dataset.filter;
        renderExplorer();
    });
});

document.querySelectorAll(".diff-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".diff-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        activeDifficulty = btn.dataset.diff;
        renderExplorer();
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

(function initPublicCatalog() {
    const btnCourses   = $("btn-landing-courses");
    const btnSignin    = $("btn-landing-signin");
    const btnBack      = $("btn-back-landing");
    const viewLanding  = $("view-landing");
    const viewPublic   = $("view-public-courses");
    const viewAuth     = $("view-auth");
    const heroCta      = document.querySelector(".hero-cta");
    const pubGrid      = $("public-catalog-grid");

    let pubCategory = "all";
    let pubDifficulty = "all";

    async function openPublic(e) {
        e?.preventDefault();
        viewLanding.style.display = "none";
        viewPublic.style.display  = "block";
        await loadCatalog();
        renderPublicGrid();
    }

    function renderPublicGrid() {
        pubGrid.innerHTML = "";
        catalogData.forEach(entry => {
            if (pubCategory !== "all" && entry.category !== pubCategory) return;
            if (pubDifficulty !== "all" && entry.difficulty !== pubDifficulty) return;

            const card = document.createElement("div");
            card.className = "public-course-card";

            const lessonsNote = isBundle(entry)
                ? `${entry.courses.length} courses`
                : "Full curriculum";

            const diffBadge = entry.difficulty
                ? `<span class="diff-badge ${entry.difficulty}">${entry.difficulty}</span>` : "";

            card.innerHTML = `
                <h3>${entry.title} ${diffBadge}</h3>
                ${isBundle(entry) ? `<p style="font-size:10px;color:var(--accent);font-weight:900;letter-spacing:1px;text-transform:uppercase;margin:0;">Bundle</p>` : ""}
                <p>${entry.description}</p>
                <div class="public-card-footer">
                    <span class="public-card-meta">${lessonsNote} &bull; ${entry.category}</span>
                    <button class="public-signin-trigger" style="font-size:11px;padding:6px 14px;">Sign in to enroll</button>
                </div>
            `;

            card.querySelector(".public-signin-trigger").addEventListener("click", () => {
                viewPublic.style.display = "none";
                viewAuth.style.display   = "block";
            });

            pubGrid.appendChild(card);
        });
    }

    if (btnCourses) btnCourses.addEventListener("click", openPublic);
    if (heroCta)    heroCta.addEventListener("click", openPublic);

    if (btnBack) {
        btnBack.addEventListener("click", () => {
            viewPublic.style.display  = "none";
            viewLanding.style.display = "flex";
        });
    }

    if (btnSignin) {
        btnSignin.addEventListener("click", e => {
            e.preventDefault();
            viewLanding.style.display = "none";
            viewAuth.style.display    = "block";
        });
    }

    document.querySelectorAll("[data-pfilter]").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll("[data-pfilter]").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            pubCategory = btn.dataset.pfilter;
            renderPublicGrid();
        });
    });

    document.querySelectorAll("[data-pdifficulty]").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll("[data-pdifficulty]").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            pubDifficulty = btn.dataset.pdifficulty;
            renderPublicGrid();
        });
    });

    window.firebaseAuth.onAuthStateChanged(user => {
        const appView = $("app-view");
        if (user) {
            viewLanding.style.display  = "none";
            viewPublic.style.display   = "none";
            viewAuth.style.display     = "none";
            appView.style.display      = "flex";
        } else {
            viewLanding.style.display  = "flex";
            viewPublic.style.display   = "none";
            viewAuth.style.display     = "none";
            appView.style.display      = "none";
        }
    });
})();