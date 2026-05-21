import { playCorrect, playIncorrect } from "../utils/sound.js";
import { initLineNumbers } from "../utils/lineNumbers.js";

async function renderProject(lessonData, courseId, userData, saveField, onReturn) {
    const lessonView = document.getElementById("view-lesson");

    const saved = userData.projectProgress?.[courseId] || {};
    let code = saved.code || lessonData.initialCode || "";
    let completedSteps = saved.completedSteps || [];
    let activeStep = 0;

    const isDone = id => completedSteps.includes(id);

    async function persist() {
        if (!userData.projectProgress) userData.projectProgress = {};
        userData.projectProgress[courseId] = {
            code: document.getElementById("proj-editor")?.value || code,
            completedSteps
        };
        await saveField("projectProgress", userData.projectProgress);
    }

    function stepTabsHtml() {
        return lessonData.steps.map((s, i) => {
            const done = isDone(s.id);
            const active = i === activeStep;
            return `<button class="proj-tab ${active ? "proj-tab-active" : ""} ${done ? "proj-tab-done" : ""}" data-step="${i}">${done ? "+" : i + 1}. ${s.title}</button>`;
        }).join("");
    }

    function instructionsHtml() {
        const step = lessonData.steps[activeStep];
        const done = isDone(step.id);
        return `
            <div class="proj-instr-inner">
                <span class="proj-instr-label">Step ${activeStep + 1} of ${lessonData.steps.length}</span>
                <span class="proj-instr-title">${step.title}</span>
                <span class="proj-instr-text">${step.instructions}</span>
                ${done ? `<span class="proj-instr-done">complete</span>` : ""}
            </div>
        `;
    }

    function actionBtnsHtml() {
        const step = lessonData.steps[activeStep];
        const done = isDone(step.id);
        const isLast = activeStep === lessonData.steps.length - 1;
        return `
            <button id="proj-check-btn" class="proj-action-btn">Check</button>
            ${isLast
                ? `<button id="proj-finish-btn" class="proj-action-btn proj-action-accent" ${done ? "" : "disabled"}>Finish</button>`
                : `<button id="proj-next-btn" class="proj-action-btn proj-action-accent" ${done ? "" : "disabled"}>Next</button>`
            }
        `;
    }

    lessonView.innerHTML = `
        <div class="proj-wrap">
            <div class="proj-topbar">
                <span class="proj-title">${lessonData.title}</span>
                <div class="proj-tabs" id="proj-tabs">${stepTabsHtml()}</div>
                <div class="proj-topbar-actions" id="proj-topbar-actions">${actionBtnsHtml()}</div>
                <button id="proj-run-btn" class="proj-action-btn proj-action-run">Run ▶</button>
            </div>

            <div class="proj-body">
                <div class="proj-editor-col">
                    <div class="proj-editor-label">${lessonData.fileLabel || "index.html"}</div>
                    <div class="proj-editor-wrap">
                        <div id="proj-line-numbers" class="proj-line-numbers"></div>
                        <textarea id="proj-editor" class="proj-editor" spellcheck="false"></textarea>
                    </div>
                </div>

                <div class="proj-right-col">
                    <div class="proj-preview-label">Preview</div>
                    <iframe id="proj-frame" class="proj-frame"></iframe>
                    <div class="proj-console-label">Output</div>
                    <div id="proj-console" class="proj-console">ready.</div>
                </div>
            </div>

            <div class="proj-instr-bar" id="proj-instr-bar">${instructionsHtml()}</div>
        </div>
    `;

    const editor = document.getElementById("proj-editor");
    const lineNumbers = document.getElementById("proj-line-numbers");
    const frame = document.getElementById("proj-frame");
    const consoleEl = document.getElementById("proj-console");

    editor.value = code;
    initLineNumbers(editor, lineNumbers);
    editor.addEventListener("input", () => { code = editor.value; });

    function rebuildDynamic() {
        document.getElementById("proj-tabs").innerHTML = stepTabsHtml();
        document.getElementById("proj-topbar-actions").innerHTML = actionBtnsHtml();
        document.getElementById("proj-instr-bar").innerHTML = instructionsHtml();
        bindActions();
    }

    function bindActions() {
        document.querySelectorAll(".proj-tab").forEach(btn => {
            btn.addEventListener("click", () => {
                activeStep = parseInt(btn.dataset.step);
                rebuildDynamic();
            });
        });

        document.getElementById("proj-check-btn").addEventListener("click", async () => {
            const step = lessonData.steps[activeStep];
            const currentCode = editor.value;
            const results = [];
            let allPassed = true;

            for (const check of (step.validation || [])) {
                const passed = new RegExp(check.rule, "m").test(currentCode);
                results.push({ label: check.message, passed });
                if (!passed) allPassed = false;
            }

            if (!results.length) {
                consoleEl.style.color = "#aaaaaa";
                consoleEl.textContent = "no checks for this step.";
                allPassed = true;
            } else {
                consoleEl.innerHTML = results.map(r =>
                    `<div style="color:${r.passed ? "var(--accent)" : "#ff4444"}">${r.passed ? "+" : "x"} ${r.label}</div>`
                ).join("");
            }

            if (allPassed && !isDone(step.id)) {
                completedSteps.push(step.id);
                playCorrect();
                await persist();
                rebuildDynamic();
            } else if (!allPassed) {
                playIncorrect();
            }
        });

        const nextBtn = document.getElementById("proj-next-btn");
        if (nextBtn) {
            nextBtn.addEventListener("click", async () => {
                await persist();
                activeStep++;
                rebuildDynamic();
            });
        }

        const finishBtn = document.getElementById("proj-finish-btn");
        if (finishBtn) {
            finishBtn.addEventListener("click", async () => {
                await persist();
                onReturn();
            });
        }
    }

    document.getElementById("proj-run-btn").addEventListener("click", () => {
        const frameDoc = frame.contentDocument || frame.contentWindow.document;
        frameDoc.open();
        frameDoc.write(editor.value);
        frameDoc.close();
        consoleEl.style.color = "#aaaaaa";
        consoleEl.textContent = "running...";
        setTimeout(() => {
            if (consoleEl.textContent === "running...") {
                consoleEl.style.color = "var(--accent)";
                consoleEl.textContent = "no errors detected.";
            }
        }, 500);
    });

    bindActions();
}

export { renderProject };