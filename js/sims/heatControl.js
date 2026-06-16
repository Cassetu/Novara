function heatControl(lessonData, simArea, revealPoint, onFinish) {
    //TODO: MAKE ASSET FOR PAN
    const PAN_SVG = lessonData.assets?.pan || `
        <svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="100" cy="70" rx="80" ry="20" fill="#555"/>
            <rect x="20" y="50" width="160" height="20" fill="#444"/>
            <rect x="160" y="55" width="60" height="8" fill="#333"/>
        </svg>
    `;
    const slider = document.getElementById("heat-slider");
    const target = lessonData.config.targetTemp;
    const tolerance = lessonData.config.tolerance;

    let currentTemp = 0;
    let targetTemp = 0;
    let timeInZone = 0;

    simArea.innerHTML = `
        <div id="heat-sim" style="position:relative;width:400px;height:200px;">
            <div id="pan" style="position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:200px;height:100px;">
                ${PAN_SVG}
            </div>
            <div id="temp-display" style="font-size:48px;font-weight:900;text-align:center;">0°C</div>
            <div style="text-align:center;color:var(--text-dim);margin-bottom:12px;">
                Target: ${lessonData.config.targetTemp}°C ± ${lessonData.config.tolerance}°C
            </div>
            <input type="range" id="heat-slider" min="0" max="100" value="0"
                style="width:100%;margin-top:16px;">
        </div>
    `;

    setInterval(() => {
        currentTemp += (targetTemp - currentTemp) * 0.05;
        document.getElementById("temp-display").innerText =
            Math.round(currentTemp) + "°C";
        if (currentTemp >= target - tolerance && currentTemp <= target + tolerance) {
            timeInZone++;
            if (timeInZone === 20) revealPoint();
            if (timeInZone === 60) onFinish();
        } else {
            timeInZone = 0;
        }
        if (timeInZone === 60) {
            clearInterval(loop);
            onFinish();
        }
    }, 50);

    slider.addEventListener("input", () => {
        targetTemp = (slider.value / 100) * 300;
    });
}

export { heatControl };