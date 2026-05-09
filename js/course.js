let currentUser = null;
let userData = { completed: [] };
let curriculum = null;
let currentCourse = null;
let currentIndex = 0;
let catalogData = [];
let activeCurriculumData = null;
let activeLessonData = null;
let currentQuestionIndex = 0;
let correctAnswersCount = 0;

const correctSound = new Audio("assets/sfx/correct.mp3");

const contentDiv = document.getElementById("module-content");
const headerDiv = document.getElementById("course-header");
const nextBtn = document.getElementById("next-btn");
const notepad = document.getElementById("notepad");
const loadBtn = document.getElementById("load-js101");
const sidebarNav = document.querySelector(".sidebar nav ul");
const viewExplorer = document.getElementById("view-explorer");
const viewSyllabus = document.getElementById("view-syllabus");
const viewLesson = document.getElementById("view-lesson");
const catalogGrid = document.getElementById("catalog-grid");
const enrolledList = document.getElementById("enrolled-list");
const navExplorer = document.getElementById("nav-explorer");

//boot
window.firebaseAuth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        await loadUserData();
        await loadCurriculum();
        renderDashboard();
    }
});

//memory load
async function loadUserData() {
    const userRef = window.doc(window.db, "users", currentUser.uid);
    const snap = await window.getDoc(userRef);
    if (snap.exists()) {
        userData = snap.data();
        if (!userData.enrolled) userData.enrolled = [];
    } else {
        userData = { completed: [], enrolled: [], scores: {} };
        await window.setDoc(userRef, userData);
    }
}

function switchView(viewId) {
    viewExplorer.style.display = "none";
    viewSyllabus.style.display = "none";
    viewLesson.style.display = "none";
    document.getElementById(viewId).style.display = "block";

    //reset sidebar
    document.body.classList.remove("lesson-active");
}

async function enrollInCourse(course) {
    if (userData.enrolled.length >= 3) {
        alert("system limit: maximum 3 active curriculums. complete or drop one to proceed.");
        return;
    }

    userData.enrolled.push(course.id);
    const userRef = window.doc(window.db, "users", currentUser.uid);
    await window.setDoc(userRef, { enrolled: userData.enrolled }, { merge: true });

    renderExplorer();
}

navExplorer.addEventListener("click", async (e) => {
    e.preventDefault();
    if (catalogData.length === 0) {
        const res = await fetch("data/catalog.json");
        catalogData = await res.json();
    }
    renderExplorer();
    switchView("view-explorer");
});

//memory save
notepad.addEventListener("input", async () => {
    userData.notes = notepad.value;
    const userRef = window.doc(window.db, "users", currentUser.uid);
    await window.setDoc(userRef, { notes: notepad.value }, { merge: true });
});

async function loadCurriculum() {
    const res = await fetch("data/curriculum.json");
    curriculum = await res.json();
}

function renderDashboard() {
    sidebarNav.innerHTML = "";

    curriculum.nodes.forEach(node => {
        const isUnlocked = node.reqs.every(req => userData.completed.includes(req));
        const isComplete = userData.completed.includes(node.id);

        const li = document.createElement("li");
        const a = document.createElement("a");
        a.innerText = node.title;
        a.href = "#";

        // styling
        if (isComplete) {
            a.style.color = "var(--accent)";
            a.innerText += " [done]";
        } else if (!isUnlocked) {
            a.style.color = "var(--border)";
            a.style.cursor = "not-allowed";
        }

        a.addEventListener("click", async (e) => {
            e.preventDefault();
            if (isUnlocked) {
                const res = await fetch(node.file);
                currentCourse = await res.json();
                currentIndex = 0;
                renderCourse();
            }
        });

        li.appendChild(a);
        sidebarNav.appendChild(li);
    });
}

function renderSidebar() {
    enrolledList.innerHTML = "";

    if (userData.enrolled.length === 0) {
        enrolledList.innerHTML = `<li><span style="color: var(--text-dim)">no active data</span></li>`;
        return;
    }

    userData.enrolled.forEach(courseId => {
        const course = catalogData.find(c => c.id === courseId);
        if (!course) return;

        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = "#";
        a.innerText = course.title;
        a.addEventListener("click", (e) => {
            e.preventDefault();
            openSyllabus(course);
        });

        li.appendChild(a);
        enrolledList.appendChild(li);
    });
}

