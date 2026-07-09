
export function renderArchitectureSim(lessonData, onComplete) {
    lessonData = lessonData || {};
    const viewLesson = document.getElementById("view-lesson");
    viewLesson.innerHTML = `
        <style>
            .arch-tool-btn {
                width: 44px; height: 44px;
                background: #1e1e1e;
                border: 2px solid #333;
                cursor: pointer;
                padding: 6px;
                transition: all 0.2s ease;
                display: flex; justify-content: center; align-items: center;
            }
            .arch-tool-btn img, .arch-tool-btn svg {
                width: 100%; height: 100%;
                object-fit: contain;
            }
            .arch-tool-btn:hover {
                background: #2a2a2a;
                border-color: #77BBA2;
            }
            .arch-tool-btn.active {
                background: #77BBA2;
                border-color: #559980;
            }
        </style>

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
                    <button id="sim-submit-btn" class="b-enroll-btn" style="width: 100%; cursor: pointer;">Submit Design</button>
                </div>
            </div>

            <div style="width: 70px; background: #1a1a1a; border-right: 2px solid var(--border); display: flex; flex-direction: column; align-items: center; padding: 20px 0; gap: 15px;">
                <button id="tool-draw" class="arch-tool-btn active" title="Draw Tool (D)">
                    <img src="assets/icon/pen.svg" alt="Draw">
                </button>
                <button id="tool-rect" class="arch-tool-btn" title="Rectangle Tool (R)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
                </button>
                <button id="tool-erase" class="arch-tool-btn" title="Eraser Tool (E)">
                    <img src="assets/icon/eraser.svg" alt="Erase">
                </button>
                <div style="flex-grow: 1;"></div>
                <button id="tool-clear" class="arch-tool-btn" title="Clear Canvas">
                    <img src="assets/icon/trash-can.svg" alt="Clear">
                </button>
            </div>
            <div style="flex-grow: 1; display: flex; align-items: center; justify-content: center; background: var(--surface-dim); position: relative;">
                <canvas id="drafting-canvas" width="950" height="694" style="background: #ffffff; border: 1px solid var(--border); cursor: crosshair; box-shadow: 5px 5px 0px rgba(0,0,0,0.1);"></canvas>
                <div id="drawing-hud" style="display: none; position: absolute; bottom: 20px; left: 20px; background: rgba(0,0,0,0.75); color: #fff; padding: 10px 16px; font-size: 14px; font-weight: bold; pointer-events: none; z-index: 50; box-shadow: 0 4px 12px rgba(0,0,0,0.15);"></div>
                <div id="clear-confirm-modal" style="display: none; position: absolute; background: white; padding: 20px 30px; border: 2px solid var(--border); box-shadow: 0 10px 30px rgba(0,0,0,0.2); text-align: center; color: black; z-index: 100;">
                    <h3 style="margin-top: 0; color: #e74c3c;">Clear Canvas</h3>
                    <p style="margin-bottom: 20px; font-size: 14px;">Are you sure?</p>
                    <div style="display: flex; gap: 10px; justify-content: center;">
                        <button id="confirm-clear-yes" class="danger-btn" style="padding: 8px 16px; cursor: pointer; background: #e74c3c; color: white; border: none;">Yes, demolish</button>
                        <button id="confirm-clear-no" style="padding: 8px 16px; cursor: pointer; background: #ddd; color: black; border: none;">Cancel</button>
                    </div>
                </div>
            </div>
            <div style="width: 80px; background: #1a1a1a; border-left: 2px solid var(--border); display: flex; flex-direction: column; align-items: center; padding: 20px 0; justify-content: space-between;">
                <button id="tool-house" class="arch-tool-btn" title="Architecture Elements">
                    <img src="assets/icon/house.svg" alt="House">
                </button>
                <div style="color: #888; font-size: 11px; text-align: center; padding-bottom: 10px; line-height: 1.5;">
                    SCALE<br><strong style="color: white; font-size: 14px;">1/8"</strong><br>↓<br><strong style="color: white; font-size: 14px;">1'-0"</strong>
                </div>
            </div>
        </div>
    `;
    const canvas = document.getElementById("drafting-canvas");
    const ctx = canvas.getContext("2d");
    const hud = document.getElementById("drawing-hud");
    const PIXELS_PER_FOOT = 12;
    const SNAP_GRID = 12;

    let lines = [];
    let mode = "draw";
    let isDrawing = false;
    let isErasing = false;
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

    function pointToLineDist(px, py, x1, y1, x2, y2) {
        const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
        if (l2 === 0) return Math.hypot(px - x1, py - y1);
        let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
    }

    function eraseAt(x, y) {
        const initialLen = lines.length;
        lines = lines.filter(l => pointToLineDist(x, y, l.x1, l.y1, l.x2, l.y2) > 10);
        if (lines.length !== initialLen) render();
    }

    function extractRooms(drawnLines) {
        if (drawnLines.length < 3) return [];

        const segments = [];
        drawnLines.forEach(l => {
            const splits = [];
            drawnLines.forEach(other => {
                [ {x: other.x1, y: other.y1}, {x: other.x2, y: other.y2} ].forEach(p => {
                    const distToStart = Math.hypot(p.x - l.x1, p.y - l.y1);
                    const distToEnd = Math.hypot(p.x - l.x2, p.y - l.y2);
                    const lineLen = Math.hypot(l.x2 - l.x1, l.y2 - l.y1);
                    if (Math.abs(distToStart + distToEnd - lineLen) < 1) {
                        splits.push(p);
                    }
                });
            });
            splits.sort((a, b) => Math.hypot(a.x - l.x1, a.y - l.y1) - Math.hypot(b.x - l.x1, b.y - l.y1));

            let curr = { x: l.x1, y: l.y1 };
            splits.forEach(pt => {
                if (Math.hypot(curr.x - pt.x, curr.y - pt.y) > 2) {
                    segments.push({x1: curr.x, y1: curr.y, x2: pt.x, y2: pt.y});
                    curr = pt;
                }
            });
            if (Math.hypot(curr.x - l.x2, curr.y - l.y2) > 2) {
                segments.push({x1: curr.x, y1: curr.y, x2: l.x2, y2: l.y2});
            }
        });

        const adj = {};
        const getK = (x, y) => `${Math.round(x)},${Math.round(y)}`;

        segments.forEach(l => {
            const k1 = getK(l.x1, l.y1);
            const k2 = getK(l.x2, l.y2);
            if (k1 === k2) return;

            if (!adj[k1]) adj[k1] = { x: l.x1, y: l.y1, neighbors: [] };
            if (!adj[k2]) adj[k2] = { x: l.x2, y: l.y2, neighbors: [] };

            if (!adj[k1].neighbors.includes(k2)) adj[k1].neighbors.push(k2);
            if (!adj[k2].neighbors.includes(k1)) adj[k2].neighbors.push(k1);
        });

        for (let k in adj) {
            const node = adj[k];
            node.neighbors.sort((a, b) => {
                return Math.atan2(adj[a].y - node.y, adj[a].x - node.x) - Math.atan2(adj[b].y - node.y, adj[b].x - node.x);
            });
        }

        const edgesTraversed = new Set();
        const rooms = [];

        for (let k in adj) {
            const node = adj[k];
            for (let i = 0; i < node.neighbors.length; i++) {
                const startK = k;
                const nextK = node.neighbors[i];
                if (edgesTraversed.has(`${startK}->${nextK}`)) continue;

                let currK = startK
                let stepK = nextK;
                const faceVertices = [];
                let valid = true;

                while (true) {
                    edgesTraversed.add(`${currK}->${stepK}`);
                    faceVertices.push(adj[currK]);

                    if (stepK === startK) break;
                    if (faceVertices.length > Object.keys(adj).length) { valid = false; break; }

                    const stepNode = adj[stepK];
                    const incomingIdx = stepNode.neighbors.indexOf(currK);
                    let nextIdx = incomingIdx - 1;
                    if (nextIdx < 0) {
                        nextIdx = stepNode.neighbors.length - 1;
                    }

                    currK = stepK;
                    stepK = stepNode.neighbors[nextIdx];
                }

                if (valid && faceVertices.length >= 3) {
                    let area = 0;
                    for (let v = 0; v < faceVertices.length; v++) {
                        const nextV = (v + 1) % faceVertices.length;
                        area += (faceVertices[v].x * faceVertices[nextV].y) - (faceVertices[nextV].x * faceVertices[v].y);
                    }
                    if (area > 0) rooms.push(faceVertices);
                }
            }
        }
        return rooms;
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

    function drawWall(x1, y1, x2, y2, color) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 6;
        ctx.lineCap = "square";
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }

    function drawDimension(x1, y1, x2, y2, offset) {
        const isHoriz = Math.abs(x2 - x1) > Math.abs(y2 - y1);
        let ox1 = x1, oy1 = y1, ox2 = x2, oy2 = y2;
        if (isHoriz) { oy1 += offset; oy2 += offset; }
        else { ox1 += offset; ox2 += offset; }

        const dx = ox2 - ox1;
        const dy = oy2 - oy1;
        const distFt = Math.round(Math.hypot(dx, dy) / PIXELS_PER_FOOT);
        if (distFt <= 0) return;

        ctx.strokeStyle = "rgba(136, 136, 136, 0.4)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x1, y1); ctx.lineTo(ox1, oy1);
        ctx.moveTo(x2, y2); ctx.lineTo(ox2, oy2);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.strokeStyle = "#888";
        ctx.beginPath();
        ctx.moveTo(ox1, oy1);
        ctx.lineTo(ox2, oy2);
        ctx.stroke();

        const tick = 5;
        const uX = dx / Math.hypot(dx, dy);
        const uY = dy / Math.hypot(dx, dy);
        ctx.beginPath();
        ctx.moveTo(ox1 - uY * tick, oy1 + uX * tick); ctx.lineTo(ox1 + uY * tick, oy1 - uX * tick);
        ctx.moveTo(ox2 - uY * tick, oy2 + uX * tick); ctx.lineTo(ox2 + uY * tick, oy2 - uX * tick);
        ctx.stroke();

        ctx.save();
        ctx.translate(ox1 + dx/2, oy1 + dy/2);
        let angle = Math.atan2(dy, dx);
        if (angle > Math.PI/2 || angle < -Math.PI/2) angle += Math.PI;
        ctx.rotate(angle);

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(-15, -8, 30, 16);

        ctx.fillStyle = "#555";
        ctx.font = "bold 11px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${distFt}'`, 0, 1);
        ctx.restore();
    }

    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "#e0e0e0";
        ctx.lineWidth = 1;
        for(let i = 0; i < canvas.width; i += SNAP_GRID) {
            ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
        }
        for(let i = 0; i < canvas.height; i += SNAP_GRID) {
            ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
        }

        const rooms = extractRooms(lines);

        rooms.forEach(roomVertices => {
            ctx.beginPath();
            ctx.moveTo(roomVertices[0].x, roomVertices[0].y);
            roomVertices.forEach(p => ctx.lineTo(p.x, p.y));
            ctx.closePath();
            ctx.fillStyle = "rgba(119, 187, 162, 0.1)";
            ctx.fill();

            const xs = roomVertices.map(p => p.x);
            const ys = roomVertices.map(p => p.y);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);
            const sqFt = calculateArea(roomVertices);

            drawDimension(minX, minY, maxX, minY, -30);
            drawDimension(minX, minY, minX, maxY, -30);

            const cx = minX + (maxX - minX) / 2;
            const cy = minY + (maxY - minY) / 2;
            const scale = Math.max(0.55, Math.min(1.0, Math.sqrt(sqFt) / 10));
            const bw = 90 * scale, bh = 30 * scale, fs = Math.max(4, Math.floor(14 * scale));

            ctx.fillStyle = "#fff";
            ctx.beginPath();
            ctx.roundRect(cx - bw/2, cy - bh/2, bw, bh, 4);
            ctx.fill();
            ctx.strokeStyle = "#77BBA2";
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.fillStyle = "#3b6a5a";
            ctx.font = `bold ${fs}px monospace`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(`${sqFt} ft²`, cx, cy);
        });

        ctx.lineWidth = 6;
        ctx.lineCap = "square";

        lines.forEach(l => drawWall(l.x1, l.y1, l.x2, l.y2, "#000"));

        if (isDrawing) {
            hud.style.display = "block";

            if (mode === "draw") {
                drawWall(startX, startY, currentX, currentY, "#77BBA2");
                const len = Math.round(Math.hypot(currentX - startX, currentY - startY) / PIXELS_PER_FOOT);
                const ang = Math.abs(Math.round(Math.atan2(currentY - startY, currentX - startX) * 180 / Math.PI));
                hud.innerHTML = `L: ${len}' - 0" &nbsp;|&nbsp; A: ${ang}&deg;`;
            } else if (mode === "rect") {
                drawWall(startX, startY, currentX, startY, "#77BBA2");
                drawWall(currentX, startY, currentX, currentY, "#77BBA2");
                drawWall(currentX, currentY, startX, currentY, "#77BBA2");
                drawWall(startX, currentY, startX, startY, "#77BBA2");

                const w = Math.round(Math.abs(currentX - startX) / PIXELS_PER_FOOT);
                const h = Math.round(Math.abs(currentY - startY) / PIXELS_PER_FOOT);
                hud.innerHTML = `W: ${w}' - 0" &nbsp;|&nbsp; H: ${h}' - 0"`;
            }
        } else {
            hud.style.display = "none";
        }
    }

    canvas.addEventListener("mousedown", (e) => {
        const pos = getMousePos(e);
        if (mode === "erase") {
            isErasing = true;
            eraseAt(pos.x, pos.y);
            return;
        }
        startX = snap(pos.x);
        startY = snap(pos.y);
        currentX = startX;
        currentY = startY;
        isDrawing = true;
    });

    canvas.addEventListener("mousemove", (e) => {
        const pos = getMousePos(e);
        if (mode === "erase") { if (isErasing) eraseAt(pos.x, pos.y); return; }
        if (!isDrawing) return;

        if (mode === "draw" && e.shiftKey) {
            const dx = Math.abs(pos.x - startX);
            const dy = Math.abs(pos.y - startY);
            if (dx > dy) { currentX = snap(pos.x); currentY = startY; }
            else { currentX = startX; currentY = snap(pos.y); }
        } else if (mode === "rect" && e.shiftKey) {
            const size = Math.max(Math.abs(pos.x - startX), Math.abs(pos.y - startY));
            currentX = snap(startX + (pos.x > startX ? size : -size));
            currentY = snap(startY + (pos.y > startY ? size : -size));
        } else {
            currentX = snap(pos.x);
            currentY = snap(pos.y);
        }
        render();
    });

    canvas.addEventListener("mouseup", () => {
        if (mode === "erase") { isErasing = false; return; }
        if (!isDrawing) return;
        isDrawing = false;

        if (mode === "draw" && (startX !== currentX || startY !== currentY)) {
            lines.push({ x1: startX, y1: startY, x2: currentX, y2: currentY });
        } else if (mode === "rect" && startX !== currentX && startY !== currentY) {
            lines.push({ x1: startX, y1: startY, x2: currentX, y2: startY });
            lines.push({ x1: currentX, y1: startY, x2: currentX, y2: currentY });
            lines.push({ x1: currentX, y1: currentY, x2: startX, y2: currentY });
            lines.push({ x1: startX, y1: currentY, x2: startX, y2: startY });
        }
        render();
    });

    canvas.addEventListener("mouseleave", () => {
        isErasing = false;
        if (isDrawing) {
            isDrawing = false;
            render();
        }
    });

    function setMode(newMode) {
        mode = newMode;
        document.getElementById("tool-draw").classList.toggle("active", mode === "draw");
        document.getElementById("tool-rect").classList.toggle("active", mode === "rect");
        document.getElementById("tool-erase").classList.toggle("active", mode === "erase");
        canvas.style.cursor = mode === "erase" ? "cell" : "crosshair";
    }

    document.getElementById("tool-draw").addEventListener("click", () => setMode("draw"));
    document.getElementById("tool-rect").addEventListener("click", () => setMode("rect"));
    document.getElementById("tool-erase").addEventListener("click", () => setMode("erase"));

    document.addEventListener("keydown", (e) => {
        if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
        if (!document.getElementById("drafting-canvas")) return;
        if (e.key.toLowerCase() === "e") setMode("erase");
        if (e.key.toLowerCase() === "r") setMode("rect");
        if (e.key.toLowerCase() === "d") setMode("draw");
    });

    const clearModal = document.getElementById("clear-confirm-modal");
    document.getElementById("tool-clear").addEventListener("click", () => {
     clearModal.style.display = "block";
    });
    document.getElementById("confirm-clear-no").addEventListener("click", () => {
     clearModal.style.display = "none";
    });
    document.getElementById("confirm-clear-yes").addEventListener("click", () => {
     lines = [];
     clearModal.style.display = "none";
     render();
    });

    document.getElementById("sim-submit-btn").addEventListener("click", () => {
     onComplete(true);
    });

    render();
}
