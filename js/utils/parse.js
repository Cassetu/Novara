function parseCode(str) {
    if (!str) return "";
    const safe = str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return safe.replace(/`([^`]+)`/g, "<code>$1</code>");
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

export { parseCode, shuffleArray };