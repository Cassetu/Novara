import { playCorrect, playIncorrect } from "../utils/sound.js";
import { initLineNumbers } from "../utils/lineNumbers.js";

const NODE_ICONS = {
    Node: "⬡", Node2D: "⊕", Node3D: "⊞",
    CharacterBody2D: "◈", RigidBody2D: "◉", StaticBody2D: "◫",
    Area2D: "◎", Sprite2D: "▣", AnimatedSprite2D: "▤",
    CollisionShape2D: "◇", Camera2D: "⊡",
    Control: "▭", Label: "T", Button: "⬜",
    ProgressBar: "▬", TextureRect: "▨", CanvasLayer: "⧉",
    Timer: "◷", AudioStreamPlayer: "♪", AnimationPlayer: "▷",
    default: "⬡"
};

const ADDABLE_NODES = Object.keys(NODE_ICONS).filter(k => k !== "default");

const FS_TREE = [
    { name: "res://", icon: "📁", children: [
        { name: "scenes/", icon: "📁", children: [
            { name: "main.tscn", icon: "🎬" },
            { name: "player.tscn", icon: "🎬" }
        ]},
        { name: "scripts/", icon: "📁", children: [
            { name: "player.gd", icon: "📜" },
            { name: "enemy.gd", icon: "📜" }
        ]},
        { name: "assets/", icon: "📁", children: [
            { name: "sprites/", icon: "📁", children: [] }
        ]},
        { name: "icon.svg", icon: "🖼" }
    ]}
];

let dragSrc = null;
let treeData = [];
let nextId = 1;
let activeRightTab = "Inspector";
let activeWsTab = "Script";
let fsOpen = { "res://": true };
let selectedNodeId = null;
let scriptEditorRef = null;
let autoloads = [];

function makeNode(type, name) {
    return { id: nextId++, type, name: name || type, children: [], hasScript: false };
}

function findNode(nodes, id) {
    for (const n of nodes) {
        if (n.id === id) return n;
        const f = findNode(n.children, id);
        if (f) return f;
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

function insertAfter(nodes, targetId, node) {
    for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].id === targetId) { nodes.splice(i + 1, 0, node); return true; }
        if (insertAfter(nodes[i].children, targetId, node)) return true;
    }
    return false;
}

function treeMatches(actual, target) {
    if (!target || !target.length) return true;
    if (actual.length < target.length) return false;
    return target.every(t => {
        const match = actual.find(a =>
            a.type === t.node &&
            (t.name ? a.name === t.name : true)
        );
        return match && treeMatches(match.children, t.children || []);
    });
}

function flattenTree(nodes) {
    return nodes.flatMap(n => [n, ...flattenTree(n.children)]);
}

function buildInitialTree(raw) {
    return (raw || []).map(n => ({
        id: nextId++,
        type: n.node,
        name: n.name || n.node,
        children: buildInitialTree(n.children || []),
        hasScript: false
    }));
}

function buildTreeHtml(nodes, depth = 0) {
    return nodes.map(node => {
        const icon = NODE_ICONS[node.type] || NODE_ICONS.default;
        const pl = 8 + depth * 14;
        const sel = node.id === selectedNodeId;
        const scriptPin = node.hasScript
            ? `<span class="gd-script-pin attached" title="Script attached">📜</span>`
            : `<span class="gd-script-pin detached" data-id="${node.id}" title="Attach script">＋</span>`;
        const children = node.children.length
            ? `<div class="gd-children">${buildTreeHtml(node.children, depth + 1)}</div>`
            : "";
        return `
            <div class="gd-node${sel ? " gd-node-sel" : ""}" data-id="${node.id}" draggable="true" style="padding-left:${pl}px">
                <span class="gd-node-icon">${icon}</span>
                <span class="gd-node-name" contenteditable="true" spellcheck="false">${node.name}</span>
                <span class="gd-node-type-tag">${node.type}</span>
                ${scriptPin}
                <button class="gd-del-btn" data-id="${node.id}">✕</button>
            </div>
            ${children}
        `;
    }).join("");
}

