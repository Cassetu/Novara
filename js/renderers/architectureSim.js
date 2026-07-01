
export function renderArchitectureSim() {
    const viewLesson = document.getElementById("view-lesson");
    viewLesson.innerHTML = `

    `;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const PIXELS_PER_FOOT = 6; //for 1/16"=1'-0" architectural scale
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
            const distancePx = Math.hypot(dx, dy); //hello pythagorean theorem
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

    render();
}
