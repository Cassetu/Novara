import { playCorrect, playIncorrect } from "../utils/sound.js";
import { heatControl } from "../sims/heatControl.js";

const sims = {
    heat_control: heatControl
};

function renderCookingSim(lessonData, onFinish) {
    let revealedCount = 0;

    const view = document.getElementById("view-lesson");
    const simFn = sims[lessonData.sim];

    view.innerHTML = `
        <div class="lesson-workspace" style="max-width:900px;">
                <h2>${lessonData.title}</h2>
                <div style="display:flex; gap:20px;">
                    <div id="teaching-panel">

                    </div>
                    <div id="sim-area">
                    </div>
                </div>
            </div>
    `;
    const teachingPanel = document.getElementById("teaching-panel");

    lessonData.teachingPoints.forEach((c, i) => {
        const points = document.createElement("div");
        points.className = "teaching-point dimmed";
        points.dataset.index = i;
        points.innerHTML = `<p>${c}</p>`;
        teachingPanel.appendChild(points);
    });

    function revealPoint() {
        const points = document.querySelectorAll(".teaching-point");
        if (points[revealedCount]) {
            points[revealedCount].classList.remove("dimmed");
            revealedCount++;
        }
    }

    if (simFn) {
        simFn(lessonData, document.getElementById("sim-area"), revealPoint, onFinish);
    }

}

export { renderCookingSim };