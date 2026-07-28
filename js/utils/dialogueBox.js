export function createDialogueBox(config) {
    const name = config.name || "Unkown";
    const imageSrc = config.imageSrc || "";
    const texts = config.texts || ["..."];
    const onComplete = config.onComplete || function() {};

    let currentIndex = 0;

    const container = document.createElement("div");
    container.style.cssText = "border: 3px solid var(--border); box-shadow: 6px 6px 0px var(--border);margin:10px; padding:10px; min-height:122px; box-sizing:border-box;";
    container.innerHTML = `
        <div style="display: flex; gap: 15px; justify-content:space-between; align-items: flex-start;">
            <img src="${imageSrc}" alt="${name} style="max-height:107px;border:3px solid var(--border);flex-shrink: 0;">
            <div style="flex-grow:1; font-family: monospace;">
                <strong style="display:block; color:var(--text-main); font-size: 24px;margin-bottom:4px;">${name}</strong>
                <p style="color: var(--text-main); margin:0; line-height:1.4;">${texts[0]}</p>
                <button id="mayor-next-btn" style="align-self:flex-end;margin:10px;padding:4px 12px; font-family: monospace; font-weight:bold; cursor: pointer; border: 2px solid var(--border);color: var(--text-main);">Next</button>
            </div>
        </div>
    `;

    const textEl = container.querySelector(".dialogueText");
    const nextBtn = container.querySelector(".dialogue-next-btn");;

    if (texts.length <= 1) {
        nextBtn.innerText = "Done"
    }

    nextBtn.addEventListener("click", () => {
        currentIndex++;
        if (currentIndex < texts.length) {
            textEl.innerText = texts[currentIndex];
            if (currentIndex === texts.length - 1) {
                nextBtn.innerText = "Done";
            }
        } else {
            container.remove();
            onComplete();
        }
    });

    return container;
}