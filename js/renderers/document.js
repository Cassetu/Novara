import { parseCode } from "../utils/parse.js";
import { playCorrect } from "../utils/sound.js";

function renderDocument(lessonData, onFinish) {
    const lessonView = document.getElementById("view-lesson");
    const formatted = parseCode(lessonData.content).replace(/\n/g, "<br>");

    let examplesHtml = "";
    if (lessonData.examples?.length) {
        examplesHtml = lessonData.examples.map(ex => `
            <div style="margin-top:25px;padding:20px;background:var(--void);border:1px solid var(--border);">
                <strong style="color:var(--text-dim);display:block;margin-bottom:12px;font-size:14px;">${ex.label}</strong>
                <div style="color:var(--surface);font-family:monospace;font-size:15px;white-space:pre-wrap;line-height:1.5;">${parseCode(ex.code)}</div>
            </div>
        `).join("");
    }

    const hasQuestions = lessonData.questions?.length > 0;
    const btnText = hasQuestions ? "continue to quiz" : "mark as read";

    lessonView.innerHTML = `
        <div class="lesson-workspace" style="max-width:800px;">
            <h2>${lessonData.title}</h2>
            <div id="module-content">
                <p style="text-transform:none;text-align:left;">${formatted}</p>
                ${examplesHtml}
            </div>
            <div class="lesson-footer">
                <div class="progress-dots"><div class="p-dot active"></div></div>
                <button id="lesson-read-btn">${btnText}</button>
            </div>
        </div>
    `;

    document.getElementById("lesson-read-btn").addEventListener("click", () => {
        playCorrect();
        onFinish();
    });
}

export { renderDocument };