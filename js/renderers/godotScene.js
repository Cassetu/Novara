import { playCorrect, playIncorrect } from "../utils/sound.js";
import { initLineNumbers } from "../utils/lineNumbers.js";

const NODE_ICONS = {
    Node: "⬡",
    Node2D: "⊕",
    Node3D: "⊞",
    CharacterBody2D: "◈",
    RigidBody2D: "◉",
    StaticBody2D: "◫",
    Area2D: "◎",
    Sprite2D: "▣",
    AnimatedSprite2D: "▤",
    CollisionShape2D: "◇",
    Camera2D: "⊡",
    Control: "▭",
    Label: "T",
    Button: "⬜",
    ProgressBar: "▬",
    TextureRect: "▨",
    Timer: "◷",
    AudioStreamPlayer: "♪",
    AnimationPlayer: "▷",
    default: "⬡"
};

const ADDABLE_NODES = Object.keys(NODE_ICONS).filter(k => k !== "default");

let dragSrc = null;
let treeData = [];
let nextId = 1;

function makeNode(type, name) {
    return { id: nextId++, type, name: name || type, children: [] };
}

function cloneTree(nodes) {
    return JSON.parse(JSON.stringify(nodes));
}

function findNode(nodes, id) {
    for (const n of nodes) {
        if (n.id === id) return n;
        const found = findNode(n.children, id);
        if (found) return found;
    }
    return null;
}

function removeNode(nodes, id) {
    for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].id === id) { nodes.splice(i, 1); return true; }
        if (removeNode(nodes[i].children, id)) return true;
    }
    return false;
}

function insertAfter(nodes, targetId, newNode) {
    for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].id === targetId) {
            nodes.splice(i + 1, 0, newNode);
            return true;
        }
        if (insertAfter(nodes[i].children, targetId, newNode)) return true;
    }
    return false;
}

function treeMatches(actual, target) {
    if (!target || target.length === 0) return true;
    if (actual.length !== target.length) return false;
    return target.every((tNode, i) => {
        const aNode = actual[i];
        return aNode &&
            aNode.type === tNode.node &&
            (tNode.name ? aNode.name === tNode.name : true) &&
            treeMatches(aNode.children, tNode.children || []);
    });
}

function buildTreeHtml(nodes, depth = 0) {
    return nodes.map(node => {
        const icon = NODE_ICONS[node.type] || NODE_ICONS.default;
        const indent = depth * 18;
        const childrenHtml = node.children.length
            ? `<div class="gd-children">${buildTreeHtml(node.children, depth + 1)}</div>`
            : "";
        return `
            <div class="gd-node" data-id="${node.id}" draggable="true" style="padding-left:${indent}px;">
                <span class="gd-node-icon">${icon}</span>
                <span class="gd-node-name" contenteditable="true" spellcheck="false">${node.name}</span>
                <span class="gd-node-type">${node.type}</span>
                <button class="gd-del-btn" data-id="${node.id}">✕</button>
            </div>
            ${childrenHtml}
        `;
    }).join("");
}

function renderTree(container) {
    container.innerHTML = buildTreeHtml(treeData);
    bindTreeEvents(container);
}

function bindTreeEvents(container) {
    container.querySelectorAll(".gd-node").forEach(el => {
        el.addEventListener("dragstart", (e) => {
            dragSrc = parseInt(el.getAttribute("data-id"));
            e.dataTransfer.effectAllowed = "move";
            el.classList.add("dragging");
        });

        el.addEventListener("dragend", () => {
            el.classList.remove("dragging");
            container.querySelectorAll(".gd-node").forEach(n => n.classList.remove("drag-over"));
        });

        el.addEventListener("dragover", (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            container.querySelectorAll(".gd-node").forEach(n => n.classList.remove("drag-over"));
            el.classList.add("drag-over");
        });

        el.addEventListener("drop", (e) => {
            e.preventDefault();
            const targetId = parseInt(el.getAttribute("data-id"));
            if (dragSrc === targetId) return;

            const srcNode = findNode(treeData, dragSrc);
            if (!srcNode) return;

            const clone = JSON.parse(JSON.stringify(srcNode));
            removeNode(treeData, dragSrc);

            const targetNode = findNode(treeData, targetId);
            if (e.shiftKey && targetNode) {
                targetNode.children.push(clone);
            } else {
                insertAfter(treeData, targetId, clone);
            }

            renderTree(container);
        });
    });

    container.querySelectorAll(".gd-del-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const id = parseInt(btn.getAttribute("data-id"));
            if (treeData.length === 1 && treeData[0].id === id) return;
            removeNode(treeData, id);
            renderTree(container);
        });
    });

    container.querySelectorAll(".gd-node-name").forEach(el => {
        el.addEventListener("blur", () => {
            const id = parseInt(el.closest(".gd-node").getAttribute("data-id"));
            const node = findNode(treeData, id);
            if (node) node.name = el.textContent.trim();
        });
    });
}

