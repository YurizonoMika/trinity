const initPhotoEditorApp = () => {
  if (!window.WindowAPI) return;

  let spawnIndex = 0;
  const rightMenuApi = window.RightMenuAPI;

  const DEFAULT_ADJUST = {
    brightness: 100,
    contrast: 100,
    saturation: 100,
    grayscale: 0,
    invert: 0
  };

  const DEFAULT_TRANSFORM = {
    rotate: 0,
    flipX: 1,
    flipY: 1,
    zoom: 1
  };

  const buildEditor = (setTitle) => {
    const fxui = window.FxUI;
    if (!fxui) return document.createElement("div");
    const app = document.createElement("div");
    app.className = "photoeditor-app";

    const toolbar = document.createElement("div");
    toolbar.className = "photoeditor-toolbar";

    const canvasPane = document.createElement("div");
    canvasPane.className = "photoeditor-canvas-pane";

    const canvasFrame = document.createElement("div");
    canvasFrame.className = "photoeditor-canvas-frame";

    const canvas = document.createElement("canvas");
    canvas.className = "photoeditor-canvas";

    const empty = document.createElement("div");
    empty.className = "photoeditor-empty";
    empty.textContent = "导入图片开始编辑";

    canvasFrame.appendChild(empty);
    canvasPane.appendChild(canvasFrame);

    const panel = document.createElement("div");
    panel.className = "photoeditor-panel";

    const panelTitle = document.createElement("div");
    panelTitle.className = "photoeditor-panel-title";
    panelTitle.textContent = "调整";

    const info = document.createElement("div");
    info.className = "photoeditor-meta";

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.hidden = true;

    const makeButton = (label, title, iconPath, onClick) => {
      return fxui.createButton({ label, title, iconPath, onClick });
    };

    const makeSlider = (label, min, max, value, step, onInput, formatter = (val) => String(val)) => {
      return fxui.createSlider({
        label,
        min,
        max,
        value,
        step,
        onInput,
        formatValue: formatter
      });
    };

    const adjustments = { ...DEFAULT_ADJUST };
    const transform = { ...DEFAULT_TRANSFORM };

    const brightnessControl = makeSlider("亮度", 0, 200, adjustments.brightness, 1, (val) => {
      adjustments.brightness = val;
      render();
    }, (val) => `${val}%`);

    const contrastControl = makeSlider("对比度", 0, 200, adjustments.contrast, 1, (val) => {
      adjustments.contrast = val;
      render();
    }, (val) => `${val}%`);

    const saturationControl = makeSlider("饱和度", 0, 200, adjustments.saturation, 1, (val) => {
      adjustments.saturation = val;
      render();
    }, (val) => `${val}%`);

    const grayscaleControl = makeSlider("灰度", 0, 100, adjustments.grayscale, 1, (val) => {
      adjustments.grayscale = val;
      render();
    }, (val) => `${val}%`);

    const invertControl = makeSlider("反相", 0, 100, adjustments.invert, 1, (val) => {
      adjustments.invert = val;
      render();
    }, (val) => `${val}%`);

    const zoomControl = makeSlider("缩放", 10, 200, 100, 1, (val) => {
      transform.zoom = val / 100;
      updateZoom();
    }, (val) => `${val}%`);

    const openBtn = makeButton(
      "打开",
      "打开图片",
      "<path d=\"M3 4h6l1 2h3v6a2 2 0 01-2 2H3a2 2 0 01-2-2V6a2 2 0 012-2z\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.3\" stroke-linejoin=\"round\" />",
      () => openFile()
    );

    const exportBtn = makeButton(
      "导出",
      "导出图片",
      "<path d=\"M8 3v7M5 7l3 3 3-3M3 13h10\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" />",
      () => exportImage()
    );

    const resetBtn = makeButton(
      "重置",
      "重置调整",
      "<path d=\"M4 5h4M4 5l2-2M4 5l2 2M12 11h-4M12 11l-2-2M12 11l-2 2\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" />",
      () => resetAll()
    );

    const rotateLeftBtn = makeButton(
      "左转",
      "逆时针旋转",
      "<path d=\"M6 4H3v3M3 7a5 5 0 109 2\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" />",
      () => rotate(-90)
    );

    const rotateRightBtn = makeButton(
      "右转",
      "顺时针旋转",
      "<path d=\"M10 4h3v3M13 7a5 5 0 11-9 2\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" />",
      () => rotate(90)
    );

    const flipXBtn = makeButton(
      "水平",
      "水平翻转",
      "<path d=\"M3 8h10M5 5h2v6H5zM9 5h2v6H9z\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.2\" stroke-linejoin=\"round\" />",
      () => flip("x")
    );

    const flipYBtn = makeButton(
      "垂直",
      "垂直翻转",
      "<path d=\"M8 3v10M5 5h6v2H5zM5 9h6v2H5z\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.2\" stroke-linejoin=\"round\" />",
      () => flip("y")
    );

    const fitBtn = makeButton(
      "适配",
      "适配显示",
      "<path d=\"M3 6V3h3M13 6V3h-3M3 10v3h3M13 10v3h-3\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" />",
      () => fitToView()
    );

    const aboutBtn = makeButton(
      "关于",
      "关于",
      "<circle cx=\"8\" cy=\"8\" r=\"6\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.3\" /><path d=\"M8 7v4M8 4.5h.01\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.3\" stroke-linecap=\"round\" />",
      () => openAbout()
    );

    toolbar.appendChild(openBtn);
    toolbar.appendChild(exportBtn);
    toolbar.appendChild(resetBtn);
    toolbar.appendChild(rotateLeftBtn);
    toolbar.appendChild(rotateRightBtn);
    toolbar.appendChild(flipXBtn);
    toolbar.appendChild(flipYBtn);
    toolbar.appendChild(fitBtn);
    toolbar.appendChild(aboutBtn);

    panel.appendChild(panelTitle);
    panel.appendChild(brightnessControl.root);
    panel.appendChild(contrastControl.root);
    panel.appendChild(saturationControl.root);
    panel.appendChild(grayscaleControl.root);
    panel.appendChild(invertControl.root);
    panel.appendChild(document.createElement("div")).className = "photoeditor-divider";
    panel.appendChild(info);
    panel.appendChild(zoomControl.root);

    app.appendChild(toolbar);
    app.appendChild(canvasPane);
    app.appendChild(panel);
    app.appendChild(fileInput);

    let image = null;
    let imageName = "未命名";
    let aboutWindow = null;
    let objectUrl = "";

    const updateTitle = () => {
      if (typeof setTitle === "function") {
        setTitle(image ? imageName : "照片编辑器");
      }
    };

    const setInfo = () => {
      if (!image) {
        info.textContent = "请先打开一张图片";
        return;
      }
      info.textContent = `${image.width} x ${image.height}`;
    };

    const applyCanvasSize = () => {
      if (!image) return;
      const rotation = ((transform.rotate % 360) + 360) % 360;
      const swap = rotation === 90 || rotation === 270;
      canvas.width = swap ? image.height : image.width;
      canvas.height = swap ? image.width : image.height;
    };

    const render = () => {
      if (!image) return;
      applyCanvasSize();
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.filter = `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%) saturate(${adjustments.saturation}%) grayscale(${adjustments.grayscale}%) invert(${adjustments.invert}%)`;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((transform.rotate * Math.PI) / 180);
      ctx.scale(transform.flipX, transform.flipY);
      ctx.drawImage(image, -image.width / 2, -image.height / 2);
      ctx.restore();
      setInfo();
    };

    const updateZoom = () => {
      canvas.style.transform = `scale(${transform.zoom})`;
      zoomControl.setValue(Math.round(transform.zoom * 100));
    };

    const fitToView = () => {
      if (!image) return;
      const bounds = canvasPane.getBoundingClientRect();
      const width = canvas.offsetWidth || canvas.width || image.width;
      const height = canvas.offsetHeight || canvas.height || image.height;
      const ratio = Math.min(bounds.width / width, bounds.height / height, 1);
      transform.zoom = Number(ratio.toFixed(3));
      updateZoom();
    };

    const resetAll = () => {
      Object.assign(adjustments, DEFAULT_ADJUST);
      Object.assign(transform, DEFAULT_TRANSFORM);
      brightnessControl.setValue(adjustments.brightness);
      contrastControl.setValue(adjustments.contrast);
      saturationControl.setValue(adjustments.saturation);
      grayscaleControl.setValue(adjustments.grayscale);
      invertControl.setValue(adjustments.invert);
      zoomControl.setValue(100);
      updateZoom();
      render();
    };

    const rotate = (delta) => {
      if (!image) return;
      transform.rotate = (transform.rotate + delta) % 360;
      render();
      fitToView();
    };

    const flip = (axis) => {
      if (!image) return;
      if (axis === "x") transform.flipX *= -1;
      if (axis === "y") transform.flipY *= -1;
      render();
    };

    const clearImage = () => {
      image = null;
      imageName = "未命名";
      canvas.width = 0;
      canvas.height = 0;
      canvas.style.transform = "scale(1)";
      canvasFrame.innerHTML = "";
      canvasFrame.appendChild(empty);
      updateTitle();
      setInfo();
    };

    const loadFromBlob = (blob, name = "未命名") => {
      if (!blob) return;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      objectUrl = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        image = img;
        imageName = name;
        canvasFrame.innerHTML = "";
        canvasFrame.appendChild(canvas);
        updateTitle();
        resetAll();
        render();
        fitToView();
        setInfo();
        URL.revokeObjectURL(objectUrl);
        objectUrl = "";
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        objectUrl = "";
      };
      img.src = objectUrl;
    };

    const openFromFilesApi = async () => {
      if (!window.FilesAPI?.pickFile || !window.FilesAPI?.readFile) return false;
      const picked = await window.FilesAPI.pickFile({ title: "选择图片文件" });
      if (!picked) return true;
      const data = await window.FilesAPI.readFile(picked.id);
      if (!data?.blob) return true;
      if (data.mime && !data.mime.startsWith("image/")) {
        alert("请选择图片文件");
        return true;
      }
      loadFromBlob(data.blob, data.name || "未命名");
      return true;
    };

    const openFile = async () => {
      const handled = await openFromFilesApi();
      if (handled) return;
      fileInput.value = "";
      fileInput.click();
    };

    fileInput.addEventListener("change", (event) => {
      const [file] = event.target.files || [];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        alert("请选择图片文件");
        return;
      }
      loadFromBlob(file, file.name);
    });

    const exportImage = () => {
      if (!image) return;
      canvas.toBlob((blob) => {
        if (!blob) return;
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${imageName.replace(/\.[^/.]+$/, "") || "photo"}.png`;
        link.click();
        URL.revokeObjectURL(link.href);
      }, "image/png");
    };

    const openAbout = () => {
      if (aboutWindow) {
        aboutWindow.restore();
        return;
      }
      const content = document.createElement("div");
      content.className = "photoeditor-about";
      content.innerHTML = `
        <div class=\"photoeditor-about-title\">Maki 照片编辑器</div>
        <div class=\"photoeditor-about-meta\">使用全新FxUI架构构建</div>
        <div class=\"photoeditor-about-meta\">版本 0.1.0</div>
        <div class=\"photoeditor-about-meta\">Copyright © 2026 CheeseSynx，Yurizono Seia</div>
        <div class=\"photoeditor-about-section\">开放源代码许可证</div>
        <div class=\"photoeditor-about-item\">
          <div class=\"photoeditor-about-name\">mini-photo-editor</div>
          <div class=\"photoeditor-about-license\">MIT License</div>
          <a class=\"photoeditor-about-link\" href=\"https://github.com/xdadda/mini-photo-editor\" target=\"_blank\" rel=\"noopener\">https://github.com/xdadda/mini-photo-editor</a>
        </div>
      `;
      aboutWindow = window.WindowAPI.createWindow({
        title: "关于 Maki 照片编辑器",
        content,
        appPath: "apps/com.cheesesynx.photoeditor",
        rect: { width: 360, height: 295, x: 160, y: 120 },
        maximizable: false,
        resizable: false,
        onClose: () => {
          aboutWindow = null;
        }
      });
    };

    let contextMenu = null;
    if (rightMenuApi) {
      contextMenu = rightMenuApi.create({
        className: "photoeditor-menu",
        items: [
          { label: "打开", action: "open" },
          { label: "适配", action: "fit" },
          { label: "重置", action: "reset" },
          { label: "导出", action: "export" }
        ],
        onSelect: (action) => {
          if (action === "open") openFile();
          if (action === "fit") fitToView();
          if (action === "reset") resetAll();
          if (action === "export") exportImage();
        }
      });
    }

    canvasPane.addEventListener("contextmenu", (event) => {
      if (!contextMenu) return;
      event.preventDefault();
      contextMenu.show({ x: event.clientX, y: event.clientY });
    });

    const resizeObserver = new ResizeObserver(() => {
      if (image) fitToView();
    });
    resizeObserver.observe(canvasPane);

    clearImage();
    return app;
  };

  const openEditor = () => {
    let windowRef = null;
    const content = buildEditor((name) => {
      const titleEl = windowRef?.windowEl?.querySelector(".app-window-title");
      if (titleEl) {
        titleEl.textContent = name || "Maki 照片编辑器";
      }
    });

    windowRef = window.WindowAPI.createWindow({
      title: "照片编辑器",
      content,
      appPath: "apps/com.cheesesynx.photoeditor",
      rect: { width: 880, height: 540, x: 140 + spawnIndex * 24, y: 90 + spawnIndex * 18 },
      maximizable: true,
      resizable: true,
      onClose: () => {}
    });

    spawnIndex = (spawnIndex + 1) % 10;
  };

  window.PhotoEditorApp = {
    open: openEditor
  };
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPhotoEditorApp);
} else {
  initPhotoEditorApp();
}
