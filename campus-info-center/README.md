# 智慧校园 · 信息与数据展示中心

软件开发综合实践 · 期末大作业 —— 题目《信息与数据展示中心》

一个围绕 **校园公共服务 / 学习生活** 主题的响应式前端应用：查询自习室与食堂、查看校园数据可视化图表、浏览三维校园场景。**纯前端实现，无后端服务器、无数据库、无 React/Vue 框架**，符合课程技术要求。

## 技术栈

| 类别 | 技术 |
| --- | --- |
| 页面结构 | HTML5（语义化标签） |
| 样式与响应式 | CSS3 + Bootstrap 5.3（栅格系统、组件） |
| 视觉设计 | 莫兰迪色系（低饱和灰调：灰蓝 #7C8E9E、豆沙绿 #9CAF88、干枯玫瑰 #C9A7A0、陶土 #C2A48F、雾紫 #A99BB4） |
| 脚本与 DOM | JavaScript(ES6) + jQuery 3.7 |
| 数据 | 本地 JSON（fetch 异步加载 + localStorage 持久化用户修改） |
| 图表 | ECharts 5（柱状图、折线图、饼图、雷达图） |
| 三维 | Three.js（UMD 版，场景、灯光、阴影、射线拾取） |

## 功能清单（对照作业要求）

| 作业要求 | 实现位置 |
| --- | --- |
| 信息首页 | `index.html`：数据总览、功能入口、校园公告、热门自习室 |
| ≥2 个功能页面 | 自习室查询、食堂查询、数据可视化、三维校园（共 4 个） |
| 响应式适配手机与桌面 | 所有页面：Bootstrap 栅格 + 自定义媒体查询，导航折叠、卡片换行、图表重排 |
| 交互查询或管理模块 | 自习室页：**搜索 / 筛选 / 排序 / 添加 / 修改 / 删除**；食堂页：**搜索 / 筛选 / 详情** |
| 基于 JSON 的数据加载 | `data/study_rooms.json`、`data/canteens.json`、`data/stats.json` |
| ≥2 类有效图表 | `dashboard.html`：柱状图、折线图、饼图、雷达图（4 类） |
| 主题相关三维展示 | `three.html`：Three.js 三维校园（建筑、树木、道路、光照、阴影） |
| 完整的错误提示 | JSON 加载失败横幅 + 重试、file:// 协议错误引导、表单非法输入校验、空状态、WebGL 不支持提示、全局脚本错误 Toast |
| 运行说明 | 本 README + `start.bat` 一键启动 + `server.js` |

## 目录结构

```
campus-info-center/
├── index.html            # 信息首页
├── study.html            # 自习室查询与管理
├── canteen.html          # 食堂与档口查询
├── dashboard.html        # 数据可视化（ECharts）
├── three.html            # 三维校园（Three.js）
├── start.bat             # 一键启动本地服务器（Windows）
├── server.js             # 零依赖 Node 静态服务器（备用）
├── css/style.css         # 全局样式
├── js/
│   ├── main.js           # 公共库：JSON 加载、错误横幅、Toast、导航高亮
│   ├── home.js           # 首页逻辑
│   ├── study.js          # 自习室查询 / 增删改逻辑
│   ├── canteen.js        # 食堂查询逻辑
│   ├── dashboard.js      # ECharts 图表配置
│   └── three-scene.js    # Three.js 三维场景
├── data/
│   ├── study_rooms.json  # 12 间自习室
│   ├── canteens.json     # 8 家食堂、32 个档口
│   └── stats.json        # 图表与首页统计数据
└── lib/                  # 本地第三方库（离线可用）
    ├── jquery.min.js             (3.7.1)
    ├── bootstrap.min.css         (5.3.3)
    ├── bootstrap.bundle.min.js   (5.3.3)
    ├── echarts.min.js            (5.5.1)
    └── three.min.js              (r128)
```

## 运行方法（重要：不要直接双击 HTML）

浏览器出于安全策略，**禁止** `file://` 协议下的页面通过 `fetch()` 读取本地 JSON 文件，
因此必须通过本地静态服务器访问。以下方式任选其一：

### 方式一：一键启动（Windows，推荐）

双击项目根目录的 **`start.bat`**（自动检测 Python / Node.js，启动服务器并打开浏览器）。