function renderTree(container) {
    container.innerHTML = buildTreeHtml(treeData);
    bindTreeEvents(container);
}

function bindTreeEvents(container) {
    container.querySelectorAll(".gd-node").forEach(el => {
        el.addEventListener("click", e => {
            if (e.target.classList.contains("gd-del-btn")) return;
            if (e.target.classList.contains("gd-script-pin")) return;
            selectedNodeId = parseInt(el.dataset.id);
            renderTree(container);
            updateInspector();
        });

        el.addEventListener("dragstart", e => {
            dragSrc = parseInt(el.dataset.id);
            e.dataTransfer.effectAllowed = "move";
            el.style.opacity = "0.4";
        });

        el.addEventListener("dragend", () => {
            el.style.opacity = "";
            container.querySelectorAll(".gd-node").forEach(n => n.classList.remove("drag-over"));
        });

        el.addEventListener("dragover", e => {
            e.preventDefault();
            container.querySelectorAll(".gd-node").forEach(n => n.classList.remove("drag-over"));
            el.classList.add("drag-over");
        });

        el.addEventListener("drop", e => {
            e.preventDefault();
            const targetId = parseInt(el.dataset.id);
            if (dragSrc === targetId) return;
            const src = findNode(treeData, dragSrc);
            if (!src) return;
            const clone = JSON.parse(JSON.stringify(src));
            removeNode(treeData, dragSrc);
            if (e.shiftKey) {
                const t = findNode(treeData, targetId);
                if (t) t.children.push(clone);
            } else {
                insertAfter(treeData, targetId, clone);
            }
            renderTree(container);
        });
    });

    container.querySelectorAll(".gd-del-btn").forEach(btn => {
        btn.addEventListener("click", e => {
            e.stopPropagation();
            const id = parseInt(btn.dataset.id);
            if (treeData.length === 1 && treeData[0].id === id) return;
            removeNode(treeData, id);
            if (selectedNodeId === id) selectedNodeId = null;
            renderTree(container);
        });
    });

    container.querySelectorAll(".gd-script-pin.detached").forEach(pin => {
        pin.addEventListener("click", e => {
            e.stopPropagation();
            const node = findNode(treeData, parseInt(pin.dataset.id));
            if (node) { node.hasScript = true; renderTree(container); }
        });
    });

    container.querySelectorAll(".gd-node-name").forEach(el => {
        el.addEventListener("blur", () => {
            const node = findNode(treeData, parseInt(el.closest(".gd-node").dataset.id));
            if (node) node.name = el.textContent.trim();
        });
        el.addEventListener("keydown", e => {
            if (e.key === "Enter") { e.preventDefault(); el.blur(); }
        });
    });
}

function updateInspector() {
    const content = document.getElementById("gd-right-content");
    if (!content || activeRightTab !== "Inspector") return;
    const node = selectedNodeId ? findNode(treeData, selectedNodeId) : null;
    if (!node) {
        content.innerHTML = `<div class="gd-insp-empty">Select a node to inspect its properties.</div>`;
        return;
    }
    content.innerHTML = `
        <div class="gd-insp-node-header">
            <span class="gd-insp-node-icon">${NODE_ICONS[node.type] || NODE_ICONS.default}</span>
            <div>
                <div class="gd-insp-node-name">${node.name}</div>
                <div class="gd-insp-node-type">${node.type}</div>
            </div>
        </div>
        <div class="gd-insp-section">Transform</div>
        <div class="gd-insp-row"><span class="gd-insp-label">Position</span><span class="gd-insp-inputs"><input class="gd-insp-input" value="0" type="number" placeholder="x"><input class="gd-insp-input" value="0" type="number" placeholder="y"></span></div>
        <div class="gd-insp-row"><span class="gd-insp-label">Rotation</span><span class="gd-insp-inputs"><input class="gd-insp-input" value="0" type="number" style="width:80px"> °</span></div>
        <div class="gd-insp-row"><span class="gd-insp-label">Scale</span><span class="gd-insp-inputs"><input class="gd-insp-input" value="1" type="number" placeholder="x"><input class="gd-insp-input" value="1" type="number" placeholder="y"></span></div>
        <div class="gd-insp-section">Visibility</div>
        <div class="gd-insp-row"><span class="gd-insp-label">Visible</span><span class="gd-insp-inputs"><input type="checkbox" checked></span></div>
        <div class="gd-insp-row"><span class="gd-insp-label">Modulate</span><span class="gd-insp-inputs"><input type="color" value="#ffffff" style="width:36px;height:22px;border:none;padding:0;background:none;cursor:pointer;"></span></div>
        <div class="gd-insp-section">Node</div>
        <div class="gd-insp-row"><span class="gd-insp-label">Name</span><span class="gd-insp-inputs"><input class="gd-insp-input" value="${node.name}" style="width:120px"></span></div>
    `;
}

