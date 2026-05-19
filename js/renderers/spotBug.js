import { playCorrect, playIncorrect } from "../utils/sound.js";

function renderSpotBug(lessonData, onFinish) {
    const lessonView = document.getElementById("view-lesson");

    const lines = lessonData.code.split("\n");
    let submitted = false;

    const linesHtml = lines.map((line, i) => {
        const num = i + 1;
        const safe = line.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        return `
            <div class="sb-line" data-line="${num}">
                <span class="sb-num">${num}</span>
                <span class="sb-code">${safe || " "}</span>
            </div>
        `;
    }).join("");

    lessonView.innerHTML = `
        <div class="lesson-workspace" style="max-width:800px;">
            <h2>${lessonData.title}</h2>
            <p style="margin-bottom:16px;font-size:15px;">${lessonData.prompt || "Click the line that contains the bug."}</p>
            <div class="sb-hint">Click a line to select it, then submit.</div>
            <div class="sb-code-block" id="sb-code-block">${linesHtml}</div>
            <div id="sb-feedback" class="explanation-box" style="display:none;"></div>
            <div class="lesson-footer">
                <div class="progress-dots"><div class="p-dot active"></div></div>
                <button id="sb-submit-btn" disabled>Submit</button>
            </div>
        </div>
    `;

    let selectedLine = null;

    document.querySelectorAll(".sb-line").forEach(el => {
        el.addEventListener("click", () => {
            if (submitted) return;
            document.querySelectorAll(".sb-line").forEach(l => l.classList.remove("sb-selected"));
            el.classList.add("sb-selected");
            selectedLine = parseInt(el.dataset.line);
            document.getElementById("sb-submit-btn").disabled = false;
        });
    });

    document.getElementById("sb-submit-btn").addEventListener("click", () => {
        if (submitted || selectedLine === null) return;
        submitted = true;

        const correct = selectedLine === lessonData.bugLine;

        document.querySelectorAll(".sb-line").forEach(el => {
            const ln = parseInt(el.dataset.line);
            if (ln === lessonData.bugLine) el.classList.add("sb-reveal-correct");
            else if (ln === selectedLine && !correct) el.classList.add("sb-reveal-wrong");
        });

        const feedback = document.getElementById("sb-feedback");
        feedback.style.display = "block";
        feedback.innerHTML = `<strong>${correct ? "Found it." : `Wrong line. Bug was on line ${lessonData.bugLine}.`}</strong>${lessonData.explanation ? " " + lessonData.explanation : ""}`;

        if (correct) playCorrect(); else playIncorrect();

        const dot = document.querySelector(".p-dot");
        if (dot) {
            dot.classList.remove("active");
            dot.classList.add(correct ? "correct" : "incorrect");
        }

        const btn = document.getElementById("sb-submit-btn");
        btn.innerText = "Continue";
        btn.disabled = false;
        btn.onclick = () => onFinish(correct ? 1 : 0, 1);
    });
}

export { renderSpotBug };