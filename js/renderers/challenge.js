import { parseCode } from "../utils/parse.js";
import { playCorrect, playIncorrect } from "../utils/sound.js";

function renderChallenge(lessonData, onFinish) {
    const lessonView = document.getElementById("view-lesson");
    const formattedPrompt = parseCode(lessonData.prompt).replace(/\n/g, "<br>");

    lessonView.innerHTML = `
        <div class="lesson-workspace" style="max-width:900px;">
            <h2>${lessonData.title}</h2>
            <div class="challenge-workspace">
                <div class="challenge-prompt">
                    <p style="text-transform:none;">${formattedPrompt}</p>
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
        const consoleOut = document.getElementById("challenge-console");
        consoleOut.innerText = "";
        consoleOut.style.color = "#ff4444";

        let passed = true;
        for (const check of lessonData.validation) {
            if (!new RegExp(check.rule).test(input)) {
                consoleOut.innerText = check.message;
                playIncorrect();
                passed = false;
                break;
            }
        }

        if (passed) {
            playCorrect();
            onFinish();
            return;
        }

        if (lessonData.solution && !document.getElementById("solution-btn")) {
            const footer = document.getElementById("challenge-footer");
            const solBtn = document.createElement("button");
            solBtn.id = "solution-btn";
            solBtn.innerText = "view solution";
            solBtn.style.cssText = "margin-right:15px;background:transparent;border-color:var(--text-dim);color:var(--text-dim);";
            solBtn.addEventListener("click", () => {
                document.getElementById("challenge-input").value = lessonData.solution;
                consoleOut.innerText = "Solution loaded.";
                consoleOut.style.color = "var(--text-dim)";
                solBtn.remove();
            });
            footer.insertBefore(solBtn, document.getElementById("lesson-action-btn"));
        }
    });
}

export { renderChallenge };