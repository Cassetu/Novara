import { parseCode } from "../utils/parse.js";
import { playCorrect, playIncorrect } from "../utils/sound.js";

function renderFillBlank(lessonData, onFinish) {
    const lessonView = document.getElementById("view-lesson");

    let currentIndex = 0;
    let correctCount = 0;
    const results = [];

    function renderQuestion() {
        const q = lessonData.questions[currentIndex];
        const total = lessonData.questions.length;

        const parts = q.code.split("___");
        const blankCount = parts.length - 1;

        let codeHtml = "";
        for (let i = 0; i < parts.length; i++) {
            codeHtml += `<span class="fb-code-text">${parts[i].replace(/\n/g, "<br>")}</span>`;
            if (i < blankCount) {
                codeHtml += `<input class="fb-input" data-index="${i}" type="text" autocomplete="off" spellcheck="false">`;
            }
        }

        const dotsHtml = lessonData.questions.map((_, i) => {
            const cls = i === currentIndex ? "active"
                : results[i] === true ? "correct"
                : results[i] === false ? "incorrect" : "";
            return `<div class="p-dot ${cls}"></div>`;
        }).join("");

        lessonView.innerHTML = `
            <div class="lesson-workspace" style="max-width:800px;">
                <h2>${lessonData.title}</h2>
                ${q.prompt ? `<p style="margin-bottom:20px;font-size:15px;">${parseCode(q.prompt)}</p>` : ""}
                <div class="fb-code-block">${codeHtml}</div>
                <div id="fb-feedback" class="explanation-box" style="display:none;"></div>
                <div class="lesson-footer">
                    <div class="progress-dots">${dotsHtml}</div>
                    <button id="fb-submit-btn">Check</button>
                </div>
            </div>
        `;

        const inputs = lessonView.querySelectorAll(".fb-input");
        inputs[0]?.focus();

        inputs.forEach(inp => {
            inp.addEventListener("keydown", e => {
                if (e.key === "Enter") document.getElementById("fb-submit-btn").click();
            });
        });

        document.getElementById("fb-submit-btn").addEventListener("click", () => {
            const given = Array.from(inputs).map(i => i.value.trim());
            const expected = Array.isArray(q.blanks) ? q.blanks : [q.blanks];

            const allCorrect = given.every((val, i) => val === expected[i]);

            results[currentIndex] = allCorrect;

            inputs.forEach((inp, i) => {
                inp.disabled = true;
                inp.classList.add(given[i] === expected[i] ? "fb-correct" : "fb-wrong");
                if (given[i] !== expected[i]) {
                    inp.value = expected[i];
                }
            });

            if (allCorrect) {
                correctCount++;
                playCorrect();
            } else {
                playIncorrect();
            }

            const feedback = document.getElementById("fb-feedback");
            feedback.style.display = "block";
            feedback.innerHTML = `<strong>${allCorrect ? "correct." : "not quite."}</strong>${q.explanation ? " " + parseCode(q.explanation) : ""}`;

            const dots = lessonView.querySelectorAll(".p-dot");
            if (dots[currentIndex]) {
                dots[currentIndex].classList.remove("active");
                dots[currentIndex].classList.add(allCorrect ? "correct" : "incorrect");
            }

            const btn = document.getElementById("fb-submit-btn");
            btn.innerText = "Next";
            btn.onclick = () => {
                currentIndex++;
                if (currentIndex < lessonData.questions.length) {
                    renderQuestion();
                } else {
                    onFinish(correctCount, lessonData.questions.length);
                }
            };
        });
    }

    renderQuestion();
}

export { renderFillBlank };