const initDocumentsApp = () => {
  if (!window.WindowAPI) return;

  let spawnIndex = 0;
  let markedLoader = null;
  const appVersion = "0.2.0";

  const loadMarked = () => {
    if (window.marked) return Promise.resolve();
    if (markedLoader) return markedLoader;

    markedLoader = new Promise((resolve, reject) => {
      const script = document.createElement("script");
         script.src = "apps/com.cheesesynx.documents/render.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Markdown library failed to load"));
      document.head.appendChild(script);
    });

    return markedLoader;
  };

  const buildEditor = (setTitle) => {
    const fxui = window.FxUI;
    const app = document.createElement("div");
    app.className = "documents-app";

    const header = document.createElement("div");
    header.className = "documents-header";

    const title = document.createElement("div");
    title.className = "documents-title";
    title.textContent = "未命名.md";

    const fileControls = document.createElement("div");
    fileControls.className = "documents-file-controls";

    const openBtn = fxui.createButton({ label: "打开", title: "打开", className: "documents-file-btn" });
    const saveBtn = fxui.createButton({ label: "保存", title: "保存", className: "documents-file-btn" });
    const aboutBtn = fxui.createButton({ label: "关于", title: "关于", className: "documents-file-btn" });

    fileControls.appendChild(openBtn);
    fileControls.appendChild(saveBtn);
    fileControls.appendChild(aboutBtn);

    const tabs = document.createElement("div");
    tabs.className = "documents-tabs";

    const textTab = fxui.createButton({ label: "文本", title: "文本", className: "documents-tab is-active" });
    textTab.dataset.tab = "text";

    const previewTab = fxui.createButton({ label: "可视化", title: "可视化", className: "documents-tab" });
    previewTab.dataset.tab = "preview";

    tabs.appendChild(textTab);
    tabs.appendChild(previewTab);

    header.appendChild(title);
    header.appendChild(tabs);
    header.appendChild(fileControls);

    const toolbar = document.createElement("div");
    toolbar.className = "documents-toolbar";

    const body = document.createElement("div");
    body.className = "documents-body";

    const editor = document.createElement("textarea");
    editor.className = "documents-editor";
    editor.spellcheck = false;
    editor.placeholder = "# 从这里开始输入Markdown...";

    const preview = document.createElement("div");
    preview.className = "documents-preview";
    preview.setAttribute("aria-live", "polite");

    body.appendChild(editor);
    body.appendChild(preview);

    app.appendChild(header);
    app.appendChild(toolbar);
    app.appendChild(body);

    let activeTab = "text";
    let renderTimer = null;
    let markedReady = false;
    let currentFileId = null;
    let currentFileName = "未命名.md";
    let aboutWindow = null;

    const updateTitle = (name) => {
      currentFileName = name || "未命名.md";
      title.textContent = currentFileName;
      if (typeof setTitle === "function") {
        setTitle(currentFileName);
      }
    };

    const getSelection = () => {
      return {
        start: editor.selectionStart || 0,
        end: editor.selectionEnd || 0,
        value: editor.value || ""
      };
    };

    const replaceSelection = (nextText, selectStartOffset = 0, selectLength = 0) => {
      const { start, end } = getSelection();
      editor.setRangeText(nextText, start, end, "end");
      if (selectLength > 0) {
        editor.setSelectionRange(start + selectStartOffset, start + selectStartOffset + selectLength);
      }
      editor.focus();
      scheduleRender();
    };

    const surroundSelection = (prefix, suffix, placeholder) => {
      const { start, end, value } = getSelection();
      const selected = value.slice(start, end) || placeholder || "";
      const nextText = `${prefix}${selected}${suffix}`;
      const selectOffset = prefix.length;
      replaceSelection(nextText, selectOffset, selected.length);
    };

    const toggleLinePrefix = (prefix) => {
      const { start, end, value } = getSelection();
      const before = value.slice(0, start);
      const selection = value.slice(start, end);
      const after = value.slice(end);
      const lines = (selection || "").split("\n");
      const nextLines = lines.map((line) => `${prefix}${line}`);
      const nextText = nextLines.join("\n");

      editor.value = `${before}${nextText}${after}`;
      editor.setSelectionRange(start, start + nextText.length);
      editor.focus();
      scheduleRender();
    };

    const insertBlock = (block, selectOffset = 0, selectLength = 0) => {
      replaceSelection(block, selectOffset, selectLength);
    };

    const insertLink = () => {
      const { start, end, value } = getSelection();
      const selected = value.slice(start, end) || "链接文本";
      const nextText = `[${selected}](https://)`;
      const selectOffset = nextText.indexOf("https://");
      replaceSelection(nextText, selectOffset, "https://".length);
    };

    const insertImage = () => {
      const { start, end, value } = getSelection();
      const selected = value.slice(start, end) || "图片描述";
      const nextText = `![${selected}](https://)`;
      const selectOffset = nextText.indexOf("https://");
      replaceSelection(nextText, selectOffset, "https://".length);
    };

    const makeIcon = (paths) => {
      return `
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          ${paths}
        </svg>
      `;
    };

    const toolbarActions = [
      {
        title: "加粗",
        icon: makeIcon("<path d=\"M4 3h5a3 3 0 010 6H4zM4 9h6a3 3 0 010 6H4z\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.4\" stroke-linejoin=\"round\" />"),
        action: () => surroundSelection("**", "**", "加粗文本")
      },
      {
        title: "斜体",
        icon: makeIcon("<path d=\"M7 3h6M3 13h6M9 3l-2 10\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" />"),
        action: () => surroundSelection("*", "*", "斜体文本")
      },
      {
        title: "标题",
        icon: makeIcon("<path d=\"M3 4v8M9 4v8M3 8h6M12 5h2M12 11h2\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.4\" stroke-linecap=\"round\" />"),
        action: () => toggleLinePrefix("## ")
      },
      {
        title: "引用",
        icon: makeIcon("<path d=\"M4 6h3v4H4zM9 6h3v4H9z\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.2\" />"),
        action: () => toggleLinePrefix("> ")
      },
      {
        title: "行内代码",
        icon: makeIcon("<path d=\"M6 5l-3 3 3 3M10 5l3 3-3 3\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" />"),
        action: () => surroundSelection("`", "`", "代码")
      },
      {
        title: "代码块",
        icon: makeIcon("<path d=\"M3 4v8M13 4v8M6 6h4M6 10h4\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.4\" stroke-linecap=\"round\" />"),
        action: () => insertBlock("```\n代码\n```", 4, 2)
      },
      {
        title: "链接",
        icon: makeIcon("<path d=\"M7 9l-1 1a3 3 0 01-4-4l2-2a3 3 0 014 4l-1 1M9 7l1-1a3 3 0 014 4l-2 2a3 3 0 01-4-4l1-1\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" />"),
        action: () => insertLink()
      },
      {
        title: "图片",
        icon: makeIcon("<rect x=\"3\" y=\"4\" width=\"10\" height=\"8\" rx=\"1.5\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.2\" /><path d=\"M5 11l3-3 2 2 2-3 2 4\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" /><circle cx=\"6\" cy=\"6\" r=\"1\" fill=\"currentColor\" />"),
        action: () => insertImage()
      },
      {
        title: "无序列表",
        icon: makeIcon("<circle cx=\"4\" cy=\"5\" r=\"1.2\" fill=\"currentColor\" /><circle cx=\"4\" cy=\"8\" r=\"1.2\" fill=\"currentColor\" /><circle cx=\"4\" cy=\"11\" r=\"1.2\" fill=\"currentColor\" /><path d=\"M7 5h6M7 8h6M7 11h6\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.2\" stroke-linecap=\"round\" />"),
        action: () => toggleLinePrefix("- ")
      },
      {
        title: "有序列表",
        icon: makeIcon("<path d=\"M3 4h2M3 12h2M3 4v8M7 5h6M7 8h6M7 11h6\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" />"),
        action: () => toggleLinePrefix("1. ")
      },
      {
        title: "任务列表",
        icon: makeIcon("<rect x=\"3\" y=\"4\" width=\"4\" height=\"4\" rx=\"0.8\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.2\" /><path d=\"M4 6l1 1 2-2\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" /><path d=\"M9 6h4M9 10h4\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.2\" stroke-linecap=\"round\" />"),
        action: () => toggleLinePrefix("- [ ] ")
      },
      {
        title: "表格",
        icon: makeIcon("<rect x=\"3\" y=\"4\" width=\"10\" height=\"8\" rx=\"1\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.2\" /><path d=\"M3 8h10M7 4v8\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.2\" />"),
        action: () => insertBlock("| 标题 | 标题 |\n| --- | --- |\n| 内容 | 内容 |\n")
      },
      {
        title: "分割线",
        icon: makeIcon("<path d=\"M3 8h10\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.4\" stroke-linecap=\"round\" />"),
        action: () => insertBlock("\n---\n")
      }
    ];

    toolbarActions.forEach((tool) => {
      const btn = fxui.createButton({
        label: "",
        title: tool.title,
        iconPath: tool.icon,
        className: "documents-toolbar-btn is-icon",
        onClick: tool.action
      });
      btn.setAttribute("aria-label", tool.title);
      toolbar.appendChild(btn);
    });

    const renderMarkdown = () => {
      if (!markedReady || !window.marked) {
        preview.textContent = "Markdown渲染库加载中...";
        return;
      }

      const source = editor.value || "";
      if (!source.trim()) {
        preview.innerHTML = "<div class=\"documents-empty\">Markdown预览将在这里显示</div>";
        return;
      }

      preview.innerHTML = window.marked.parse(source);
    };

    const scheduleRender = () => {
      if (renderTimer) {
        window.clearTimeout(renderTimer);
      }
      renderTimer = window.setTimeout(renderMarkdown, 120);
    };

    const setActiveTab = (nextTab) => {
      activeTab = nextTab;
      textTab.classList.toggle("is-active", activeTab === "text");
      previewTab.classList.toggle("is-active", activeTab === "preview");
      preview.classList.toggle("is-hidden", activeTab !== "preview");
      toolbar.classList.toggle("is-hidden", activeTab !== "preview");
      app.classList.toggle("is-preview", activeTab === "preview");

      if (activeTab === "preview") {
        renderMarkdown();
      } else {
        editor.focus();
      }
    };

    textTab.addEventListener("click", () => setActiveTab("text"));
    previewTab.addEventListener("click", () => setActiveTab("preview"));
    editor.addEventListener("input", scheduleRender);

    openBtn.addEventListener("click", async () => {
      if (!window.FilesAPI?.pickFile || !window.FilesAPI?.readTextFile) return;
      const picked = await window.FilesAPI.pickFile({
        title: "选择Markdown文件",
        textOnly: true
      });
      if (!picked) return;
      const fileData = await window.FilesAPI.readTextFile(picked.id);
      if (!fileData) return;
      editor.value = fileData.content || "";
      currentFileId = fileData.id || null;
      updateTitle(fileData.name || "未命名.md");
      scheduleRender();
    });

    saveBtn.addEventListener("click", async () => {
      if (!window.FilesAPI?.writeTextFile || !window.FilesAPI?.createTextFile) return;
      if (currentFileId) {
        await window.FilesAPI.writeTextFile(currentFileId, editor.value, {
          name: currentFileName,
          mime: "text/markdown"
        });
        return;
      }
      const name = (prompt("保存为", currentFileName) || "").trim();
      if (!name) return;
      const created = await window.FilesAPI.createTextFile(name, editor.value);
      if (created) {
        currentFileId = created.id;
        updateTitle(created.name || name);
      }
    });

    aboutBtn.addEventListener("click", () => {
      if (aboutWindow) {
        aboutWindow.restore();
        return;
      }

      const content = document.createElement("div");
      content.className = "documents-about";
      content.innerHTML = `
        <div class="documents-about-title">灵狐文档</div>
        <div class="documents-about-meta">版本：${appVersion}</div>
        <div class="documents-about-meta">Copyright © 2026 CheeseSynx，Yurizono Seia</div>
        <div class="documents-about-section">开放源代码许可证</div>
        <div class="documents-about-item">
          <div class="documents-about-name">marked</div>
          <div class="documents-about-license">MIT License</div>
          <a class="documents-about-link" href="https://github.com/markedjs/marked" target="_blank" rel="noopener">https://github.com/markedjs/marked</a>
        </div>
      `;

      aboutWindow = window.WindowAPI.createWindow({
        title: "关于 灵狐文档",
        content,
        appPath: "apps/com.cheesesynx.documents",
        rect: { width: 360, height: 265, x: 160, y: 120 },
        maximizable: false,
        resizable: false,
        onClose: () => {
          aboutWindow = null;
        }
      });
    });

    loadMarked()
      .then(() => {
        markedReady = true;
        renderMarkdown();
      })
      .catch(() => {
        preview.innerHTML = "<div class=\"documents-error\">Markdown渲染库加载失败，请检查网络连接。</div>";
      });

    updateTitle(currentFileName);
    setActiveTab("text");
    return app;
  };

  const openDocuments = () => {
    const setTitle = (name, windowRef) => {
      const titleEl = windowRef?.windowEl?.querySelector(".app-window-title");
      if (titleEl) {
        titleEl.textContent = name || "未命名.md";
      }
    };

    let windowRef = null;
    const content = buildEditor((name) => {
      if (windowRef) {
        setTitle(name, windowRef);
      }
    });

    windowRef = window.WindowAPI.createWindow({
      title: "未命名.md",
      content,
      appPath: "apps/com.cheesesynx.documents",
      rect: { width: 780, height: 520, x: 120 + spawnIndex * 24, y: 80 + spawnIndex * 18 },
      maximizable: true,
      resizable: true,
      onClose: () => {}
    });
    spawnIndex = (spawnIndex + 1) % 10;
  };

  window.DocumentsApp = {
    open: openDocuments
  };
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDocumentsApp);
} else {
  initDocumentsApp();
}
