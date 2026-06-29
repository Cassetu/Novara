import { parseCode, shuffleArray } from "./utils/parse.js";
import { renderDocument } from "./renderers/document.js";
import { renderQuestion, initQuestionState, getQuestionStats } from "./renderers/question.js";
import { renderChallenge } from "./renderers/challenge.js";
import { renderCodeFix } from "./renderers/codeFix.js";
import { renderGodotScene } from "./renderers/godotScene.js";
import { renderFillBlank } from "./renderers/fillBlank.js";
import { renderSpotBug } from "./renderers/spotBug.js";
import { renderProject } from "./renderers/project.js";
import { renderCookingSim } from "./renderers/cookingSim.js";

let currentUser = null;
let ud = { enrolled: [], scores: {}, analytics: {}, survivalScores: {}, projectProgress: {}, mastery: {}, practiceSettings: {} };
let catalogData = [];
let activeCD = null;
let activeLessonData = null;
let activeBundleCourseId = null;
let activeCurriculumEntry = null;
let activeCourseRef = null;

const $ = id => document.getElementById(id);

const viewExplorer  = $("view-explorer");
const viewSyllabus  = $("view-syllabus");
const viewLesson    = $("view-lesson");
const viewSettings  = $("view-settings");
const viewHub       = $("view-hub");
const catalogGrid   = $("catalog-grid");

const navExplorer      = $("nav-explorer");
const navActiveBtn     = $("nav-active-btn");
const activeDropdown   = $("active-dropdown");
const activeDropItems  = $("active-dropdown-items");
const activeCountBadge = $("active-count-badge");
const userAvatarBtn    = $("user-avatar-btn");
const userDropdown     = $("user-dropdown");
const navHub           = $("nav-hub");
const navSettings      = $("nav-settings");
const navSignout       = $("nav-signout");

const authGoogleBtn    = $("auth-google-btn");
const authMagicBtn     = $("auth-magic-btn");
const authEmailInput   = $("auth-email-input");
const authStatus       = $("auth-status");
const searchBar        = $("search-bar");
const reqWipeBtn       = $("request-wipe-btn");
const wipeAuthBlock    = $("wipe-auth-block");
const wipeConfirmInput = $("wipe-confirm-input");
const execWipeBtn      = $("execute-wipe-btn");

const BINARY_TYPES = ["challenge", "code_fix", "godot_scene", "spot_bug", "project", "cooking_sim"];
const PRACTICE_TYPES = ["practice_standard", "practice_survival", "master_test"];
const MASTERY_THRESHOLD = 0.75;

const isBinaryLesson = l =>
    BINARY_TYPES.includes(l.type) || (!l.questions?.length && l.type === "document");

const navToolsBtn = document.getElementById("nav-tools-btn");
const toolsDropdown = document.getElementById("tools-dropdown");

navToolsBtn.addEventListener("click", e => {
    e.stopPropagation();
    const isOpen = toolsDropdown.classList.contains("open");
    closeAllDropdowns();
    if (!isOpen) toolsDropdown.classList.add("open");
});

function applyTheme(t) {
    document.body.className = document.body.className.replace(/theme-\w+/g, "").trim();
    if (t) document.body.classList.add(t);
    localStorage.setItem("novara-theme", t || "");
    document.querySelectorAll(".theme-swatch").forEach(s =>
        s.classList.toggle("active-theme", s.dataset.theme === t)
    );
}

(function initTheme() {
    const saved = localStorage.getItem("novara-theme");
    if (saved) applyTheme(saved);
})();

document.querySelectorAll(".theme-swatch").forEach(s =>
    s.addEventListener("click", () => applyTheme(s.dataset.theme))
);

window.firebaseAuth.onAuthStateChanged(async user => {
    if (!user) return;
    currentUser = user;
    await loadUserData();
    const initial = (user.displayName || user.email || "N")[0].toUpperCase();
    if (userAvatarBtn) userAvatarBtn.textContent = initial;

    await loadCatalog();
    await routeFromURL();
});

window.addEventListener("popstate", routeFromURL);

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

function startOnboarding() {
    const onboardingOverlay = document.createElement("div");
    onboardingOverlay.id = "onboardingOverlay";
    if (existing) existing.remove();
    document.body.appendChild(onboardingOverlay);
    const steps = [
        { selector: ".course-card", title: "Curriculums", text: "Each card is a structured course with lessons and quizzes.", interaction: false },
        { selector: ".b-enroll-btn", title: "Enrolling", text: "Enroll in curriculums with a click of a button!", interaction: true },
        { selector: "#nav-hub", title: "Navigation & Hub", text: "This is the navigation, where you can find other things, such as the Hub. The Hub has practice mode to practice all information you've learned in an curriculum.", interaction: false },
        { selector: "#nav-active-btn", title: "Active Dropdown", text: "Here is where your curriculums will be, you can have a maximum of three curriculums active at once.", interaction: false }
    ];
    let lastTarget = null;
    function renderStep(index) {
        if (lastTarget) {
            lastTarget.style.position = "";
            lastTarget.style.zIndex = "";
        }
        const step = steps[index];
        const target = document.querySelector(step.selector);
        lastTarget = target;
        console.log(step.selector, target);
        const rect = target.getBoundingClientRect();
        onboardingOverlay.innerHTML = "";
        target.style.position = "relative";
        target.style.zIndex = "10000";
        const card = document.createElement("div");
        card.id = "onboardingCard";
        card.innerHTML = `
            <p>${index + 1} / ${steps.length}</p>
            <h3>${step.title}</h3>
            <p>${step.text}</p>
        `;
        card.style.position = "fixed";
        card.style.top = rect.top + "px";
        card.style.left = rect.right + 20 + "px";
        onboardingOverlay.appendChild(card);

        if (step.interaction) {
            target.addEventListener("click", () => {
                renderStep(index + 1)
            });
        } else {
            const nextBtn = document.createElement("button");
            nextBtn.innerText = "Got it!";
            card.appendChild(nextBtn);
            nextBtn.addEventListener("click", () => {
                if (index === steps.length - 1) {
                    onboardingOverlay.classList.add("onboarding-fadeout");
                    onboardingOverlay.addEventListener("animationend", () => {
                        if (lastTarget) {
                            lastTarget.style.position = "";
                            lastTarget.style.zIndex = "";
                        }
                        onboardingOverlay.remove();
                        ud.onboarded = true;
                        saveField("onboarded", true);
                    });
                } else {
                    renderStep(index + 1);
                }
            });
        }
    }
    renderStep(0);
}

