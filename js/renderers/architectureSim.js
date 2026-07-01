
export function renderArchitectureSim() {
    const viewLesson = document.getElementById("view-lesson");
    viewLesson.innerHTML = `
        <div style="display: flex; height: 100vh; font-family: monospace; color: var(--text-main);">
            <div style="width: 300px; padding: 20px; border-right: 2px solid var(--border); display: flex; flex-direction: column;">
                <h2>${lessonData.title || "Studio Brief"}</h2>
                <div style="flex-grow: 1; margin-top: 20px;">
                    <p style="text-transform: uppercase; letter-spacing: 1px; font-size: 11px; color: var(--text-dim);">Objective</p>
                    <ul style="padding-left: 20px; line-height: 1.5; font-size: 14px;">
                        ${(lessonData.briefPoints || ["Draw a basic room footprint.", "Close the shape.", "Submit when done."]).map(p => `<li>${p}</li>`).join("")}
                    </ul>
                </div>
                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px dashed var(--border);">
                    <p style="font-size: 11px; color: var(--text-dim); margin-bottom: 8px;">Scale: 1/16" = 1'-0"</p>
                    <button id="sim-submit-btn" class="b-enroll-btn" style="width: 100%; cursor: pointer;">Submit Design</button>
                    <button id="sim-clear-btn" class="danger-btn" style="width: 100%; margin-top: 8px; cursor: pointer;">Clear Draft</button>
                </div>
            </div>
            <div style="flex-grow: 1; display: flex; align-items: center; justify-content: center; background: var(--surface-dim); padding: 40px;">
                <canvas id="drafting-canvas" width="800" height="600" style="background: #ffffff; border: 1px solid var(--border); cursor: crosshair; box-shadow: 5px 5px 0px rgba(0,0,0,0.1);"></canvas>
            </div>

        </div>
    `;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const PIXELS_PER_FOOT = 6;
    const SNAP_GRID = 6;

    let lines = [];
    let isDrawing = false;
    let startX = 0, let startY = 0;
    let currentX = 0, let currentY = 0;

    function getMousePos(e) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    function snap(val) {
        return Math.round(val / SNAP_GRID) * SNAP_GRID;
    }

    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "#e0e0e0";
        ctx.lineWidth = 1;
        for(let i = 0; i < canvas.width; i += SNAP_GRID * 2) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, canvas.height);
            ctx.stroke();
        }
        for(let i = 0; i < canvas.height; i += SNAP_GRID * 2) {
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(canvas.width, i);
            ctx.stroke();
        }

        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        lines.forEach(l => {
            ctx.beginPath();
            ctx.moveTo(l.x1, l.y1);
            ctx.lineTo(l.x2, l.y2);
            ctx.stroke();
        });
        if (isDrawing) {
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(currentX, currentY);
            ctx.stroke();

            const dx = currentX - startX;
            const dy = currentY - startY;
            const distancePx = Math.hypot(dx, dy);
            const distanceFt = Math.round(distancePx / PIXELS_PER_FOOT);

            if (distanceFt > 0) {
                const midX = startX + (dx / 2);
                const midY = startY + (dy / 2) - 10;
                ctx.fillStyle = "#000";
                ctx.font = "bold 12px Monospace";
                ctx.fillText(`${distanceFt}'`, midX, midY);
            }
        }
    }

    canvas.addEventListener("mousedown", (e) => {
        const pos = getMousePos(e);
        startX = snap(pos.x);
        startY = snap(pos.y);
        currentX = startX;
        currentY = startY;
        isDrawing = true;
    });

    canvas.addEventListener("mousemove", (e) => {
        if (!isDrawing) return;
        const pos = getMousePos(e);

        if (e.shiftKey) {
            const dx = Math.abs(pos.x - startX);
            const dy = Math.abs(pos.y - startY);
            if (dx > dy) {
                currentX = snap(pos.x);
                currentY = startY;
            } else {
                currentX = startX;
                currentY = snap(pos.y);
            }
        } else {
            currentX = snap(pos.x);
            currentY = snap(pos.y);
        }

        render();
    });

    canvas.addEventListener("mouseup", (e) => {
        if (!isDrawing) return;
        isDrawing = false;
        if (startX !== currentX || startY !== currentY) {
            lines.push({ x1: startX, y1: startY, x2: currentX, y2: currentY });
        }
        render();
    }

    canvas.addEventListener("mouseleave", () => {
        if (isDrawing) {
            isDrawing = false;
            render();
        }
    });

    document.getElementById("sim-clear-btn").addEventListener("click", () => {
        lines = [];
        render();
    });
    document.getElementById("sim-submit-btn").addEventListener("click", () => {
        onComplete(true);
    });

    render();
}
