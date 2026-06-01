import { parseCode } from "../utils/parse.js";
import { playCorrect } from "../utils/sound.js";

function renderDocument(lessonData, onFinish) {
    const view = document.getElementById("view-lesson");
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

    const hasQ = lessonData.questions?.length > 0;

    view.innerHTML = `
        <div class="lesson-workspace" style="max-width:800px;">
            <h2>${lessonData.title}</h2>
            <div id="module-content">
                <p style="text-transform:none;text-align:left;">${formatted}</p>
                ${examplesHtml}
            </div>
            <div class="lesson-footer">
                <div class="progress-dots"><div class="p-dot active"></div></div>
                <button id="lesson-read-btn" ${hasQ ? "disabled" : ""}>${hasQ ? "read to continue" : "mark as read"}</button>
            </div>
        </div>
    `;

    const btn = document.getElementById("lesson-read-btn");
    const content = document.getElementById("module-content");

    if (hasQ) {
        const threshold = 75;

        function checkScroll() {
            const rect = content.getBoundingClientRect();
            const workspace = view.closest(".workspace") || document.scrollingElement;
            const scrolled = workspace.scrollTop + workspace.clientHeight;
            const target = content.offsetTop + content.offsetHeight * threshold;

            if (scrolled >= target) {
                btn.disabled = false;
                btn.innerText = "continue to quiz";
                workspace.removeEventListener("scroll", checkScroll);
            }
        }

        const workspace = view.closest(".workspace") || document.scrollingElement;
        workspace.addEventListener("scroll", checkScroll);
        checkScroll();
    }

    btn.addEventListener("click", () => {
        playCorrect();
        onFinish();
    });
}

export { renderDocument };