async function routeFromURL() {
    const params = new URLSearchParams(window.location.search);
    const view = params.get("view");
    const id = params.get("id");
    const tab = params.get("tab");
    const parentId = params.get("parentId");

    if (view === "hub") {
        navHub.click();
        if (tab) openHub(tab);
    } else if (view === "curriculum-home") {
        const entry = catalogData.find(c => c.id === id);
        if (entry) openCurriculumHome(entry);
        else navExplorer.click();
    } else if (view === "syllabus") {
        const entry = catalogData.find(c => c.id === id);
        const parent = catalogData.find(c => c.id === parentId);
        if (entry) openSyllabus(entry, null, parent || entry);
        else navExplorer.click();
    } else {
        navExplorer.click();
    }
}

async function loadUserData() {
    const ref = window.doc(window.db, "users", currentUser.uid);
    const snap = await window.getDoc(ref);
    if (snap.exists()) {
        ud = snap.data();
        ud.enrolled         = ud.enrolled         || [];
        ud.scores           = ud.scores           || {};
        ud.analytics        = ud.analytics        || {};
        ud.survivalScores   = ud.survivalScores   || {};
        ud.projectProgress  = ud.projectProgress  || {};
        ud.mastery          = ud.mastery          || {};
        ud.practiceSettings = ud.practiceSettings || {};
        ud.onboarded = ud.onboarded || false;
    } else {
        ud = { enrolled: [], scores: {}, analytics: {}, survivalScores: {}, projectProgress: {}, mastery: {}, practiceSettings: {}, onboarded: false };
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

function closeAllDropdowns() {
    activeDropdown?.classList.remove("open");
    userDropdown?.classList.remove("open");
}

navActiveBtn?.addEventListener("click", e => {
    e.stopPropagation();
    const isOpen = activeDropdown.classList.contains("open");
    closeAllDropdowns();
    if (!isOpen) {
        populateActiveDropdown();
        activeDropdown.classList.add("open");
    }
});

userAvatarBtn?.addEventListener("click", e => {
    e.stopPropagation();
    const isOpen = userDropdown.classList.contains("open");
    closeAllDropdowns();
    if (!isOpen) userDropdown.classList.add("open");
});

document.addEventListener("click", closeAllDropdowns);
activeDropdown?.addEventListener("click", e => e.stopPropagation());
userDropdown?.addEventListener("click", e => e.stopPropagation());

async function populateActiveDropdown() {
    if (!activeDropItems) return;
    activeDropItems.innerHTML = "";

    if (!ud.enrolled.length) {
        activeDropItems.innerHTML = `<div class="tb-dd-empty">No active curriculums.<br>Explore to enroll.</div>`;
        return;
    }

    for (const entryId of ud.enrolled) {
        const entry = catalogData.find(c => c.id === entryId);
        if (!entry) continue;

        const pct = await getCourseProgress(entry.id);

        const item = document.createElement("div");
        item.className = "tb-dd-item";
        item.style.flexDirection = "column";
        item.style.alignItems = "flex-start";
        item.style.gap = "6px";
        item.innerHTML = `
            <div class="tb-dd-inner">
                <div class="tb-dd-title">${entry.title}</div>
                <div class="tb-dd-pct">${pct}% complete</div>
                <div class="dd-progress-bar">
                    <div class="dd-progress-fill progress-animator" data-target="${pct}%" style="width:0%"></div>
                </div>
            </div>
        `;

        item.addEventListener("click", () => {
            closeAllDropdowns();
            openCurriculumHome(entry);
        });

        activeDropItems.appendChild(item);
    }

    setTimeout(() => {
        activeDropItems.querySelectorAll(".progress-animator")
            .forEach(b => b.style.width = b.dataset.target);
    }, 30);
}

function updateActiveCountBadge() {
    if (!activeCountBadge) return;
    const n = ud.enrolled.length;
    activeCountBadge.textContent = n ? `(${n})` : "";
}

navExplorer?.addEventListener("click", async e => {
    history.pushState({}, "", window.location.pathname);
    e.preventDefault();
    closeAllDropdowns();
    await loadCatalog();
    await renderExplorer();
    switchView("view-explorer");
    setActiveNavBtn(navExplorer);
    if (!ud.onboarded) startOnboarding();
});

navHub?.addEventListener("click", async e => {
    e.stopPropagation();
    closeAllDropdowns();
    await loadCatalog();
    switchView("view-hub");
    setActiveNavBtn(null);
    openHub("practice");
});

navSettings?.addEventListener("click", e => {
    e.stopPropagation();
    closeAllDropdowns();
    switchView("view-settings");
    setActiveNavBtn(null);
});

navSignout?.addEventListener("click", e => {
    e.stopPropagation();
    closeAllDropdowns();
    showConfirmDialog("Sign out of Novara?", () => {
        window.firebaseAuth.signOut();
    });
});

function setActiveNavBtn(el) {
    document.querySelectorAll(".tb-btn").forEach(b => b.classList.remove("tb-active"));
    el?.classList.add("tb-active");
}

reqWipeBtn?.addEventListener("click", () => {
    reqWipeBtn.style.display = "none";
    wipeAuthBlock.style.display = "block";
});

wipeConfirmInput?.addEventListener("input", e => {
    const ok = e.target.value === "PURGE";
    execWipeBtn.disabled = !ok;
    execWipeBtn.style.backgroundColor = ok ? "#ff4444" : "transparent";
    execWipeBtn.style.color = ok ? "var(--void)" : "#ff4444";
});

execWipeBtn?.addEventListener("click", async () => {
    const blank = { enrolled: [], scores: {}, analytics: {}, survivalScores: {}, projectProgress: {}, mastery: {}, practiceSettings: {} };
    await window.setDoc(window.doc(window.db, "users", currentUser.uid), blank);
    ud = blank;
    wipeConfirmInput.value = "";
    execWipeBtn.disabled = true;
    execWipeBtn.style.cssText = "background-color:transparent;color:#ff4444;";
    wipeAuthBlock.style.display = "none";
    reqWipeBtn.style.display = "inline-block";
    updateActiveCountBadge();
    await renderExplorer();
    navExplorer.click();
});

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
}

function isBundle(entry) { return entry.type === "bundle"; }

async function fetchCourseData(meta) {
    try {
        const res = await fetch(meta.file);
        if (!res.ok) throw new Error();
        return res.json();
    } catch {
        show404();
    }
}

function show404() {
    switchView("view-explorer");
    viewExplorer.innerHTML = `
        <div style="text-align:center;padding:80px 0;">
            <img src="assets/abstract/abstract2.svg" width="25%" height="25%" alt="">
            <p style="font-size:48px;font-weight:900;letter-spacing:-2px;margin-top:24px;">404</p>
            <p style="color:var(--text-dim);font-family:monospace;margin-top:8px;letter-spacing:2px;">Page Not Found.</p>
            <button onclick="navExplorer.click()" style="margin-top:32px;">Return Home</button>
        </div>
    `;
}

async function fetchBundleData(entry) {
    if (!isBundle(entry)) return { [entry.id]: await fetchCourseData(entry) };
    const results = {};
    for (const c of entry.courses) {
        results[c.id] = await fetchCourseData(c);
    }
    return results;
}

async function getCourseProgress(entryId) {
    const entry = catalogData.find(c => c.id === entryId);
    if (!entry) return 0;
    let earned = 0, total = 0;

    const collect = (data) => {
        data.sections.forEach(sec => sec.lessons.forEach(l => {
            if (l.type === "project") return;
            const id = l.id || (l.title || "").replace(/\s+/g, "-").toLowerCase();
            const max = isBinaryLesson(l) ? 1 : 4;
            total += max;
            if (ud.mastery[id]) {
                earned += max;
            } else {
                earned += Math.min(ud.scores[id] || 0, max);
            }
        }));
    };

    if (isBundle(entry)) {
        for (const c of entry.courses) {
            const data = await fetchCourseData(c);
            collect(data);
        }
    } else {
        const data = await fetchCourseData(entry);
        collect(data);
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
        const actionWrapper = document.createElement("div");

        const diffBadge = entry.difficulty
            ? `<span class="diff-badge ${entry.difficulty}">${entry.difficulty}</span>` : "";

        let progressHtml = "";
        if (enrolled) {
            const pct = await getCourseProgress(entry.id);
            progressHtml = `
                <div class="course-progress-wrapper">
                    <div class="course-progress-fill progress-animator" data-target="${pct}%" style="width:0%"></div>
                </div>
                <p style="font-size:12px;color:var(--accent);margin-top:6px;margin-bottom:15px;text-align:right;">${pct}% complete</p>
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
            cont.onclick = () => openCurriculumHome(entry);

            const drop = document.createElement("button");
            drop.innerText = "Drop";
            drop.className = "danger-btn";
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

        let authorText = "Unkown Author";
        if (entry.author && Array.isArray(entry.author)) {
            authorText = entry.author.join(", ");
        } else if (typeof entry.author === "string") {
            authorText = entry.author;
        }

        const authorEl = document.createElement("div");
        authorEl.innerText = `By ${authorText}`;

        authorEl.style.cssText = `
            font-family: 'Courier New', Courier, monospace;
            font-size: 11px;
            color: var(--text-dim, #888888);
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-top: 12px;
            text-align: center;
        `;

        card.appendChild(btnGroup);
        btnGroup.appendChild(authorEl);
        catalogGrid.appendChild(card);
    }

    updateActiveCountBadge();

    setTimeout(() => {
        document.querySelectorAll(".progress-animator")
            .forEach(b => b.style.width = b.dataset.target);
    }, 50);
}

async function enrollInCourse(entry) {
    if (ud.enrolled.length >= 3) {
        showError("You can only be enrolled in 3 curriculums at once. Please unenroll from an active curriculum to enroll in a new one.");
        return;
    }
    ud.enrolled.push(entry.id);
    await saveField("enrolled", ud.enrolled);

    if (navigator.serviceWorker?.controller) {
        const files = isBundle(entry) ? entry.courses.map(c => c.file) : [entry.file];
        files.forEach(f => {
            navigator.serviceWorker.controller.postMessage({ type: "CACHE_COURSE", url: f });
        });
    }

    updateActiveCountBadge();
    await renderExplorer();
}

function showError(message) {
    const existing = $("errorOverlay");
    if (existing) existing.remove();
    const errorOverlay = document.createElement("div");
    const errorBox = document.createElement("div");
    errorBox.innerText = message;
    const errorBtn = document.createElement("button");
    errorBtn.innerText = "OK";
    errorBtn.className = "danger-btn";
    errorBox.id = "errorBox";

    errorOverlay.id = "errorOverlay";

    errorBtn.addEventListener("click", () => {
        errorOverlay.remove();
    });
    errorOverlay.appendChild(errorBox);
    errorBox.appendChild(errorBtn);

    document.body.appendChild(errorOverlay);
    return;
}

function showConfirmDialog(message, onConfirm) {
    const existing = $("errorOverlay");
    if (existing) existing.remove();

    const errorOverlay = document.createElement("div");
    const errorBox = document.createElement("div");
    errorBox.innerText = message;

    const btnContainer = document.createElement("div");
    btnContainer.style.display = "flex";
    btnContainer.style.gap = "10px";
    btnContainer.style.marginTop = "15px";
    btnContainer.style.justifyContent = "center";

    const errorBtn = document.createElement("button");
    errorBtn.innerText = "OK";
    errorBtn.className = "danger-btn";

    const cancelBtn = document.createElement("button");
    cancelBtn.innerText = "Cancel";
    cancelBtn.className = "blue-btn";

    errorBox.id = "errorBox";
    errorOverlay.id = "errorOverlay";

    errorBtn.addEventListener("click", () => {
        errorOverlay.remove();
        if (onConfirm) onConfirm();
    });

    cancelBtn.addEventListener("click", () => {
        errorOverlay.remove();
    });
    btnContainer.appendChild(errorBtn);
    btnContainer.appendChild(cancelBtn);

    errorBox.appendChild(btnContainer);
    errorOverlay.appendChild(errorBox);
    document.body.appendChild(errorOverlay);
}

async function unenrollFromCourse(entry) {
    showConfirmDialog(`Disenroll from ${entry.title}? Scores are preserved.`, async () => {
        ud.enrolled = ud.enrolled.filter(id => id !== entry.id);
        await saveField("enrolled", ud.enrolled);
        updateActiveCountBadge();
        await renderExplorer();
    });
}

function findProjectLesson(data) {
    for (const sec of data.sections) {
        for (const l of sec.lessons) {
            if (l.type === "project") return l;
        }
    }
    return null;
}

async function openCurriculumHome(entry) {
    history.pushState({}, "", `?view=curriculum-home&id=${entry.id}`);
    activeCurriculumEntry = entry;
    switchView("view-syllabus");
    setActiveNavBtn(null);
    viewSyllabus.innerHTML = `<div style="text-align:center;padding:60px;color:var(--text-dim);font-family:monospace;">loading...</div>`;

    const pct = await getCourseProgress(entry.id);

    viewSyllabus.innerHTML = "";

    const meta = document.createElement("div");
    meta.className = "syllabus-meta";
    meta.innerHTML = `
        <h1>${entry.title}${isBundle(entry) ? ` <span style="font-size:12px;opacity:0.5;letter-spacing:1px;">Bundle</span>` : ""}</h1>
        <div class="course-progress-wrapper" style="margin-top:16px;">
            <div class="course-progress-fill progress-animator" data-target="${pct}%" style="width:0%"></div>
        </div>
        <div style="font-size:12px;color:var(--accent);font-weight:700;text-align:right;margin-top:4px;">${pct}% complete</div>
    `;
    viewSyllabus.appendChild(meta);

    if (isBundle(entry)) {
        const grid = document.createElement("div");
        grid.className = "syllabus-sections-grid";

        for (const courseRef of entry.courses) {
            const data = await fetchCourseData(courseRef);
            let e2 = 0, t2 = 0;
            data.sections.forEach(sec => sec.lessons.forEach(l => {
                if (l.type === "project") return;
                const id = l.id || l.title.replace(/\s+/g, "-").toLowerCase();
                const max = isBinaryLesson(l) ? 1 : 4;
                t2 += max;
                e2 += Math.min(ud.scores[id] || 0, max);
            }));
            const cPct = t2 === 0 ? 0 : Math.round((e2 / t2) * 100);

            const courseCard = document.createElement("div");
            courseCard.className = "course-home-card";
            courseCard.innerHTML = `
                <div class="course-home-title">${courseRef.title}</div>
                <div class="course-home-pct">${cPct}%</div>
                <div class="course-progress-wrapper" style="margin-top:8px;">
                    <div class="course-progress-fill progress-animator" data-target="${cPct}%" style="width:0%"></div>
                </div>
                <div class="course-home-meta">${data.sections.length} sections</div>
            `;
            courseCard.addEventListener("click", () => openSyllabus(courseRef, data, entry));
            grid.appendChild(courseCard);
        }

        viewSyllabus.appendChild(grid);
    } else {
        const data = await fetchCourseData(entry);
        const grid = document.createElement("div");
        grid.className = "syllabus-sections-grid";

        const sectionCount = data.sections.length;
        const lessonCount = data.sections.reduce((sum, s) => sum + s.lessons.filter(l => l.type !== "project").length, 0);

        const onlyCard = document.createElement("div");
        onlyCard.className = "course-home-card";
        onlyCard.innerHTML = `
            <div class="course-home-title">${entry.title}</div>
            <div class="course-home-pct">${pct}%</div>
            <div class="course-progress-wrapper" style="margin-top:8px;">
                <div class="course-progress-fill progress-animator" data-target="${pct}%" style="width:0%"></div>
            </div>
            <div class="course-home-meta">${sectionCount} sections &bull; ${lessonCount} lessons</div>
        `;
        onlyCard.addEventListener("click", () => openSyllabus(entry, data, entry));
        grid.appendChild(onlyCard);

        const projectLesson = findProjectLesson(data);
        if (projectLesson) {
            const projCard = document.createElement("div");
            projCard.className = "course-home-card";
            projCard.style.borderColor = "var(--accent)";
            projCard.innerHTML = `
                <div class="course-home-title">Projects</div>
                <div class="course-home-meta" style="margin-top:8px;">Hands-on project workspace</div>
            `;
            projCard.addEventListener("click", () => openProject(projectLesson, entry));
            grid.appendChild(projCard);
        }

        const masterCard = document.createElement("div");
        masterCard.className = "course-home-card";
        masterCard.style.cssText = "border-color:var(--border);box-shadow:5px 5px 0px var(--accent);";
        masterCard.innerHTML = `
            <div class="course-home-title">Curriculum Test</div>
            <div class="course-home-meta" style="margin-top:8px;">Full course exam</div>
        `;
        masterCard.addEventListener("click", async () => {
            activeCD = data;
            activeCD.id = entry.id;
            compileMasterTest();
        });
        grid.appendChild(masterCard);

        viewSyllabus.appendChild(grid);
    }

    setTimeout(() => {
        viewSyllabus.querySelectorAll(".progress-animator")
            .forEach(b => b.style.width = b.dataset.target);
    }, 50);
}

async function openSyllabus(courseRef, dataArg, parentEntry) {
    history.pushState({}, "", `?view=syllabus&id=${courseRef.id}&parentId=${parentEntry?.id || ""}`);
    activeCourseRef = courseRef;
    switchView("view-syllabus");
    setActiveNavBtn(null);
    viewSyllabus.innerHTML = `<div style="text-align:center;padding:60px;color:var(--text-dim);font-family:monospace;">loading...</div>`;

    const data = dataArg || await fetchCourseData(courseRef);
    activeCD = data;
    activeCD.id = courseRef.id;
    activeBundleCourseId = courseRef.id;

    const pct = await getCourseProgress(parentEntry?.id || courseRef.id);
    const projectLesson = findProjectLesson(data);

    viewSyllabus.innerHTML = "";

    const returnBtn = document.createElement("button");
    returnBtn.id = "syllabus-return-btn";
    returnBtn.innerText = "Return to Curriculum Home";
    returnBtn.addEventListener("click", () => openCurriculumHome(parentEntry || courseRef));
    viewSyllabus.appendChild(returnBtn);

    const meta = document.createElement("div");
    meta.className = "syllabus-meta";
    meta.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
            <h1>${courseRef.title || courseRef.name}</h1>
            <div style="display:flex;gap:10px;">
                ${projectLesson ? `<button id="projects-btn" style="font-size:12px;padding:8px 16px;">Projects</button>` : ""}
                <button id="master-test-btn" style="font-size:12px;padding:8px 16px;background:var(--accent);color:#fff;border-color:var(--accent);">Curriculum Test</button>
            </div>
        </div>
        <div class="course-progress-wrapper" style="margin-top:16px;">
            <div class="course-progress-fill progress-animator" data-target="${pct}%" style="width:0%"></div>
        </div>
        <div style="font-size:12px;color:var(--accent);font-weight:700;text-align:right;margin-top:4px;">${pct}% complete</div>
    `;
    viewSyllabus.appendChild(meta);

    meta.querySelector("#master-test-btn")?.addEventListener("click", compileMasterTest);
    if (projectLesson) {
        meta.querySelector("#projects-btn")?.addEventListener("click", () => openProject(projectLesson, parentEntry || courseRef));
    }

    const grid = document.createElement("div");
    grid.className = "syllabus-sections-grid";

    data.sections.forEach(section => {
        grid.appendChild(buildSectionCard(section, data, courseRef.id));
    });

    viewSyllabus.appendChild(grid);

    setTimeout(() => {
        viewSyllabus.querySelectorAll(".progress-animator")
            .forEach(b => b.style.width = b.dataset.target);
    }, 50);
}

function buildSectionCard(section, data, courseId) {
    const lessons = section.lessons.filter(l => l.type !== "project");
    const totalLessons = lessons.length;

    let completed = 0;
    lessons.forEach(l => {
        const id = l.id || (l.title || "").replace(/\s+/g, "-").toLowerCase();
        if ((ud.scores[id] || 0) > 0) completed++;
    });

    const card = document.createElement("div");
    card.className = "sec-card open";

    const header = document.createElement("div");
    header.className = "sec-card-header";
    header.innerHTML = `
        <span class="sec-card-title">${section.title}</span>
        <span class="sec-card-meta">${completed}/${totalLessons}</span>
        <span class="sec-card-arrow">&#9660;</span>
    `;

    const body = document.createElement("div");
    body.className = "sec-card-body";

    lessons.forEach(lesson => {
        const id = lesson.id || (lesson.title || "").replace(/\s+/g, "-").toLowerCase();
        lesson.id = id;
        lesson.questions?.forEach((q, i) => q.globalId = `${id}-q${i}`);

        const score    = ud.scores?.[id] || 0;
        const mastered = ud.mastery?.[id];

        let dotsHtml = "";
        if (isBinaryLesson(lesson)) {
            dotsHtml = mastered
                ? `<div class="rating-star" title="Mastered"></div>`
                : `<div class="rating-dot ${score >= 1 ? "filled" : ""}"></div>`;
        } else {
            dotsHtml = mastered
                ? `<div class="rating-star"></div><div class="rating-star"></div><div class="rating-star"></div><div class="rating-star"></div>`
                : [1,2,3,4].map(n => `<div class="rating-dot ${score >= n ? "filled" : ""}"></div>`).join("");
        }

        const typeLabel = (lesson.type && lesson.type !== "document") ? lesson.type.replace(/_/g, " ") : "";

        const row = document.createElement("div");
        row.className = "lesson-row";
        row.innerHTML = `
            <div class="lesson-title">${lesson.title}</div>
            ${typeLabel ? `<span class="lesson-type-tag">${typeLabel}</span>` : ""}
            <div class="rating-display">${dotsHtml}</div>
        `;

        row.onclick = () => {
            if (!activeCD || activeCD.id !== courseId) {
                activeCD = data;
                activeCD.id = courseId;
                activeBundleCourseId = courseId;
            }
            startLesson(lesson);
        };

        body.appendChild(row);
    });

    header.addEventListener("click", () => {
        const isOpen = card.classList.toggle("open");
        header.querySelector(".sec-card-arrow").innerHTML = isOpen ? "&#9660;" : "&#9658;";
    });

    card.appendChild(header);
    card.appendChild(body);
    return card;
}

function openProject(projectLesson, entry) {
    switchView("view-lesson");
    document.body.classList.add("lesson-active");

    resetTopBarLayout();
    const backBtn = document.createElement("button");
    backBtn.id = "lesson-back-btn";
    backBtn.innerText = "Return";
    backBtn.style.cssText = "position:fixed;top:70px;left:24px;z-index:999;background:var(--surface);color:var(--text-main);border:2px solid var(--border);padding:10px 16px;font-size:12px;letter-spacing:2px;box-shadow:4px 4px 0px var(--border);cursor:pointer;";
    document.body.appendChild(backBtn);
    backBtn.onclick = () => {
        backBtn.remove();
        document.body.classList.remove("lesson-active");
        openSyllabus(entry, null, activeCurriculumEntry || entry);
    };

    renderProject(projectLesson, entry.id, ud, saveField, () => {
        backBtn.remove();
        document.body.classList.remove("lesson-active");
        openSyllabus(entry, null, activeCurriculumEntry || entry);
    });
}

function runMixedPractice(lessonData, analytics, onUpdate) {
    const allQ = lessonData.questions;
    const spotBugs = allQ.filter(q => q._lessonType === "spot_bug" && q._lessonRef);
    const mcqQ     = allQ.filter(q => q._lessonType !== "spot_bug");

    let sbIdx = 0;

    function runNextSpotBug() {
        if (sbIdx >= spotBugs.length) {
            runMcq();
            return;
        }
        const stub = spotBugs[sbIdx];
        sbIdx++;
        const lessonCopy = Object.assign({}, stub._lessonRef);
        renderSpotBug(lessonCopy, () => runNextSpotBug());
    }

    function runMcq() {
        if (!mcqQ.length) {
            finishLesson();
            return;
        }
        const mcqLesson = Object.assign({}, lessonData, { questions: mcqQ });
        renderQuestion(mcqLesson, analytics, onUpdate, () => finishLesson());
    }

    if (spotBugs.length) {
        runNextSpotBug();
    } else {
        runMcq();
    }
}

function startLesson(lesson) {
    activeLessonData = JSON.parse(JSON.stringify(lesson));

    if (activeLessonData.questions?.length && activeLessonData.type !== "practice_standard")
        activeLessonData.questions = shuffleArray(activeLessonData.questions);

    initQuestionState();
    switchView("view-lesson");

    if ($("nav-active-btn")) $("nav-active-btn").style.display = "none";
    if ($("nav-tools-btn")) $("nav-tools-btn").style.display = "none";

    if ($("user-avatar-btn")) {
        $("user-avatar-btn").style.pointerEvents = "none";
        $("user-avatar-btn").style.cursor = "default";
        $("user-avatar-btn").style.opacity = "0.5";
    }

    const topNavBtn = $("nav-explorer");
    let originalText = "Explore";

    if (topNavBtn) {
        originalText = topNavBtn.innerText;
        topNavBtn.innerText = "← Return";
        topNavBtn.style.fontWeight = "bold";
        topNavBtn.style.color = "var(--text-dim, #0a0a0a)";

        window.activeTopbarGate = (e) => {
            e.preventDefault();
            e.stopPropagation();
            showConfirmDialog("Return? Progress on this lesson will not be saved.", () => {
                resetTopBarLayout();

                if (activeCourseRef) {
                    openSyllabus(activeCourseRef, null, activeCurriculumEntry || activeCourseRef);
                } else {
                    switchView("view-explorer");
                }
            });
        };

        topNavBtn.addEventListener("click", window.activeTopbarGate, true);
    }

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
    else if (t === "cooking_sim") renderCookingSim(activeLessonData, () => finishLesson());
    else if (t === "practice_standard" || t === "practice_survival") {
        runMixedPractice(activeLessonData, analytics, onUpdate);
    }
    else renderQuestion(activeLessonData, analytics, onUpdate, () => finishLesson());
}

function resetTopBarLayout() {
    const topNavBtn = $("nav-explorer")
    if (topNavBtn) {
        topNavBtn.innerText = "Explore";
        topNavBtn.style.fontWeight = "";
        topNavBtn.style.color = "";
        topNavBtn.onclick = null;
        if (window.activeTopbarGate) {
            topNavBtn.removeEventListener("click", window.activeTopbarGate, true);
            window.activeTopbarGate = null;
        }

    }

    if ($("nav-active-btn")) $("nav-active-btn").style.display = "";
    if ($("nav-tools-btn")) $("nav-tools-btn").style.display = "";

    if ($("user-avatar-btn")) {
        $("user-avatar-btn").style.pointerEvents = "auto";
        $("user-avatar-btn").style.cursor = "pointer";
        $("user-avatar-btn").style.opacity = "1";
    }
}

function pickBonusQuestion(lessonType) {
    if (PRACTICE_TYPES.includes(lessonType)) return null;
    if (!activeLessonData?.questions?.length) return null;
    if (!activeCD) return null;

    const analytics = ud.analytics[activeCD.id] || {};

    const candidates = activeLessonData.questions.filter(q =>
        q.globalId && Array.isArray(q.options) && q.options.length > 0
    );

    if (!candidates.length) return null;

    candidates.sort((a, b) => {
        const aS = analytics[a.globalId] || { correct: 0, incorrect: 0 };
        const bS = analytics[b.globalId] || { correct: 0, incorrect: 0 };
        const aRatio = aS.correct / Math.max(1, aS.correct + aS.incorrect);
        const bRatio = bS.correct / Math.max(1, bS.correct + bS.incorrect);
        return aRatio - bRatio;
    });

    return candidates[0] || null;
}

async function finishFillBlank(correctCount, total) {
    resetTopBarLayout();
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
        if (activeCourseRef) {
            openSyllabus(activeCourseRef, null, activeCurriculumEntry || activeCourseRef);
        } else {
            navExplorer.click();
        }
    };
}

async function finishSpotBug(correct) {
    resetTopBarLayout();
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
        if (activeCourseRef) {
            openSyllabus(activeCourseRef, null, activeCurriculumEntry || activeCourseRef);
        } else {
            navExplorer.click();
        }
    };
}

async function finishLesson() {
    resetTopBarLayout();

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
                    ud.scores[lid] = 4;
                    masteryChanged = true;
                }
            }
            if (masteryChanged) {
                await saveField("mastery", ud.mastery);
                await saveField("scores", ud.scores);
            }
            if (masteryChanged) ratingText = "complete. mastery earned!";
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

    if (!PRACTICE_TYPES.includes(t)) {
        const cur = ud.scores[activeLessonData.id] || 0;
        if (finalScore > cur) {
            ud.scores[activeLessonData.id] = finalScore;
            await saveField("scores", ud.scores);
        }
    }

    const bonusQ = pickBonusQuestion(t);

    viewLesson.innerHTML = `
        <div class="lesson-workspace" style="text-align:center;">
            <h2>Complete</h2>
            <p style="line-height:1.5;">${accuracyText}</p>
            <p style="color:var(--accent);font-size:24px;margin-top:20px;">${ratingText}</p>
            ${bonusQ ? `
            <div id="bonus-block" style="margin-top:40px;text-align:left;border-top:3px solid var(--border);padding-top:28px;">
                <p style="font-size:11px;font-weight:900;letter-spacing:2px;text-transform:uppercase;color:var(--text-dim);margin-bottom:16px;">one more</p>
                <p style="font-size:16px;font-weight:700;margin-bottom:20px;">${parseCode(bonusQ.q)}</p>
                <div id="bonus-options">
                    ${bonusQ.options.map((opt, i) => `
                        <label class="mcq-option" id="bonus-opt-${i}" style="margin:8px 0;font-size:14px;">
                            <input type="radio" name="bonus-answer" value="${i}"> ${parseCode(opt)}
                        </label>
                    `).join("")}
                </div>
                <div id="bonus-feedback" style="display:none;margin-top:16px;padding:14px 18px;border-left:6px solid var(--accent);background:var(--surface);font-size:14px;"></div>
                <button id="bonus-submit-btn" style="margin-top:16px;" disabled>submit</button>
            </div>` : ""}
            <button id="return-btn" style="margin-top:${bonusQ ? "24px" : "40px"};">Return</button>
        </div>
    `;

    if (bonusQ) {
        document.querySelectorAll('input[name="bonus-answer"]').forEach(r => {
            r.addEventListener("change", () => {
                document.getElementById("bonus-submit-btn").disabled = false;
            });
        });
        document.getElementById("bonus-submit-btn").addEventListener("click", () => {
            const sel = document.querySelector('input[name="bonus-answer"]:checked');
            if (!sel) return;
            const correct = parseInt(sel.value) === bonusQ.answer;
            document.querySelectorAll('input[name="bonus-answer"]').forEach(r => r.disabled = true);
            document.querySelectorAll(".mcq-option").forEach(l => l.classList.add("locked"));
            const selLabel = document.getElementById(`bonus-opt-${sel.value}`);
            const corrLabel = document.getElementById(`bonus-opt-${bonusQ.answer}`);
            if (correct) {
                selLabel?.classList.add("reveal-correct");
            } else {
                selLabel?.classList.add("reveal-incorrect");
                corrLabel?.classList.add("reveal-correct");
            }
            const fb = document.getElementById("bonus-feedback");
            fb.style.display = "block";
            fb.innerHTML = `<strong>${correct ? "correct." : "not quite."}</strong>${bonusQ.explanation ? " " + parseCode(bonusQ.explanation) : ""}`;
            document.getElementById("bonus-submit-btn").style.display = "none";
        });
    }

    $("return-btn").onclick = () => {
        if (t === "practice_standard" || t === "practice_survival") {
            navHub.click();
        } else if (activeCourseRef) {
            openSyllabus(activeCourseRef, null, activeCurriculumEntry || activeCourseRef);
        } else {
            navExplorer.click();
        }
    };
}

