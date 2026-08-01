export function createDialogueBox(config) {
    const name = config.name || "Unknown";
    const imageSrc = config.imageSrc || "";
    const texts = config.texts || ["..."];
    const onComplete = config.onComplete || function() {};

    let currentIndex = 0;
    let typingInterval = null;
    const container = document.createElement("div");
    container.style.cssText = "border:3px solid var(--border);box-shadow:6px 6px 0px var(--border);margin:10px auto;width:100%;max-width:420px;padding:15px;height:172px;box-sizing:border-box;background:#fff;";
    container.innerHTML = `
        <div style="display: flex; gap: 15px; justify-content:space-between; align-items: flex-start; height:100%;">
            <img src="${imageSrc}" alt="${name}" style="max-height:107px;border:3px solid var(--border);flex-shrink: 0;">
            <div style="flex-grow:1;height:100%;font-family: monospace;display:flex; flex-direction:column;">
                <strong style="display:block; color:var(--text-main); font-size: 24px;margin-bottom:4px;">${name}</strong>
                <p class="dialogue-text" style="color: var(--text-main); margin:0; line-height:1.4; white-space: pre-wrap; overflow-y: auto; max-height: 75px;"></p>
                <button class="dialogue-next-btn" style="align-self:flex-end;margin-top:auto;padding:4px 12px; font-family: monospace; font-weight:bold; cursor: pointer; border: 2px solid var(--border);color: var(--text-main);">Next</button>
            </div>
        </div>
    `;

    const textEl = container.querySelector(".dialogue-text");
    const nextBtn = container.querySelector(".dialogue-next-btn");
    nextBtn.style.display = "none";

    function typeText(txt) {
        clearInterval(typingInterval);
        textEl.innerText = "";
        nextBtn.style.display = "none";
        let i = 0;
        typingInterval = setInterval(() => {
            if (i < txt.length) {
                textEl.innerHTML += txt.charAt(i) === '\n' ? '<br>' : txt.charAt(i);
                i++;
            } else {
                clearInterval(typingInterval);
                nextBtn.style.display = "block";
                if (currentIndex === texts.length - 1 && texts.length <= 1) {
                    nextBtn.innerText = "Done";
                }
            }
        }, 25);
    }
    typeText(texts[0]);

    nextBtn.addEventListener("click", () => {
        currentIndex++;
        if (currentIndex < texts.length) {
            if (currentIndex === texts.length - 1) {
                nextBtn.innerText = "Done";
            }
            typeText(texts[currentIndex]);
        } else {
            container.innerHTML = `
                <div style="display: flex; width: 100%; height: 100%; justify-content: center; align-items: center; font-family: monospace; font-weight: bold; font-size: 16px; color: var(--text-main);">
                    This Dialogue is Complete!<br>Have a nice day!
                </div>
            `;
            onComplete();
        }
    });

    return container;
}