function buildFsHtml(nodes, depth = 0) {
    return nodes.map(item => {
        const pl = 6 + depth * 14;
        if (item.children !== undefined) {
            const open = fsOpen[item.name];
            return `
                <div class="gd-fs-row gd-fs-folder" data-name="${item.name}" style="padding-left:${pl}px">
                    <span class="gd-fs-arrow">${open ? "▾" : "▸"}</span>
                    <span>${item.icon}</span>
                    <span class="gd-fs-label">${item.name}</span>
                </div>
                <div style="display:${open ? "block" : "none"}">
                    ${open ? buildFsHtml(item.children, depth + 1) : ""}
                </div>
            `;
        }
        return `
            <div class="gd-fs-row gd-fs-file" style="padding-left:${pl + 14}px">
                <span>${item.icon}</span>
                <span class="gd-fs-label">${item.name}</span>
            </div>
        `;
    }).join("");
}

function renderFilesystem(container) {
    container.innerHTML = buildFsHtml(FS_TREE);
    container.querySelectorAll(".gd-fs-folder").forEach(row => {
        row.addEventListener("click", () => {
            const name = row.dataset.name;
            fsOpen[name] = !fsOpen[name];
            renderFilesystem(container);
        });
    });
}

function buildWorkspace(lessonData) {
    if (activeWsTab === "Script") {
        return `
            <div class="gd-script-area">
                <div class="gd-script-tab-bar">
                    <span class="gd-script-file-tab">📜 ${treeData[0]?.name || "script"}.gd ×</span>
                </div>
                <div class="gd-editor-wrap">
                    <div id="gd-line-numbers" class="gd-line-numbers"></div>
                    <textarea id="gd-script-editor" class="gd-script-editor" spellcheck="false"></textarea>
                </div>
            </div>
        `;
    }
    const labels = { "2D": "2D Viewport — run scene to preview", "3D": "3D Viewport — no 3D nodes in scene", "Game": "Game — press ▶ Run to start", "AssetLib": "Asset Library — requires connection" };
    return `<div class="gd-viewport-empty"><span>${labels[activeWsTab] || activeWsTab}</span></div>`;
}

function mountWorkspace(lessonData, currentScript) {
    const ws = document.getElementById("gd-workspace");
    ws.innerHTML = buildWorkspace(lessonData);
    if (activeWsTab === "Script") {
        const editor = document.getElementById("gd-script-editor");
        const ln = document.getElementById("gd-line-numbers");
        editor.value = currentScript;
        initLineNumbers(editor, ln);
        scriptEditorRef = editor;
    }
}

function getScript() {
    return document.getElementById("gd-script-editor")?.value ?? scriptEditorRef?.value ?? "";
}

