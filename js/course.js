let currentUser = null;
let userData = { completed: [] };
let curriculum = null;
let currentCourse = null;
let currentIndex = 0;

const correctSound = new Audio("assets/sfx/correct.mp3");

const contentDiv = document.getElementById("module-content");
const headerDiv = document.getElementById("course-header");
const nextBtn = document.getElementById("next-btn");
const notepad = document.getElementById("notepad");
const loadBtn = document.getElementById("load-js101");
const sidebarNav = document.querySelector(".sidebar nav ul");

//boot
window.firebaseAuth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        await loadUserData();
        await loadCurriculum();
        renderDashboard();
    }
});

//memory load
async function loadUserData() {
    const userRef = window.doc(window.db, "users", currentUser.uid);
    const snap = await window.getDoc(userRef);
    if (snap.exists()) {
        userData = snap.data();
    } else {
        await window.setDoc(userRef, userData);
    }

    notepad.value = userData.notes || "";
}

//memory save
notepad.addEventListener("input", async () => {
    userData.notes = notepad.value;
    const userRef = window.doc(window.db, "users", currentUser.uid);
    await window.setDoc(userRef, { notes: notepad.value }, { merge: true });
});

async function loadCurriculum() {
    const res = await fetch("data/curriculum.json");
    curriculum = await res.json();
}

function renderDashboard() {
    sidebarNav.innerHTML = "";

    curriculum.nodes.forEach(node => {
        const isUnlocked = node.reqs.every(req => userData.completed.includes(req));
        const isComplete = userData.completed.includes(node.id);

        const li = document.createElement("li");
        const a = document.createElement("a");
        a.innerText = node.title;
        a.href = "#";

        // styling
        if (isComplete) {
            a.style.color = "var(--accent)";
            a.innerText += " [done]";
        } else if (!isUnlocked) {
            a.style.color = "var(--border)";
            a.style.cursor = "not-allowed";
        }

        a.addEventListener("click", async (e) => {
            e.preventDefault();
            if (isUnlocked) {
                const res = await fetch(node.file);
                currentCourse = await res.json();
                currentIndex = 0;
                renderCourse();
            }
        });

        li.appendChild(a);
        sidebarNav.appendChild(li);
    });
}

function renderCourse() {
    if (!currentCourse) return;

    const module = currentCourse.modules[currentIndex];
    headerDiv.innerHTML = `<h2>${module.title}</h2>`;
    nextBtn.style.display = "block";

    if (module.type === "reading") {
        contentDiv.innerHTML = `<p>${module.content}</p>`;
    }
    else if (module.type === "mcq") {
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

nextBtn.addEventListener("click", async () => {
    const module = currentCourse.modules[currentIndex];

    // mcq check
    if (module.type === "mcq") {
        const selected = document.querySelector('input[name="answer"]:checked');
        if (!selected) {
            alert("error: no selection made.");
            return;
        }
        if (parseInt(selected.value) !== module.answer) {
            alert("incorrect. evaluate your logic.");
            return;
        }

        correctSound.currentTime = 0;
        correctSound.play();
    }

    // progress
    if (currentIndex < currentCourse.modules.length - 1) {
        currentIndex++;
        renderCourse();
    } else {
        headerDiv.innerHTML = `<h2>status</h2>`;
        contentDiv.innerHTML = `<p>course complete. data logged.</p>`;
        nextBtn.style.display = "none";

        if (!userData.completed.includes(currentCourse.id)) {
            userData.completed.push(currentCourse.id);
            const userRef = window.doc(window.db, "users", currentUser.uid);
            await window.setDoc(userRef, { completed: userData.completed }, { merge: true });
        }

        renderDashboard();
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