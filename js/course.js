import { parseCode, shuffleArray } from "./utils/parse.js";
import { renderProject } from "./renderers/project.js";
import { createDialogueBox } from "./utils/dialogueBox.js";

let currentUser = null;
let ud = { enrolled: [], scores: {}, analytics: {}, survivalScores: {}, projectProgress: {}, mastery: {}, practiceSettings: {} };
let catalogData = [];
let activeCD = null;
let activeBlockAnswers = {};
let activeLessonData = null;
let activeBundleCourseId = null;
let activeCurriculumEntry = null;
let activeCourseRef = null;
let activeSection;
let activeLessonStage;

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

const isBinaryLesson = l => BINARY_TYPES.includes(l.type) || l.type === "document";

const navToolsBtn = document.getElementById("nav-tools-btn");
const toolsDropdown = document.getElementById("tools-dropdown");

navToolsBtn.addEventListener("click", e => {
    e.stopPropagation();
    const isOpen = toolsDropdown.classList.contains("open");
    closeAllDropdowns();
    if (!isOpen) toolsDropdown.classList.add("open");
});

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

const privacyBackdrop = $("privacy-confirm-backdrop");
const privacyCheckbox = $("privacy-confirm-checkbox");
const privacyContinueBtn = $("privacy-confirm-continue");
const privacyCancelBtn = $("privacy-confirm-cancel");
let pendingAuthAction = null;

function openPrivacyConfirm(action) {
    pendingAuthAction = action;
    privacyCheckbox.checked = false;
    privacyContinueBtn.disabled = true;
    privacyBackdrop.classList.add("open");
}

function closePrivacyConfirm() {
    privacyBackdrop.classList.remove("open");
    pendingAuthAction = null;
}

privacyCheckbox.addEventListener("change", () => {
    privacyContinueBtn.disabled = !privacyCheckbox.checked;
});

privacyCancelBtn.addEventListener("click", closePrivacyConfirm);

privacyBackdrop.addEventListener("click", e => {
    if (e.target === privacyBackdrop) closePrivacyConfirm();
});

privacyContinueBtn.addEventListener("click", () => {
    const action = pendingAuthAction;
    closePrivacyConfirm();
    if (action) action();
});

authGoogleBtn.addEventListener("click", () => {
    openPrivacyConfirm(async () => {
        try {
            await window.signInWithPopup(window.firebaseAuth, new window.GoogleAuthProvider());
        } catch (e) {
            setAuthStatus("Google sign-in failed: " + e.message, "#ff4444");
        }
    });
});

