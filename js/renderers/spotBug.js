import { playCorrect, playIncorrect } from "../utils/sound.js";

function renderSpotBug(lessonData, onFinish) {
    const view = document.getElementById("view-lesson");
    let selected = null;
    let submitted = false;

    const linesHtml = lessonData.code.split("\n").map((line, i) => {
        const n = i + 1;
        const safe = line.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        return `<div class="sb-line" data-line="${n}"><span class="sb-num">${n}</span><span class="sb-code">${safe || " "}</span></div>`;
    }).join("");

    view.innerHTML = `
        <div class="lesson-workspace" style="max-width:800px;">
            <h2>${lessonData.title}</h2>
            <p style="margin-bottom:16px;font-size:15px;">${lessonData.prompt || "Click the line that contains the bug."}</p>
            <div class="sb-hint">Click a line to select it, then submit.</div>
            <div class="sb-code-block">${linesHtml}</div>
            <div id="sb-feedback" class="explanation-box" style="display:none;"></div>
            <div class="lesson-footer">
                <div class="progress-dots"><div class="p-dot active"></div></div>
                <button id="sb-btn" disabled>Submit</button>
            </div>
        </div>
    `;

    view.querySelectorAll(".sb-line").forEach(el => {
        el.addEventListener("click", () => {
            if (submitted) return;
            view.querySelectorAll(".sb-line").forEach(l => l.classList.remove("sb-selected"));
            el.classList.add("sb-selected");
            selected = parseInt(el.dataset.line);
            document.getElementById("sb-btn").disabled = false;
        });
    });

    document.getElementById("sb-btn").addEventListener("click", () => {
        if (submitted || selected === null) return;
        submitted = true;

        const ok = selected === lessonData.bugLine;

        view.querySelectorAll(".sb-line").forEach(el => {
            const ln = parseInt(el.dataset.line);
            if (ln === lessonData.bugLine) el.classList.add("sb-reveal-correct");
            else if (ln === selected && !ok) el.classList.add("sb-reveal-wrong");
        });

        const fb = document.getElementById("sb-feedback");
        fb.style.display = "block";
        fb.innerHTML = `<strong>${ok ? "Found it." : "Wrong line. Bug was on line " + lessonData.bugLine + "."}</strong>${lessonData.explanation ? " " + lessonData.explanation : ""}`;

        ok ? playCorrect() : playIncorrect();

        const dot = view.querySelector(".p-dot");
        if (dot) { dot.classList.remove("active"); dot.classList.add(ok ? "correct" : "incorrect"); }

        const btn = document.getElementById("sb-btn");
        btn.innerText = "Continue";
        btn.disabled = false;
        btn.onclick = () => onFinish(ok ? 1 : 0, 1);
    });
}

export { renderSpotBug };