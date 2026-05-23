import { parseCode } from "../utils/parse.js";
import { playCorrect, playIncorrect } from "../utils/sound.js";

function renderFillBlank(lessonData, onFinish) {
    const view = document.getElementById("view-lesson");
    let idx = 0;
    let correct = 0;
    const results = [];

    function renderQuestion() {
        const q = lessonData.questions[idx];
        const parts = q.code.split("___");

        let codeHtml = "";
        for (let i = 0; i < parts.length; i++) {
            codeHtml += `<span class="fb-code-text">${parts[i].replace(/\n/g, "<br>")}</span>`;
            if (i < parts.length - 1)
                codeHtml += `<input class="fb-input" data-index="${i}" type="text" autocomplete="off" spellcheck="false">`;
        }

        const dots = lessonData.questions.map((_, i) => {
            const cls = i === idx ? "active" : results[i] === true ? "correct" : results[i] === false ? "incorrect" : "";
            return `<div class="p-dot ${cls}"></div>`;
        }).join("");

        view.innerHTML = `
            <div class="lesson-workspace" style="max-width:800px;">
                <h2>${lessonData.title}</h2>
                ${q.prompt ? `<p style="margin-bottom:20px;font-size:15px;">${parseCode(q.prompt)}</p>` : ""}
                <div class="fb-code-block">${codeHtml}</div>
                <div id="fb-feedback" class="explanation-box" style="display:none;"></div>
                <div class="lesson-footer">
                    <div class="progress-dots">${dots}</div>
                    <button id="fb-btn">Check</button>
                </div>
            </div>
        `;

        const inputs = view.querySelectorAll(".fb-input");
        inputs[0]?.focus();
        inputs.forEach(inp => {
            inp.addEventListener("keydown", e => {
                if (e.key === "Enter") document.getElementById("fb-btn").click();
            });
        });

        document.getElementById("fb-btn").addEventListener("click", () => {
            const given = Array.from(inputs).map(i => i.value.trim());
            const expected = Array.isArray(q.blanks) ? q.blanks : [q.blanks];
            const allCorrect = given.every((v, i) => v === expected[i]);

            results[idx] = allCorrect;

            inputs.forEach((inp, i) => {
                inp.disabled = true;
                inp.classList.add(given[i] === expected[i] ? "fb-correct" : "fb-wrong");
                if (given[i] !== expected[i]) inp.value = expected[i];
            });

            allCorrect ? (correct++, playCorrect()) : playIncorrect();

            const fb = document.getElementById("fb-feedback");
            fb.style.display = "block";
            fb.innerHTML = `<strong>${allCorrect ? "correct." : "not quite."}</strong>${q.explanation ? " " + parseCode(q.explanation) : ""}`;

            const pdots = view.querySelectorAll(".p-dot");
            if (pdots[idx]) {
                pdots[idx].classList.remove("active");
                pdots[idx].classList.add(allCorrect ? "correct" : "incorrect");
            }

            const btn = document.getElementById("fb-btn");
            btn.innerText = "Next";
            btn.onclick = () => {
                idx++;
                idx < lessonData.questions.length ? renderQuestion() : onFinish(correct, lessonData.questions.length);
            };
        });
    }

    renderQuestion();
}

export { renderFillBlank };