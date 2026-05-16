import { parseCode } from "../utils/parse.js";
import { playCorrect, playIncorrect } from "../utils/sound.js";

let currentQuestionIndex = 0;
let correctAnswersCount = 0;
let isQuestionSubmitted = false;
let questionResults = [];
let survivalStrikes = 0;

function initQuestionState() {
    currentQuestionIndex = 0;
    correctAnswersCount = 0;
    isQuestionSubmitted = false;
    questionResults = [];
    survivalStrikes = 0;
}

function getQuestionStats() {
    return { correctAnswersCount, questionResults, survivalStrikes };
}

function renderQuestion(lessonData, analytics, onAnalyticsUpdate, onFinish) {
    const qData = lessonData.questions[currentQuestionIndex];
    const lessonView = document.getElementById("view-lesson");
    isQuestionSubmitted = false;

    const optionsHtml = qData.options.map((opt, i) => `
        <label class="mcq-option" id="opt-label-${i}">
            <input type="radio" name="answer" value="${i}"> ${parseCode(opt)}
        </label>
    `).join("");

    let statusHtml = "";
    if (lessonData.type === "practice_survival") {
        statusHtml = [1, 2, 3].map(i =>
            `<div class="strike-dot ${survivalStrikes >= i ? "lost" : ""}"></div>`
        ).join("");
    } else {
        statusHtml = lessonData.questions.map((_, i) => {
            const cls = i === currentQuestionIndex ? "active"
                : questionResults[i] === true ? "correct"
                : questionResults[i] === false ? "incorrect" : "";
            return `<div class="p-dot ${cls}"></div>`;
        }).join("");
    }

    lessonView.innerHTML = `
        <div class="lesson-workspace">
            <h2>${lessonData.title}</h2>
            <div id="module-content">
                <p>${parseCode(qData.q)}</p>
                <form id="mcq-form">${optionsHtml}</form>
                <div id="explanation-box" class="explanation-box" style="display:none;"></div>
            </div>
            <div class="lesson-footer">
                <div class="progress-dots" style="${lessonData.type === "practice_survival" ? "gap:10px;" : ""}">${statusHtml}</div>
                <button id="lesson-action-btn" disabled>submit</button>
            </div>
        </div>
    `;

    document.querySelectorAll('input[name="answer"]').forEach(r => {
        r.addEventListener("change", () => {
            if (!isQuestionSubmitted)
                document.getElementById("lesson-action-btn").disabled = false;
        });
    });

    document.getElementById("lesson-action-btn").addEventListener("click", () =>
        handleActionClick(lessonData, analytics, onAnalyticsUpdate, onFinish)
    );
}

async function handleActionClick(lessonData, analytics, onAnalyticsUpdate, onFinish) {
    const qData = lessonData.questions[currentQuestionIndex];
    const actionBtn = document.getElementById("lesson-action-btn");

    if (!isQuestionSubmitted) {
        const selected = document.querySelector('input[name="answer"]:checked');
        const selectedVal = parseInt(selected.value);
        const isCorrect = selectedVal === qData.answer;

        questionResults[currentQuestionIndex] = isCorrect;

        if (qData.globalId && analytics) {
            if (!analytics[qData.globalId]) analytics[qData.globalId] = { correct: 0, incorrect: 0 };
            if (isCorrect) analytics[qData.globalId].correct++;
            else analytics[qData.globalId].incorrect++;
            await onAnalyticsUpdate(analytics);
        }

        if (isCorrect) {
            correctAnswersCount++;
            playCorrect();
        } else {
            playIncorrect();
            if (lessonData.type === "practice_survival") survivalStrikes++;
        }

        document.querySelectorAll('input[name="answer"]').forEach(r => r.disabled = true);
        document.querySelectorAll(".mcq-option").forEach(l => l.classList.add("locked"));

        const selectedLabel = document.getElementById(`opt-label-${selectedVal}`);
        if (isCorrect) {
            selectedLabel.classList.add("reveal-correct");
        } else {
            selectedLabel.classList.add("reveal-incorrect");
            document.getElementById(`opt-label-${qData.answer}`).classList.add("reveal-correct");
        }

        if (qData.explanation) {
            const expBox = document.getElementById("explanation-box");
            expBox.innerHTML = `<strong>analysis:</strong> ${parseCode(qData.explanation)}`;
            expBox.style.display = "block";
        }

        if (lessonData.type === "practice_survival") {
            document.querySelectorAll(".strike-dot").forEach((dot, i) => {
                if (i < survivalStrikes) dot.classList.add("lost");
            });
        } else {
            const dots = document.querySelectorAll(".p-dot");
            if (dots[currentQuestionIndex]) {
                dots[currentQuestionIndex].classList.remove("active");
                dots[currentQuestionIndex].classList.add(isCorrect ? "correct" : "incorrect");
            }
        }

        actionBtn.innerText = "next";
        isQuestionSubmitted = true;

    } else {
        if (lessonData.type === "practice_survival" && survivalStrikes >= 3) {
            onFinish();
        } else {
            currentQuestionIndex++;
            if (currentQuestionIndex < lessonData.questions.length) {
                renderQuestion(lessonData, analytics, onAnalyticsUpdate, onFinish);
            } else {
                onFinish();
            }
        }
    }
}

export { renderQuestion, initQuestionState, getQuestionStats };