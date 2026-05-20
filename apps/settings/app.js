document.addEventListener("DOMContentLoaded", () => {
  const settingsButton = document.getElementById("settingsAppButton");
  if (!settingsButton || !window.WindowAPI) return;

  const VERSION = "0.1.7 release";
  const DEFAULT_WALLPAPER = "wallpaper.jpg";
  const settingsDbName = "trinitySettingsDB";
  const wallpaperStoreName = "userWallpapers";
  const avatarStoreName = "userAvatars";
  const uiStoreName = "userUiSettings";

  const getThemeColor = () => {
    const stored = localStorage.getItem("trinityThemeColor");
    if (!stored) return { r: 120, g: 190, b: 255 };
    try {
      const parsed = JSON.parse(stored);
      if (
        Number.isFinite(parsed?.r) &&
        Number.isFinite(parsed?.g) &&
        Number.isFinite(parsed?.b)
      ) {
        return parsed;
      }
    } catch {
      return { r: 120, g: 190, b: 255 };
    }
    return { r: 120, g: 190, b: 255 };
  };

  const applyThemeColor = (color) => {
    const skyBlue = {
      r: Math.min(255, Math.max(0, color.r)),
      g: Math.min(255, Math.max(0, color.g)),
      b: Math.min(255, Math.max(0, color.b))
    };
    const primary = `rgb(${skyBlue.r}, ${skyBlue.g}, ${skyBlue.b})`;
    const primaryContainer = `color-mix(in srgb, ${primary}, #ffffff 68%)`;
    const luma = (0.2126 * skyBlue.r + 0.7152 * skyBlue.g + 0.0722 * skyBlue.b) / 255;
    const onPrimary = luma > 0.55 ? "#1b1b1f" : "#ffffff";
    const onPrimaryContainer = luma > 0.55 ? "#1b1b1f" : "#2b2233";
    const outline = `color-mix(in srgb, ${primary}, #ffffff 55%)`;
    const text = luma > 0.55 ? "#1b1b1f" : "#f6f5f1";

    const root = document.documentElement.style;
    root.setProperty("--md-primary", primary);
    root.setProperty("--md-on-primary", onPrimary);
    root.setProperty("--md-primary-container", primaryContainer);
    root.setProperty("--md-on-primary-container", onPrimaryContainer);
    root.setProperty("--md-outline", outline);
    root.setProperty("--md-text", text);
    localStorage.setItem("trinityThemeColor", JSON.stringify(skyBlue));
  };

  const openSettingsDb = () => new Promise((resolve, reject) => {
    const request = indexedDB.open(settingsDbName, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(wallpaperStoreName)) {
        db.createObjectStore(wallpaperStoreName, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(avatarStoreName)) {
        db.createObjectStore(avatarStoreName, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(uiStoreName)) {
        db.createObjectStore(uiStoreName, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  const getWallpaperKey = () => {
    const name = localStorage.getItem("trinityName") || "guest";
    return `trinityWallpaper:${encodeURIComponent(name)}`;
  };

  const readWallpaperBlob = async () => {
    const db = await openSettingsDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(wallpaperStoreName, "readonly");
      const store = tx.objectStore(wallpaperStoreName);
      const request = store.get(getWallpaperKey());
      request.onsuccess = () => resolve(request.result?.blob || null);
      request.onerror = () => reject(request.error);
    });
  };

  const writeWallpaperBlob = async (blob) => {
    const db = await openSettingsDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(wallpaperStoreName, "readwrite");
      const store = tx.objectStore(wallpaperStoreName);
      store.put({ id: getWallpaperKey(), blob });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  };

  const deleteWallpaperBlob = async () => {
    const db = await openSettingsDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(wallpaperStoreName, "readwrite");
      const store = tx.objectStore(wallpaperStoreName);
      store.delete(getWallpaperKey());
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  };

  const getAvatarKey = () => {
    const name = localStorage.getItem("trinityName") || "guest";
    return `trinityAvatar:${encodeURIComponent(name)}`;
  };

  const getUiSettingsKey = () => {
    const name = localStorage.getItem("trinityName") || "guest";
    return `trinityUi:${encodeURIComponent(name)}`;
  };

  const readAvatarBlob = async () => {
    const db = await openSettingsDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(avatarStoreName, "readonly");
      const store = tx.objectStore(avatarStoreName);
      const request = store.get(getAvatarKey());
      request.onsuccess = () => resolve(request.result?.blob || null);
      request.onerror = () => reject(request.error);
    });
  };

  const writeAvatarBlob = async (blob) => {
    const db = await openSettingsDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(avatarStoreName, "readwrite");
      const store = tx.objectStore(avatarStoreName);
      store.put({ id: getAvatarKey(), blob });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  };

  const readUiSettings = async () => {
    const db = await openSettingsDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(uiStoreName, "readonly");
      const store = tx.objectStore(uiStoreName);
      const request = store.get(getUiSettingsKey());
      request.onsuccess = () => resolve(request.result?.value || null);
      request.onerror = () => reject(request.error);
    });
  };

  const writeUiSettings = async (value) => {
    const db = await openSettingsDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(uiStoreName, "readwrite");
      const store = tx.objectStore(uiStoreName);
      store.put({ id: getUiSettingsKey(), value });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  };

  const applyUiSettings = (value) => {
    const root = document.documentElement;
    const glassEnabled = value?.glassEnabled !== false;
    const animationEnabled = value?.animationEnabled !== false;
    const lowTransparencyEnabled = value?.lowTransparencyEnabled === true;
    root.classList.toggle("ui-no-glass", !glassEnabled);
    root.classList.toggle("ui-no-anim", !animationEnabled);
    root.classList.toggle("ui-low-transparency", lowTransparencyEnabled);
  };

  const applyWallpaper = async (dataUrl) => {
    const stage = document.querySelector(".stage");
    if (!stage) return;
    const url = dataUrl ? `url('${dataUrl}')` : `url('${DEFAULT_WALLPAPER}')`;
    stage.style.setProperty("--wallpaper-url", url);
    stage.style.backgroundImage = url;
    stage.style.backgroundSize = "cover";
    stage.style.backgroundPosition = "center";
    stage.style.backgroundRepeat = "no-repeat";
    if (dataUrl) {
      try {
        const blob = dataUrlToBlob(dataUrl);
        await writeWallpaperBlob(blob);
      } catch (error) {
        console.warn("Failed to store wallpaper in IndexedDB.", error);
      }
      return;
    }
    try {
      await deleteWallpaperBlob();
    } catch (error) {
      console.warn("Failed to clear wallpaper in IndexedDB.", error);
    }
  };

  const blobToDataUrl = (blob) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(blob);
  });

  const dataUrlToBlob = (dataUrl) => {
    const comma = dataUrl.indexOf(",");
    if (comma === -1) return new Blob();
    const meta = dataUrl.slice(0, comma);
    const data = dataUrl.slice(comma + 1);
    const isBase64 = meta.includes(";base64");
    const mimeMatch = meta.match(/data:([^;]+)/);
    const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";
    if (isBase64) {
      const binary = atob(data);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      return new Blob([bytes], { type: mime });
    }
    return new Blob([decodeURIComponent(data)], { type: mime });
  };

  const isImageItem = (item) => {
    if (!item) return false;
    if (item.mime && item.mime.startsWith("image/")) return true;
    const ext = (item.name || "").split(".").pop()?.toLowerCase() || "";
    return ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext);
  };

  const pickImageFromFiles = async (title) => {
    if (!window.FilesAPI?.pickFile || !window.FilesAPI?.readFile) {
      return { unsupported: true };
    }
    const picked = await window.FilesAPI.pickFile({ title });
    if (!picked) return { canceled: true };
    if (!isImageItem(picked)) return { canceled: true };
    const fileData = await window.FilesAPI.readFile(picked.id);
    if (!fileData?.blob) return { canceled: true };
    return { dataUrl: await blobToDataUrl(fileData.blob) };
  };

  const getWallpaper = async () => {
    try {
      const blob = await readWallpaperBlob();
      if (!blob) return "";
      return await blobToDataUrl(blob);
    } catch {
      return "";
    }
  };

  const openDb = () => new Promise((resolve, reject) => {
    const request = indexedDB.open("trinityFilesDB", 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("userTrees")) {
        db.createObjectStore("userTrees", { keyPath: "userKey" });
      }
      if (!db.objectStoreNames.contains("fileBlobs")) {
        db.createObjectStore("fileBlobs", { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  const migrateUserTree = async (oldName, newName) => {
    const oldKey = `trinityFiles:${encodeURIComponent(oldName)}`;
    const newKey = `trinityFiles:${encodeURIComponent(newName)}`;
    if (oldKey === newKey) return;
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction("userTrees", "readwrite");
      const store = tx.objectStore("userTrees");
      const request = store.get(oldKey);
      request.onsuccess = () => {
        const record = request.result;
        if (record) {
          store.put({ userKey: newKey, items: record.items || [] });
          store.delete(oldKey);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  };

  const migrateDesktop = (oldName, newName) => {
    const oldKey = `trinityDesktop:${encodeURIComponent(oldName)}`;
    const newKey = `trinityDesktop:${encodeURIComponent(newName)}`;
    if (oldKey === newKey) return;
    const data = localStorage.getItem(oldKey);
    if (data) {
      localStorage.setItem(newKey, data);
      localStorage.removeItem(oldKey);
    }
  };

  const updateAvatarEverywhere = (dataUrl) => {
    const avatar = document.getElementById("avatar");
    const menuAvatar = document.getElementById("menuAvatar");
    if (avatar) {
      avatar.style.backgroundImage = dataUrl ? `url('${dataUrl}')` : "";
      avatar.classList.toggle("has-image", Boolean(dataUrl));
    }
    if (menuAvatar) {
      menuAvatar.style.backgroundImage = dataUrl ? `url('${dataUrl}')` : "";
    }
  };

  const updateNameEverywhere = (name) => {
    const menuName = document.getElementById("menuName");
    const nameInput = document.getElementById("nameInput");
    if (menuName) menuName.textContent = name || "游客";
    if (nameInput) nameInput.value = name || "";
  };

  const createSettingsUI = () => {
    const fxui = window.FxUI;
    const app = document.createElement("div");
    app.className = "settings-app";

    const sidebar = document.createElement("div");
    sidebar.className = "settings-sidebar";

    const profile = document.createElement("div");
    profile.className = "settings-profile";

    const avatar = document.createElement("div");
    avatar.className = "settings-avatar";
    const avatarImg = document.createElement("img");
    avatarImg.src = "icon/avatar.svg";
    avatarImg.alt = "";
    avatar.appendChild(avatarImg);

    const username = document.createElement("div");
    username.className = "settings-username";

    profile.appendChild(avatar);
    profile.appendChild(username);

    const menu = document.createElement("div");
    menu.className = "settings-menu";

    const menuItems = [
      { id: "overview", label: "概览" },
      { id: "personalize", label: "个性化" },
      { id: "account", label: "账户设置" },
      { id: "about", label: "关于" }
    ];

    menuItems.forEach((item) => {
      const button = fxui.createButton({ label: item.label, title: item.label, className: "settings-menu-btn" });
      button.dataset.target = item.id;
      menu.appendChild(button);
    });

    sidebar.appendChild(profile);
    sidebar.appendChild(menu);

    const content = document.createElement("div");
    content.className = "settings-content";

    const sections = {
      overview: document.createElement("div"),
      personalize: document.createElement("div"),
      account: document.createElement("div"),
      about: document.createElement("div")
    };

    Object.values(sections).forEach((section) => {
      section.className = "settings-section";
      content.appendChild(section);
    });

    const overviewCard = document.createElement("div");
    overviewCard.className = "settings-card";
    overviewCard.innerHTML = "<div class=\"settings-card-title\">当前状态</div>";

    const overviewRow = document.createElement("div");
    overviewRow.className = "settings-row";

    const wallpaperPreview = document.createElement("div");
    wallpaperPreview.className = "settings-wallpaper";

    const overviewInfo = document.createElement("div");
    overviewInfo.innerHTML = `<div>用户名：<span id=\"settingsOverviewName\"></span></div><div>版本：${VERSION}</div>`;

    overviewRow.appendChild(wallpaperPreview);
    overviewRow.appendChild(overviewInfo);
    overviewCard.appendChild(overviewRow);
    sections.overview.appendChild(overviewCard);

    const personalizeCard = document.createElement("div");
    personalizeCard.className = "settings-card";
    personalizeCard.innerHTML = "<div class=\"settings-card-title\">壁纸</div>";

    const wallpaperRow = document.createElement("div");
    wallpaperRow.className = "settings-row";

    const uploadWallpaper = document.createElement("input");
    uploadWallpaper.type = "file";
    uploadWallpaper.accept = "image/*";
    uploadWallpaper.hidden = true;

    const uploadBtn = fxui.createButton({ label: "更换壁纸", title: "更换壁纸", className: "settings-button" });
    const resetBtn = fxui.createButton({ label: "恢复默认", title: "恢复默认", className: "settings-button" });

    wallpaperRow.appendChild(wallpaperPreview.cloneNode(true));
    wallpaperRow.appendChild(uploadBtn);
    wallpaperRow.appendChild(resetBtn);
    personalizeCard.appendChild(wallpaperRow);
    personalizeCard.appendChild(uploadWallpaper);

    const colorCard = document.createElement("div");
    colorCard.className = "settings-card";
    colorCard.innerHTML = "<div class=\"settings-card-title\">配色方案</div>";

    const colorRow = document.createElement("div");
    colorRow.className = "settings-row";

    const colorList = document.createElement("div");
    colorList.className = "settings-color-list";

    const colors = [
      { r: 120, g: 190, b: 255 },
      { r: 255, g: 164, b: 96 },
      { r: 120, g: 230, b: 200 },
      { r: 190, g: 150, b: 255 },
      { r: 255, g: 120, b: 160 }
    ];

    colors.forEach((color) => {
      const dot = fxui.createButton({ label: "", title: "切换配色", className: "settings-color" });
      dot.style.background = `rgb(${color.r}, ${color.g}, ${color.b})`;
      dot.addEventListener("click", () => {
        applyThemeColor(color);
      });
      colorList.appendChild(dot);
    });

    colorRow.appendChild(colorList);
    colorCard.appendChild(colorRow);

    sections.personalize.appendChild(personalizeCard);
    sections.personalize.appendChild(colorCard);

    const effectsCard = document.createElement("div");
    effectsCard.className = "settings-card";
    effectsCard.innerHTML = "<div class=\"settings-card-title\">界面效果（调整此项可能导致界面渲染异常）</div>";

    let updateUiSettings = async () => {};
    const handleSwitchChange = () => {
      void updateUiSettings();
    };

    const blurRow = document.createElement("div");
    blurRow.className = "settings-row settings-toggle-row";
    blurRow.innerHTML = "<span>毛玻璃效果</span>";
    const blurSwitch = fxui.createSwitch({ label: "", checked: true, className: "settings-switch", onChange: handleSwitchChange });
    blurRow.appendChild(blurSwitch.root);

    const animRow = document.createElement("div");
    animRow.className = "settings-row settings-toggle-row";
    animRow.innerHTML = "<span>界面动画</span>";
    const animSwitch = fxui.createSwitch({ label: "", checked: true, className: "settings-switch", onChange: handleSwitchChange });
    animRow.appendChild(animSwitch.root);

    const lowTransparencyRow = document.createElement("div");
    lowTransparencyRow.className = "settings-row settings-toggle-row";
    lowTransparencyRow.innerHTML = "<span>降低透明度</span>";
    const lowTransparencySwitch = fxui.createSwitch({ label: "", checked: false, className: "settings-switch", onChange: handleSwitchChange });
    lowTransparencyRow.appendChild(lowTransparencySwitch.root);

    effectsCard.appendChild(blurRow);
    effectsCard.appendChild(animRow);
    effectsCard.appendChild(lowTransparencyRow);
    sections.personalize.appendChild(effectsCard);

    const accountCard = document.createElement("div");
    accountCard.className = "settings-card";
    accountCard.innerHTML = "<div class=\"settings-card-title\">账户信息</div>";

    const accountWrap = document.createElement("div");
    accountWrap.className = "settings-account";

    const accountInfo = document.createElement("div");
    accountInfo.className = "settings-account-info";

    const accountAvatar = document.createElement("div");
    accountAvatar.className = "settings-account-avatar";
    const accountAvatarImg = document.createElement("img");
    accountAvatarImg.src = "icon/avatar.svg";
    accountAvatarImg.alt = "";
    accountAvatar.appendChild(accountAvatarImg);

    const accountName = document.createElement("div");
    accountName.className = "settings-account-name";

    accountInfo.appendChild(accountAvatar);
    accountInfo.appendChild(accountName);

    const accountActions = document.createElement("div");
    accountActions.className = "settings-account-actions";

    const editBtn = fxui.createButton({ label: "更改用户信息", title: "更改用户信息", className: "settings-button settings-primary-button" });
    const deleteBtn = fxui.createButton({ label: "清空本地存储", title: "清空本地存储", className: "settings-button settings-danger-button" });

    accountActions.appendChild(editBtn);
    accountActions.appendChild(deleteBtn);

    accountWrap.appendChild(accountInfo);
    accountWrap.appendChild(accountActions);

    accountCard.appendChild(accountWrap);
    sections.account.appendChild(accountCard);

    const aboutCard = document.createElement("div");
    aboutCard.className = "settings-card";
    aboutCard.innerHTML = `
      <div class=\"settings-card-title\">关于</div>
      <div class=\"settings-meta\">Trinity Web应用平台版本：${VERSION}</div>
      <div class=\"settings-meta\">浏览器：${navigator.userAgent}</div>
      <div class=\"settings-meta\">Copyright © 2026 CheeseSynx，Yurizono Seia</div>
    `;
    sections.about.appendChild(aboutCard);

    const modal = document.createElement("div");
    modal.className = "settings-modal";
    modal.innerHTML = `
      <div class=\"settings-modal-card\">
        <div class=\"settings-modal-title\"></div>
        <div class=\"settings-modal-message\"></div>
        <div class=\"settings-modal-actions\"></div>
      </div>
    `;

    const modalActions = modal.querySelector(".settings-modal-actions");
    if (modalActions) {
      const cancelBtn = fxui.createButton({ label: "取消", title: "取消", className: "settings-button" });
      cancelBtn.dataset.action = "cancel";
      const confirmBtn = fxui.createButton({ label: "确认", title: "确认", className: "settings-button settings-danger-button" });
      confirmBtn.dataset.action = "confirm";
      modalActions.appendChild(cancelBtn);
      modalActions.appendChild(confirmBtn);
    }

    const showConfirm = (title, message) => new Promise((resolve) => {
      const titleEl = modal.querySelector(".settings-modal-title");
      const messageEl = modal.querySelector(".settings-modal-message");
      if (titleEl) titleEl.textContent = title;
      if (messageEl) messageEl.textContent = message;
      modal.classList.add("is-open");

      const onClick = (event) => {
        const action = event.target.closest(".fxui-btn")?.dataset?.action;
        if (!action) return;
        modal.classList.remove("is-open");
        modal.removeEventListener("click", onClick);
        resolve(action === "confirm");
      };

      modal.addEventListener("click", onClick);
    });

    const editModal = document.createElement("div");
    editModal.className = "settings-modal settings-modal-edit";
    editModal.innerHTML = `
      <div class=\"settings-modal-card\">
        <div class=\"settings-modal-topbar\">
          <div class=\"settings-modal-title\">更改用户信息</div>
        </div>
        <div class=\"settings-modal-body\">
          <div class=\"settings-modal-avatar\">
            <div class=\"settings-account-avatar\"></div>
            <div class=\"settings-avatar-action\"></div>
          </div>
          <input type=\"file\" accept=\"image/*\" hidden />
        </div>
      </div>
    `;

    const editTopbar = editModal.querySelector(".settings-modal-topbar");
    if (editTopbar) {
      const cancelBtn = fxui.createButton({ label: "取消", title: "取消", className: "settings-modal-icon settings-danger-pill" });
      cancelBtn.dataset.action = "cancel";
      const confirmBtn = fxui.createButton({ label: "确定", title: "确定", className: "settings-modal-icon settings-primary-pill" });
      confirmBtn.dataset.action = "confirm";
      editTopbar.insertBefore(cancelBtn, editTopbar.firstChild);
      editTopbar.appendChild(confirmBtn);
    }

    const avatarAction = editModal.querySelector(".settings-avatar-action");
    let nameInputControl = null;
    if (avatarAction) {
      const pickBtn = fxui.createButton({ label: "选择头像", title: "选择头像", className: "settings-button" });
      pickBtn.dataset.action = "pick-avatar";
      avatarAction.appendChild(pickBtn);
    }
    const editBody = editModal.querySelector(".settings-modal-body");
    if (editBody) {
      nameInputControl = fxui.createInput({
        label: "",
        placeholder: "新的用户名",
        className: "settings-input"
      });
      editBody.insertBefore(nameInputControl.root, editBody.querySelector("input[type=\"file\"]"));
    }

    const showEditUser = async () => {
      const titleName = localStorage.getItem("trinityName") || "游客";
      let avatarUrl = "";
      try {
        const blob = await readAvatarBlob();
        avatarUrl = blob ? await blobToDataUrl(blob) : "";
      } catch {
        avatarUrl = "";
      }
      const avatarBox = editModal.querySelector(".settings-account-avatar");
      const nameField = nameInputControl;
      const fileInput = editModal.querySelector("input[type=\"file\"]");
      let tempAvatar = avatarUrl || "";

      if (avatarBox) {
        avatarBox.style.backgroundImage = avatarUrl ? `url('${avatarUrl}')` : "";
      }
      if (nameField) {
        nameField.setValue(titleName === "游客" ? "" : titleName);
        nameField.input.focus();
      }

      const pickAvatar = async () => {
        const result = await pickImageFromFiles("选择头像");
        if (result?.dataUrl) {
          tempAvatar = result.dataUrl;
          if (avatarBox) avatarBox.style.backgroundImage = `url('${result.dataUrl}')`;
          return;
        }
        if (result?.canceled) return;
        if (fileInput) {
          fileInput.value = "";
        }
        fileInput?.click();
      };

      const onFileChange = (event) => {
        const [file] = event.target.files;
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          tempAvatar = String(reader.result || "");
          if (avatarBox) avatarBox.style.backgroundImage = `url('${tempAvatar}')`;
        };
        reader.readAsDataURL(file);
      };

      fileInput?.addEventListener("change", onFileChange);

      return new Promise((resolve) => {
        editModal.classList.add("is-open");

        const onClick = async (event) => {
          const action = event.target.closest(".fxui-btn")?.dataset?.action;
          if (!action) return;
          if (action === "pick-avatar") {
            await pickAvatar();
            return;
          }
          editModal.classList.remove("is-open");
          editModal.removeEventListener("click", onClick);
          fileInput?.removeEventListener("change", onFileChange);
          if (action === "confirm") {
            const newName = nameField?.getValue().trim() || titleName;
            const oldName = localStorage.getItem("trinityName") || "guest";
            if (newName && newName !== oldName) {
              localStorage.setItem("trinityName", newName);
              await migrateUserTree(oldName, newName);
              migrateDesktop(oldName, newName);
              updateNameEverywhere(newName);
            }
            if (tempAvatar) {
              try {
                const blob = dataUrlToBlob(tempAvatar);
                await writeAvatarBlob(blob);
                updateAvatarEverywhere(tempAvatar);
              } catch {
                // Ignore avatar storage failures.
              }
            }
            await syncProfile();
          }
          resolve();
        };

        editModal.addEventListener("click", onClick);
      });
    };

    const syncProfile = async (options = {}) => {
      const name = localStorage.getItem("trinityName") || "游客";
      username.textContent = name;
      accountName.textContent = name;
      let avatarUrl = "";
      try {
        const blob = await readAvatarBlob();
        avatarUrl = blob ? await blobToDataUrl(blob) : "";
      } catch {
        avatarUrl = "";
      }
      if (avatarUrl) {
        avatar.style.backgroundImage = `url('${avatarUrl}')`;
        avatarImg.style.display = "none";
        accountAvatar.style.backgroundImage = `url('${avatarUrl}')`;
        accountAvatarImg.style.display = "none";
      } else {
        avatar.style.backgroundImage = "";
        avatarImg.style.display = "block";
        accountAvatar.style.backgroundImage = "";
        accountAvatarImg.style.display = "block";
      }
      const overviewName = app.querySelector("#settingsOverviewName");
      if (overviewName) overviewName.textContent = name;
      const preview = app.querySelectorAll(".settings-wallpaper");
      const wallpaper = options.wallpaperOverride ?? await getWallpaper();
      preview.forEach((node) => {
        node.style.backgroundImage = wallpaper ? `url('${wallpaper}')` : `url('${DEFAULT_WALLPAPER}')`;
      });
    };

    const syncUiSettings = async () => {
      const stored = await readUiSettings();
      const value = stored || { glassEnabled: true, animationEnabled: true, lowTransparencyEnabled: false };
      blurSwitch.setChecked(value.glassEnabled !== false);
      animSwitch.setChecked(value.animationEnabled !== false);
      lowTransparencySwitch.setChecked(value.lowTransparencyEnabled === true);
      applyUiSettings(value);
    };

    menu.addEventListener("click", (event) => {
      const button = event.target.closest(".fxui-btn");
      if (!button) return;
      const target = button.dataset.target;
      if (!target || !sections[target]) return;
      menu.querySelectorAll(".fxui-btn").forEach((btn) => btn.classList.remove("is-active"));
      button.classList.add("is-active");
      Object.entries(sections).forEach(([key, section]) => {
        section.classList.toggle("is-active", key === target);
      });
    });

    uploadBtn.addEventListener("click", async () => {
      const result = await pickImageFromFiles("选择壁纸");
      if (result?.dataUrl) {
        await applyWallpaper(result.dataUrl);
        await syncProfile({ wallpaperOverride: result.dataUrl });
        return;
      }
      if (result?.canceled) return;
      uploadWallpaper.value = "";
      uploadWallpaper.click();
    });
    uploadWallpaper.addEventListener("change", (event) => {
      const [file] = event.target.files;
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = String(reader.result || "");
        await applyWallpaper(dataUrl);
        await syncProfile({ wallpaperOverride: dataUrl });
        uploadWallpaper.value = "";
      };
      reader.readAsDataURL(file);
    });

    resetBtn.addEventListener("click", async () => {
      await applyWallpaper("");
      await syncProfile({ wallpaperOverride: "" });
    });

    updateUiSettings = async () => {
      const value = {
        glassEnabled: blurSwitch.getChecked(),
        animationEnabled: animSwitch.getChecked(),
        lowTransparencyEnabled: lowTransparencySwitch.getChecked()
      };
      applyUiSettings(value);
      await writeUiSettings(value);
    };

    editBtn.addEventListener("click", () => {
      showEditUser();
    });

    deleteBtn.addEventListener("click", async () => {
      const confirmed = await showConfirm("删除所有数据", "确认删除所有数据？此操作不可恢复。");
      if (!confirmed) return;
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("trinity")) {
          localStorage.removeItem(key);
        }
      });
      indexedDB.deleteDatabase("trinityFilesDB");
      indexedDB.deleteDatabase(settingsDbName);
      updateAvatarEverywhere("");
      updateNameEverywhere("");
      await syncProfile();
    });

    app.appendChild(sidebar);
    app.appendChild(content);
    app.appendChild(modal);
    app.appendChild(editModal);

    menu.querySelector(".fxui-btn")?.classList.add("is-active");
    sections.overview.classList.add("is-active");
    void syncProfile();
    void syncUiSettings();

    return app;
  };

  let settingsWindow = null;

  const openSettings = () => {
    if (settingsWindow && !settingsWindow.windowEl?.isConnected) {
      settingsWindow = null;
    }
    if (settingsWindow) {
      settingsWindow.restore();
      return;
    }

    const content = createSettingsUI();

    settingsWindow = window.WindowAPI.createWindow({
      title: "设置",
      content,
      appPath: "apps/settings",
      rect: { width: 720, height: 460, x: 120, y: 70 },
      maximizable: true,
      resizable: true,
      onClose: () => {
        settingsWindow = null;
      }
    });
  };

  settingsButton.addEventListener("click", (event) => {
    event.stopPropagation();
    openSettings();
  });

  window.SettingsApp = {
    open: openSettings
  };
});