async function openSyllabus(courseMeta) {
    switchView("view-syllabus");
    document.getElementById("syllabus-title").innerText = courseMeta.title;
    const contentDiv = document.getElementById("syllabus-content");
    contentDiv.innerHTML = `<p style="color: var(--text-dim)">loading matrix...</p>`;

    const res = await fetch(courseMeta.file);
    activeCurriculumData = await res.json();

    contentDiv.innerHTML = "";

    activeCurriculumData.sections.forEach(section => {
        const sectionBlock = document.createElement("div");
        sectionBlock.className = "section-block";

        const header = document.createElement("div");
        header.className = "section-header";
        header.innerText = section.title;
        sectionBlock.appendChild(header);

        section.lessons.forEach(lesson => {
            const row = document.createElement("div");
            row.className = "lesson-row";

            const score = userData.scores?.[lesson.id] || 0;

            row.innerHTML = `
                <div class="lesson-title">${lesson.title}</div>
                <div class="rating-display">
                    <div class="rating-dot ${score >= 1 ? 'filled' : ''}"></div>
                    <div class="rating-dot ${score >= 2 ? 'filled' : ''}"></div>
                    <div class="rating-dot ${score >= 3 ? 'filled' : ''}"></div>
                    <div class="rating-dot ${score >= 4 ? 'filled' : ''}"></div>
                </div>
            `;

            row.addEventListener("click", () => startLesson(lesson));
            sectionBlock.appendChild(row);
        });

        contentDiv.appendChild(sectionBlock);
    });
}

function startLesson(lesson) {
    activeLessonData = lesson;
    currentQuestionIndex = 0;
    correctAnswersCount = 0;

    document.body.classList.add("lesson-active");
    switchView("view-lesson");

    renderQuestion();
}

async function finishLesson() {
    const total = activeLessonData.questions.length;
    const percentage = correctAnswersCount / total;
    let finalScore = Math.round(percentage * 4);
    if (finalScore === 0 && correctAnswersCount > 0) finalScore = 1;
    const lessonView = document.getElementById("view-lesson");
    lessonView.innerHTML = `
        <div class="lesson-workspace" style="text-align: center;">
            <h2>lesson complete</h2>
            <p>accuracy: ${correctAnswersCount} / ${total}</p>
            <p style="color: var(--accent); font-size: 24px; margin-top: 20px;">rating: ${finalScore} / 4</p>
            <button id="return-btn" style="margin-top: 40px;">return to syllabus</button>
        </div>
    `;

    if (!userData.scores) userData.scores = {};

    if (finalScore > (userData.scores[activeLessonData.id] || 0)) {
        userData.scores[activeLessonData.id] = finalScore;
        const userRef = window.doc(window.db, "users", currentUser.uid);
        await window.setDoc(userRef, { scores: userData.scores }, { merge: true });
    }

    document.getElementById("return-btn").addEventListener("click", () => {
        const courseMeta = catalogData.find(c => c.id === activeCurriculumData.id);
        openSyllabus(courseMeta);
    });
}

function renderQuestion() {
    const qData = activeLessonData.questions[currentQuestionIndex];
    const lessonView = document.getElementById("view-lesson");

    let optionsHtml = qData.options.map((opt, i) => `
        <label class="mcq-option">
            <input type="radio" name="answer" value="${i}"> ${opt}
        </label>
    `).join("");

    let dotsHtml = activeLessonData.questions.map((_, i) => `
        <div class="p-dot ${i <= currentQuestionIndex ? 'active' : ''}"></div>
    `).join("");

    lessonView.innerHTML = `
        <div class="lesson-workspace">
            <h2>${activeLessonData.title}</h2>
            <div id="module-content">
                <p>${qData.q}</p>
                <form id="mcq-form">${optionsHtml}</form>
            </div>

            <div class="lesson-footer">
                <div class="progress-dots">${dotsHtml}</div>
                <button id="lesson-next-btn" disabled>next</button>
            </div>
        </div>
    `;

    const radios = document.querySelectorAll('input[name="answer"]');
    const nextBtn = document.getElementById("lesson-next-btn");

    radios.forEach(radio => {
        radio.addEventListener("change", () => {
            nextBtn.disabled = false;
        });
    });

    nextBtn.addEventListener("click", handleNextQuestion);
}

