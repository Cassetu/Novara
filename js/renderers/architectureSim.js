
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
}