function renderGodotScene(lessonData, onFinish) {
    const lessonView = document.getElementById("view-lesson");
    const requiresTree = !!lessonData.targetTree;

    treeData = buildInitialTree(lessonData.initialTree || []);
    nextId = flattenTree(treeData).reduce((max, n) => Math.max(max, n.id), 0) + 1;

    lessonView.innerHTML = `
        <div class="lesson-workspace gd-workspace">
            <div id="course-header">
                <span>GODOT 4</span>
                <span>SCENE EDITOR</span>
            </div>
            <div class="gd-prompt">${lessonData.prompt}</div>
            <div class="gd-layout">
                <div class="gd-panel gd-tree-panel">
                    <div class="gd-panel-header">
                        Scene Tree
                        <div class="gd-add-row">
                            <select id="gd-node-select">
                                ${ADDABLE_NODES.map(n => `<option value="${n}">${n}</option>`).join("")}
                            </select>
                            <button id="gd-add-btn">+ Add</button>
                            <button id="gd-add-child-btn">+ Child</button>
                        </div>
                    </div>
                    <div class="gd-tree-hint">Drag to reorder — Hold Shift + Drop to nest as child</div>
                    <div id="gd-tree-container" class="gd-tree-container"></div>
                </div>
                <div class="gd-panel gd-script-panel">
                    <div class="gd-panel-header">Script</div>
                    <div class="gd-editor-wrap">
                        <div id="gd-line-numbers" class="gd-line-numbers"></div>
                        <textarea id="gd-script-editor" class="gd-script-editor" spellcheck="false"></textarea>
                    </div>
                </div>
            </div>
            <div class="gd-console-row">
                <div class="gd-panel-header">Validation</div>
                <div id="gd-console" class="gd-console">waiting for run.</div>
            </div>
            <div class="lesson-footer">
                <div class="progress-dots"><div class="p-dot active"></div></div>
                <button id="gd-run-btn">▶ RUN CHECK</button>
                <button id="gd-submit-btn" disabled>SUBMIT</button>
            </div>
        </div>
    `;

    const treeContainer = document.getElementById("gd-tree-container");
    const scriptEditor = document.getElementById("gd-script-editor");
    const lineNumbers = document.getElementById("gd-line-numbers");
    const consoleBox = document.getElementById("gd-console");
    const runBtn = document.getElementById("gd-run-btn");
    const submitBtn = document.getElementById("gd-submit-btn");
    const addBtn = document.getElementById("gd-add-btn");
    const addChildBtn = document.getElementById("gd-add-child-btn");
    const nodeSelect = document.getElementById("gd-node-select");

    scriptEditor.value = lessonData.initialScript || "";
    renderTree(treeContainer);
    initLineNumbers(scriptEditor, lineNumbers);

    addBtn.addEventListener("click", () => {
        const type = nodeSelect.value;
        treeData.push(makeNode(type));
        renderTree(treeContainer);
    });

    addChildBtn.addEventListener("click", () => {
        const type = nodeSelect.value;
        if (treeData.length === 0) { treeData.push(makeNode(type)); }
        else { treeData[0].children.push(makeNode(type)); }
        renderTree(treeContainer);
    });

    runBtn.addEventListener("click", () => {
        const script = scriptEditor.value;
        const results = [];
        let allPassed = true;

        if (requiresTree) {
            const treeOk = treeMatches(treeData, lessonData.targetTree);
            results.push({ label: "Scene tree structure", passed: treeOk });
            if (!treeOk) allPassed = false;
        }

        if (lessonData.validation?.length) {
            for (const check of lessonData.validation) {
                const passed = new RegExp(check.rule).test(script);
                results.push({ label: check.message, passed });
                if (!passed) allPassed = false;
            }
        }

        consoleBox.innerHTML = results.map(r =>
            `<div style="color:${r.passed ? "#77BBA2" : "#ff4444"};">${r.passed ? "✓" : "✗"} ${r.label}</div>`
        ).join("");

        if (allPassed) {
            playCorrect();
            submitBtn.disabled = false;
            submitBtn.style.backgroundColor = "var(--accent)";
            submitBtn.style.color = "#ffffff";
        } else {
            playIncorrect();
            submitBtn.disabled = true;
            submitBtn.style.backgroundColor = "";
            submitBtn.style.color = "";
        }
    });

    submitBtn.addEventListener("click", () => onFinish());
}

function buildInitialTree(rawNodes) {
    return rawNodes.map(n => ({
        id: nextId++,
        type: n.node,
        name: n.name || n.node,
        children: buildInitialTree(n.children || [])
    }));
}

function flattenTree(nodes) {
    return nodes.flatMap(n => [n, ...flattenTree(n.children)]);
}

export { renderGodotScene };