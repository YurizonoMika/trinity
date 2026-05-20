document.addEventListener("DOMContentLoaded", () => {
  const aboutButton = document.getElementById("aboutAppButton");
  if (!aboutButton || !window.WindowAPI) return;

  let aboutWindow = null;

  const openAbout = () => {
    if (aboutWindow && !aboutWindow.windowEl?.isConnected) {
      aboutWindow = null;
    }
    if (aboutWindow) {
      aboutWindow.restore();
      return;
    }

    const content = document.createElement("div");
    content.className = "about-app";
    content.innerHTML = "<div class=\"about-title\">Hikari 桌面环境与窗口管理器</div><div class=\"about-title\">Hikari是Trinity Web应用平台的一部分</div><div class=\"about-version\">版本 0.1.3 alpha</div>";

    aboutWindow = window.WindowAPI.createWindow({
      title: "关于Trinity",
      content,
      appPath: "apps/about",
      rect: { width: 280, height: 200, x: 120, y: 80 },
      maximizable: false,
      resizable: false,
      onClose: () => {
        aboutWindow = null;
      }
    });
  };

  aboutButton.addEventListener("click", (event) => {
    event.stopPropagation();
    openAbout();
  });

  window.AboutApp = {
    open: openAbout
  };
});