function renderGodotScene(lessonData, onFinish) {
    const lessonView = document.getElementById("view-lesson");
    const requiresTree = !!lessonData.targetTree;

    treeData = buildInitialTree(lessonData.initialTree || []);
    nextId = flattenTree(treeData).reduce((m, n) => Math.max(m, n.id), 0) + 1;
    selectedNodeId = treeData[0]?.id || null;
    activeRightTab = "Inspector";
    activeWsTab = "Script";
    fsOpen = { "res://": true };
    scriptEditorRef = null;

    lessonView.innerHTML = `
        <div class="gd-window">

            <div class="gd-titlebar">
                <div class="gd-titlebar-dots">
                    <div class="gd-dot gd-dot-close"></div>
                    <div class="gd-dot gd-dot-min"></div>
                    <div class="gd-dot gd-dot-max"></div>
                </div>
                <span class="gd-titlebar-title">Godot Engine — ${lessonData.title}</span>
            </div>

            <div class="gd-menubar">
                ${["Scene","Debug","Editor","Help"].map(m =>
                    `<span class="gd-menu-item">${m}</span>`
                ).join("")}
                <div class="gd-menu-project-wrap" style="position:relative;">
                    <span class="gd-menu-item" id="gd-project-menu-btn">Project</span>
                    <div id="gd-project-dropdown" class="gd-project-dropdown" style="display:none;">
                        <div class="gd-dropdown-item gd-dropdown-label">Project Settings</div>
                        <div class="gd-dropdown-item gd-dropdown-sub" id="gd-open-autoloads">
                            <span>Globals</span>
                            <span class="gd-dropdown-arrow">▸</span>
                        </div>
                        <div id="gd-autoload-sub" class="gd-autoload-sub" style="display:none;">
                            <div class="gd-dropdown-item gd-dropdown-label" style="padding-left:24px;">Autoload</div>
                            <div id="gd-autoload-list" class="gd-autoload-list"></div>
                            <div class="gd-autoload-add-row">
                                <input id="gd-autoload-path" class="gd-autoload-input" placeholder="res://scripts/my_global.gd" spellcheck="false">
                                <input id="gd-autoload-name" class="gd-autoload-input" placeholder="MyGlobal" spellcheck="false" style="width:90px;">
                                <button class="gd-sm-btn" id="gd-autoload-add-btn">Add</button>
                            </div>
                        </div>
                        <div class="gd-dropdown-divider"></div>
                        <div class="gd-dropdown-item">Export...</div>
                        <div class="gd-dropdown-item">Install Android Build Template...</div>
                    </div>
                </div>
                <div class="gd-menubar-center">
                    ${["2D","3D","Script","Game","AssetLib"].map(t =>
                        `<button class="gd-ws-btn${t === activeWsTab ? " active" : ""}" data-ws="${t}">${t}</button>`
                    ).join("")}
                </div>
                <div class="gd-menubar-right">
                    <button class="gd-play-btn gd-play-green" title="Play">▶</button>
                    <button class="gd-play-btn" title="Play Scene">⏵</button>
                    <button class="gd-play-btn" title="Pause">⏸</button>
                    <button class="gd-play-btn" title="Stop">⏹</button>
                </div>
            </div>

            <div class="gd-body">

                <div class="gd-left">

                    <div class="gd-dock" style="flex:1.2;min-height:0;">
                        <div class="gd-dock-tabs">
                            <span class="gd-dock-tab active">Scene</span>
                            <span class="gd-dock-tab">Import</span>
                            <div class="gd-dock-tab-actions">
                                <select id="gd-node-select" class="gd-sel">
                                    ${ADDABLE_NODES.map(n => `<option value="${n}">${n}</option>`).join("")}
                                </select>
                                <button class="gd-sm-btn" id="gd-add-btn">+</button>
                                <button class="gd-sm-btn" id="gd-child-btn">+Child</button>
                            </div>
                        </div>
                        <div class="gd-drag-hint">Drag · Shift+Drop to nest</div>
                        <div id="gd-tree-container" class="gd-tree-scroll"></div>
                    </div>

                    <div class="gd-dock" style="flex:0.8;min-height:0;">
                        <div class="gd-dock-tabs">
                            <span class="gd-dock-tab active">FileSystem</span>
                        </div>
                        <div id="gd-filesystem" class="gd-tree-scroll"></div>
                    </div>

                </div>

                <div class="gd-center">
                    <div id="gd-workspace" class="gd-workspace-area"></div>
                    <div class="gd-bottom-bar">
                        <div class="gd-bottom-tabs">
                            <span class="gd-bottom-tab active">Output</span>
                            <span class="gd-bottom-tab">Debugger</span>
                            <span class="gd-bottom-tab">Search Results</span>
                            <span class="gd-bottom-tab">Audio</span>
                        </div>
                        <div id="gd-console" class="gd-output">ready.</div>
                    </div>
                </div>

                <div class="gd-right">
                    <div class="gd-dock" style="flex:1;min-height:0;">
                        <div class="gd-dock-tabs" id="gd-right-tabs">
                            ${["Inspector","Node","History"].map(t =>
                                `<span class="gd-dock-tab${t === activeRightTab ? " active" : ""}" data-rtab="${t}">${t}</span>`
                            ).join("")}
                        </div>
                        <div id="gd-right-content" class="gd-right-content"></div>
                    </div>
                </div>

            </div>

            <div class="gd-statusbar">
                <span id="gd-status">Scene loaded — run check when ready.</span>
                <div class="gd-statusbar-btns">
                    <button id="gd-run-btn" class="gd-run-btn">▶ Run Check</button>
                    <button id="gd-submit-btn" class="gd-submit-btn" disabled>Submit</button>
                </div>
            </div>

            <div class="gd-task-bar">
                <span class="gd-task-label">Task:</span>
                <span class="gd-task-text">${lessonData.prompt}</span>
            </div>

        </div>
    `;

    const treeContainer = document.getElementById("gd-tree-container");
    const fsContainer = document.getElementById("gd-filesystem");
    const consoleBox = document.getElementById("gd-console");
    const statusEl = document.getElementById("gd-status");
    const runBtn = document.getElementById("gd-run-btn");
    const submitBtn = document.getElementById("gd-submit-btn");

    renderTree(treeContainer);
    renderFilesystem(fsContainer);
    mountWorkspace(lessonData, lessonData.initialScript || "");
    updateInspector();

    document.getElementById("gd-add-btn").addEventListener("click", () => {
        treeData.push(makeNode(document.getElementById("gd-node-select").value));
        renderTree(treeContainer);
    });

    document.getElementById("gd-child-btn").addEventListener("click", () => {
        const type = document.getElementById("gd-node-select").value;
        if (!treeData.length) treeData.push(makeNode(type));
        else treeData[0].children.push(makeNode(type));
        renderTree(treeContainer);
    });

    document.querySelectorAll("[data-ws]").forEach(btn => {
        btn.addEventListener("click", () => {
            const saved = getScript();
            activeWsTab = btn.dataset.ws;
            document.querySelectorAll("[data-ws]").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            mountWorkspace(lessonData, saved);
        });
    });

    document.getElementById("gd-right-tabs").addEventListener("click", e => {
        const tab = e.target.closest("[data-rtab]");
        if (!tab) return;
        activeRightTab = tab.dataset.rtab;
        document.querySelectorAll("[data-rtab]").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");

        const content = document.getElementById("gd-right-content");
        if (activeRightTab === "Inspector") {
            updateInspector();
        } else if (activeRightTab === "Node") {
            content.innerHTML = `
                <div class="gd-right-section">Signals</div>
                <div class="gd-signal-row">body_entered ( body: Node2D )</div>
                <div class="gd-signal-row">body_exited ( body: Node2D )</div>
                <div class="gd-signal-row">area_entered ( area: Area2D )</div>
                <div class="gd-right-section" style="margin-top:10px;">Groups</div>
                <div class="gd-insp-empty">No groups assigned.</div>
            `;
        } else if (activeRightTab === "History") {
            content.innerHTML = `
                <div class="gd-right-section">Undo History</div>
                <div class="gd-history-row gd-history-current">▶ Current State</div>
                <div class="gd-history-row">Add Node</div>
                <div class="gd-history-row">Rename Node</div>
            `;
        }
    });

    runBtn.addEventListener("click", () => {
        const script = getScript();
        const results = [];
        let allPassed = true;

        if (requiresTree) {
            const ok = treeMatches(treeData, lessonData.targetTree);
            results.push({ label: "Scene tree structure correct", passed: ok });
            if (!ok) allPassed = false;
        }

        for (const check of (lessonData.validation || [])) {
            const passed = new RegExp(check.rule, "m").test(script);
            results.push({ label: check.message, passed });
            if (!passed) allPassed = false;
        }

        if (!results.length) {
            consoleBox.innerHTML = `<span style="color:#aaa">No validation configured for this lesson.</span>`;
        } else {
            consoleBox.innerHTML = results.map(r =>
                `<div style="color:${r.passed ? "#6fcf97" : "#eb5757"}">${r.passed ? "✓" : "✗"} ${r.label}</div>`
            ).join("");
        }

        statusEl.textContent = allPassed ? "All checks passed." : "Some checks failed — see output.";

        if (allPassed) {
            playCorrect();
            submitBtn.disabled = false;
            submitBtn.classList.add("gd-submit-ready");
        } else {
            playIncorrect();
            submitBtn.disabled = true;
            submitBtn.classList.remove("gd-submit-ready");
        }
    });

    submitBtn.addEventListener("click", () => onFinish());

    autoloads = lessonData.initialAutoloads ? [...lessonData.initialAutoloads] : [];

    const projectBtn = document.getElementById("gd-project-menu-btn");
    const dropdown = document.getElementById("gd-project-dropdown");
    const autoloadSub = document.getElementById("gd-autoload-sub");
    const openAutoloads = document.getElementById("gd-open-autoloads");

    projectBtn.addEventListener("click", e => {
        e.stopPropagation();
        dropdown.style.display = dropdown.style.display === "none" ? "block" : "none";
    });

    openAutoloads.addEventListener("click", e => {
        e.stopPropagation();
        const open = autoloadSub.style.display !== "none";
        autoloadSub.style.display = open ? "none" : "block";
        openAutoloads.querySelector(".gd-dropdown-arrow").textContent = open ? "▸" : "▾";
        renderAutoloadList();
    });

    document.getElementById("gd-autoload-add-btn").addEventListener("click", e => {
        e.stopPropagation();
        const path = document.getElementById("gd-autoload-path").value.trim();
        const name = document.getElementById("gd-autoload-name").value.trim();
        if (!path || !name) return;
        autoloads.push({ path, name, enabled: true });
        document.getElementById("gd-autoload-path").value = "";
        document.getElementById("gd-autoload-name").value = "";
        renderAutoloadList();
    });

    document.addEventListener("click", () => {
        dropdown.style.display = "none";
    }, { once: false, capture: true });

    dropdown.addEventListener("click", e => e.stopPropagation());

    function renderAutoloadList() {
        const list = document.getElementById("gd-autoload-list");
        if (!list) return;
        if (!autoloads.length) {
            list.innerHTML = `<div class="gd-autoload-empty">No autoloads configured.</div>`;
            return;
        }
        list.innerHTML = autoloads.map((al, i) => `
            <div class="gd-autoload-row">
                <input type="checkbox" ${al.enabled ? "checked" : ""} data-ali="${i}" class="gd-al-toggle">
                <span class="gd-al-name">${al.name}</span>
                <span class="gd-al-path">${al.path}</span>
                <span class="gd-al-del" data-ali="${i}">✕</span>
            </div>
        `).join("");
        list.querySelectorAll(".gd-al-toggle").forEach(cb => {
            cb.addEventListener("change", e => {
                autoloads[parseInt(e.target.dataset.ali)].enabled = e.target.checked;
            });
        });
        list.querySelectorAll(".gd-al-del").forEach(btn => {
            btn.addEventListener("click", e => {
                e.stopPropagation();
                autoloads.splice(parseInt(btn.dataset.ali), 1);
                renderAutoloadList();
            });
        });
    }

    renderAutoloadList();
}

export { renderGodotScene };