### 方式二：Python

```bash
cd campus-info-center
python -m http.server 8000
# 浏览器访问 http://localhost:8000
```

### 方式三：Node.js（无需安装任何依赖）

```bash
cd campus-info-center
node server.js
# 浏览器访问 http://localhost:8000
```

### 方式四：VS Code Live Server 插件

用 VS Code 打开项目文件夹 → 右键 `index.html` → “Open with Live Server”。

> 端口被占用时：方式二可换端口 `python -m http.server 8080`；
> 方式三可用 `set PORT=8080 && node server.js`（CMD）或 `$env:PORT=8080; node server.js`（PowerShell）。

## 常见问题（错误提示说明）

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| 页面顶部出现红色「数据加载出错」横幅 | 通过 file:// 双击打开 / JSON 路径错误 / 服务器未启动 | 按上述任一方式启动服务器后刷新；横幅上有点击「重新加载」按钮 |
| 三维页面提示 WebGL 初始化失败 | 浏览器不支持 WebGL 或禁用了硬件加速 | 换最新版 Chrome / Edge，开启「使用硬件加速」后刷新 |
| 图表空白 | `lib/echarts.min.js` 缺失或损坏 | 确认 lib 目录 5 个文件完整 |
| 表单提交提示红色错误 | 输入非法（如可用座位 > 座位总数、名称重复） | 按红色提示修改后重新保存 |
| 搜索无结果 | 关键字或筛选条件过严 | 清空关键字或点击「↺ 重置」 |

## 在 VS Code 中开发与运行（无需安装任何插件/扩展）

1. VS Code → 文件 → 打开文件夹 → 选择 `campus-info-center` 文件夹；
2. 顶部菜单 **终端 → 运行任务** → 选择「启动本地服务器（Node）」（或 Python 任务）；
3. 再运行任务「在浏览器打开首页」，或手动访问 http://localhost:8000；
4. 也可以在底部「终端」面板直接输入 `node server.js` 或 `python -m http.server 8000`。

> 本项目**全程不需要安装任何 VS Code 扩展**：不依赖 Live Server 插件，服务器用自带的
> `server.js`（零依赖）或 Python 内置模块实现；不依赖任何第三方构建工具，
> 只使用课堂讲授的 jQuery / Bootstrap / ECharts / Three.js。

## 课程知识点对照（体现所学内容）

| 课程内容 | 在作品中的使用位置 |
| --- | --- |
| 第 1 次课 Git 代码托管与 HTML 基础 | 标题、段落、列表、链接、表格、图片等基础标签；完整 Git 提交流程 |
| 第 2 次课 语义化 HTML 表单与 CSS 基础 | `header/nav/main/section/aside/footer` 语义结构；表单 label/校验；style.css 全部样式 |
| 第 3 次课 CSS 布局响应式与 Bootstrap | Bootstrap 栅格（`col-12 col-md-6 col-xl-4`）、导航折叠、弹窗、Toast；`@media` 断点 |
| 第 4 次课 JavaScript 语法数据与函数 | 数组 filter/sort/map、对象、字符串模板、函数封装、JSON.parse |
| 第 5 次课 DOM 事件与交互应用 | input/change/click 事件、事件委托、动态渲染、表单校验 setCustomValidity |
| 第 6 次课 jQuery 异步与数据可视化 | jQuery 选择器/事件/`.html()` 渲染；fetch 异步加载 JSON；ECharts 柱状/折线/饼/雷达图 |
| 第 7 次课 Three.js 与 A-Frame 三维开发 | Three.js 场景、相机、灯光、材质贴图、Raycaster 拾取、动画循环（选 Three.js 路线） |
| 第 8 次课 前端技术整合与成果验收 | 五页整合、错误处理、响应式适配、测试与调试、README 运行说明 |

## 数据说明

- 所有数据均为**本地 JSON 模拟数据**，通过 `fetch()` 异步加载；
- 自习室页的添加 / 修改 / 删除结果保存在浏览器 `localStorage`，
  点击「♻️ 恢复原始数据」可还原为 JSON 初始状态；
- 食堂「营业中 / 已打烊」状态按当前系统时间与营业时段实时计算。

## 浏览器要求

最新版 Chrome / Edge（需支持 ES6、fetch、WebGL）。
