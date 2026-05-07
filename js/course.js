let currentCourse = null;
let currentIndex = 0;

const contentDiv = document.getElementById("module-content");
const headerDiv = document.getElementById("course-header");
const nextBtn = document.getElementById("next-btn");
const notepad = document.getElementById("notepad");
const loadBtn = document.getElementById("load-js101");

//event listeners
window.addEventListener("DOMContentLoaded", () => {
    notepad.value = window.localStorage.getItem("user-notes") || "";
});

notepad.addEventListener("input", () => {
    window.localStorage.setItem("user-notes", notepad.value);
})

loadBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    const response = await fetch("data/js101.json");
    currentCourse = await response.json();
    currentIndex = 0;
    render();
});

nextBtn.addEventListener("click", () => {
    const module = currentCourse.modules[currentIndex];

    if (module.type === "mcq") {
        const selected = document.querySelector('input[name="answer"]:checked');

        if (!selected) {
            alert("Error: No selection made.")
            return;
        }

        if (parseInt(selected.value) !== module.answer) {
            alert("Incorrect answer. Please try again.");
            return;
        }
    }

    if (currentIndex < currentCourse.modules.length - 1) {
        currentIndex++;
        render();
    } else {
        headerDiv.innerHTML = "<h2>Status</h2>";
        contentDiv.innerHTML = "<p>Course Complete!</p>";
        nextBtn.style.display = "none";
    }
});

function render() {
    if (!currentCourse) return;

    const module = currentCourse.modules[currentIndex];
    headerDiv.innerHTML = `<h2>${module.title}</h2>`;
    nextBtn.style.display = "block";

    if (module.type === "reading") {
        const parsed = module.content.replace(/`([^`]+)`/g, '<code>$1</code>');
        contentDiv.innerHTML = `<p>${parsed}</p>`;
    } else if (module.type === "mcq") {
        let optionsHtml = module.options.map((opt, i) => `
            <label class="mcq-option">
                <input type="radio" name="answer" value="${i}"> ${opt}
            </label>
        `).join("");

        contentDiv.innerHTML = `
            <p>${module.question}</p>
            <form id="mcq-form">${optionsHtml}</form>
        `;
    }
}