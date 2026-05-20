# Web App 开发指南

本指南说明如何使用 Trinity 现有 API 开发 JS App，并给出完整开发流程。

## 1. 应用目录结构

在 `apps/<appId>/` 下创建以下文件：

- `app.js` 应用入口脚本
- `style.css` 应用样式
- `app.json` 应用元数据
- `ico.svg` 或 `ico.png` 应用图标

推荐结构：
```
apps/
  my.app/
    app.js
    style.css
    app.json
    ico.svg
```

## 2. 编写 app.json

`app.json` 用于描述应用元信息以及全局入口名（用于动态加载和打开）。

示例：
```json
{
  "id": "my.app",
  "name": "我的应用",
  "icon": "apps/my.app/ico.svg",
  "global": "MyApp"
}
```

关键字段：
- `id`: 应用 ID（目录名）
- `name`: 应用显示名称
- `icon`: 图标路径
- `global`: `app.js` 中挂到 `window` 的全局对象名

## 3. 编写 app.js（应用入口）

应用应在加载后注册一个全局入口对象，至少提供 `open()` 方法：

```js
const initMyApp = () => {
  if (!window.WindowAPI) return;

  let appWindow = null;

  const buildApp = () => {
    const app = document.createElement("div");
    app.className = "my-app";
    app.textContent = "Hello Trinity";
    return app;
  };

  const open = () => {
    if (appWindow && !appWindow.windowEl?.isConnected) {
      appWindow = null;
    }
    if (appWindow) {
      appWindow.restore();
      return;
    }

    const content = buildApp();

    appWindow = window.WindowAPI.createWindow({
      title: "我的应用",
      content,
      appPath: "apps/my.app",
      rect: { width: 480, height: 320, x: 120, y: 80 },
      maximizable: true,
      resizable: true,
      onClose: () => {
        appWindow = null;
      }
    });
  };

  window.MyApp = { open };
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initMyApp, { once: true });
} else {
  initMyApp();
}
```

## 4. 编写 style.css

应用样式建议使用 `apps/<appId>/style.css`。

示例：
```css
.my-app {
  font-family: "Roboto Flex", sans-serif;
  color: #ffffff;
}
```

## 5. 使用现有 API

所有 API 文档见 [api.md](api.md)。常用能力如下：

### WindowAPI
用于创建窗口：
```js
const win = window.WindowAPI.createWindow({
  title: "My App",
  content: "<div>Hello</div>",
  appPath: "apps/my.app",
  rect: { width: 420, height: 300, x: 120, y: 80 }
});
```

### RightMenuAPI
用于统一右键菜单：
```js
const menu = window.RightMenuAPI.create({
  items: [
    { label: "打开", action: "open" },
    { label: "删除", action: "delete" }
  ],
  onSelect: (action) => {
    if (action === "open") open();
  }
});
```

### FilesAPI
用于读写文件或选择文件：
```js
const picked = await window.FilesAPI.pickFile({ textOnly: true });
if (picked) {
  const data = await window.FilesAPI.readTextFile(picked.id);
}
```

## 6. 使用 FxUI（统一控件）

FxUI 是 Trinity 内置的轻量 UI 控件库，用于替代原生 `button`/`input`/`switch`/`range`，保证风格一致。

### 基本用法
在应用中直接调用 `window.FxUI`：

```js
const fxui = window.FxUI;

const saveBtn = fxui.createButton({
  label: "保存",
  title: "保存",
  className: "my-toolbar-btn",
  onClick: () => handleSave()
});

const nameInput = fxui.createInput({
  label: "名称",
  value: "",
  placeholder: "请输入名称",
  className: "my-form-input",
  onInput: (val) => updateName(val)
});

const zoomSlider = fxui.createSlider({
  label: "缩放",
  min: 10,
  max: 200,
  value: 100,
  step: 5,
  onInput: (val) => setZoom(val)
});

const darkSwitch = fxui.createSwitch({
  label: "夜间模式",
  checked: false,
  onChange: (checked) => toggleDark(checked)
});

toolbar.appendChild(saveBtn);
panel.appendChild(nameInput.root);
panel.appendChild(zoomSlider.root);
panel.appendChild(darkSwitch.root);
```

### 读写值
- `createInput` 返回 `{ root, input, setValue(), getValue() }`
- `createSlider` 返回 `{ root, setValue(), getValue() }`
- `createSwitch` 返回 `{ root, setChecked(), getChecked() }`

### 图标按钮
`createButton` 支持 `iconPath`：

```js
const boldBtn = fxui.createButton({
  title: "加粗",
  iconPath: "<path d=\"M4 3h5a3 3 0 010 6H4z\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.4\" />",
  className: "my-icon-btn"
});
```

注意：
- FxUI 控件会自动添加 `fxui-*` 类名，样式来自 `script/libfxui/fxui.css`。
- 如需自定义外观，建议在应用的 `style.css` 中覆盖类名。

## 7. 将应用加入 Launchpad/桌面

方式一（推荐）：加入 `apps/manifest.json` 或提供 `apps/<appId>/app.json` 供 Launchpad 发现。

方式二：在桌面或主菜单右键“添加至桌面”。

注意：
- 如果应用需要被桌面/Launchpad 动态加载，请确保 `app.json` 的 `global` 与 `app.js` 中的 `window.<GlobalName>` 一致。

## 8. 开发流程（完整步骤）

1. 创建 `apps/<appId>/` 目录和基础文件。
2. 编写 `app.json` 并确认 `global` 名称。
3. 编写 `app.js`，注册 `window.<GlobalName>.open()`。
4. 编写 `style.css` 并添加必要样式。
5. 将应用加入 `apps/manifest.json`（可选但推荐）。
6. 运行页面并从 Launchpad/桌面打开应用验证。
7. 如需右键菜单、文件能力等，接入对应 API。

## 9. 常见问题

- 应用无法打开：确认 `app.json` 的 `global` 名称与 `app.js` 注册的全局对象一致。
- 图标不显示：检查 `ico.svg` 路径和文件名。
- 动态加载失败：确认 `apps/<appId>/app.js` 路径可访问。
