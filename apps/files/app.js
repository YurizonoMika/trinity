document.addEventListener("DOMContentLoaded", () => {
  const filesButton = document.getElementById("filesAppButton");
  if (!filesButton || !window.WindowAPI) return;

  let filesWindow = null;
  let spawnIndex = 0;
  let previewIndex = 0;
  const dbName = "trinityFilesDB";
  const treeStoreName = "userTrees";
  const blobStoreName = "fileBlobs";

  const openDb = () => new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(treeStoreName)) {
        db.createObjectStore(treeStoreName, { keyPath: "userKey" });
      }
      if (!db.objectStoreNames.contains(blobStoreName)) {
        db.createObjectStore(blobStoreName, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  const readUserTree = async (userKey) => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(treeStoreName, "readonly");
      const store = tx.objectStore(treeStoreName);
      const request = store.get(userKey);
      request.onsuccess = () => resolve(request.result?.items || []);
      request.onerror = () => reject(request.error);
    });
  };

  const writeUserTree = async (userKey, items) => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(treeStoreName, "readwrite");
      const store = tx.objectStore(treeStoreName);
      store.put({ userKey, items });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  };

  const readBlob = async (id) => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(blobStoreName, "readonly");
      const store = tx.objectStore(blobStoreName);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result?.blob || null);
      request.onerror = () => reject(request.error);
    });
  };

  const writeBlob = async (id, blob) => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(blobStoreName, "readwrite");
      const store = tx.objectStore(blobStoreName);
      store.put({ id, blob });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  };

  const deleteBlob = async (id) => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(blobStoreName, "readwrite");
      const store = tx.objectStore(blobStoreName);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  };

  const getUserKey = () => {
    const name = localStorage.getItem("trinityName") || "guest";
    return `trinityFiles:${encodeURIComponent(name)}`;
  };

  const dataUrlToBlob = async (dataUrl) => {
    const response = await fetch(dataUrl);
    return response.blob();
  };

  const migrateLegacyContent = async (items) => {
    let changed = false;
    for (const item of items) {
      if (item.type === "file" && item.content) {
        try {
          const blob = await dataUrlToBlob(item.content);
          await writeBlob(item.id, blob);
          delete item.content;
          changed = true;
        } catch {
          // Ignore migration failures.
        }
      }
      if (item.type === "folder" && Array.isArray(item.children)) {
        const childChanged = await migrateLegacyContent(item.children);
        if (childChanged) changed = true;
      }
    }
    return changed;
  };

  const loadStore = async () => {
    try {
      const items = await readUserTree(getUserKey());
      const changed = await migrateLegacyContent(items);
      if (changed) {
        await writeUserTree(getUserKey(), items);
      }
      return { items };
    } catch {
      return { items: [] };
    }
  };

  const saveStore = async (store) => {
    try {
      await writeUserTree(getUserKey(), store.items || []);
    } catch {
      // Ignore storage failures.
    }
  };

  const createId = () => `item_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

  const formatSize = (size) => {
    if (!Number.isFinite(size)) return "--";
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
    return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`;
  };

  const fileTypeLabel = (item) => {
    if (item.type === "folder") return "文件夹";
    if (item.mime) return item.mime;
    return "文件";
  };

  const isTextFile = (item) => {
    const ext = (item.name.split(".").pop() || "").toLowerCase();
    if (item.mime && item.mime.startsWith("text/")) return true;
    return ["txt", "md", "log", "json", "csv"].includes(ext);
  };

  const getPreviewType = (item) => {
    const ext = (item.name.split(".").pop() || "").toLowerCase();
    if (isTextFile(item)) return "text";
    if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "image";
    if (["pdf"].includes(ext)) return "pdf";
    if (["mp3", "wav", "ogg", "flac"].includes(ext)) return "audio";
    if (["mp4", "mov", "avi", "webm"].includes(ext)) return "video";
    if (item.mime.startsWith("image/")) return "image";
    if (item.mime.startsWith("audio/")) return "audio";
    if (item.mime.startsWith("video/")) return "video";
    if (item.mime === "application/pdf") return "pdf";
    return "file";
  };

  const getFileTypeKey = (item) => {
    if (item.type === "folder") return "";
    const ext = (item.name.split(".").pop() || "").toLowerCase();
    return (item.mime || ext || "").toLowerCase();
  };

  const compareNames = (a, b) => {
    return a.localeCompare(b, "zh-Hans-CN", { numeric: true, sensitivity: "base" });
  };

  const sortFolderChildren = (folder) => {
    if (!folder?.children) return;
    folder.children.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "folder" ? -1 : 1;
      }
      const nameA = a.name || "";
      const nameB = b.name || "";
      const nameCompare = compareNames(nameA, nameB);
      if (nameCompare !== 0) return nameCompare;
      if (a.type === "folder") return 0;
      return compareNames(getFileTypeKey(a), getFileTypeKey(b));
    });
  };

  const decodeDataUrlToText = (dataUrl) => {
    if (!dataUrl || typeof dataUrl !== "string") return "";
    const comma = dataUrl.indexOf(",");
    if (comma === -1) return "";
    const meta = dataUrl.slice(0, comma);
    const data = dataUrl.slice(comma + 1);
    if (meta.includes(";base64")) {
      try {
        const binary = atob(data);
        const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
        return new TextDecoder().decode(bytes);
      } catch {
        return "";
      }
    }
    try {
      return decodeURIComponent(data);
    } catch {
      return data;
    }
  };

  const iconForItem = (item) => {
    if (item.type === "folder") return "apps/files/icons/folder.svg";
    const ext = (item.name.split(".").pop() || "").toLowerCase();
    if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "apps/files/icons/image.svg";
    if (["txt", "md", "log", "json", "csv"].includes(ext)) return "apps/files/icons/text.svg";
    if (["pdf"].includes(ext)) return "apps/files/icons/pdf.svg";
    if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "apps/files/icons/archive.svg";
    if (["mp3", "wav", "ogg", "flac"].includes(ext)) return "apps/files/icons/audio.svg";
    if (["mp4", "mov", "avi", "webm"].includes(ext)) return "apps/files/icons/video.svg";
    return "apps/files/icons/file.svg";
  };

  const findItemAndParent = (items, id, parent = null) => {
    for (const item of items) {
      if (item.id === id) return { item, parent };
      if (item.type === "folder" && item.children) {
        const found = findItemAndParent(item.children, id, item);
        if (found) return found;
      }
    }
    return null;
  };

  const getFolderByPath = (store, pathIds) => {
    let current = { children: store.items };
    for (const id of pathIds) {
      const next = (current.children || []).find((child) => child.id === id && child.type === "folder");
      if (!next) return current;
      current = next;
    }
    return current;
  };

  const loadTreeItems = async () => {
    return await readUserTree(getUserKey());
  };

  const saveTreeItems = async (items) => {
    await writeUserTree(getUserKey(), items || []);
  };

  const findItemById = (items, id) => {
    const found = findItemAndParent(items, id);
    return found?.item || null;
  };

  const openFilePicker = async (options = {}) => {
    const items = await loadTreeItems();
    const titleText = options.title || "选择文件";
    const allowFolders = Boolean(options.allowFolders);
    const textOnly = Boolean(options.textOnly);
    let currentPath = [];
    let selectedId = null;
    const fxui = window.FxUI;
    const navHistory = [[]];
    let navIndex = 0;

    return new Promise((resolve) => {
      const app = document.createElement("div");
      app.className = "files-app";

      const toolbar = document.createElement("div");
      toolbar.className = "files-toolbar";

      const title = document.createElement("div");
      title.className = "files-preview-title";
      title.textContent = titleText;

      const actionGroup = document.createElement("div");
      actionGroup.className = "files-nav-group";

      const confirmBtn = fxui.createButton({ label: "选择", title: "选择", className: "files-nav-btn" });
      const cancelBtn = fxui.createButton({ label: "取消", title: "取消", className: "files-nav-btn" });

      actionGroup.appendChild(confirmBtn);
      actionGroup.appendChild(cancelBtn);

      toolbar.appendChild(title);
      toolbar.appendChild(actionGroup);

      const navBar = document.createElement("div");
      navBar.className = "files-picker-bar";

      const navGroup = document.createElement("div");
      navGroup.className = "files-picker-nav";

      const backBtn = fxui.createButton({
        label: "",
        title: "后退",
        iconPath: "<path d=\"M9.5 4l-3.5 4 3.5 4\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" />",
        className: "files-nav-btn files-icon-btn"
      });

      const forwardBtn = fxui.createButton({
        label: "",
        title: "前进",
        iconPath: "<path d=\"M6.5 4l3.5 4-3.5 4\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" />",
        className: "files-nav-btn files-icon-btn"
      });

      navGroup.appendChild(backBtn);
      navGroup.appendChild(forwardBtn);

      const addressInput = fxui.createInput({
        label: "",
        value: "",
        placeholder: "",
        className: "files-address-input files-picker-address",
        readOnly: true
      });

      navBar.appendChild(navGroup);
      navBar.appendChild(addressInput.root);

      const list = document.createElement("div");
      list.className = "files-list";

      app.appendChild(toolbar);
      app.appendChild(navBar);
      app.appendChild(list);

      const updateSelection = () => {
        list.querySelectorAll(".files-item").forEach((item) => {
          item.classList.toggle("is-selected", item.dataset.id === selectedId);
        });
      };

      const getPathLabels = (pathIds) => {
        const labels = [];
        let cursor = { children: items };
        for (const id of pathIds) {
          const next = (cursor.children || []).find((child) => child.id === id && child.type === "folder");
          if (!next) break;
          labels.push(next.name || "未命名文件夹");
          cursor = next;
        }
        return labels;
      };

      const updateAddress = () => {
        const labels = getPathLabels(currentPath);
        const text = labels.length ? `/${labels.join("/")}` : "/";
        addressInput.setValue(text);
      };

      const updateNavState = () => {
        backBtn.setAttribute("aria-disabled", navIndex > 0 ? "false" : "true");
        forwardBtn.setAttribute("aria-disabled", navIndex < navHistory.length - 1 ? "false" : "true");
      };

      const renderPicker = () => {
        list.innerHTML = "";
        const folder = getFolderByPath({ items }, currentPath);
        const children = (folder.children || []).filter((item) => {
          if (item.type === "folder") return true;
          if (!allowFolders && item.type === "folder") return false;
          if (textOnly && !isTextFile(item)) return false;
          return true;
        });
        sortFolderChildren({ children });
        if (children.length === 0) {
          const empty = document.createElement("div");
          empty.className = "files-empty";
          empty.textContent = "此处还没有文件";
          list.appendChild(empty);
          return;
        }
        children.forEach((item) => {
          const row = document.createElement("div");
          row.className = "files-item";
          row.dataset.id = item.id;

          const icon = document.createElement("img");
          icon.className = "files-item-icon";
          icon.src = iconForItem(item);
          icon.alt = "";

          const name = document.createElement("div");
          name.className = "files-item-name";
          name.textContent = item.name;

          const type = document.createElement("div");
          type.className = "files-item-type";
          type.textContent = fileTypeLabel(item);

          const size = document.createElement("div");
          size.className = "files-item-size";
          size.textContent = item.type === "folder" ? "--" : formatSize(item.size);

          row.appendChild(icon);
          row.appendChild(name);
          row.appendChild(type);
          row.appendChild(size);

          if (item.id === selectedId) {
            row.classList.add("is-selected");
          }

          list.appendChild(row);
        });

        updateSelection();
        updateAddress();
        updateNavState();
      };

      const pickWindow = window.WindowAPI.createWindow({
        title: titleText,
        content: app,
        appPath: "apps/files",
        rect: { width: 520, height: 360, x: 180, y: 120 },
        maximizable: false,
        resizable: true,
        onClose: () => {
          resolve(null);
        }
      });

      const closePicker = (result) => {
        resolve(result);
        pickWindow.close();
      };

      list.addEventListener("click", (event) => {
        const row = event.target.closest(".files-item");
        if (!row) {
          selectedId = null;
          updateSelection();
          return;
        }
        selectedId = row.dataset.id || null;
        updateSelection();
      });

      list.addEventListener("dblclick", (event) => {
        const row = event.target.closest(".files-item");
        if (!row) return;
        const item = findItemById(items, row.dataset.id || "");
        if (!item) return;
        if (item.type === "folder") {
          currentPath = [...currentPath, item.id];
          navHistory.splice(navIndex + 1);
          navHistory.push([...currentPath]);
          navIndex = navHistory.length - 1;
          selectedId = null;
          renderPicker();
          return;
        }
        closePicker(item);
      });

      backBtn.addEventListener("click", () => {
        if (navIndex <= 0) return;
        navIndex -= 1;
        currentPath = [...navHistory[navIndex]];
        selectedId = null;
        renderPicker();
      });

      forwardBtn.addEventListener("click", () => {
        if (navIndex >= navHistory.length - 1) return;
        navIndex += 1;
        currentPath = [...navHistory[navIndex]];
        selectedId = null;
        renderPicker();
      });

      cancelBtn.addEventListener("click", () => {
        closePicker(null);
      });

      confirmBtn.addEventListener("click", () => {
        if (!selectedId) {
          closePicker(null);
          return;
        }
        const item = findItemById(items, selectedId);
        if (!item) {
          closePicker(null);
          return;
        }
        if (item.type === "folder" && !allowFolders) {
          closePicker(null);
          return;
        }
        closePicker(item);
      });

      renderPicker();
    });
  };

  const readTextFile = async (id) => {
    const items = await loadTreeItems();
    const item = findItemById(items, id);
    if (!item || item.type !== "file") return null;
    const blob = await readBlob(item.id);
    if (!blob) return null;
    return {
      id: item.id,
      name: item.name,
      mime: item.mime || "text/plain",
      size: item.size || blob.size,
      content: await blob.text()
    };
  };

  const readFile = async (id) => {
    const items = await loadTreeItems();
    const item = findItemById(items, id);
    if (!item || item.type !== "file") return null;
    const blob = await readBlob(item.id);
    if (!blob) return null;
    return {
      id: item.id,
      name: item.name,
      mime: item.mime || blob.type || "application/octet-stream",
      size: item.size || blob.size,
      blob
    };
  };

  const writeTextFile = async (id, content, options = {}) => {
    const items = await loadTreeItems();
    const item = findItemById(items, id);
    if (!item || item.type !== "file") return null;
    const name = options.name || item.name || "未命名.txt";
    const mime = options.mime || item.mime || "text/plain";
    const blob = new Blob([content], { type: mime });
    await writeBlob(item.id, blob);
    item.name = name;
    item.mime = mime;
    item.size = blob.size;
    await saveTreeItems(items);
    return { id: item.id, name, mime, size: item.size };
  };

  const createTextFile = async (name, content, parentId = null) => {
    const items = await loadTreeItems();
    const target = parentId ? findItemById(items, parentId) : null;
    const folder = target && target.type === "folder" ? target : { children: items };
    if (!folder.children) folder.children = [];
    const id = createId();
    const mime = "text/plain";
    const blob = new Blob([content], { type: mime });
    const fileItem = {
      id,
      name: name || "未命名.txt",
      type: "file",
      mime,
      size: blob.size
    };
    folder.children.push(fileItem);
    await writeBlob(id, blob);
    await saveTreeItems(items);
    return fileItem;
  };

  const buildFilesApp = () => {
    const app = document.createElement("div");
    app.className = "files-app";
    const rightMenuApi = window.RightMenuAPI;
    const fxui = window.FxUI;

    const toolbar = document.createElement("div");
    toolbar.className = "files-toolbar";

    const menuGroup = document.createElement("div");
    menuGroup.className = "files-menu-group";

    const importBtn = fxui.createButton({ label: "导入文件", title: "导入文件", className: "files-menu-btn" });

    const opsMenu = document.createElement("div");
    opsMenu.className = "files-menu";

    const opsBtn = fxui.createButton({ label: "操作", title: "操作", className: "files-menu-btn" });

    const opsDropdown = document.createElement("div");
    opsDropdown.className = "files-dropdown";
    const opsActions = [
      { label: "复制", action: "copy" },
      { label: "粘贴", action: "paste" },
      { label: "剪切", action: "cut" },
      { label: "删除", action: "delete" },
      { label: "重命名", action: "rename" },
      { label: "导出", action: "export" }
    ];
    opsActions.forEach((item) => {
      const btn = fxui.createButton({ label: item.label, title: item.label, className: "files-dropdown-btn" });
      btn.dataset.action = item.action;
      opsDropdown.appendChild(btn);
    });

    opsMenu.appendChild(opsBtn);
    opsMenu.appendChild(opsDropdown);

    const newFolderBtn = fxui.createButton({ label: "新文件夹", title: "新文件夹", className: "files-menu-btn" });

    const aboutBtn = fxui.createButton({ label: "关于", title: "关于", className: "files-menu-btn" });

    menuGroup.appendChild(importBtn);
    menuGroup.appendChild(opsMenu);
    menuGroup.appendChild(newFolderBtn);
    menuGroup.appendChild(aboutBtn);

    const navGroup = document.createElement("div");
    navGroup.className = "files-nav-group";

    const forwardBtn = fxui.createButton({ label: "前进", title: "前进", className: "files-nav-btn" });
    const backBtn = fxui.createButton({ label: "后退", title: "后退", className: "files-nav-btn" });
    const refreshBtn = fxui.createButton({ label: "刷新", title: "刷新", className: "files-nav-btn" });

    navGroup.appendChild(forwardBtn);
    navGroup.appendChild(backBtn);
    navGroup.appendChild(refreshBtn);

    toolbar.appendChild(menuGroup);
    toolbar.appendChild(navGroup);

    const address = document.createElement("div");
    address.className = "files-address";

    const addressInput = fxui.createInput({
      label: "",
      value: "",
      readOnly: true,
      className: "files-address-input"
    });

    address.appendChild(addressInput.root);

    const list = document.createElement("div");
    list.className = "files-list";

    const status = document.createElement("div");
    status.className = "files-status";

    const statusLeft = document.createElement("span");
    const statusRight = document.createElement("span");
    status.appendChild(statusLeft);
    status.appendChild(statusRight);

    const modalMask = document.createElement("div");
    modalMask.className = "files-modal-mask";

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.multiple = true;
    fileInput.hidden = true;

    app.appendChild(toolbar);
    app.appendChild(address);
    app.appendChild(list);
    app.appendChild(status);
    app.appendChild(modalMask);
    app.appendChild(fileInput);

    let store = { items: [] };
    let storeReady = false;
    let hasPendingChanges = false;
    let currentPath = [];
    let history = [currentPath];
    let historyIndex = 0;
    let selectedId = null;
    let clipboard = null;
    let fileContextMenu = null;

    const closeMenus = () => {
      opsDropdown.classList.remove("is-open");
      fileContextMenu?.hide();
    };

    const setStatus = (item) => {
      if (!item) {
        statusLeft.textContent = "未选择";
        statusRight.textContent = "";
        return;
      }
      statusLeft.textContent = `${item.name}`;
      statusRight.textContent = `${fileTypeLabel(item)} · ${item.type === "folder" ? "--" : formatSize(item.size)}`;
    };

    const updateAddress = () => {
      if (currentPath.length === 0) {
        addressInput.setValue("/");
        return;
      }
      const parts = [];
      let cursor = { children: store.items };
      for (const id of currentPath) {
        const next = (cursor.children || []).find((child) => child.id === id);
        if (!next) break;
        parts.push(next.name);
        cursor = next;
      }
      addressInput.setValue(`/${parts.join("/")}/`);
    };

    const renderList = () => {
      list.innerHTML = "";
      if (!storeReady) {
        const loading = document.createElement("div");
        loading.className = "files-loading";
        loading.textContent = "加载中...";
        list.appendChild(loading);
        setStatus(null);
        return;
      }
      const folder = getFolderByPath(store, currentPath);
      const items = folder.children || [];
      if (items.length === 0) {
        const empty = document.createElement("div");
        empty.className = "files-empty";
        empty.textContent = "此处还没有文件";
        list.appendChild(empty);
        setStatus(null);
        return;
      }
      items.forEach((item) => {
        const row = document.createElement("div");
        row.className = "files-item";
        row.dataset.id = item.id;

        const icon = document.createElement("img");
        icon.className = "files-item-icon";
        icon.src = iconForItem(item);
        icon.alt = "";

        const name = document.createElement("div");
        name.className = "files-item-name";
        name.textContent = item.name;

        const type = document.createElement("div");
        type.className = "files-item-type";
        type.textContent = fileTypeLabel(item);

        const size = document.createElement("div");
        size.className = "files-item-size";
        size.textContent = item.type === "folder" ? "--" : formatSize(item.size);

        row.appendChild(icon);
        row.appendChild(name);
        row.appendChild(type);
        row.appendChild(size);

        if (item.id === selectedId) {
          row.classList.add("is-selected");
        }

        list.appendChild(row);
      });
      if (selectedId) {
        const selected = findItemAndParent(store.items, selectedId);
        setStatus(selected?.item || null);
      }
    };

    const selectById = (id) => {
      selectedId = id || null;
      list.querySelectorAll(".files-item").forEach((row) => {
        row.classList.toggle("is-selected", row.dataset.id === selectedId);
      });
      if (!selectedId) {
        setStatus(null);
        return;
      }
      const selected = findItemAndParent(store.items, selectedId);
      setStatus(selected?.item || null);
    };

    const refreshView = () => {
      updateAddress();
      const folder = getFolderByPath(store, currentPath);
      sortFolderChildren(folder);
      renderList();
      if (storeReady) {
        void saveStore(store);
      }
    };

    const markDirty = () => {
      if (!storeReady) {
        hasPendingChanges = true;
      }
    };

    const pushHistory = (nextPath) => {
      history = history.slice(0, historyIndex + 1);
      history.push(nextPath);
      historyIndex = history.length - 1;
    };

    const navigateTo = (pathIds) => {
      currentPath = pathIds.slice();
      pushHistory(currentPath);
      selectedId = null;
      refreshView();
    };

    const openItem = async (item) => {
      if (item.type === "folder") {
        currentPath = [...currentPath, item.id];
        pushHistory(currentPath);
        selectedId = null;
        refreshView();
        return;
      }
      const blob = await readBlob(item.id);
      if (!blob) return;
      const previewType = getPreviewType(item);
      if (previewType === "text" && window.NoteApp?.openWithContent) {
        const text = await blob.text();
        window.NoteApp.openWithContent(item.name || "未命名.txt", text, item.id);
        return;
      }
      if (["image", "video", "audio", "pdf"].includes(previewType)) {
        const preview = buildPreviewWindow(item, previewType, blob);
        if (preview) previewIndex = (previewIndex + 1) % 12;
        return;
      }
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = item.name || "download";
      link.click();
      URL.revokeObjectURL(link.href);
    };

    const addFiles = async (files) => {
      const folder = getFolderByPath(store, currentPath);
      if (!folder.children) folder.children = [];
      for (const file of Array.from(files)) {
        const id = createId();
        folder.children.push({
          id,
          name: file.name,
          type: "file",
          mime: file.type || "",
          size: file.size
        });
        markDirty();
        refreshView();
        try {
          await writeBlob(id, file);
        } catch {
          // Ignore blob write failures.
        }
      }
    };

    const createFolder = (name) => {
      const folder = getFolderByPath(store, currentPath);
      if (!folder.children) folder.children = [];
      folder.children.push({
        id: createId(),
        name,
        type: "folder",
        children: []
      });
      markDirty();
      refreshView();
    };

    const showModal = (content) => {
      modalMask.innerHTML = "";
      modalMask.appendChild(content);
      modalMask.classList.add("is-open");
    };

    const closeModal = () => {
      modalMask.classList.remove("is-open");
      modalMask.innerHTML = "";
    };

    const openImportModal = () => {
      const modal = document.createElement("div");
      modal.className = "files-modal";
      modal.innerHTML = "<h3>导入文件</h3><p>拖放文件到此处，或点击下方按钮选择文件。</p>";
      const dropZone = document.createElement("div");
      dropZone.className = "files-drop-zone";
      dropZone.textContent = "将文件拖放到这里";
      const actions = document.createElement("div");
      actions.className = "files-modal-actions";
      const pickBtn = fxui.createButton({ label: "选择文件", title: "选择文件", className: "files-modal-btn" });
      const closeBtn = fxui.createButton({ label: "关闭", title: "关闭", className: "files-modal-btn" });
      actions.appendChild(pickBtn);
      actions.appendChild(closeBtn);
      modal.appendChild(dropZone);
      modal.appendChild(actions);
      showModal(modal);

      pickBtn.addEventListener("click", () => {
        fileInput.click();
      });

      closeBtn.addEventListener("click", closeModal);

      dropZone.addEventListener("dragover", (event) => {
        event.preventDefault();
      });

      dropZone.addEventListener("drop", (event) => {
        event.preventDefault();
        if (event.dataTransfer?.files?.length) {
          void addFiles(event.dataTransfer.files);
        }
        closeModal();
      });
    };

    const openFolderModal = () => {
      const modal = document.createElement("div");
      modal.className = "files-modal";
      modal.innerHTML = "<h3>新文件夹</h3><p>请输入新文件夹名称</p>";
      const input = fxui.createInput({
        label: "",
        value: "新文件夹",
        placeholder: "新文件夹",
        className: "files-modal-input"
      });
      const actions = document.createElement("div");
      actions.className = "files-modal-actions";
      const okBtn = fxui.createButton({ label: "创建", title: "创建", className: "files-modal-btn" });
      const cancelBtn = fxui.createButton({ label: "取消", title: "取消", className: "files-modal-btn" });
      actions.appendChild(cancelBtn);
      actions.appendChild(okBtn);
      modal.appendChild(input.root);
      modal.appendChild(actions);
      showModal(modal);
      input.input.focus();

      okBtn.addEventListener("click", () => {
        const name = input.getValue().trim();
        if (name) createFolder(name);
        closeModal();
      });

      cancelBtn.addEventListener("click", closeModal);
    };

    let aboutWindow = null;

    const openAboutModal = () => {
      if (aboutWindow) {
        aboutWindow.restore();
        return;
      }
      const content = document.createElement("div");
      content.className = "about-app";
      content.innerHTML = "<div class=\"about-title\">Serika文件管理器</div><div class=\"about-version\">Serika文件管理器是Trinity Web桌面环境的一部分</div><div class=\"about-version\">版本 0.1.0</div><div class=\"about-version\">导入的文件仅保存在本地，Trinity Web应用平台不会存储任何用户文件</div>";
      aboutWindow = window.WindowAPI.createWindow({
        title: "关于文件管理器",
        content,
        appPath: "apps/files",
        rect: { width: 300, height: 200, x: 160, y: 120 },
        maximizable: false,
        resizable: false,
        onClose: () => {
          aboutWindow = null;
        }
      });
    };

    const openRenameModal = (item) => {
      const modal = document.createElement("div");
      modal.className = "files-modal";
      modal.innerHTML = "<h3>重命名</h3><p>请输入新名称</p>";
      const input = fxui.createInput({
        label: "",
        value: item.name || "",
        placeholder: "新名称",
        className: "files-modal-input"
      });
      const actions = document.createElement("div");
      actions.className = "files-modal-actions";
      const okBtn = fxui.createButton({ label: "确定", title: "确定", className: "files-modal-btn" });
      const cancelBtn = fxui.createButton({ label: "取消", title: "取消", className: "files-modal-btn" });
      actions.appendChild(cancelBtn);
      actions.appendChild(okBtn);
      modal.appendChild(input.root);
      modal.appendChild(actions);
      showModal(modal);
      input.input.focus();

      okBtn.addEventListener("click", () => {
        const name = input.getValue().trim();
        if (name) {
          item.name = name;
          markDirty();
          refreshView();
        }
        closeModal();
      });

      cancelBtn.addEventListener("click", closeModal);
    };

    const buildPreviewShell = (titleText) => {
      const wrapper = document.createElement("div");
      wrapper.className = "files-preview";

      const toolbar = document.createElement("div");
      toolbar.className = "files-preview-toolbar";

      const title = document.createElement("div");
      title.className = "files-preview-title";
      title.textContent = titleText;

      const controls = document.createElement("div");
      controls.className = "files-preview-controls";

      toolbar.appendChild(title);
      toolbar.appendChild(controls);

      const body = document.createElement("div");
      body.className = "files-preview-body";

      wrapper.appendChild(toolbar);
      wrapper.appendChild(body);

      return { wrapper, controls, body };
    };

    const addControlButton = (label, onClick) => {
      const button = fxui.createButton({ label, title: label, className: "files-preview-btn", onClick });
      return button;
    };

    const openPreviewWindow = (titleText, contentEl, onClose) => {
      const windowRef = window.WindowAPI.createWindow({
        title: titleText,
        content: contentEl,
        appPath: "apps/files",
        rect: { width: 640, height: 420, x: 180 + previewIndex * 22, y: 120 + previewIndex * 18 },
        maximizable: true,
        resizable: true,
        onClose: () => {
          if (typeof onClose === "function") {
            onClose();
          }
        }
      });
      return windowRef;
    };

    const buildPreviewWindow = (item, previewType, blob) => {
      if (!blob) return null;
      const shell = buildPreviewShell(item.name || "预览");
      const blobUrl = URL.createObjectURL(blob);
      const cleanup = () => {
        URL.revokeObjectURL(blobUrl);
      };

      if (previewType === "image") {
        const img = document.createElement("img");
        img.className = "files-preview-image";
        img.src = blobUrl;
        img.alt = item.name || "";
        let scale = 1;
        const applyScale = () => {
          img.style.transform = `scale(${scale})`;
        };
        shell.body.appendChild(img);
        shell.controls.appendChild(addControlButton("放大", () => {
          scale = Math.min(3, scale + 0.2);
          applyScale();
        }));
        shell.controls.appendChild(addControlButton("缩小", () => {
          scale = Math.max(0.4, scale - 0.2);
          applyScale();
        }));
        shell.controls.appendChild(addControlButton("原始", () => {
          scale = 1;
          applyScale();
        }));
        shell.controls.appendChild(addControlButton("下载", () => {
          const link = document.createElement("a");
          link.href = blobUrl;
          link.download = item.name || "image";
          link.click();
        }));
        openPreviewWindow(item.name || "图片预览", shell.wrapper, cleanup);
        return shell;
      }

      if (previewType === "video") {
        const video = document.createElement("video");
        video.className = "files-preview-media";
        video.src = blobUrl;
        video.controls = true;
        shell.body.appendChild(video);
        shell.controls.appendChild(addControlButton("播放/暂停", () => {
          if (video.paused) video.play();
          else video.pause();
        }));
        shell.controls.appendChild(addControlButton("静音", () => {
          video.muted = !video.muted;
        }));
        shell.controls.appendChild(addControlButton("全屏", () => {
          if (video.requestFullscreen) video.requestFullscreen();
        }));
        shell.controls.appendChild(addControlButton("下载", () => {
          const link = document.createElement("a");
          link.href = blobUrl;
          link.download = item.name || "video";
          link.click();
        }));
        openPreviewWindow(item.name || "视频预览", shell.wrapper, cleanup);
        return shell;
      }

      if (previewType === "audio") {
        const audio = document.createElement("audio");
        audio.className = "files-preview-media";
        audio.src = blobUrl;
        audio.controls = true;
        shell.body.appendChild(audio);
        shell.controls.appendChild(addControlButton("播放/暂停", () => {
          if (audio.paused) audio.play();
          else audio.pause();
        }));
        shell.controls.appendChild(addControlButton("静音", () => {
          audio.muted = !audio.muted;
        }));
        shell.controls.appendChild(addControlButton("循环", () => {
          audio.loop = !audio.loop;
        }));
        shell.controls.appendChild(addControlButton("下载", () => {
          const link = document.createElement("a");
          link.href = blobUrl;
          link.download = item.name || "audio";
          link.click();
        }));
        openPreviewWindow(item.name || "音乐播放器", shell.wrapper, cleanup);
        return shell;
      }

      if (previewType === "pdf") {
        const frame = document.createElement("iframe");
        frame.className = "files-preview-frame";
        frame.src = blobUrl;
        frame.title = item.name || "PDF";
        shell.body.appendChild(frame);
        let scale = 1;
        const applyScale = () => {
          frame.style.transform = `scale(${scale})`;
          frame.style.transformOrigin = "0 0";
          frame.style.width = `${100 / scale}%`;
          frame.style.height = `${100 / scale}%`;
        };
        applyScale();
        shell.controls.appendChild(addControlButton("放大", () => {
          scale = Math.min(2.5, scale + 0.2);
          applyScale();
        }));
        shell.controls.appendChild(addControlButton("缩小", () => {
          scale = Math.max(0.6, scale - 0.2);
          applyScale();
        }));
        shell.controls.appendChild(addControlButton("原始", () => {
          scale = 1;
          applyScale();
        }));
        shell.controls.appendChild(addControlButton("下载", () => {
          const link = document.createElement("a");
          link.href = blobUrl;
          link.download = item.name || "document";
          link.click();
        }));
        openPreviewWindow(item.name || "PDF 查看器", shell.wrapper, cleanup);
        return shell;
      }

      return null;
    };

    const doCopy = () => {
      if (!selectedId) return;
      clipboard = { mode: "copy", id: selectedId };
    };

    const doCut = () => {
      if (!selectedId) return;
      clipboard = { mode: "cut", id: selectedId };
    };

    const cloneItemWithBlobs = async (item) => {
      const base = {
        id: createId(),
        name: item.name,
        type: item.type,
        mime: item.mime,
        size: item.size
      };
      if (item.type === "folder") {
        base.children = [];
        for (const child of item.children || []) {
          base.children.push(await cloneItemWithBlobs(child));
        }
        return base;
      }
      const blob = await readBlob(item.id);
      if (blob) {
        await writeBlob(base.id, blob);
      }
      return base;
    };

    const deleteItemBlobs = async (item) => {
      if (item.type === "folder") {
        for (const child of item.children || []) {
          await deleteItemBlobs(child);
        }
        return;
      }
      await deleteBlob(item.id);
    };

    const doPaste = async () => {
      if (!clipboard) return;
      const found = findItemAndParent(store.items, clipboard.id);
      if (!found || !found.item) return;
      const targetFolder = getFolderByPath(store, currentPath);
      if (!targetFolder.children) targetFolder.children = [];
      if (clipboard.mode === "copy") {
        const cloned = await cloneItemWithBlobs(found.item);
        targetFolder.children.push(cloned);
      } else if (clipboard.mode === "cut") {
        if (found.parent) {
          found.parent.children = (found.parent.children || []).filter((child) => child.id !== found.item.id);
        } else {
          store.items = store.items.filter((child) => child.id !== found.item.id);
        }
        targetFolder.children.push(found.item);
        clipboard = null;
      }
      markDirty();
      refreshView();
    };

    const doDelete = async () => {
      if (!selectedId) return;
      const found = findItemAndParent(store.items, selectedId);
      if (!found) return;
      if (found.parent) {
        found.parent.children = (found.parent.children || []).filter((child) => child.id !== found.item.id);
      } else {
        store.items = store.items.filter((child) => child.id !== found.item.id);
      }
      selectedId = null;
      await deleteItemBlobs(found.item);
      markDirty();
      refreshView();
    };

    const doRename = () => {
      if (!selectedId) return;
      const found = findItemAndParent(store.items, selectedId);
      if (!found) return;
      openRenameModal(found.item);
    };

    const doExport = async () => {
      if (!selectedId) return;
      const found = findItemAndParent(store.items, selectedId);
      if (!found) return;
      if (found.item.type === "folder") {
        const blob = new Blob([JSON.stringify(found.item, null, 2)], { type: "application/json" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${found.item.name || "folder"}.json`;
        link.click();
        URL.revokeObjectURL(link.href);
        return;
      }
      const blob = await readBlob(found.item.id);
      if (!blob) return;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = found.item.name || "download";
      link.click();
      URL.revokeObjectURL(link.href);
    };

    const doOpen = async () => {
      if (!selectedId) return;
      const found = findItemAndParent(store.items, selectedId);
      if (!found) return;
      await openItem(found.item);
    };

    const handleAction = (action) => {
      if (action === "open") void doOpen();
      if (action === "copy") doCopy();
      if (action === "cut") doCut();
      if (action === "paste") void doPaste();
      if (action === "delete") void doDelete();
      if (action === "rename") doRename();
      if (action === "export") void doExport();
      closeMenus();
    };

    fileContextMenu = rightMenuApi?.create({
      className: "files-context",
      items: [
        { label: "打开", action: "open" },
        { label: "复制", action: "copy" },
        { label: "粘贴", action: "paste" },
        { label: "剪切", action: "cut" },
        { label: "删除", action: "delete" },
        { label: "重命名", action: "rename" },
        { label: "导出", action: "export" }
      ],
      onSelect: (action) => {
        if (action) handleAction(action);
      }
    });

    importBtn.addEventListener("click", openImportModal);
    newFolderBtn.addEventListener("click", openFolderModal);
    aboutBtn.addEventListener("click", openAboutModal);

    opsBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      opsDropdown.classList.toggle("is-open");
    });

    opsDropdown.addEventListener("click", (event) => {
      const action = event.target.closest(".fxui-btn")?.dataset.action;
      if (action) handleAction(action);
    });

    backBtn.addEventListener("click", () => {
      if (historyIndex <= 0) return;
      historyIndex -= 1;
      currentPath = history[historyIndex].slice();
      selectedId = null;
      refreshView();
    });

    forwardBtn.addEventListener("click", () => {
      if (historyIndex >= history.length - 1) return;
      historyIndex += 1;
      currentPath = history[historyIndex].slice();
      selectedId = null;
      refreshView();
    });

    refreshBtn.addEventListener("click", refreshView);

    fileInput.addEventListener("change", (event) => {
      if (event.target.files?.length) {
        void addFiles(event.target.files);
      }
      fileInput.value = "";
      closeModal();
    });

    list.addEventListener("click", (event) => {
      const row = event.target.closest(".files-item");
      if (!row) {
        selectById(null);
        return;
      }
      selectById(row.dataset.id || null);
    });

    list.addEventListener("dblclick", (event) => {
      const row = event.target.closest(".files-item");
      if (!row) return;
      const found = findItemAndParent(store.items, row.dataset.id || "");
      if (!found) return;
      void openItem(found.item);
    });

    list.addEventListener("contextmenu", (event) => {
      const row = event.target.closest(".files-item");
      if (!row) return;
      event.preventDefault();
      selectById(row.dataset.id || null);
      fileContextMenu?.show({ x: event.clientX, y: event.clientY, context: row.dataset.id || null });
    });

    app.addEventListener("click", () => {
      closeMenus();
    });

    const handleWindowClick = () => {
      closeMenus();
    };
    window.addEventListener("click", handleWindowClick);

    refreshView();

    loadStore().then((loaded) => {
      if (!hasPendingChanges) {
        store = loaded;
      }
      storeReady = true;
      refreshView();
    });

    app.cleanupContextMenu = () => {
      window.removeEventListener("click", handleWindowClick);
      fileContextMenu?.destroy();
    };

    return app;
  };

  const openFiles = () => {
    const content = buildFilesApp();
    const windowRef = window.WindowAPI.createWindow({
      title: "文件管理",
      content,
      appPath: "apps/files",
      rect: { width: 720, height: 480, x: 140 + spawnIndex * 20, y: 90 + spawnIndex * 16 },
      maximizable: true,
      resizable: true,
      onClose: () => {
        content.cleanupContextMenu?.();
      }
    });

    filesWindow = windowRef;
    spawnIndex = (spawnIndex + 1) % 10;
  };

  filesButton.addEventListener("click", (event) => {
    event.stopPropagation();
    openFiles();
  });

  window.FilesApp = {
    open: openFiles
  };

  window.FilesAPI = {
    pickFile: openFilePicker,
    readFile,
    readTextFile,
    writeTextFile,
    createTextFile
  };
});
