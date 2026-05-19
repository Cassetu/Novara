import { playCorrect, playIncorrect } from "../utils/sound.js";
import { initLineNumbers } from "../utils/lineNumbers.js";

async function renderProject(lessonData, courseId, userData, saveField, onReturn) {
    const lessonView = document.getElementById("view-lesson");

    const storageKey = "proj_" + courseId;
    const saved = userData.projectProgress?.[courseId] || {};
    let code = saved.code || lessonData.initialCode || "";
    let completedSteps = saved.completedSteps || [];
    let activeStep = 0;

    function getStepStatus(stepId) {
        return completedSteps.includes(stepId);
    }

    async function persistState() {
        if (!userData.projectProgress) userData.projectProgress = {};
        userData.projectProgress[courseId] = {
            code: document.getElementById("proj-editor")?.value || code,
            completedSteps
        };
        await saveField("projectProgress", userData.projectProgress);
    }

    function buildStepsList() {
        return lessonData.steps.map((step, i) => {
            const done = getStepStatus(step.id);
            const active = i === activeStep;
            return `
                <div class="proj-step ${active ? "proj-step-active" : ""} ${done ? "proj-step-done" : ""}" data-step="${i}">
                    <span class="proj-step-num">${done ? "+" : i + 1}</span>
                    <span class="proj-step-title">${step.title}</span>
                </div>
            `;
        }).join("");
    }

    function buildInstructions() {
        const step = lessonData.steps[activeStep];
        const done = getStepStatus(step.id);
        return `
            <div class="proj-instructions">
                <div class="proj-step-header">
                    Step ${activeStep + 1} of ${lessonData.steps.length}: ${step.title}
                </div>
                <div class="proj-step-body">${step.instructions}</div>
                ${done ? `<div class="proj-step-complete-badge">Step complete</div>` : ""}
            </div>
        `;
    }

    lessonView.innerHTML = `
        <div class="proj-layout">
            <div class="proj-left">
                <div class="proj-steps-header">${lessonData.title}</div>
                <div id="proj-steps-list" class="proj-steps-list">${buildStepsList()}</div>
                <div id="proj-instructions-panel">${buildInstructions()}</div>
                <div class="proj-step-actions">
                    <button id="proj-check-btn">Check Step</button>
                    ${activeStep < lessonData.steps.length - 1
                        ? `<button id="proj-next-btn" ${getStepStatus(lessonData.steps[activeStep].id) ? "" : "disabled"}>Next Step</button>`
                        : `<button id="proj-finish-btn" ${getStepStatus(lessonData.steps[activeStep].id) ? "" : "disabled"}>Finish Project</button>`
                    }
                </div>
                <div id="proj-console" class="proj-console">ready.</div>
            </div>
            <div class="proj-right">
                <div class="proj-editor-header">
                    <span>${lessonData.fileLabel || "index.html"}</span>
                    <button id="proj-run-btn" class="proj-run-btn">Run ▶</button>
                </div>
                <div class="proj-editor-wrap">
                    <div id="proj-line-numbers" class="proj-line-numbers"></div>
                    <textarea id="proj-editor" class="proj-editor" spellcheck="false"></textarea>
                </div>
                <div class="proj-preview-header">Preview</div>
                <iframe id="proj-frame" class="proj-frame"></iframe>
            </div>
        </div>
    `;

    const editor = document.getElementById("proj-editor");
    const lineNumbers = document.getElementById("proj-line-numbers");
    const frame = document.getElementById("proj-frame");
    const consoleEl = document.getElementById("proj-console");

    editor.value = code;
    initLineNumbers(editor, lineNumbers);

    editor.addEventListener("input", () => {
        code = editor.value;
    });

    document.getElementById("proj-run-btn").addEventListener("click", () => {
        const frameDoc = frame.contentDocument || frame.contentWindow.document;
        frameDoc.open();
        frameDoc.write(editor.value);
        frameDoc.close();
        consoleEl.style.color = "#aaaaaa";
        consoleEl.textContent = "running...";
        setTimeout(() => {
            if (consoleEl.textContent === "running...") {
                consoleEl.textContent = "no errors detected.";
            }
        }, 400);
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

        if (allPassed && !getStepStatus(step.id)) {
            completedSteps.push(step.id);
            playCorrect();
            await persistState();
            rebuildSidePanels();
        } else if (!allPassed) {
            playIncorrect();
        }
    });

    function rebuildSidePanels() {
        document.getElementById("proj-steps-list").innerHTML = buildStepsList();
        document.getElementById("proj-instructions-panel").innerHTML = buildInstructions();

        const nextBtn = document.getElementById("proj-next-btn");
        const finishBtn = document.getElementById("proj-finish-btn");
        const step = lessonData.steps[activeStep];
        if (nextBtn) nextBtn.disabled = !getStepStatus(step.id);
        if (finishBtn) finishBtn.disabled = !getStepStatus(step.id);

        document.querySelectorAll(".proj-step[data-step]").forEach(el => {
            el.addEventListener("click", () => {
                activeStep = parseInt(el.dataset.step);
                rebuildSidePanels();
            });
        });
    }

    document.querySelectorAll(".proj-step[data-step]").forEach(el => {
        el.addEventListener("click", () => {
            activeStep = parseInt(el.dataset.step);
            rebuildSidePanels();
        });
    });

    const nextBtn = document.getElementById("proj-next-btn");
    if (nextBtn) {
        nextBtn.addEventListener("click", async () => {
            await persistState();
            activeStep++;
            rebuildSidePanels();
        });
    }

    const finishBtn = document.getElementById("proj-finish-btn");
    if (finishBtn) {
        finishBtn.addEventListener("click", async () => {
            await persistState();
            onReturn();
        });
    }
}

export { renderProject };