async function handleNextQuestion() {
    const qData = activeLessonData.questions[currentQuestionIndex];
    const selected = document.querySelector('input[name="answer"]:checked');

    if (parseInt(selected.value) === qData.answer) {
        correctAnswersCount++;
        correctSound.currentTime = 0;
        correctSound.play();
    }

    currentQuestionIndex++;

    if (currentQuestionIndex < activeLessonData.questions.length) {
        renderQuestion();
    } else {
        finishLesson();
    }
}

function renderExplorer() {
    catalogGrid.innerHTML = "";

    catalogData.forEach(course => {
        const isEnrolled = userData.enrolled.includes(course.id);

        const card = document.createElement("div");
        card.className = "course-card";
        card.innerHTML = `
            <h3>${course.title}</h3>
            <p>${course.description}</p>
        `;

        const actionBtn = document.createElement("button");
        if (isEnrolled) {
            actionBtn.innerText = "continue";
            actionBtn.style.borderColor = "var(--text-dim)";
            actionBtn.style.color = "var(--text-dim)";
            actionBtn.addEventListener("click", () => openSyllabus(course));
        } else {
            actionBtn.innerText = "enroll";
            actionBtn.addEventListener("click", () => enrollInCourse(course));
        }

        card.appendChild(actionBtn);
        catalogGrid.appendChild(card);
    });

    renderSidebar();
}

function renderCourse() {
    if (!currentCourse) return;

    const module = currentCourse.modules[currentIndex];
    headerDiv.innerHTML = `<h2>${module.title}</h2>`;
    nextBtn.style.display = "block";

    if (module.type === "reading") {
        contentDiv.innerHTML = `<p>${module.content}</p>`;
    }
    else if (module.type === "mcq") {
        let optionsHtml = module.options.map((opt, i) => `
            <label class="mcq-option">
                <input type="radio" name="answer" value="${i}"> ${opt}
            </label>
        `).join("");

        contentDiv.innerHTML = `
            <p>${module.question}</p>
            <form id="mcq-form">${optionsHtml}</form>
        `;
    }
}

//event listeners
window.addEventListener("DOMContentLoaded", () => {
    notepad.value = window.localStorage.getItem("user-notes") || "";
});

notepad.addEventListener("input", () => {
    window.localStorage.setItem("user-notes", notepad.value);
})

loadBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    const response = await fetch("data/js101.json");
    currentCourse = await response.json();
    currentIndex = 0;
    render();
});

nextBtn.addEventListener("click", async () => {
    const module = currentCourse.modules[currentIndex];

    //mcq check
    if (module.type === "mcq") {
        const selected = document.querySelector('input[name="answer"]:checked');
        if (!selected) {
            alert("error: no selection made.");
            return;
        }
        if (parseInt(selected.value) !== module.answer) {
            alert("incorrect. evaluate your logic.");
            return;
        }

        correctSound.currentTime = 0;
        correctSound.play();
    }

    //progress
    if (currentIndex < currentCourse.modules.length - 1) {
        currentIndex++;
        renderCourse();
    } else {
        headerDiv.innerHTML = `<h2>status</h2>`;
        contentDiv.innerHTML = `<p>course complete. data logged.</p>`;
        nextBtn.style.display = "none";

        if (!userData.completed.includes(currentCourse.id)) {
            userData.completed.push(currentCourse.id);
            const userRef = window.doc(window.db, "users", currentUser.uid);
            await window.setDoc(userRef, { completed: userData.completed }, { merge: true });
        }

        renderDashboard();
    }
});

window.firebaseAuth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        await loadUserData();
        navExplorer.click();
    }
});

function render() {
    if (!currentCourse) return;

    const module = currentCourse.modules[currentIndex];
    headerDiv.innerHTML = `<h2>${module.title}</h2>`;
    nextBtn.style.display = "block";

    if (module.type === "reading") {
        const parsed = module.content.replace(/`([^`]+)`/g, '<code>$1</code>');
        contentDiv.innerHTML = `<p>${parsed}</p>`;
    } else if (module.type === "mcq") {
        let optionsHtml = module.options.map((opt, i) => `
            <label class="mcq-option">
                <input type="radio" name="answer" value="${i}"> ${opt}
            </label>
        `).join("");

        contentDiv.innerHTML = `
            <p>${module.question}</p>
            <form id="mcq-form">${optionsHtml}</form>
        `;
    }
}