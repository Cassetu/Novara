import { parseCode } from "../utils/parse.js";
import { playCorrect, playIncorrect } from "../utils/sound.js";

function renderChallenge(lessonData, onFinish) {
    const view = document.getElementById("view-lesson");

    view.innerHTML = `
        <div class="lesson-workspace" style="max-width:900px;">
            <h2>${lessonData.title}</h2>
            <div class="challenge-workspace">
                <div class="challenge-prompt">
                    <p style="text-transform:none;">${parseCode(lessonData.prompt).replace(/\n/g, "<br>")}</p>
                </div>
                <div class="challenge-editor-wrapper">
                    <textarea id="challenge-input" class="challenge-editor" spellcheck="false"></textarea>
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
        const out = document.getElementById("challenge-console");
        out.innerText = "";
        out.style.color = "#ff4444";

        let passed = true;
        for (const check of lessonData.validation) {
            if (!new RegExp(check.rule).test(input)) {
                out.innerText = check.message;
                playIncorrect();
                passed = false;
                break;
            }
        }

        if (passed) { playCorrect(); onFinish(); return; }

        if (lessonData.solution && !document.getElementById("solution-btn")) {
            const footer = document.getElementById("challenge-footer");
            const btn = document.getElementById("lesson-action-btn");
            const solBtn = document.createElement("button");
            solBtn.id = "solution-btn";
            solBtn.innerText = "view solution";
            solBtn.style.cssText = "margin-right:15px;background:transparent;border-color:var(--text-dim);color:var(--text-dim);";
            solBtn.onclick = () => {
                document.getElementById("challenge-input").value = lessonData.solution;
                out.innerText = "Solution loaded.";
                out.style.color = "var(--text-dim)";
                solBtn.remove();
            };
            footer.insertBefore(solBtn, btn);
        }
    });
}

export { renderChallenge };