authMagicBtn.addEventListener("click", () => {
    const email = authEmailInput.value.trim();
    if (!email) { setAuthStatus("Email required.", "#ff4444"); return; }
    openPrivacyConfirm(async () => {
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
});

function setAuthStatus(msg, color) {
    authStatus.innerText = msg;
    authStatus.style.color = color;
}
function startOnboarding() {
    if (document.getElementById("onboardingOverlay")) {
        document.getElementById("onboardingOverlay").remove();
    }
    const onboardingOverlay = document.createElement("div");
    onboardingOverlay.id = "onboardingOverlay";
    onboardingOverlay.className = "onboarding-backdrop";
    document.body.appendChild(onboardingOverlay);

    const steps = [
        { selector: ".course-card", text: "Welcome to Novara. I'm Bob. Each card here is a full curriculum with lessons, challenges, and simulations." },
        { selector: ".b-enroll-btn", text: "When you're ready, click 'Enroll' on a card to put it into your active selection.", interaction: true },
        { selector: "#user-avatar-btn", text: "If you want extra practice, open your profile menu to hit the Hub for survival drills and docs.", openMenu: true, blockClick: true },
        { selector: "#nav-active-btn", text: "Your active curriculums stay right up here in this menu so you can drop back in anytime.", openActive: true, blockClick: true }
    ];

    let cur = 0;
    let lastTarget = null;
    let lastHighlightEl = null;

    function renderStep() {
        if (lastHighlightEl) lastHighlightEl.classList.remove("onboarding-highlight");
        if (lastTarget) lastTarget.style.pointerEvents = "";

        if (cur >= steps.length) {
            closeAllDropdowns();
            const activeOverlay = document.getElementById("onboardingOverlay");
            if (activeOverlay) activeOverlay.remove();
            ud.onboarded = true;
            saveField("onboarded", true);
            return;
        }

        const step = steps[cur];
        if (step.openMenu && userDropdown) {
            closeAllDropdowns();
            userDropdown.classList.add("open");
        } else if (step.openActive && activeDropdown) {
            closeAllDropdowns();
            populateActiveDropdown();
            activeDropdown.classList.add("open");
        }

        const target = document.querySelector(step.selector);
        lastTarget = target;
        if (!target) { cur++; renderStep(); return; }

        const rect = target.getBoundingClientRect();
        onboardingOverlay.innerHTML = "";

        const highlightEl = step.openMenu || step.openActive ? target.closest(".tb-dropdown-wrap") || target : target;
        highlightEl.classList.add("onboarding-highlight");
        lastHighlightEl = highlightEl;

        target.style.pointerEvents = step.blockClick ? "none" : "auto";

        const dialogueBox = createDialogueBox({
            name: "Mayor Bob",
            imageSrc: "assets/img/minibit/advisor_mayor.png",
            texts: [step.text],
            onComplete: () => {
                closeAllDropdowns();
                cur++;
                renderStep();
            }
        });

        dialogueBox.className = "dialogue-box-fixed";
        dialogueBox.style.top = Math.min(rect.bottom + 40, window.innerHeight - 200) + "px";
        dialogueBox.style.left = Math.max(20, Math.min(rect.left, window.innerWidth - 440)) + "px";
        onboardingOverlay.appendChild(dialogueBox);

        if (step.interaction) {
            target.addEventListener("click", () => {
                closeAllDropdowns();
                cur++;
                renderStep();
            }, { once: true });
        }
    }
    renderStep();
}

async function routeFromURL() {
    const params = new URLSearchParams(window.location.search);
    const view = params.get("view");
    const id = params.get("id");
    const tab = params.get("tab");
    const parentId = params.get("parentId");

    if (!currentUser) {
        document.getElementById("view-landing").style.display = "none";
        document.getElementById("view-public-courses").style.display = "none";
        document.getElementById("view-auth").style.display = "none";

        if (view === "courses") {
            document.getElementById("view-public-courses").style.display = "block";
            if (typeof loadCatalog !== "undefined" && catalogData.length === 0) {
                await loadCatalog();
            }
        } else if (view === "signin") {
            document.getElementById("view-auth").style.display = "block";
        } else {
            document.getElementById("view-landing").style.display = "flex";
        }
        return;
    }

    if (view === "hub") {
        navHub.click();
        if (tab) openHub(tab);
    } else if (view === "curriculum-home") {
        const entry = catalogData.find(c => c.id === id);
        if (entry) openCurriculumHome(entry);
        else navExplorer.click();
    } else if (view === "syllabus") {
        const parent = catalogData.find(c => c.id === parentId);
        if (parent) openSyllabus(id, null, parent);
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
        ud.pacedMode = ud.pacedMode || { active: false };
        ud.pacedProgress = ud.pacedProgress || {};
    } else {
        ud = { enrolled: [], scores: {}, analytics: {}, survivalScores: {}, projectProgress: {}, mastery: {}, practiceSettings: {}, onboarded: false, pacedMode: { active: false }, pacedProgress: {} };
        await window.setDoc(ref, ud);
        await window.setDoc(window.doc(window.db, "stats", "global"), { userCount: window.increment(1) }, { merge: true });
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
    toolsDropdown.classList.remove("open");
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
        item.className = "tb-dd-item tb-dd-course-item";
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

async function loadStats() {
    const catalogRes = await fetch("data/catalog.json");
    const catalog = await catalogRes.json();
    const curriculumCount = catalog.length;
    const statsSnap = await window.getDoc(window.doc(window.db, "stats", "global"));
    const userCount = statsSnap.exists() ? statsSnap.data().userCount : 0;
    document.getElementById("stat-curriculums").dataset.target = curriculumCount;
    document.getElementById("stat-users").dataset.target = userCount;
    animateStatsNum(document.getElementById("stat-curriculums"));
    animateStatsNum(document.getElementById("stat-users"));
}
function animateStatsNum(el) {
    const target = parseInt(el.dataset.target, 10);
    const duration = 800;
    const startTime = performance.now();
    function step(now) {
        const progress = Math.min((now - startTime) / duration, 1);
        el.textContent = Math.round(progress * target);
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}
function landingAudienceTabs() {
    document.querySelectorAll(".landing-audience-tab").forEach(tab => {
        tab.onclick = () => {
            document.querySelectorAll(".landing-audience-tab").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".landing-audience-panel").forEach(b => b.classList.remove("active"));
            tab.classList.add("active");
            document.querySelector(`[data-audience-panel="${tab.dataset.audience}"]`).classList.add("active");
        };
    });
}
window.loadStats = loadStats;
window.landingAudienceTabs = landingAudienceTabs;
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
    if ($("settings-paced-mode")) $("settings-paced-mode").checked = ud.pacedMode.active;
    switchView("view-settings");
    setActiveNavBtn(null);
});

$('settings-paced-mode')?.addEventListener("change", async e => {
    ud.pacedMode = ud.pacedMode || {};
    ud.pacedMode.active = e.target.checked;
    await saveField("pacedMode", ud.pacedMode);
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
    execWipeBtn.classList.toggle("wipe-btn-ready", ok);
});

execWipeBtn?.addEventListener("click", async () => {
    const blank = { enrolled: [], scores: {}, analytics: {}, survivalScores: {}, projectProgress: {}, mastery: {}, practiceSettings: {}, onboarded: true, pacedMode: { active: false }, pacedProgress: {} };
    await window.setDoc(window.doc(window.db, "users", currentUser.uid), blank);
    ud = blank;
    wipeConfirmInput.value = "";
    execWipeBtn.disabled = true;
    execWipeBtn.classList.remove("wipe-btn-ready");
    wipeAuthBlock.style.display = "none";
    reqWipeBtn.style.display = "inline-block";
    updateActiveCountBadge();
    await renderExplorer();
    navExplorer.click();
});

function switchView(id, title) {
    document.title = title ? title + " - Novara" : "Novara";
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

async function loadIndex(meta) {
    try {
        const res = await fetch(meta.indexFile);
        if (!res.ok) throw new Error();
        return await res.json();
    } catch {
        show404();
        return;
    }
}

function show404() {
    switchView("view-explorer");
    viewExplorer.innerHTML = `
        <div class="not-found-container">
            <img src="assets/abstract/abstract2.svg" class="not-found-image" alt="">
            <p class="not-found-code">404</p>
            <p class="not-found-text">Page Not Found.</p>
            <button onclick="navExplorer.click()" class="not-found-btn">Return Home</button>
        </div>
    `;
}

async function getCourseProgress(entryId) {
    const entry = catalogData.find(c => c.id === entryId);
    if (!entry) return 0;
    let earned = 0, total = 0;

    const collect = (data) => {
        if (!data || !data.courses) return;

        data.courses.forEach(courses => {
            courses.sections.forEach(sec => sec.lessons.forEach(l => {
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
        });
    };

    const data = await loadIndex(entry);
    collect(data);
    return total === 0 ? 0 : Math.round((earned / total) * 100);
}

let activeCategory = "all";
let activeDifficulty = "all";

function showCourseDescription(courseRef) {
    const old = document.getElementById("descOverlay");
    if (old) old.remove();
    const overlay = document.createElement("div");
    overlay.id = "descOverlay";
    overlay.className = "details-backdrop";

    overlay.innerHTML = `
        <div class="details-modal">
            <h2 class="details-title">${courseRef.title || courseRef.name} Description</h2>
            <div class="details-desc-box">
                <span class="details-desc-text">${courseRef.description || "No description provided."}</span>
            </div>
            <button id="closeDescBtn" class="details-close-btn">Close</button>
        </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById("closeDescBtn").onclick = () => overlay.remove();
    overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
}

function showCourseDetails(entry) {
    const old = document.getElementById("detailsOverlay");
    if (old) old.remove();

    let sources = "None";
    if (entry.sources) {
        if (Array.isArray(entry.sources)) {
            sources = "<ul class='details-meta-list'>";
            entry.sources.forEach(source => {
                sources += `<li>${source}</li>`;
            });
            sources += "</ul>";
        } else {
            sources = `<div class="details-sources-text">${entry.sources}</div>`;
        }
    }

    const overlay = document.createElement("div");
    overlay.id = "detailsOverlay";
    overlay.className = "details-backdrop";

    overlay.innerHTML = `
        <div class="details-modal">
            <h2 class="details-title">${entry.title} Details</h2>
            <p class="details-meta-text"><b>Author:</b> ${Array.isArray(entry.author) ? entry.author.join(", ") : entry.author || "Unknown"}</p>
            <p class="details-meta-text"><b>Published:</b> ${entry.published || "Unknown"}</p>
            <p class="details-meta-text"><b>Last Updated:</b> ${entry.updated || "Unknown"}</p>

            <div class="details-desc-box">
                <b class="details-desc-label">Description</b>
                <span class="details-desc-text">${entry.description || "No description provided."}</span>
            </div>

            <div>
                <b>Sources:</b>
                ${sources}
            </div>
            <button id="closeDetailsBtn" class="details-close-btn">Close</button>
        </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById("closeDetailsBtn").onclick = () => {
        overlay.remove();
    };

    overlay.onclick = e => {
        if (e.target === overlay) {
            overlay.remove();
        }
    };
}

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

        const pct = await getCourseProgress(entry.id);
        const barColor = enrolled ? "var(--accent)" : "var(--accent-orange)";

        const data = await loadIndex(entry);
        const progressHtml = `
            <div class="course-progress-wrapper card-prog-wrapper">
                <div class="course-progress-fill progress-animator" data-target="${pct}%" style="width:0%;background:${barColor};"></div>
            </div>
            <p class="card-prog-text" style="color:${barColor};">${pct}% complete</p>
        `;

        card.innerHTML = `
            <div class="card-top-content">
                <h3 class="card-title-clamp">${entry.title}</h3>
                ${data.courses.length > 1 ? `<p class="card-bundle-tag">Bundle &bull; ${data.courses.length} courses</p>` : ""}
            </div>
            ${progressHtml}
        `;

        const actionWrapper = document.createElement("div");
        actionWrapper.className = "card-action-wrap";

        const btnGroup = document.createElement("div");
        btnGroup.className = "card-btn-group";

        if (enrolled) {
            const cont = document.createElement("button");
            cont.innerText = "Continue";
            cont.className = "card-btn-cont";
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
            enroll.onclick = () => enrollInCourse(entry);
            btnGroup.appendChild(enroll);
        }

        const footerRow = document.createElement("div");

        const detailsBtn = document.createElement("button");
        detailsBtn.innerText = "Details";
        detailsBtn.className = "card-details-btn";
        detailsBtn.onclick = () => showCourseDetails(entry);
        footerRow.appendChild(detailsBtn);

        if(entry.difficulty){
            const badge = document.createElement("span");
            badge.className = `diff-badge ${entry.difficulty} card-footer-badge`;
            badge.innerText = entry.difficulty;
            footerRow.appendChild(badge);
        }

        actionWrapper.appendChild(btnGroup);
        actionWrapper.appendChild(footerRow);
        card.appendChild(actionWrapper);
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
    const data = await loadIndex(entry);
    const lessonPaths = getLessonPaths(data);

    if (navigator.serviceWorker?.controller) {
        const files = [entry.indexFile, ...lessonPaths];
        files.forEach(f => {
            navigator.serviceWorker.controller.postMessage({ type: "CACHE_COURSE", url: f });
        });
    }

    updateActiveCountBadge();
    await renderExplorer();
}

function getLessonPaths(data) {
    const paths = [];
    data.courses.forEach(course => {
        course.sections.forEach(sec => sec.lessons.forEach(l => {
            paths.push(l.path);
        }));
    });
    return paths;
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
    btnContainer.className = "dialog-btn-container";

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
    for (const course of data.courses) {
        for (const sec of course.sections) {
            for (const l of sec.lessons) {
                if (l.type === "project") return l;
            }
        }
    }
    return null;
}

async function openCurriculumHome(entry) {
    history.pushState({}, "", `?view=curriculum-home&id=${entry.id}`);
    activeCurriculumEntry = entry;
    switchView("view-syllabus", entry.title);
    setActiveNavBtn(null);
    viewSyllabus.innerHTML = `<div class="view-loading-state">loading...</div>`;

    const pct = await getCourseProgress(entry.id);
    const data = await loadIndex(entry);

    viewSyllabus.innerHTML = "";

    const meta = document.createElement("div");
    meta.className = "syllabus-meta";
    meta.innerHTML = `
        <h1>${entry.title}${data.courses.length > 1 ? ` <span class="curriculum-bundle-tag">Bundle</span>` : ""}</h1>
        <div class="course-progress-wrapper curriculum-prog-wrap">
            <div class="course-progress-fill progress-animator" data-target="${pct}%" style="width:0%"></div>
        </div>
        <div class="curriculum-prog-text">${pct}% complete</div>
    `;
    viewSyllabus.appendChild(meta);


    if (data.courses.length > 1) {
        const grid = document.createElement("div");
        grid.className = "syllabus-sections-grid";

        for (const course of data.courses) {
            let e2 = 0, t2 = 0;
            course.sections.forEach(sec => sec.lessons.forEach(l => {
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
                <div class="course-home-title">${course.title}</div>
                <div class="course-home-pct">${cPct}%</div>
                <div class="course-progress-wrapper" style="margin-top:8px;">
                    <div class="course-progress-fill progress-animator" data-target="${cPct}%" style="width:0%"></div>
                </div>
                <div class="course-home-meta">${course.sections.length} sections</div>
            `;
            courseCard.addEventListener("click", () => openSyllabus(course.id, data, entry));
            grid.appendChild(courseCard);
        }

        viewSyllabus.appendChild(grid);
    } else {
        const grid = document.createElement("div");
        grid.className = "syllabus-sections-grid";

        const sectionCount = data.courses[0].sections.length;
        const lessonCount = data.courses[0].sections.reduce((sum, s) => sum + s.lessons.filter(l => l.type !== "project").length, 0);

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
        onlyCard.addEventListener("click", () => openSyllabus(data.courses[0].id, data, entry));
        grid.appendChild(onlyCard);

        const projectLesson = findProjectLesson(data);
        if (projectLesson) {
            const projCard = document.createElement("div");
            projCard.className = "course-home-card card-project";
            projCard.innerHTML = `
                <div class="course-home-title">Projects</div>
                <div class="course-home-meta course-home-meta-spaced">Hands-on project workspace</div>
            `;
            projCard.addEventListener("click", () => openProject(projectLesson, entry));
            grid.appendChild(projCard);
        }

        const masterCard = document.createElement("div");
        masterCard.className = "course-home-card card-master";
        masterCard.innerHTML = `
            <div class="course-home-title">Curriculum Test</div>
            <div class="course-home-meta course-home-meta-spaced">Full course exam</div>
        `;
        masterCard.addEventListener("click", async () => {
            activeCD = data.courses[0];
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

async function openSyllabus(courseId, dataArg, parentEntry) {
    history.pushState({}, "", `?view=syllabus&id=${courseId}&parentId=${parentEntry?.id || ""}`);
    setActiveNavBtn(null);
    viewSyllabus.innerHTML = `<div class="view-loading-state">loading...</div>`;

    const data = dataArg || await loadIndex(parentEntry);
    activeCD = data.courses.find(c => c.id === courseId);
    activeCourseRef = activeCD;
    activeCD.id = courseId;
    activeBundleCourseId = courseId;

    switchView("view-syllabus", activeCD.title);

    const pct = await getCourseProgress(parentEntry?.id || courseId);
    const projectLesson = findProjectLesson(data);

    viewSyllabus.innerHTML = "";

    const masterDetailContainer = document.createElement("div");
    masterDetailContainer.className = "syllabus-master-detail";

    const sidebar = document.createElement("div");
    sidebar.className = "syllabus-sidebar";

    const returnBtn = document.createElement("button");
    returnBtn.id = "syllabus-return-btn";
    returnBtn.innerText = "← Return";
    returnBtn.addEventListener("click", () => openCurriculumHome(parentEntry));
    sidebar.appendChild(returnBtn);

    if (projectLesson) {
        const topActions = document.createElement("div");
        topActions.className = "curriculum-header-actions syllabus-top-actions";
        topActions.innerHTML = `<button id="projects-btn" class="curriculum-action-btn">Projects</button>`;
        topActions.querySelector("#projects-btn").addEventListener("click", () => openProject(projectLesson, parentEntry));
        sidebar.appendChild(topActions);
    }

    const sidebarInfo = document.createElement("div");
    sidebarInfo.className = "syllabus-sidebar-info";
    sidebarInfo.innerHTML = `
        <div class="syllabus-sidebar-course-title">${activeCD.title}</div>
        <div class="course-progress-wrapper">
            <div class="course-progress-fill progress-animator" data-target="${pct}%" style="width:0%"></div>
        </div>
        <div class="curriculum-prog-text">${pct}% complete</div>
        <span class="syllabus-desc-link">Course Description</span>
    `;
    sidebarInfo.querySelector(".syllabus-desc-link").addEventListener("click", () => showCourseDescription(activeCD));
    sidebar.appendChild(sidebarInfo);

    const contentStage = document.createElement("div");
    contentStage.className = "syllabus-content-stage";

    let firstSectionBtn = null;

    activeCD.sections.forEach((section, index) => {
        const lessons = section.lessons.filter(l => l.type !== "project");
        const totalLessons = lessons.length;
        let completed = 0;
        lessons.forEach(l => {
            const id = l.id || (l.title || "").replace(/\s+/g, "-").toLowerCase();
            if ((ud.scores[id] || 0) > 0) completed++;
        });

        const secBtn = document.createElement("div");
        secBtn.className = "syllabus-section-btn";
        secBtn.innerHTML = `
            <div class="syllabus-section-title">${section.title}</div>
            <div class="syllabus-section-meta"><span>${completed}/${totalLessons} lessons</span><span>&#9658;</span></div>
        `;

        secBtn.onclick = () => {
            sidebar.querySelectorAll(".syllabus-section-btn").forEach(b => b.classList.remove("active"));
            secBtn.classList.add("active");
            renderSectionLessons(section, activeCD, courseId, contentStage);
        };

        if (index === 0) firstSectionBtn = secBtn;
        sidebar.appendChild(secBtn);
    });

    const testBtn = document.createElement("div");
    testBtn.className = "syllabus-section-btn syllabus-test-btn";
    testBtn.innerHTML = `
        <div class="syllabus-section-title">Course Test</div>
        <div class="syllabus-section-meta"><span>Full Exam</span><span>&#9658;</span></div>
    `;
    testBtn.onclick = compileMasterTest;
    sidebar.appendChild(testBtn);

    masterDetailContainer.appendChild(sidebar);
    masterDetailContainer.appendChild(contentStage);
    viewSyllabus.appendChild(masterDetailContainer);

    if (activeCD.sections.length > 0) {
        firstSectionBtn?.click();
    }

    setTimeout(() => {
        viewSyllabus.querySelectorAll(".progress-animator")
            .forEach(b => b.style.width = b.dataset.target);
    }, 50);
}

function renderSectionLessons(section, data, courseId, contentStage) {
    contentStage.innerHTML = "";
    const paced = getCoursePacedState(data, courseId);
    const lessons = section.lessons.filter(l => l.type !== "project");
    const totalLessons = lessons.length;
    let completed = 0;
    lessons.forEach(l => {
        const id = l.id || (l.title || "").replace(/\s+/g, "-").toLowerCase();
        if ((ud.scores[id] || 0) > 0) completed++;
    });

    const header = document.createElement("div");
    header.className = "syllabus-stage-header";
    header.innerHTML = `<h2>${section.title}</h2><p class="syllabus-stage-meta">${completed}/${totalLessons} lessons completed</p>`;
    contentStage.appendChild(header);

    const listWrap = document.createElement("div");
    listWrap.className = "syllabus-lesson-list";

    lessons.forEach(lesson => {
        const id = lesson.id || (lesson.title || "").replace(/\s+/g, "-").toLowerCase();
        lesson.id = id;
        lesson.questions?.forEach((q, i) => q.globalId = `${id}-q${i}`);

        const score = ud.scores?.[id] || 0;
        const mastered = ud.mastery?.[id];
        const maxScore = isBinaryLesson(lesson) ? 1 : 4;
        const pct = (score / maxScore) * 100;
        let isLocked = false;
        if (paced.active) {
            const done = score > 0 || mastered;
            if (!done && (id !== paced.nextId || paced.lockedToday)) isLocked = true;
        }
        let dotsHtml = "";
        if (mastered) {
            dotsHtml = `<div style="width:16px;height:16px;background:var(--accent-orange);border:2px solid var(--text-main);display:flex;align-items:center;justify-content:center;border-radius:5px;"><svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:var(--surface,#ffffff);"><path d="M2 16 L4 5 L9 10 L12 3 L15 10 L20 5 L22 16 Z"/></svg></div>`;
        } else {
            dotsHtml = `<div style="width:16px;height:16px;background:transparent;border:2px solid var(--text-main);position:relative;overflow:hidden;border-radius:5px;"><div style="position:absolute;left:0;bottom:0;right:0;height:${pct}%;background:var(--accent);transition:height 0.3s ease;"></div></div>`;
        }

        const typeLabel = (lesson.type && lesson.type !== "document") ? lesson.type.replace(/_/g, " ") : "";
        const row = document.createElement("div");
        row.className = "lesson-row";
        if (isLocked) row.style.opacity = "0.4";

        const padlockHtml = isLocked ? `<img src="assets/icon/padlock.svg" class="padlock-icon" alt="Locked">` : "";
        row.innerHTML = `<div class="lesson-title" style="display:flex;align-items:center;">${lesson.title}</div>${typeLabel ? `<span class="lesson-type-tag">${typeLabel}</span>` : ""}<div class="rating-container"><div class="rating-display">${dotsHtml}</div>${padlockHtml}</div>`;

        row.onclick = async () => {
            if (isLocked) return;
            if (!activeCD || activeCD.id !== courseId) {
                activeCD = data;
                activeCD.id = courseId;
                activeBundleCourseId = courseId;
            }
            if (paced.active && paced.absenceDays > 0 && id === paced.nextId) {
                const reviewQuiz = await generateAbsenceReview(courseId, data, paced.absenceDays);
                if (reviewQuiz) {
                    const overlay = document.createElement("div");
                    overlay.className = "dialogue-backdrop";
                    document.body.appendChild(overlay);
                    const dialogue = createDialogueBox({
                        name: "Mayor Bob",
                        imageSrc: "assets/img/minibit/advisor_mayor.png",
                        texts: [
                            `Well, look who's back. Log says you've been out for ${paced.absenceDays} days.`,
                            "Stuff gets rusty if you don't use it, so let's run a quick refresher.",
                            "Clear this recall check and today's lesson is all yours."
                        ],
                        onComplete: () => {
                            overlay.remove();
                            startLesson(reviewQuiz);
                        }
                    });
                    overlay.appendChild(dialogue);
                    return;
                }
            }

            let completedCount = 0;
            let targetIsCheckpoint = false;
            data.sections.forEach(s => s.lessons.forEach(l => {
                if (l.type === "project") return;
                const lid = l.id || (l.title || "").replace(/\s+/g, "-").toLowerCase();
                const done = (ud.scores[lid] > 0) || ud.mastery[lid];
                if (done) completedCount++;
                if (lid === id && completedCount > 0 && completedCount % 7 === 0) {
                    targetIsCheckpoint = true;
                }
            }));

            if (paced.active && targetIsCheckpoint && !(ud.scores[id] > 0 || ud.mastery[id])) {
                const exam = await generateModuleExam(courseId, data);
                if (exam) {
                    const overlay = document.createElement("div");
                    overlay.className = "dialogue-backdrop";
                    document.body.appendChild(overlay);
                    const dialogue = createDialogueBox({
                        name: "Mayor Bob",
                        imageSrc: "assets/img/minibit/advisor_mayor.png",
                        texts: [
                            "Alright, milestone check. Time for your weekly Module Exam.",
                            "Score 80% or higher to show you've got this down, and we'll head on to the next lessons."
                        ],
                        onComplete: () => {
                            overlay.remove();
                            startLesson(exam);
                        }
                    });
                    overlay.appendChild(dialogue);
                    return;
                }
            }

            startLesson(lesson, section);
        };

        listWrap.appendChild(row);
    });
    contentStage.appendChild(listWrap);
}

function getCoursePacedState(data, courseId) {
    if (!ud.pacedMode || ud.pacedMode.active !== true) {
        return { active: false };
    }
    let nextId = null;
    let found = false;
    data.sections.forEach(s => s.lessons.forEach(l => {
        if (l.type === "project") return;
        const id = l.id || (l.title || "").replace(/\s+/g, "-").toLowerCase();
        if (!found && !(ud.scores[id] > 0) && !ud.mastery[id]) {
            nextId = id;
            found = true;
        }
    }));

    const today = new Date().toLocaleDateString("en-CA");
    const prog = ud.pacedProgress[courseId] || {};


    let absenceDays = 0;
    if (prog.lastCompletedDate && prog.lastCompletedDate !== today && !prog.absenceClearedToday) {
        const last = new Date(prog.lastCompletedDate);
        const curr = new Date(today);
        absenceDays = Math.floor((curr - last) / (1000 * 60 * 60 * 24));
    }

    return {
        active: true,
        nextId: nextId,
        lockedToday: prog.lastCompletedDate === today,
        absenceDays: absenceDays
    };
}

async function generateAbsenceReview(courseId, data, absenceDays) {
    const allQ = await collectQuestions(data, { mcq: true, fill_blank: true, spot_bug: true });
    const pool = allQ.filter(q => ud.scores[q.sourceLessonId] > 0 || ud.mastery[q.sourceLessonId]);
    if (pool.length === 0) return null;

    const qCount = Math.min(9, (absenceDays - 1) * 3);
    const blocks = buildQuizBlocks(shuffleArray(pool).slice(0, qCount));
    return { id: "absence-review", name: "Absence Review", isAbsenceReview: true, blocks: blocks };
}

function openProject(projectLesson, entry) {
    switchView("view-lesson");
    document.body.classList.add("lesson-active");

    resetTopBarLayout();
    const backBtn = document.createElement("button");
    backBtn.id = "lesson-back-btn";
    backBtn.className = "lesson-back-fixed-btn";
    backBtn.innerText = "Return";
    document.body.appendChild(backBtn);
    backBtn.onclick = () => {
        backBtn.remove();
        document.body.classList.remove("lesson-active");
        openSyllabus(activeBundleCourseId, null, activeCurriculumEntry || entry);
    };

    renderProject(projectLesson, entry.id, ud, saveField, () => {
        backBtn.remove();
        document.body.classList.remove("lesson-active");
        openSyllabus(activeBundleCourseId, null, activeCurriculumEntry || entry);
    });
}

async function startLesson(lesson, section) {
    if (lesson.blocks) {
        activeLessonData = lesson;
    } else {
        const res = await fetch(lesson.path);
        activeLessonData = await res.json();
        activeLessonData.id = lesson.id;
    }
    console.log(lesson.path);
    //TODO: REMOVE LOG IF UNNEEDED
    activeSection = section;
    activeBlockAnswers = {};

    switchView("view-lesson", lesson.title);
    viewLesson.style.display = "flex";

    if ($("nav-active-btn")) $("nav-active-btn").style.display = "none";
    if ($("nav-tools-btn")) $("nav-tools-btn").style.display = "none";

    if ($("user-avatar-btn")) {
        $("user-avatar-btn").classList.add("avatar-disabled");
    }

    const topNavBtn = $("nav-explorer");
    let originalText = "Explore";

    if (topNavBtn) {
        originalText = topNavBtn.innerText;
        topNavBtn.innerText = "← Return";
        topNavBtn.classList.add("tb-btn-return");

        window.activeTopbarGate = (e) => {
            e.preventDefault();
            e.stopPropagation();
            showConfirmDialog("Return? Progress on this lesson will not be saved.", () => {
                resetTopBarLayout();

                if (activeCourseRef) {
                    openSyllabus(activeBundleCourseId, null, activeCurriculumEntry);
                } else {
                    switchView("view-explorer");
                }
            });
        };

        topNavBtn.addEventListener("click", window.activeTopbarGate, true);
        }

    viewLesson.innerHTML = "";
    activeLessonStage = document.createElement("div")
    activeLessonStage.className = "syllabus-content-stage";
    if (section) {
        const sidebarDiv = document.createElement("div");
        sidebarDiv.className = "syllabus-sidebar";
        viewLesson.appendChild(sidebarDiv);
        const header = document.createElement("div");
        header.className = "syllabus-sidebar-info";
        const headerTitle = document.createElement("div");
        headerTitle.className = "syllabus-sidebar-course-title";
        headerTitle.textContent = section.title;
        header.appendChild(headerTitle);
        sidebarDiv.appendChild(header);
        activeSection.lessons.forEach(l => {
            const row = document.createElement("div");
            row.className = "syllabus-section-btn";
            if (l.id === lesson.id) row.classList.add("active");
            const title = document.createElement("div");
            title.className = "syllabus-section-title";
            title.textContent = l.title
            row.appendChild(title);
            const meta = document.createElement("div");
            meta.textContent = "\u25BA";
            meta.className = "syllabus-section-meta";
            meta.style.justifyContent = 'right';
            row.appendChild(meta);
            if (l.id !== lesson.id) {
                row.onclick = () => {
                    showConfirmDialog("Leave this lesson? Progress will be lost.", () => {
                        startLesson(l, activeSection);
                    });
                };
            };
            sidebarDiv.appendChild(row);
        });
    }
    viewLesson.appendChild(activeLessonStage);
    renderBlocks(activeLessonData.blocks)
}

function renderBlocks(blocks) {
    blocks.forEach(block => {
       if (block.type == "heading") renderHeadingBlock(block);
       else if (block.type == "text") renderTextBlock(block);
       else if (block.type == "image") renderImageBlock(block);
       else if (block.type == "multipleChoice") renderMultipleChoiceBlock(block);
       else if (block.type == "imageLabel") renderImageLabelBlock(block);
       else if (block.type == "submit") renderSubmitBlock(block);
    });
}

function renderHeadingBlock(block) {
    const lessonContent = document.createElement("h" + block.level);
    lessonContent.textContent = block.text;
    activeLessonStage.appendChild(lessonContent);
}

function renderTextBlock(block) {
    const lessonContent = document.createElement("p");
    lessonContent.textContent = block.content;
    activeLessonStage.appendChild(lessonContent);
}

function renderImageBlock(block) {
    const lessonContent = document.createElement("div");
    lessonContent.className = "image-block-div";
    const img = document.createElement("img");
    lessonContent.appendChild(img);
    img.src = block.src;
    img.alt = block.alt;
    if (block.caption) {
        const caption = document.createElement("p");
        caption.textContent = block.caption;
        lessonContent.appendChild(caption);
    }
    activeLessonStage.appendChild(lessonContent);
}

function renderMultipleChoiceBlock(block) {
    const lessonContent = document.createElement("div");
    block.options.forEach(option => {
        const button = document.createElement("button");
        button.textContent = option.text;
        button.onclick = () => {
            if (block.allowMultiple) {
                button.classList.toggle("b-option-selected");
                if (!Array.isArray(activeBlockAnswers[block.id])) activeBlockAnswers[block.id] = [];
                if (activeBlockAnswers[block.id].includes(option.id)) {
                    activeBlockAnswers[block.id] = activeBlockAnswers[block.id].filter(id => id !== option.id);
                } else {
                    activeBlockAnswers[block.id].push(option.id);
                }
            } else {
                activeBlockAnswers[block.id] = option.id;
                lessonContent.querySelectorAll("button").forEach(b => b.classList.remove("b-option-selected"));
                button.classList.add("b-option-selected");
            }
        };
        lessonContent.appendChild(button);
    });
    activeLessonStage.appendChild(lessonContent);
}

function renderImageLabelBlock(block) {
    const lessonContent = document.createElement("div");
    const img = document.createElement("img");
    lessonContent.appendChild(img);
    lessonContent.className = "image-label-div";
    img.src = block.src;
    img.alt = block.alt;
    block.points.forEach(point => {
        const pWrapper = document.createElement("div");
        const marker = document.createElement("select");
        marker.className = "image-label-select";
        const blank = document.createElement("option");
        blank.textContent = "";
        marker.appendChild(blank);
        const dot = document.createElement("button");
        dot.className = "image-label-dot";
        dot.onclick = () => { pWrapper.classList.add("expanded"); };
        point.options.forEach(option => {
            const optionPt = document.createElement("option");
            optionPt.value = option.id
            optionPt.textContent = option.text;
            marker.appendChild(optionPt);
        });
        pWrapper.style.left = point.x + "%"
        pWrapper.style.top = point.y + "%"
        pWrapper.className = "image-label-pt"
        marker.onchange = () => {
            activeBlockAnswers[block.id] = activeBlockAnswers[block.id] || {};
            activeBlockAnswers[block.id][point.id] = marker.value;
        };
        pWrapper.appendChild(dot);
        pWrapper.appendChild(marker);
        lessonContent.appendChild(pWrapper);
    });
    const colBtn = document.createElement("button");
    colBtn.className = "image-label-collapse-btn";
    colBtn.textContent = "Reset Selections"
    colBtn.onclick = () => {
        lessonContent.querySelectorAll(".image-label-pt").forEach(pt => pt.classList.remove("expanded"));
        lessonContent.querySelectorAll(".image-label-select").forEach(sel => sel.value = "");
        if (activeBlockAnswers[block.id]) activeBlockAnswers[block.id] = {};
    }
    lessonContent.appendChild(colBtn);
    activeLessonStage.appendChild(lessonContent);
}

function renderSubmitBlock(block) {
    const lessonContent = document.createElement("button");
    lessonContent.textContent = "Submit"
    activeLessonStage.appendChild(lessonContent);
    lessonContent.onclick = async () => {
        const unanswered = block.targets.some(id => {
            const targetBlock = findBlockById(id);
            if (targetBlock.type === "multipleChoice" && !targetBlock.allowMultiple) {
                return activeBlockAnswers[id] === undefined;
            } else if (targetBlock.type === "multipleChoice" && targetBlock.allowMultiple) {
                return !activeBlockAnswers[id] || activeBlockAnswers[id].length === 0
            } else if (targetBlock.type === "imageLabel") {
                return targetBlock.points.some(point => activeBlockAnswers[id]?.[point.id] === undefined)
            }
        });
        if (unanswered) {
            const uaFeedback = document.createElement("p");
            uaFeedback.textContent = "Please answer all questions before submitting."
            uaFeedback.className = "block-feedback";
            activeLessonStage.appendChild(uaFeedback);
            return;
        }
        activeLessonStage.querySelectorAll(".block-feedback").forEach(el => el.remove());
        if (block.targets.length === 0) {
            ud.scores[activeLessonData.id] = 1
            await saveField("scores", ud.scores)
        } else {
            let allCorrect = true;
            let correctCount = 0;
            block.targets.forEach(targetId => {
                let isCorrect;
                let feedbackText;
                const targetBlock = findBlockById(targetId);
                if (targetBlock.type === "multipleChoice") {
                    if (!targetBlock.allowMultiple) {
                        const correct = targetBlock.options.find(o => o.correct);
                        isCorrect = correct.id === activeBlockAnswers[targetBlock.id];
                        const selectedOption = targetBlock.options.find(o => o.id === activeBlockAnswers[targetBlock.id])
                        if (selectedOption.feedback) feedbackText = selectedOption.feedback
                        else feedbackText = isCorrect ? targetBlock.correctFeedback : targetBlock.incorrectFeedback;
                        if (!isCorrect) allCorrect = false;
                        if (isCorrect) correctCount++;
                    } else {
                        const correctIds = targetBlock.options.filter(o => o.correct).map(o => o.id);
                        const selected = activeBlockAnswers[targetBlock.id] || [];
                        isCorrect = selected.length === correctIds.length && selected.every(id => correctIds.includes(id));
                        feedbackText = isCorrect ? targetBlock.correctFeedback : targetBlock.incorrectFeedback;
                        if (!isCorrect) allCorrect = false;
                        if (isCorrect) correctCount++;
                    }
                } else if (targetBlock.type === "imageLabel") {
                    isCorrect = targetBlock.points.every(point => {
                        const correct = point.options.find(o => o.correct);
                        return correct.id === activeBlockAnswers[targetBlock.id]?.[point.id];
                    });
                    feedbackText = isCorrect ? targetBlock.correctFeedback : targetBlock.incorrectFeedback;
                    if (!isCorrect) allCorrect = false;
                    if (isCorrect) correctCount++;
                }
                const feedback = document.createElement("p");
                feedback.className = "block-feedback";
                feedback.textContent = feedbackText;
                activeLessonStage.appendChild(feedback);
            })
            if (allCorrect) {
            ud.scores[activeLessonData.id] = 4;
            ud.mastery[activeLessonData.id] = true;
            await saveField("scores", ud.scores);
            await saveField("mastery", ud.mastery);
            } else {

            }
        }
    }
}

function findBlockById(id) {
    const block = activeLessonData.blocks.find(b => b.id === id);
    return block;
}

function resetTopBarLayout() {
    const topNavBtn = $("nav-explorer");
    if (topNavBtn) {
        topNavBtn.innerText = "Explore";
        topNavBtn.classList.remove("tb-btn-return");
        topNavBtn.onclick = null;
        if (window.activeTopbarGate) {
            topNavBtn.removeEventListener("click", window.activeTopbarGate, true);
            window.activeTopbarGate = null;
        }
    }

    if ($("nav-active-btn")) $("nav-active-btn").style.display = "";
    if ($("nav-tools-btn")) $("nav-tools-btn").style.display = "";

    if ($("user-avatar-btn")) {
        $("user-avatar-btn").classList.remove("avatar-disabled");
    }
}

async function generateModuleExam(courseId, data) {
    const allQ = await collectQuestions(data, getDefaultPracticeSettings());
    if (allQ.length === 0) return null;
    const blocks = buildQuizBlocks(shuffleArray(allQ).slice(0, 10));
    return { id: `module-exam-${courseId}`, name: "Weekly Module Exam", isModuleExam: true, blocks: blocks };
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
            <div class="hub-empty-state">
                <img src="assets/abstract/abstract2.svg" alt="abstract empty" width="25%" height="25%">
                <p class="hub-empty-text">No Curriculums Active.</p>
            </div>
        `;
        return;
    }

    const banner = document.createElement("div");
    banner.className = "hub-banner";

    if (ud.pacedMode?.active) {
        banner.innerHTML = `
            <div class="hub-banner-label">Lessons Renew In</div>
            <div id="paced-countdown" class="hub-banner-timer">Calculating...</div>
        `;
        content.appendChild(banner);

        function updateCountdown() {
            const now = new Date();
            const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
            const diff = tomorrow - now;

            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            const el = document.getElementById("paced-countdown");
            if (el) el.textContent = `${hours}h ${minutes}m ${seconds}s`;
        }
        updateCountdown();
        setInterval(updateCountdown, 1000);
    } else {
        banner.innerHTML = `
            <div class="hub-banner-title">For Paced Mode Users</div>
            <div class="hub-banner-desc">Enable Paced Mode in settings to unlock daily lesson locks and midnight renewal countdowns.</div>
        `;
        content.appendChild(banner);
    }

    const globalSettings = ud.practiceSettings["global"] || getDefaultPracticeSettings();

    let maxSurvival = 0;
    Object.values(ud.survivalScores || {}).forEach(score => {
        if (score > maxSurvival) maxSurvival = score;
    });

    const card = document.createElement("div");
    card.innerHTML = `
        <h3>Practice Hub</h3>
        <p class="practice-card-sub">All Enrolled Curriculums Combined</p>
        <p class="practice-card-record">Highest Survival Record: ${maxSurvival}</p>
        <div class="practice-settings">
            <div class="practice-settings-title">Include question types</div>
            <label><input type="checkbox" class="ps-check" data-type="mcq" ${globalSettings.mcq ? "checked" : ""}> Multiple Choice</label>
            <label><input type="checkbox" class="ps-check" data-type="fill_blank" ${globalSettings.fill_blank ? "checked" : ""}> Fill in the Blank</label>
            <label><input type="checkbox" class="ps-check" data-type="spot_bug" ${globalSettings.spot_bug ? "checked" : ""}> Spot the Bug</label>
        </div>
    `;

    card.querySelectorAll(".ps-check").forEach(cb => {
        cb.addEventListener("change", async () => {
            ud.practiceSettings["global"] = ud.practiceSettings["global"] || getDefaultPracticeSettings();
            ud.practiceSettings["global"][cb.dataset.type] = cb.checked;
            await saveField("practiceSettings", ud.practiceSettings);
        });
    });

    const grp = document.createElement("div");
    grp.className = "practice-btn-group";

    const std = document.createElement("button");
    std.innerText = "standard";
    std.onclick = () => compileStandardPractice();

    const sur = document.createElement("button");
    sur.innerText = "survival";
    sur.className = "practice-btn-surv";
    sur.onclick = () => compileSurvivalPractice();

    grp.append(std, sur);
    card.appendChild(grp);
    content.appendChild(card);
}

async function buildDocsPanel() {
    const content = $("docs-content");
    content.innerHTML = "";

    if (!ud.enrolled.length) {
        content.innerHTML = "<p class='hub-empty-text' style='margin-top:0;'>no curriculums active.</p>";
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

        const dataMap = await loadIndex(entry);

        dataMap.courses.forEach(course => {
            course.sections.forEach(section => {
                section.lessons.forEach(lesson => {
                    if (lesson.type !== "document") return;
                    const id = lesson.id || lesson.title.replace(/\s+/g, "-").toLowerCase();
                    lesson.id = id;

                    const row = document.createElement("div");
                    row.className = "docs-lesson-row";
                    row.innerHTML = `
                        <span class="docs-lesson-title">${lesson.title}</span>
                        <span class="docs-lesson-meta">${section.title}</span>
                    `;
                    row.onclick = () => {
                        activeCD = course;
                        activeCD.id = course.id;
                        startLesson(Object.assign({}, lesson, { questions: [] }), section);
                    };
                    group.appendChild(row);
                });
            });
        });

        content.appendChild(group);
    }
}

async function collectQuestions(data, settings) {
    const out = [];
    const completedLessons = [];

    data.sections.forEach(sec => sec.lessons.forEach(l => {
        if (l.type === "project") return;
        const id = l.id || l.title.replace(/\s+/g, "-").toLowerCase();
        const isCompleted = (ud.scores[id] > 0) || ud.mastery[id];
        if (isCompleted) completedLessons.push(l);
    }));
    const fetchedContents = await Promise.all(
        completedLessons.map(l => fetch(l.path).then(res => res.json()))
    );
    completedLessons.forEach((l, i) => {
        const content = fetchedContents[i];
        content.blocks.forEach(block => {
            if(block.type !== "multipleChoice") return;
            out.push({
                block: block,
                sourceLessonId: l.id,
                sourceLessonTitle: l.title
            });
        });
    });
    return out;
}

async function getAllQuestionsForEntry(entry, settings) {
    const data = await loadIndex(entry);
    const all = [];
    for (const course of data.courses) {
        const questions = await collectQuestions(course, settings);
        questions.forEach(q => {
            q._courseId = course.id;
            all.push(q);
        });
    };
    return all;
}

function buildQuizBlocks(entries) {
    const blocks = [];
    entries.forEach(entry => {
        const blockId = `${entry.sourceLessonId}-mcq`;
        blocks.push({type: "heading", level: 3, text: entry.sourceLessonTitle });
        const mcqBlock = { ...entry.block, id: blockId };
        blocks.push(mcqBlock);
        blocks.push({ id: `${blockId}-submit`, type: "submit", targets: [blockId] });
    });
    return blocks;
}

async function compileMasterTest() {
    if (!activeCD) return;
    const all = await collectQuestions(activeCD, getDefaultPracticeSettings());
    if (!all.length) {
        showError("No Questions Available!");
        return;
    }
    const selected = shuffleArray(all).slice(0, 15);
    const blocks = buildQuizBlocks(selected);
    startLesson({
        id: "master-test",
        name: "Curriculum Master Test",
        blocks: blocks
    });
}

async function compileStandardPractice() {
    const globalSettings = ud.practiceSettings["global"] || getDefaultPracticeSettings();
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

    const mergedAnalytics = ud.analytics["global"] || {};

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

    const sessionLen = Math.min(allEnrolled.length, Math.max(3, weakCount >= 8 ? 20 : weakCount >= 4 ? 15 : 10));

    activeCD = { id: "global" };
    activeCourseRef = null;

    const blocks = buildQuizBlocks(allEnrolled.slice(0, sessionLen));
    startLesson({ id: "practice-standard", name: "Standard Practice", blocks: blocks });
}

async function compileSurvivalPractice() {
    const globalSettings = ud.practiceSettings["global"] || getDefaultPracticeSettings();
    const allEnrolled = [];

    for (const entryId of ud.enrolled) {
        const e = catalogData.find(c => c.id === entryId);
        if (!e) continue;
        const qs = await getAllQuestionsForEntry(e, globalSettings);
        allEnrolled.push(...qs);
    }

    if (!allEnrolled.length) {
        showError("No Questions Available!");
        return;
    }

    activeCD = { id: "global" };
    activeCourseRef = null;

    const blocks = buildQuizBlocks(allEnrolled);
    startLesson({ id: "practice-survival", name: "Survival", blocks: blocks });
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
    const pubGrid     = $("public-catalog-grid");

    let pubCategory   = "all";
    let pubDifficulty = "all";

    async function openPublic(e) {
        e?.preventDefault();
        history.pushState({}, "", "?view=courses");
        viewLanding.style.display = "none";
        viewAuth.style.display = "none";
        viewPublic.style.display  = "block";
        await loadCatalog();
        renderPublicGrid();
    }

    if (btnCourses) btnCourses.addEventListener("click", openPublic);

    if (btnBack) {
        btnBack.addEventListener("click", (e) => {
            e.preventDefault();
            history.pushState({}, "", window.location.pathname);
            viewPublic.style.display  = "none";
            viewAuth.style.display = "none";
            viewLanding.style.display = "flex";
        });
    }

    if (btnSignin) {
        btnSignin.addEventListener("click", e => {
            e.preventDefault();
            history.pushState({}, "", "?view=signin");
            viewLanding.style.display = "none";
            viewPublic.style.display = "none";
            viewAuth.style.display    = "block";
        });
    }

    function renderPublicGrid() {
        pubGrid.innerHTML = "";
        catalogData.forEach(entry => {
            if (pubCategory !== "all" && entry.category !== pubCategory) return;
            if (pubDifficulty !== "all" && entry.difficulty !== pubDifficulty) return;

            const card = document.createElement("div");
            card.className = "public-course-card";

            const lessonsNote = "Full curriculum";
            const diffBadge = entry.difficulty
                ? `<span class="diff-badge ${entry.difficulty}">${entry.difficulty}</span>` : "";

            card.innerHTML = `
                <h3><a href="/curriculum/${entry.id}/" class="public-card-title-link">${entry.title}</a> ${diffBadge}</h3>
                <span class="public-card-meta">${lessonsNote} &bull; ${entry.category}</span>
                <p>${entry.description}</p>
                <div class="public-card-footer">
                    <button class="public-signin-trigger public-signin-btn">Sign in to enroll</button>
                </div>
            `;

            card.querySelector(".public-signin-trigger").addEventListener("click", () => {
                viewPublic.style.display = "none";
                viewAuth.style.display   = "block";
            });

            pubGrid.appendChild(card);
        });

        const courseSchema = catalogData.map(entry => ({
            "@context": "https://schema.org",
            "@type": "Course",
            "name": entry.title,
            "description": entry.description,
            "provider": {
                "@type": "Organization",
                "name": "Novara",
                "sameAs": "https://novaraedu.org"
            }
        }))
        document.getElementById("course-schema")?.remove();
        const schemaScript = document.createElement("script");
        schemaScript.id = "course-schema";
        schemaScript.type = "application/ld+json";
        schemaScript.textContent = JSON.stringify(courseSchema);
        document.head.appendChild(schemaScript);
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