function getDefaultPracticeSettings() {
    return { mcq: true, fill_blank: true, spot_bug: true };
}

async function openHub(tab) {
    history.pushState({}, "", `?view=hub&tab=${tab}`);
    document.querySelectorAll(".hub-tab").forEach(tb =>
        tb.classList.toggle("active", tb.dataset.hubtab === tab)
    );
    $("hub-practice-panel").style.display = tab === "practice" ? "block" : "none";
    $("hub-docs-panel").style.display     = tab === "docs"     ? "block" : "none";

    if (tab === "practice") await buildPracticePanel();
    if (tab === "docs")     await buildDocsPanel();
}

document.querySelectorAll(".hub-tab").forEach(btn =>
    btn.addEventListener("click", () => openHub(btn.dataset.hubtab))
);

async function buildPracticePanel() {
    const content = $("practice-content");
    content.innerHTML = "";

    if (!ud.enrolled.length) {
        content.innerHTML = `
            <div style="text-align:center;padding:60px 0;">
                <img src="assets/abstract/abstract2.svg" alt="abstract empty"/ width="25%" height="25%">
                <p style="color:var(--text-dim);font-family:monospace;margin-top:20px;font-size:13px;letter-spacing:2px;">No Curriculums Active.</p>
            </div>
        `;
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

        const std = document.createElement("button");
        std.innerText = "standard";
        std.onclick = () => compileStandardPractice(entry);

        const sur = document.createElement("button");
        sur.innerText = "survival";
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

        const titleEl = document.createElement("div");
        titleEl.className = "docs-course-title";
        titleEl.textContent = entry.title;
        group.appendChild(titleEl);

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
                        startLesson(Object.assign({}, lesson, { questions: [] }));
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
            out.push({ q: l.title, options: [], answer: 0, globalId: id, parentLessonId: id, _lessonType: "spot_bug", _lessonRef: l });
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
    if (!all.length) {
        showError("No Questions Available!");
        return;
    }
    startLesson({
        id: "master-test",
        courseId: activeCD.id,
        title: "Curriculum Master Test",
        type: "master_test",
        questions: shuffleArray(all).slice(0, 15)
    });
}

async function compileStandardPractice(entry) {
    const dataMap = await fetchBundleData(entry);
    const firstKey = Object.keys(dataMap)[0];
    activeCD = dataMap[firstKey];
    activeCD.id = firstKey;

    const allEnrolled = [];
    for (const entryId of ud.enrolled) {
        const e = catalogData.find(c => c.id === entryId);
        if (!e) continue;
        const s = ud.practiceSettings[entryId] || getDefaultPracticeSettings();
        const qs = await getAllQuestionsForEntry(e, s);
        allEnrolled.push(...qs);
    }

    if (!allEnrolled.length) {
        showError("Complete more Lessons First!");
        return;
    }

    const mergedAnalytics = {};
    for (const entryId of ud.enrolled) {
        Object.assign(mergedAnalytics, ud.analytics[entryId] || {});
    }

    allEnrolled.sort((a, b) => {
        const aS = mergedAnalytics[a.globalId] || { correct: 0, incorrect: 0 };
        const bS = mergedAnalytics[b.globalId] || { correct: 0, incorrect: 0 };
        const aRatio = aS.correct / Math.max(1, aS.correct + aS.incorrect);
        const bRatio = bS.correct / Math.max(1, bS.correct + bS.incorrect);
        return aRatio - bRatio;
    });

    const weakCount = allEnrolled.filter(q => {
        const s = mergedAnalytics[q.globalId] || { correct: 0, incorrect: 0 };
        const ratio = s.correct / Math.max(1, s.correct + s.incorrect);
        return ratio < 0.6;
    }).length;

    const sessionLen = weakCount >= 8 ? 20 : weakCount >= 4 ? 15 : 10;
    activeCourseRef = null;

    startLesson({
        id: "practice-standard",
        title: "Standard Practice",
        type: "practice_standard",
        questions: shuffleArray(allEnrolled.slice(0, sessionLen))
    });
}

async function compileSurvivalPractice(entry) {
    const settings = ud.practiceSettings[entry.id] || getDefaultPracticeSettings();
    const dataMap = await fetchBundleData(entry);
    const firstKey = Object.keys(dataMap)[0];
    activeCD = dataMap[firstKey];
    activeCD.id = firstKey;

    const all = await getAllQuestionsForEntry(entry, settings);
    if (!all.length) {
        showError("No Questions Available!");
        return;
    }
    activeCourseRef = null;
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
    const btnCourses  = $("btn-landing-courses");
    const btnSignin   = $("btn-landing-signin");
    const btnBack     = $("btn-back-landing");
    const viewLanding = $("view-landing");
    const viewPublic  = $("view-public-courses");
    const viewAuth    = $("view-auth");
    const heroCta     = document.querySelector(".hero-cta");
    const pubGrid     = $("public-catalog-grid");

    let pubCategory   = "all";
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

            const lessonsNote = isBundle(entry) ? `${entry.courses.length} courses` : "Full curriculum";
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