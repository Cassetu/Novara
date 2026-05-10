let currentUser = null;
let userData = { enrolled: [], scores: {}, analytics: {}, survivalScores: {} };
let catalogData = [];
let activeCurriculumData = null;
let activeLessonData = null;
let currentQuestionIndex = 0;
let correctAnswersCount = 0;
let isQuestionSubmitted = false;
let questionResults = [];
let survivalStrikes = 0;

const correctSound = new Audio("assets/sfx/correct.mp3");
const incorrectSound = new Audio("assets/sfx/incorrect.mp3");

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
        if (!userData.analytics) userData.analytics = {};
        if (!userData.survivalScores) userData.survivalScores = {};
    } else {
        userData = { enrolled: [], scores: {}, analytics: {}, survivalScores: {} };
        await window.setDoc(userRef, userData);
    }
}

function switchView(viewId) {
    viewExplorer.style.display = "none";
    viewSyllabus.style.display = "none";
    viewLesson.style.display = "none";
    viewSettings.style.display = "none";
    viewPractice.style.display = "none";
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

navSettings.addEventListener("click", (e) => {
    e.preventDefault();
    switchView("view-settings");
});

navPractice.addEventListener("click", async (e) => {
    e.preventDefault();
    if (catalogData.length === 0) {
        const res = await fetch("data/catalog.json");
        catalogData = await res.json();
    }
    openPracticeHub();
});

const reqWipeBtn = document.getElementById("request-wipe-btn");
const wipeAuthBlock = document.getElementById("wipe-auth-block");
const wipeConfirmInput = document.getElementById("wipe-confirm-input");
const execWipeBtn = document.getElementById("execute-wipe-btn");

reqWipeBtn.addEventListener("click", () => {
    reqWipeBtn.style.display = "none";
    wipeAuthBlock.style.display = "block";
});

wipeConfirmInput.addEventListener("input", (e) => {
    if (e.target.value === "PURGE") {
        execWipeBtn.disabled = false;
        execWipeBtn.style.backgroundColor = "#ff4444";
        execWipeBtn.style.color = "var(--void)";
    } else {
        execWipeBtn.disabled = true;
        execWipeBtn.style.backgroundColor = "transparent";
        execWipeBtn.style.color = "#ff4444";
    }
});

execWipeBtn.addEventListener("click", async () => {
    const userRef = window.doc(window.db, "users", currentUser.uid);
    await window.setDoc(userRef, { enrolled: [], scores: {}, analytics: {}, survivalScores: {} });

    userData = { enrolled: [], scores: {}, analytics: {}, survivalScores: {} };
    wipeConfirmInput.value = "";
    execWipeBtn.disabled = true;
    execWipeBtn.style.backgroundColor = "transparent";
    execWipeBtn.style.color = "#ff4444";
    wipeAuthBlock.style.display = "none";
    reqWipeBtn.style.display = "inline-block";

    renderExplorer();
    navExplorer.click();
});

async function enrollInCourse(course) {
    if (userData.enrolled.length >= 3) {
        alert("system limit: maximum 3 active curriculums.");
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

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function parseCode(str) {
    if (!str) return "";
    return str.replace(/`([^`]+)`/g, '<code>$1</code>');
}

async function fetchCourseData(courseMeta) {
    const res = await fetch(courseMeta.file);
    return await res.json();
}

async function openSyllabus(courseMeta) {
    switchView("view-syllabus");
    document.getElementById("syllabus-title").innerText = courseMeta.title;
    activeCurriculumData = await fetchCourseData(courseMeta);

    const contentDiv = document.getElementById("syllabus-content");
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

            if (lesson.questions) {
                lesson.questions.forEach((q, idx) => q.globalId = `${safeLessonId}-q${idx}`);
            }

            const row = document.createElement("div");
            row.className = "lesson-row";
            const score = userData.scores?.[safeLessonId] || 0;
            const hasQuestions = lesson.questions && lesson.questions.length > 0;
            let dotsHtml = '';

            if (lesson.type === "challenge" || (!hasQuestions && lesson.type === "document")) {
                dotsHtml = `<div class="rating-dot ${score >= 1 ? 'filled' : ''}"></div>`;
            } else {
                dotsHtml = `
                    <div class="rating-dot ${score >= 1 ? 'filled' : ''}"></div>
                    <div class="rating-dot ${score >= 2 ? 'filled' : ''}"></div>
                    <div class="rating-dot ${score >= 3 ? 'filled' : ''}"></div>
                    <div class="rating-dot ${score >= 4 ? 'filled' : ''}"></div>
                `;
            }
            row.innerHTML = `<div class="lesson-title">${lesson.title}</div><div class="rating-display">${dotsHtml}</div>`;
            row.addEventListener("click", () => startLesson(lesson));
            sectionBlock.appendChild(row);
        });
        contentDiv.appendChild(sectionBlock);
    });
}

function startLesson(lesson) {
    activeLessonData = JSON.parse(JSON.stringify(lesson));

    if (activeLessonData.questions && activeLessonData.questions.length > 0) {
        if (activeLessonData.type !== "practice_standard") {
            activeLessonData.questions = shuffleArray(activeLessonData.questions);
        }
    }

    currentQuestionIndex = 0;
    correctAnswersCount = 0;
    questionResults = [];
    isQuestionSubmitted = false;
    survivalStrikes = 0;

    document.body.classList.add("lesson-active");
    switchView("view-lesson");

    if (activeLessonData.type === "document" || activeLessonData.content) {
        renderDocument();
    } else if (activeLessonData.type === "challenge") {
        renderChallenge();
    } else {
        renderQuestion();
    }
}

async function openPracticeHub() {
    switchView("view-practice");
    practiceContent.innerHTML = "";

    if (userData.enrolled.length === 0) {
        practiceContent.innerHTML = "<p style='color: var(--text-dim)'>no curriculums active.</p>";
        return;
    }

    for (const courseId of userData.enrolled) {
        const courseMeta = catalogData.find(c => c.id === courseId);
        if (!courseMeta) continue;

        const survivalScore = userData.survivalScores[courseId] || 0;

        const card = document.createElement("div");
        card.className = "practice-card";
        card.innerHTML = `
            <h3>${courseMeta.title}</h3>
            <p style="font-size: 14px; color: var(--text-dim);">2 Modes</p>
            <p style="font-size: 12px; color: #ff4444; margin-top: -5px; font-weight: bold;">Survival Record: ${survivalScore}</p>
        `;

        const btnGroup = document.createElement("div");
        btnGroup.className = "practice-btn-group";

        const standardBtn = document.createElement("button");
        standardBtn.innerText = "standard";
        standardBtn.addEventListener("click", () => compileStandardPractice(courseMeta));

        const survivalBtn = document.createElement("button");
        survivalBtn.innerText = "survival";
        survivalBtn.style.color = "#ff4444";
        survivalBtn.style.borderColor = "#ff4444";
        survivalBtn.addEventListener("click", () => compileSurvivalPractice(courseMeta));

        btnGroup.appendChild(standardBtn);
        btnGroup.appendChild(survivalBtn);
        card.appendChild(btnGroup);
        practiceContent.appendChild(card);
    }
}

async function compileStandardPractice(courseMeta) {
    activeCurriculumData = await fetchCourseData(courseMeta);
    let allQuestions = [];

    activeCurriculumData.sections.forEach(sec => {
        sec.lessons.forEach(lesson => {
            const safeLessonId = lesson.id || lesson.title.replace(/\s+/g, '-').toLowerCase();
            if (lesson.questions) {
                lesson.questions.forEach((q, idx) => {
                    q.globalId = `${safeLessonId}-q${idx}`;
                    allQuestions.push(q);
                });
            }
        });
    });

    const courseAnalytics = userData.analytics[activeCurriculumData.id] || {};

    allQuestions.sort((a, b) => {
        const aStats = courseAnalytics[a.globalId] || { correct: 0, incorrect: 0 };
        const bStats = courseAnalytics[b.globalId] || { correct: 0, incorrect: 0 };
        const aDelta = aStats.incorrect - aStats.correct;
        const bDelta = bStats.incorrect - bStats.correct;
        return bDelta - aDelta;
    });

    const targetQuestions = allQuestions.slice(0, 10);

    if (targetQuestions.length === 0) {
        alert("Insufficient data. Complete more lessons.");
        return;
    }

    startLesson({
        id: "practice-standard",
        title: "Standard",
        type: "practice_standard",
        questions: shuffleArray(targetQuestions)
    });
}

async function compileSurvivalPractice(courseMeta) {
    activeCurriculumData = await fetchCourseData(courseMeta);
    let allQuestions = [];

    activeCurriculumData.sections.forEach(sec => {
        sec.lessons.forEach(lesson => {
            const safeLessonId = lesson.id || lesson.title.replace(/\s+/g, '-').toLowerCase();
            if (lesson.questions) {
                lesson.questions.forEach((q, idx) => {
                    q.globalId = `${safeLessonId}-q${idx}`;
                    allQuestions.push(q);
                });
            }
        });
    });

    if (allQuestions.length === 0) {
        alert("Insufficient Data.");
        return;
    }

    startLesson({
        id: "practice-survival",
        title: "Survival",
        type: "practice_survival",
        questions: shuffleArray(allQuestions)
    });
}

function renderDocument() {
    const lessonView = document.getElementById("view-lesson");
    const formattedContent = parseCode(activeLessonData.content).replace(/\n/g, '<br>');

    let examplesHtml = "";
    if (activeLessonData.examples && activeLessonData.examples.length > 0) {
        examplesHtml = activeLessonData.examples.map(ex => `
            <div style="margin-top: 25px; padding: 20px; background-color: var(--void); border: 1px solid var(--border);">
                <strong style="color: var(--text-dim); display: block; margin-bottom: 12px; font-size: 14px;">${ex.label}</strong>
                <div style="color: var(--surface); font-family: 'Courier New', Courier, monospace; font-size: 15px; white-space: pre-wrap; line-height: 1.5;">${parseCode(ex.code)}</div>
            </div>
        `).join("");
    }

    const hasQuestions = activeLessonData.questions && activeLessonData.questions.length > 0;
    const btnText = hasQuestions ? "continue to quiz" : "mark as read";

    lessonView.innerHTML = `
        <div class="lesson-workspace" style="max-width: 800px;">
            <h2>${activeLessonData.title}</h2>
            <div id="module-content">
                <p style="text-transform: none; text-align: left;">${formattedContent}</p>
                ${examplesHtml}
            </div>

            <div class="lesson-footer">
                <div class="progress-dots">
                    <div class="p-dot active"></div>
                </div>
                <button id="lesson-read-btn">${btnText}</button>
            </div>
        </div>
    `;

    document.getElementById("lesson-read-btn").addEventListener("click", () => {
        correctSound.currentTime = 0;
        correctSound.play();
        if (hasQuestions) renderQuestion();
        else finishLesson();
    });
}

function renderQuestion() {
    const qData = activeLessonData.questions[currentQuestionIndex];
    const lessonView = document.getElementById("view-lesson");
    isQuestionSubmitted = false;

    let optionsHtml = qData.options.map((opt, i) => `
        <label class="mcq-option" id="opt-label-${i}">
            <input type="radio" name="answer" value="${i}"> ${parseCode(opt)}
        </label>
    `).join("");

    let statusHtml = "";
    if (activeLessonData.type === "practice_survival") {
        statusHtml = [1,2,3].map(i => `<div class="strike-dot ${survivalStrikes >= i ? 'lost' : ''}"></div>`).join("");
    } else {
        statusHtml = activeLessonData.questions.map((_, i) => {
            let dotClass = i === currentQuestionIndex ? "active" : questionResults[i] === true ? "correct" : questionResults[i] === false ? "incorrect" : "";
            return `<div class="p-dot ${dotClass}"></div>`;
        }).join("");
    }

    lessonView.innerHTML = `
        <div class="lesson-workspace">
            <h2>${activeLessonData.title}</h2>
            <div id="module-content">
                <p>${parseCode(qData.q)}</p>
                <form id="mcq-form">${optionsHtml}</form>
                <div id="explanation-box" class="explanation-box" style="display: none;"></div>
            </div>
            <div class="lesson-footer">
                <div class="progress-dots" style="${activeLessonData.type === 'practice_survival' ? 'gap: 10px;' : ''}">${statusHtml}</div>
                <button id="lesson-action-btn" disabled>submit</button>
            </div>
        </div>
    `;

    document.querySelectorAll('input[name="answer"]').forEach(r => r.addEventListener("change", () => {
        if (!isQuestionSubmitted) document.getElementById("lesson-action-btn").disabled = false;
    }));

    document.getElementById("lesson-action-btn").addEventListener("click", handleActionClick);
}

async function handleActionClick() {
    const qData = activeLessonData.questions[currentQuestionIndex];
    const actionBtn = document.getElementById("lesson-action-btn");

    if (!isQuestionSubmitted) {
        const selectedRadio = document.querySelector('input[name="answer"]:checked');
        const selectedVal = parseInt(selectedRadio.value);
        const isCorrect = selectedVal === qData.answer;

        questionResults[currentQuestionIndex] = isCorrect;

        if (qData.globalId && activeCurriculumData) {
            const courseId = activeCurriculumData.id;
            if (!userData.analytics[courseId]) userData.analytics[courseId] = {};
            if (!userData.analytics[courseId][qData.globalId]) userData.analytics[courseId][qData.globalId] = { correct: 0, incorrect: 0 };

            if (isCorrect) userData.analytics[courseId][qData.globalId].correct++;
            else userData.analytics[courseId][qData.globalId].incorrect++;

            const userRef = window.doc(window.db, "users", currentUser.uid);
            await window.setDoc(userRef, { analytics: userData.analytics }, { merge: true });
        }

        if (isCorrect) {
            correctAnswersCount++;
            correctSound.currentTime = 0;
            correctSound.play();
        } else {
            incorrectSound.currentTime = 0;
            incorrectSound.play();
            if (activeLessonData.type === "practice_survival") survivalStrikes++;
        }

        document.querySelectorAll('input[name="answer"]').forEach(r => r.disabled = true);
        document.querySelectorAll('.mcq-option').forEach(l => l.classList.add("locked"));

        const selectedLabel = document.getElementById(`opt-label-${selectedVal}`);
        if (isCorrect) selectedLabel.classList.add("reveal-correct");
        else {
            selectedLabel.classList.add("reveal-incorrect");
            document.getElementById(`opt-label-${qData.answer}`).classList.add("reveal-correct");
        }

        if (qData.explanation) {
            const expBox = document.getElementById("explanation-box");
            expBox.innerHTML = `<strong>analysis:</strong> ${parseCode(qData.explanation)}`;
            expBox.style.display = "block";
        }

        if (activeLessonData.type === "practice_survival") {
            const strikes = document.querySelectorAll('.strike-dot');
            for (let i = 0; i < survivalStrikes; i++) if(strikes[i]) strikes[i].classList.add('lost');
        } else {
            const dots = document.querySelectorAll('.p-dot');
            dots[currentQuestionIndex].classList.remove('active');
            dots[currentQuestionIndex].classList.add(isCorrect ? 'correct' : 'incorrect');
        }

        actionBtn.innerText = "next";
        isQuestionSubmitted = true;
    } else {
        if (activeLessonData.type === "practice_survival" && survivalStrikes >= 3) {
            finishLesson();
        } else {
            currentQuestionIndex++;
            if (currentQuestionIndex < activeLessonData.questions.length) renderQuestion();
            else finishLesson();
        }
    }
}

function renderChallenge() {
    const lessonView = document.getElementById("view-lesson");
    const formattedPrompt = parseCode(activeLessonData.prompt).replace(/\n/g, '<br>');

    lessonView.innerHTML = `
        <div class="lesson-workspace" style="max-width: 900px;">
            <h2>${activeLessonData.title}</h2>
            <div class="challenge-workspace">
                <div class="challenge-prompt"><p style="text-transform: none;">${formattedPrompt}</p></div>
                <div class="challenge-editor-wrapper">
                    <textarea id="challenge-input" class="challenge-editor" spellcheck="false" placeholder=""></textarea>
                    <div id="challenge-console" class="challenge-console"></div>
                </div>
            </div>
            <div class="lesson-footer" id="challenge-footer">
                <div class="progress-dots"><div class="p-dot active"></div></div>
                <button id="lesson-action-btn">execute</button>
            </div>
        </div>
    `;

    document.getElementById("lesson-action-btn").addEventListener("click", () => {
        const input = document.getElementById("challenge-input").value;
        const consoleOut = document.getElementById("challenge-console");
        consoleOut.innerText = "";
        consoleOut.style.color = "#ff4444";

        let passed = true;
        for (const check of activeLessonData.validation) {
            const regex = new RegExp(check.rule);
            if (!regex.test(input)) {
                consoleOut.innerText = check.message;
                incorrectSound.currentTime = 0;
                incorrectSound.play();
                passed = false;
                break;
            }
        }

        if (passed) {
            correctSound.currentTime = 0;
            correctSound.play();
            finishLesson();
        } else {
            if (activeLessonData.solution && !document.getElementById('solution-btn')) {
                const footer = document.getElementById('challenge-footer');
                const solBtn = document.createElement('button');
                solBtn.id = 'solution-btn';
                solBtn.innerText = 'view solution';
                solBtn.style.marginRight = '15px';
                solBtn.style.backgroundColor = 'transparent';
                solBtn.style.borderColor = 'var(--text-dim)';
                solBtn.style.color = 'var(--text-dim)';
                solBtn.addEventListener('click', () => {
                    document.getElementById("challenge-input").value = activeLessonData.solution;
                    consoleOut.innerText = "Solution loaded.";
                    consoleOut.style.color = "var(--text-dim)";
                    solBtn.remove();
                });
                footer.insertBefore(solBtn, document.getElementById('lesson-action-btn'));
            }
        }
    });
}

async function finishLesson() {
    let finalScore = 0;
    let accuracyText = "";
    let ratingText = "";

    const hasQuestions = activeLessonData.questions && activeLessonData.questions.length > 0;

    if (activeLessonData.type === "practice_survival") {
        const courseId = activeCurriculumData.id;
        const currentHigh = userData.survivalScores[courseId] || 0;
        let recordText = "";

        if (correctAnswersCount > currentHigh) {
            userData.survivalScores[courseId] = correctAnswersCount;
            const userRef = window.doc(window.db, "users", currentUser.uid);
            await window.setDoc(userRef, { survivalScores: userData.survivalScores }, { merge: true });
            recordText = `<br><span style='color: #ff4444; font-size: 16px; display: block; margin-top: 10px;'>New Survival Record!</span>`;
        }

        accuracyText = `you survived ${correctAnswersCount} iterations.${recordText}`;
        ratingText = survivalStrikes >= 3 ? "Terminated." : "Cleared.";
    } else if (activeLessonData.type === "practice_standard") {
        accuracyText = `accuracy: ${correctAnswersCount} / ${activeLessonData.questions.length}`;
        ratingText = "Complete.";
    } else if (activeLessonData.type === "challenge" || (!hasQuestions && activeLessonData.type === "document")) {
        finalScore = 1;
        accuracyText = activeLessonData.type === "challenge" ? "Passed" : "Complete";
        ratingText = "Rating: 1 / 1";
    } else {
        const total = activeLessonData.questions.length;
        const percentage = correctAnswersCount / total;
        finalScore = Math.round(percentage * 4);
        if (finalScore === 0 && correctAnswersCount > 0) finalScore = 1;
        accuracyText = `accuracy: ${correctAnswersCount} / ${total}`;
        ratingText = `rating: ${finalScore} / 4`;
    }

    const lessonView = document.getElementById("view-lesson");
    lessonView.innerHTML = `
        <div class="lesson-workspace" style="text-align: center;">
            <h2>Lesson complete</h2>
            <p style="line-height: 1.5;">${accuracyText}</p>
            <p style="color: var(--accent); font-size: 24px; margin-top: 20px;">${ratingText}</p>
            <button id="return-btn" style="margin-top: 40px;">Return</button>
        </div>
    `;

    if (activeLessonData.type !== "practice_standard" && activeLessonData.type !== "practice_survival") {
        if (!userData.scores) userData.scores = {};
        const currentHighscore = userData.scores[activeLessonData.id] || 0;
        if (finalScore > currentHighscore) {
            userData.scores[activeLessonData.id] = finalScore;
            const userRef = window.doc(window.db, "users", currentUser.uid);
            await window.setDoc(userRef, { scores: userData.scores }, { merge: true });
        }
    }

    document.getElementById("return-btn").addEventListener("click", () => {
        if (activeLessonData.type === "practice_standard" || activeLessonData.type === "practice_survival") {
            navPractice.click();
        } else {
            const courseMeta = catalogData.find(c => c.id === activeCurriculumData.id);
            if (courseMeta) openSyllabus(courseMeta);
            else navExplorer.click();
        }
    });
}