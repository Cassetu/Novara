let currentUser = null;
let userData = { enrolled: [], scores: {} };
let catalogData = [];
let activeCurriculumData = null;
let activeLessonData = null;
let currentQuestionIndex = 0;
let correctAnswersCount = 0;
let isQuestionSubmitted = false;
let questionResults = [];

const correctSound = new Audio("assets/sfx/correct.mp3");
const incorrectSound = new Audio("assets/sfx/incorrect.mp3");

const viewExplorer = document.getElementById("view-explorer");
const viewSyllabus = document.getElementById("view-syllabus");
const viewLesson = document.getElementById("view-lesson");
const catalogGrid = document.getElementById("catalog-grid");
const enrolledList = document.getElementById("enrolled-list");
const navExplorer = document.getElementById("nav-explorer");

window.firebaseAuth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        await loadUserData();
        navExplorer.click();
    }
});

async function loadUserData() {
    const userRef = window.doc(window.db, "users", currentUser.uid);
    const snap = await window.getDoc(userRef);
    if (snap.exists()) {
        userData = snap.data();
        if (!userData.enrolled) userData.enrolled = [];
        if (!userData.scores) userData.scores = {};
    } else {
        userData = { enrolled: [], scores: {} };
        await window.setDoc(userRef, userData);
    }
}

function switchView(viewId) {
    viewExplorer.style.display = "none";
    viewSyllabus.style.display = "none";
    viewLesson.style.display = "none";
    document.getElementById(viewId).style.display = "block";
    document.body.classList.remove("lesson-active");
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
            const safeLessonId = lesson.id || lesson.title.replace(/\s+/g, '-').toLowerCase();
            lesson.id = safeLessonId;

            const row = document.createElement("div");
            row.className = "lesson-row";

            const score = userData.scores?.[safeLessonId] || 0;

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

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function startLesson(lesson) {
    activeLessonData = JSON.parse(JSON.stringify(lesson));
    activeLessonData.questions = shuffleArray(activeLessonData.questions);

    currentQuestionIndex = 0;
    correctAnswersCount = 0;
    questionResults = [];

    document.body.classList.add("lesson-active");
    switchView("view-lesson");

    renderQuestion();
}

function renderQuestion() {
    const qData = activeLessonData.questions[currentQuestionIndex];
    const lessonView = document.getElementById("view-lesson");

    isQuestionSubmitted = false;

    let optionsHtml = qData.options.map((opt, i) => `
        <label class="mcq-option" id="opt-label-${i}">
            <input type="radio" name="answer" value="${i}"> ${opt}
        </label>
    `).join("");

    let dotsHtml = activeLessonData.questions.map((_, i) => {
        let dotClass = "";
        if (i === currentQuestionIndex) dotClass = "active";
        else if (questionResults[i] === true) dotClass = "correct";
        else if (questionResults[i] === false) dotClass = "incorrect";

        return `<div class="p-dot ${dotClass}"></div>`;
    }).join("");

    lessonView.innerHTML = `
        <div class="lesson-workspace">
            <h2>${activeLessonData.title}</h2>
            <div id="module-content">
                <p>${qData.q}</p>
                <form id="mcq-form">${optionsHtml}</form>
            </div>

            <div class="lesson-footer">
                <div class="progress-dots">${dotsHtml}</div>
                <button id="lesson-action-btn" disabled>submit</button>
            </div>
        </div>
    `;

    const radios = document.querySelectorAll('input[name="answer"]');
    const actionBtn = document.getElementById("lesson-action-btn");

    radios.forEach(radio => {
        radio.addEventListener("change", () => {
            if (!isQuestionSubmitted) actionBtn.disabled = false;
        });
    });

    actionBtn.addEventListener("click", handleActionClick);
}

async function handleActionClick() {
    const qData = activeLessonData.questions[currentQuestionIndex];
    const actionBtn = document.getElementById("lesson-action-btn");

    if (!isQuestionSubmitted) {
        const selectedRadio = document.querySelector('input[name="answer"]:checked');
        const selectedVal = parseInt(selectedRadio.value);
        const isCorrect = selectedVal === qData.answer;

        questionResults[currentQuestionIndex] = isCorrect;

        if (isCorrect) {
            correctAnswersCount++;
            correctSound.currentTime = 0;
            correctSound.play();
        } else {
            incorrectSound.currentTime = 0;
            incorrectSound.play();
        }

        const allRadios = document.querySelectorAll('input[name="answer"]');
        const allLabels = document.querySelectorAll('.mcq-option');

        allRadios.forEach(r => r.disabled = true);
        allLabels.forEach(l => l.classList.add("locked"));

        const selectedLabel = document.getElementById(`opt-label-${selectedVal}`);
        if (isCorrect) {
            selectedLabel.classList.add("reveal-correct");
        } else {
            selectedLabel.classList.add("reveal-incorrect");
            document.getElementById(`opt-label-${qData.answer}`).classList.add("reveal-correct");
        }

        const dots = document.querySelectorAll('.p-dot');
        dots[currentQuestionIndex].classList.remove('active');
        dots[currentQuestionIndex].classList.add(isCorrect ? 'correct' : 'incorrect');

        actionBtn.innerText = "next";
        isQuestionSubmitted = true;
    } else {
        currentQuestionIndex++;

        if (currentQuestionIndex < activeLessonData.questions.length) {
            renderQuestion();
        } else {
            finishLesson();
        }
    }
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

    const currentHighscore = userData.scores[activeLessonData.id] || 0;

    if (finalScore > currentHighscore) {
        userData.scores[activeLessonData.id] = finalScore;
        const userRef = window.doc(window.db, "users", currentUser.uid);
        await window.setDoc(userRef, { scores: userData.scores }, { merge: true });
    }

    document.getElementById("return-btn").addEventListener("click", () => {
        const courseMeta = catalogData.find(c => c.id === activeCurriculumData.id);
        if (courseMeta) {
            openSyllabus(courseMeta);
        } else {
            navExplorer.click();
        }
    });
}