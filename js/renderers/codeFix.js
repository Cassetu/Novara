import { playCorrect, playIncorrect } from "../utils/sound.js";
import { initLineNumbers } from "../utils/lineNumbers.js";

function renderCodeFix(lessonData, onFinish) {
    const lessonView = document.getElementById("view-lesson");

    lessonView.innerHTML = `
        <div class="lesson-workspace" style="max-width:100%;padding-bottom:40px;">
            <div id="course-header">
                <span>SYS.MODULE</span>
                <span>DIAGNOSTIC PROTOCOL</span>
            </div>
            <div id="module-content" style="margin-bottom:20px;">
                <h3>${lessonData.title}</h3>
                <p style="text-transform:none;">${lessonData.prompt}</p>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;height:520px;">
                <div style="display:flex;flex-direction:column;height:100%;">
                    <div class="preview-label">Editor</div>
                    <div style="display:flex;flex:1;border:3px solid var(--border);box-shadow:4px 4px 0px var(--accent);overflow:hidden;">
                        <div id="line-numbers" style="background:#1a1a1a;color:#555;font-family:monospace;font-size:13px;line-height:1.6;padding:14px 10px;text-align:right;user-select:none;min-width:40px;overflow-y:hidden;overflow-x:hidden;white-space:pre;pointer-events:none;"></div>
                        <textarea id="fix-editor" class="challenge-editor" spellcheck="false" style="flex:1;border:none;box-shadow:none;font-size:13px;line-height:1.6;padding:14px;resize:none;white-space:pre;overflow-x:auto;overflow-y:auto;overflow-wrap:normal;word-wrap:normal;"></textarea>
                    </div>
                    <div style="display:flex;gap:10px;margin-top:12px;">
                        <button id="run-code-btn" style="background:var(--border);color:var(--surface);flex:1;">RUN DIAGNOSTIC ↗</button>
                        <button id="lesson-action-btn" disabled style="flex:1;">SUBMIT FIX</button>
                    </div>
                </div>
                <div style="display:flex;flex-direction:column;height:100%;gap:12px;">
                    <div style="flex:1;display:flex;flex-direction:column;">
                        <div class="preview-label">Live Output</div>
                        <iframe id="preview-frame" class="preview-frame" style="flex:1;box-shadow:4px 4px 0px var(--border);"></iframe>
                    </div>
                    <div style="flex:0 0 160px;display:flex;flex-direction:column;">
                        <div class="preview-label">Console</div>
                        <div id="fix-console" style="flex:1;background:var(--void);color:#aaaaaa;font-family:monospace;font-size:13px;padding:14px;border:3px solid var(--border);overflow-y:auto;white-space:pre-wrap;line-height:1.6;box-shadow:4px 4px 0px var(--border);">ready.</div>
                    </div>
                </div>
            </div>
        </div>
    `;

    const editor = document.getElementById("fix-editor");
    const lineNumbers = document.getElementById("line-numbers");
    const frame = document.getElementById("preview-frame");
    const submitBtn = document.getElementById("lesson-action-btn");
    const consoleBox = document.getElementById("fix-console");
    const runBtn = document.getElementById("run-code-btn");

    editor.value = lessonData.initialCode;
    initLineNumbers(editor, lineNumbers);

    runBtn.addEventListener("click", () => {
        const code = editor.value;
        consoleBox.style.color = "#aaaaaa";
        consoleBox.textContent = "running...";

        const errorInterceptor = `
            <script>
                window.onerror = function(msg, src, line, col) {
                    const box = window.parent.document.getElementById('fix-console');
                    if (!box) return true;
                    box.style.color = '#ff4444';
                    box.textContent = 'line ' + line + ': ' + msg;
                    return true;
                };
                const _log = console.log;
                console.log = function(...args) {
                    const box = window.parent.document.getElementById('fix-console');
                    if (box) { box.style.color = '#77BBA2'; box.textContent = args.join(' '); }
                    _log.apply(console, args);
                };
            <\/script>
        `;

        const injected = code.replace(/(<script\b[^>]*>)/i, `$1${errorInterceptor}`);
        const frameDoc = frame.contentDocument || frame.contentWindow.document;
        frameDoc.open();
        frameDoc.write(injected.includes("<script") ? injected : errorInterceptor + injected);
        frameDoc.close();

        setTimeout(() => {
            const box = document.getElementById("fix-console");
            if (box && box.textContent === "running...") {
                box.style.color = "#77BBA2";
                box.textContent = "no errors.";
            }
        }, 500);

        if (lessonData.targetFix && code.includes(lessonData.targetFix)) {
            submitBtn.disabled = false;
            submitBtn.style.backgroundColor = "var(--accent)";
            submitBtn.style.color = "#ffffff";
            playCorrect();
        } else {
            submitBtn.disabled = true;
            submitBtn.style.backgroundColor = "";
            submitBtn.style.color = "";
            playIncorrect();
        }
    });

    submitBtn.addEventListener("click", () => onFinish());
}

export { renderCodeFix };