
export function renderArchitectureSim(lessonData, onComplete) {
    lessonData = lessonData || {};
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
                    <p style="font-size: 11px; color: var(--text-dim); margin-bottom: 8px;">Scale: 1/8" = 1'-0"</p>
                    <button id="sim-submit-btn" class="b-enroll-btn" style="width: 100%; cursor: pointer;">Submit Design</button>
                    <button id="sim-clear-btn" class="danger-btn" style="width: 100%; margin-top: 8px; cursor: pointer;">Clear Draft</button>
                </div>
            </div>
            <div style="flex-grow: 1; display: flex; align-items: center; justify-content: center; background: var(--surface-dim); padding: 40px;">
                <canvas id="drafting-canvas" width="800" height="600" style="background: #ffffff; border: 1px solid var(--border); cursor: crosshair; box-shadow: 5px 5px 0px rgba(0,0,0,0.1);"></canvas>
            </div>

        </div>
    `;
    const canvas = document.getElementById("drafting-canvas");
    const ctx = canvas.getContext("2d");
    const PIXELS_PER_FOOT = 12;
    const SNAP_GRID = 12;

    let lines = [];
    let isDrawing = false;
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let currentY = 0;

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

    function detectRoom(drawnLines) {
        if (drawnLines.length < 3) return null;

        const adj = {};
        const addEdge = (p1, p2) => {
            const k1 = p1.x + "," + p1.y;
            const k2 = p2.x + "," + p2.y;
            if (k1 === k2) return;
            if (!adj[k1]) adj[k1] = {point:p1, neighbors: new Set()};
            if (!adj[k2]) adj[k2] = {point:p2, neighbors: new Set()};
            adj[k1].neighbors.add(k2);
            adj[k2].neighbors.add(k1);
        };

        drawnLines.forEach(l => addEdge({x:l.x1, y:l.y1}, {x:l.x2, y:l.y2}));

        const keys = Object.keys(adj);
        if (keys.length === 0) return null;

        for (let k of keys) {
            if (adj[k].neighbors.size !== 2) return null;
        }

        const vertices = [];
        let currKey = keys[0];
        let prevKey = null;

        for (let i = 0; i < keys.length; i++) {
            vertices.push(adj[currKey].point);

            let nextKey = null;
            for (let neighbor of adj[currKey].neighbors) {
                if (neighbor !== prevKey) {
                    nextKey = neighbor;
                    break;
                }
            }

            if (!nextKey) return null;
            prevKey = currKey;
            currKey = nextKey;
        }

        if (vertices.length !== keys.length) return null;
        return vertices;
    }

    function calculateArea(vertices) {
        let area = 0;
        for (let i = 0; i < vertices.length; i++) {
            const j = (i + 1) % vertices.length;
            area += vertices[i].x * vertices[j].y;
            area -= vertices[j].x * vertices[i].y;
        }
        area = Math.abs(area)/2;
        return Math.round(area / (PIXELS_PER_FOOT * PIXELS_PER_FOOT));
    }

    function drawMeasuredLine(x1, y1, x2, y2, color) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const distancePx = Math.hypot(dx, dy);
        const distanceFt = Math.round(distancePx / PIXELS_PER_FOOT);

        if (distancePx === 0) return;

        const uX = dx / distancePx;
        const uY = dy / distancePx;

        const midX = x1 + dx/2;
        const midY = y1 + dy/2;

        ctx.font = "bold 10px Monospace";
        const text = distanceFt > 0 ? `${distanceFt}'` : "";
        const textWidth = distanceFt > 0 ? ctx.measureText(text).width : 0;
        const clearance = (textWidth / 2) + 6;
        const fade = 20;

        ctx.textAlign = "center";
        ctx.baseline = "center";

        if (distancePx > (clearance + 20) * 2) {
            let r = 0, g = 0, b = 0;
            if (color.length === 4) {
                r = parseInt(color[1]+color[1], 16);
                g = parseInt(color[2]+color[2], 16);
                b = parseInt(color[3]+color[3], 16);
            } else if (color.length === 7) {
                r = parseInt(color[1]+color[2], 16);
                g = parseInt(color[3]+color[4], 16);
                b = parseInt(color[5]+color[6], 16);
            }
            const transparent = `rgba(${r}, ${g}, ${b}, 0)`;

            const grad = ctx.createLinearGradient(x1, y1, x2, y2);
            const stop1 = (distancePx / 2 - clearance - fade) / distancePx;
            const stop2 = (distancePx / 2 - clearance) / distancePx;
            const stop3 = (distancePx / 2 + clearance) / distancePx;
            const stop4 = (distancePx / 2 + clearance + fade) / distancePx;

            grad.addColorStop(0, color);
            grad.addColorStop(Math.max(0, stop1), color);
            grad.addColorStop(Math.max(0, stop2), transparent);
            grad.addColorStop(Math.min(1, stop3), transparent);
            grad.addColorStop(Math.min(1, stop4), color);
            grad.addColorStop(1, color);

            ctx.strokeStyle = grad;
        } else {
            ctx.strokeStyle = color;
        }

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        const tickSize = 3;
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(x1 - uY * tickSize, y1 + uX * tickSize);
        ctx.lineTo(x1 + uY * tickSize, y1 - uX * tickSize);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x2 - uY * tickSize, y2 + uX * tickSize);
        ctx.lineTo(x2 + uY * tickSize, y2 - uX * tickSize);
        ctx.stroke();

        if (distancePx > (clearance + 20) * 2) {
            ctx.save();
            ctx.translate(midX, midY);

            let angle = Math.atan2(dy, dx);
            if (angle > Math.PI /2 || angle < -Math.PI /2) {
                angle += Math.PI;
            }

            ctx.rotate(angle);
            ctx.fillStyle = color;
            ctx.fillText(text, 0, 2.5);

            ctx.restore();
        }
    }

    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "#e0e0e0";
        ctx.lineWidth = 1;
        for(let i = 0; i < canvas.width; i += SNAP_GRID) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, canvas.height);
            ctx.stroke();
        }
        for(let i = 0; i < canvas.height; i += SNAP_GRID) {
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(canvas.width, i);
            ctx.stroke();
        }

        const roomVertices = detectRoom(lines);
        if (roomVertices) {
            ctx.beginPath();
            ctx.moveTo(roomVertices[0].x, roomVertices[0].y);
            roomVertices.forEach(p => ctx.lineTo(p.x, p.y));
            ctx.closePath();

            ctx.fillStyle = "rgba(119, 187, 162, 0.2)";
            ctx.fill();

            const xs = roomVertices.map(p => p.x);
            const ys = roomVertices.map(p => p.y);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);

            const sqFt = calculateArea(roomVertices);

            const centerX = minX + (maxX - minX) / 2;
            const centerY = minY + (maxY - minY) / 2;

            ctx.fillStyle = "#fff";
            ctx.beginPath();
            ctx.roundRect(centerX - 45, centerY - 15, 90, 30, 8);
            ctx.fill();
            ctx.strokeStyle = "#77BBA2";
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.fillStyle = "#3b6a5a";
            ctx.font = "bold 14px monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(`${sqFt} sq ft`, centerX, centerY);
        }

        ctx.lineWidth = 2;
        ctx.lineCap = "round";

        lines.forEach(l => {
            drawMeasuredLine(l.x1, l.y1, l.x2, l.y2, "#000");
        });

        if (isDrawing) {
            drawMeasuredLine(startX, startY, currentX, currentY, "#77BBA2");
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
    });

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
