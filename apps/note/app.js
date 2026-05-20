document.addEventListener("DOMContentLoaded", () => {
  const noteButton = document.getElementById("noteAppButton");
  if (!noteButton || !window.WindowAPI) return;

  let aboutWindow = null;
  let spawnIndex = 0;

  const buildEditor = (setTitle, initialContent = "", initialFile = null) => {
    const fxui = window.FxUI;
    const app = document.createElement("div");
    app.className = "note-app";

    const menuBar = document.createElement("div");
    menuBar.className = "note-menu";

    const openBtn = fxui.createButton({ label: "打开", title: "打开", className: "note-menu-btn" });
    const saveBtn = fxui.createButton({ label: "保存", title: "保存", className: "note-menu-btn" });
    const saveAsBtn = fxui.createButton({ label: "另存为", title: "另存为", className: "note-menu-btn" });
    const exportBtn = fxui.createButton({ label: "导出", title: "导出", className: "note-menu-btn" });
    const aboutBtn = fxui.createButton({ label: "关于", title: "关于", className: "note-menu-btn" });

    menuBar.appendChild(openBtn);
    menuBar.appendChild(saveBtn);
    menuBar.appendChild(saveAsBtn);
    menuBar.appendChild(exportBtn);
    menuBar.appendChild(aboutBtn);

    const body = document.createElement("div");
    body.className = "note-body";

    const lineNumbers = document.createElement("div");
    lineNumbers.className = "note-lines";

    const editorPane = document.createElement("div");
    editorPane.className = "note-editor";

    const lineHighlight = document.createElement("div");
    lineHighlight.className = "note-line-highlight";

    const textarea = document.createElement("textarea");
    textarea.className = "note-text";
    textarea.spellcheck = false;
    textarea.value = initialContent;

    editorPane.appendChild(lineHighlight);
    editorPane.appendChild(textarea);

    body.appendChild(lineNumbers);
    body.appendChild(editorPane);

    const status = document.createElement("div");
    status.className = "note-status";
    status.textContent = "行 1, 列 1";

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".txt,text/plain";
    fileInput.hidden = true;

    app.appendChild(menuBar);
    app.appendChild(body);
    app.appendChild(status);
    app.appendChild(fileInput);

    const updateLineNumbers = () => {
      const lines = textarea.value.split("\n").length || 1;
      lineNumbers.innerHTML = "";
      for (let i = 1; i <= lines; i += 1) {
        const line = document.createElement("div");
        line.className = "note-line-number";
        line.textContent = String(i);
        lineNumbers.appendChild(line);
      }
    };

    const updateCaret = () => {
      const value = textarea.value;
      const caret = textarea.selectionStart;
      const before = value.slice(0, caret);
      const line = before.split("\n").length;
      const lastBreak = before.lastIndexOf("\n");
      const column = caret - (lastBreak === -1 ? 0 : lastBreak + 1) + 1;
      status.textContent = `行 ${line}, 列 ${column}`;

      const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight || "20");
      const paddingTop = parseFloat(getComputedStyle(textarea).paddingTop || "0");
      lineHighlight.style.top = `${paddingTop + (line - 1) * lineHeight}px`;
      lineHighlight.style.height = `${lineHeight}px`;

      const nodes = lineNumbers.querySelectorAll(".note-line-number");
      nodes.forEach((node, index) => {
        node.classList.toggle("is-active", index + 1 === line);
      });
    };

    const syncScroll = () => {
      lineNumbers.scrollTop = textarea.scrollTop;
      lineHighlight.style.transform = `translateY(-${textarea.scrollTop}px)`;
    };

    textarea.addEventListener("input", () => {
      updateLineNumbers();
      updateCaret();
    });

    textarea.addEventListener("click", updateCaret);
    textarea.addEventListener("keyup", updateCaret);
    textarea.addEventListener("scroll", syncScroll);
    updateLineNumbers();
    updateCaret();

    let currentFileId = initialFile?.id || null;
    let currentFileName = initialFile?.name || "未命名.txt";

    const updateTitle = (name) => {
      currentFileName = name || "未命名.txt";
      if (typeof setTitle === "function") {
        setTitle(currentFileName);
      }
    };

    openBtn.addEventListener("click", async () => {
      if (window.FilesAPI?.pickFile && window.FilesAPI?.readTextFile) {
        const picked = await window.FilesAPI.pickFile({
          title: "选择文本文件",
          textOnly: true
        });
        if (!picked) return;
        const fileData = await window.FilesAPI.readTextFile(picked.id);
        if (!fileData) return;
        textarea.value = fileData.content || "";
        currentFileId = fileData.id;
        updateTitle(fileData.name);
        updateLineNumbers();
        updateCaret();
        return;
      }
      fileInput.value = "";
      fileInput.click();
    });

    fileInput.addEventListener("change", (event) => {
      const [file] = event.target.files;
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        textarea.value = String(reader.result || "");
        currentFileId = null;
        updateTitle(file.name);
        updateLineNumbers();
        updateCaret();
      };
      reader.readAsText(file);
    });

    saveBtn.addEventListener("click", async () => {
      if (!window.FilesAPI?.writeTextFile || !window.FilesAPI?.createTextFile) {
        exportBtn.click();
        return;
      }
      if (currentFileId) {
        await window.FilesAPI.writeTextFile(currentFileId, textarea.value, {
          name: currentFileName,
          mime: "text/plain"
        });
        return;
      }
      const name = prompt("保存为", currentFileName) || "";
      if (!name.trim()) return;
      const created = await window.FilesAPI.createTextFile(name.trim(), textarea.value);
      if (created) {
        currentFileId = created.id;
        updateTitle(created.name);
      }
    });

    saveAsBtn.addEventListener("click", async () => {
      if (!window.FilesAPI?.createTextFile) {
        exportBtn.click();
        return;
      }
      const name = prompt("另存为", currentFileName) || "";
      if (!name.trim()) return;
      try {
        const created = await window.FilesAPI.createTextFile(name.trim(), textarea.value);
        if (created) {
          currentFileId = created.id;
          updateTitle(created.name);
          return;
        }
      } catch {
        exportBtn.click();
        return;
      }
      exportBtn.click();
    });

    exportBtn.addEventListener("click", () => {
      const blob = new Blob([textarea.value], { type: "text/plain" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "note.txt";
      link.click();
      URL.revokeObjectURL(link.href);
    });

    aboutBtn.addEventListener("click", () => {
      if (aboutWindow) {
        aboutWindow.restore();
        return;
      }
      const content = document.createElement("div");
      content.className = "about-app";
      content.innerHTML = "<div class=\"about-title\">Trinity Web编辑器</div><div class=\"about-version\">版本：0.1.0</div>";
      aboutWindow = window.WindowAPI.createWindow({
        title: "关于文本编辑器",
        content,
        rect: { width: 240, height: 140, x: 160, y: 120 },
        maximizable: false,
        resizable: false,
        onClose: () => {
          aboutWindow = null;
        }
      });
    });

    return app;
  };

  const openNote = () => {
    const setTitle = (name, windowRef) => {
      const title = windowRef?.windowEl?.querySelector(".app-window-title");
      if (title) {
        title.textContent = name || "未命名.txt";
      }
    };

    const noteWindow = window.WindowAPI.createWindow({
      title: "未命名.txt",
      content: buildEditor((name) => setTitle(name, noteWindow)),
      appPath: "apps/note",
      rect: { width: 520, height: 360, x: 140 + spawnIndex * 26, y: 90 + spawnIndex * 20 },
      maximizable: true,
      resizable: true,
      onClose: () => {}
    });
    spawnIndex = (spawnIndex + 1) % 10;
  };

  const openNoteWithContent = (fileName, content, fileId = null) => {
    const setTitle = (name, windowRef) => {
      const title = windowRef?.windowEl?.querySelector(".app-window-title");
      if (title) {
        title.textContent = name || "未命名.txt";
      }
    };

    const noteWindow = window.WindowAPI.createWindow({
      title: fileName || "未命名.txt",
      content: buildEditor((name) => setTitle(name, noteWindow), content || "", {
        id: fileId,
        name: fileName || "未命名.txt"
      }),
      appPath: "apps/note",
      rect: { width: 520, height: 360, x: 140 + spawnIndex * 26, y: 90 + spawnIndex * 20 },
      maximizable: true,
      resizable: true,
      onClose: () => {}
    });
    spawnIndex = (spawnIndex + 1) % 10;
  };

  noteButton.addEventListener("click", (event) => {
    event.stopPropagation();
    openNote();
  });

  window.NoteApp = {
    open: openNote,
    openWithContent: openNoteWithContent
  };
});
