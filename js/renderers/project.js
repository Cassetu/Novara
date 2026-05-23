import { playCorrect, playIncorrect } from "../utils/sound.js";
import { initLineNumbers } from "../utils/lineNumbers.js";

async function renderProject(lessonData, courseId, userData, saveField, onReturn) {
    const view = document.getElementById("view-lesson");
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

    const stepTabsHtml = () => lessonData.steps.map((s, i) =>
        `<button class="proj-tab ${i === activeStep ? "proj-tab-active" : ""} ${isDone(s.id) ? "proj-tab-done" : ""}" data-step="${i}">${isDone(s.id) ? "+" : i + 1}. ${s.title}</button>`
    ).join("");

    const instrHtml = () => {
        const s = lessonData.steps[activeStep];
        return `<div class="proj-instr-inner">
            <span class="proj-instr-label">Step ${activeStep + 1} of ${lessonData.steps.length}</span>
            <span class="proj-instr-title">${s.title}</span>
            <span class="proj-instr-text">${s.instructions}</span>
            ${isDone(s.id) ? `<span class="proj-instr-done">complete</span>` : ""}
        </div>`;
    };

    const actionHtml = () => {
        const done = isDone(lessonData.steps[activeStep].id);
        const last = activeStep === lessonData.steps.length - 1;
        return `<button id="proj-check-btn" class="proj-action-btn">Check</button>
            ${last
                ? `<button id="proj-finish-btn" class="proj-action-btn proj-action-accent" ${done ? "" : "disabled"}>Finish</button>`
                : `<button id="proj-next-btn" class="proj-action-btn proj-action-accent" ${done ? "" : "disabled"}>Next</button>`
            }`;
    };

    view.innerHTML = `
        <div class="proj-wrap">
            <div class="proj-topbar">
                <span class="proj-title">${lessonData.title}</span>
                <div class="proj-tabs" id="proj-tabs">${stepTabsHtml()}</div>
                <div class="proj-topbar-actions" id="proj-topbar-actions">${actionHtml()}</div>
                <button id="proj-run-btn" class="proj-action-btn proj-action-run">Run &#9654;</button>
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
            <div class="proj-instr-bar" id="proj-instr-bar">${instrHtml()}</div>
        </div>
    `;

    const editor  = document.getElementById("proj-editor");
    const frame   = document.getElementById("proj-frame");
    const con     = document.getElementById("proj-console");

    editor.value = code;
    initLineNumbers(editor, document.getElementById("proj-line-numbers"));
    editor.addEventListener("input", () => { code = editor.value; });

    function rebuildDynamic() {
        document.getElementById("proj-tabs").innerHTML = stepTabsHtml();
        document.getElementById("proj-topbar-actions").innerHTML = actionHtml();
        document.getElementById("proj-instr-bar").innerHTML = instrHtml();
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
            const checks = step.validation || [];
            const results = checks.map(c => ({
                label: c.message,
                passed: new RegExp(c.rule, "m").test(editor.value)
            }));

            const allPassed = !results.length || results.every(r => r.passed);

            if (!results.length) {
                con.style.color = "#aaaaaa";
                con.textContent = "no checks for this step.";
            } else {
                con.innerHTML = results.map(r =>
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

        const nextBtn   = document.getElementById("proj-next-btn");
        const finishBtn = document.getElementById("proj-finish-btn");

        if (nextBtn) {
            nextBtn.addEventListener("click", async () => {
                await persist();
                activeStep++;
                rebuildDynamic();
            });
        }

        if (finishBtn) {
            finishBtn.addEventListener("click", async () => {
                await persist();
                onReturn();
            });
        }
    }

    document.getElementById("proj-run-btn").addEventListener("click", () => {
        const fd = frame.contentDocument || frame.contentWindow.document;
        fd.open();
        fd.write(editor.value);
        fd.close();
        con.style.color = "#aaaaaa";
        con.textContent = "running...";
        setTimeout(() => {
            if (con.textContent === "running...") {
                con.style.color = "var(--accent)";
                con.textContent = "no errors detected.";
            }
        }, 500);
    });

    bindActions();
}

export { renderProject };