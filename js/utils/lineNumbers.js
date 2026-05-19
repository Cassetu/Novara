function initLineNumbers(editor, lineNumbersEl) {
    function update() {
        const count = editor.value.split("\n").length;
        lineNumbersEl.textContent = Array.from({ length: count }, (_, i) => i + 1).join("\n");
    }

    function syncScroll() {
        lineNumbersEl.scrollTop = editor.scrollTop;
    }

    editor.addEventListener("input", update);
    editor.addEventListener("scroll", syncScroll);

    editor.addEventListener("keydown", (e) => {
        if (e.key !== "Tab") return;
        e.preventDefault();
        const s = editor.selectionStart;
        const end = editor.selectionEnd;
        editor.value = editor.value.substring(0, s) + "    " + editor.value.substring(end);
        editor.selectionStart = editor.selectionEnd = s + 4;
        update();
    });

    update();
}

export { initLineNumbers };