# 班主任班级管理工作台（高三2班）· 第八次课自主实践



---

## 一、运行方法

### 方式 A：本地服务器（推荐，功能完整）

在仓库根目录执行：

```
node _tools/serve.js . 8123
```

浏览器打开：

- 主页面：http://localhost:8123/practice/index.html
- 三维页：http://localhost:8123/practice/three-d/classroom.html

> 为什么必须用服务器：`fetch` 读 `data/students.json` 只有在 `http://` 下才可用，
> `file://` 双击打开会被浏览器 CORS 拦截（详见下文"错误处理"）。

### 方式 B：直接双击（降级可用）

双击 `practice/index.html` 也能打开：`fetch` 失败后自动回退到内嵌副本
`data/students.js`，页面照常显示，并弹出一条黄色提示说明"已回退"。

---

## 二、目录结构与职责

```
practice/
├── index.html                    ← 统一入口：工作台 / 学生档案 / 成绩统计 / 出勤记录 / 教室三维
├── css/style.css                 ← 自定义样式（在 Bootstrap 之后引入，黑板绿 + 粉笔黄配色）
├── js/app.js                     ← 交互与渲染：增删改查、筛选、localStorage、三张图表
├── data/
│   ├── students.json             ← 24 名学生（数据源，姓名成绩均为虚构演示数据）
│   ├── students.js               ← students.json 的内嵌副本（降级用，脚本生成，勿手改）
│   └── empty.json                ← 空数据实验文件（质量自查用）
├── three-d/
│   ├── classroom.html            ← 教室三维座位图（独立子页面，可导航进入并返回）
│   └── classroom.js              ← Three.js 场景：按 group/seat 排 6×4 课桌，颜色=出勤
├── screenshots/                  ← 11 张运行截图（质量自查证据）
└── README.md                     ← 本文件
```

> 库统一用仓库根目录 `../libs/`（Bootstrap 5.3.3 / jQuery 3.7.1 / ECharts 5.6.0 / Chart.js 4.4.4 /
> Three.js r128 / OrbitControls），与第六、七次课共用同一份，不重复拷贝。

---

## 三、六模块分解与数据流

| 模块 | 内容 | 对应课堂 | 本作品的实现 |
|---|---|---|---|
| 页面结构 | 语义化骨架、导航、区块 | 一、二 | `header/nav/main/section/footer`，五入口统一导航，当前项高亮 |
| 样式响应式 | CSS 布局、Bootstrap、三档适配 | 二、三 | `bg-class` 自定义主题 + 三档（375/768/1200）无横向滚动 |
| 交互 | 表单、筛选、增删改查 | 四、五 | 添加表单校验、行内编辑成绩/出勤、删除、按小组/出勤/关键字筛选 |
| 数据 | JSON 加载、状态处理、本地保存 | 五、六 | `fetch students.json` + `localStorage` 持久化 + 断网/空数据/格式错三状态 |
| 可视化 | 两类以上有效图表 | 六 | ECharts 分数段分布 + 各小组平均分；Chart.js 出勤构成圆环图 |
| 三维展示 | Three.js 场景 | 七 | 教室三维座位图（加分模块），桌面颜色按出勤着色、点击看详情 |

**数据流（先想清楚再写代码）**：

```
students.json ──fetch──┐
                       ├─→ state.students ──applyFilter()──→ 概览卡片 / 学生表格
localStorage（增删改）──┘        │                            分数段图 / 平均分图
students.js（内嵌兜底）            └──────────────────────→ 出勤圆环图 / 异常名单 / 三维座位
```

五个模块共用同一份 `state.students`：增删改只改数组 → `save()` → `renderAll()`，
不会出现"表格一份数据、图表另一份数据"对不上的情况。三维页读的是同一份
`students.json`，首页把某人从"出勤"改成"请假"，三维页对应桌面跟着变黄。

---

## 四、质量自查记录（讲义第六部分清单）

| 检查项 | 通过标准 | 证据 |
|---|---|---|
| 功能与边界 | 正常 / 边界 / 非法输入三遍不崩 | 自动化 36 项断言 + 截图 02 |
| 三档宽度 | 375/768/1200px 无横向滚动 | 截图 05/06/07 |
| 错误三状态 | 断网、空数据、格式错有提示 | 截图 08（断网）、09（空数据） |
| 控制台 | 无未处理红色报错 | 自动化断言含 Console 检查 |
| 可访问性 | 有 label、可 Tab、有 aria-live | skip-link、form label、aria-live 播报、键盘定位座位 |
| 仓库 | 分步提交、README 可复现 | 本文件 + 3 次提交 |

**断网 / 空数据实验入口**（与讲义"故意实验"等价，截图留证不用真去改文件名）：

- `index.html?simulate=offline` → 指向不存在的文件，模拟断网 / 路径写错
- `index.html?simulate=empty`   → 指向空数组 JSON，模拟空数据

**自动化自查**（`_tools/practice-test.js`，Chrome CDP 在真实浏览器跑）：

```
node _tools/serve.js . 8123      # 先起服务器
node _tools/practice-test.js     # 再跑自查
```

结果 **36 / 36 项通过**，覆盖：Console 无报错、24 行表格、4 卡片、3 图表、增删改查、
localStorage 持久化（刷新仍 25 行）、筛选即时生效且无残留、非法输入不注入、断网/空数据提示、
三档无横向滚动、可访问性抽查、三维画布与名单聚焦。

---

## 五、整合中踩过的真实问题（写进报告"问题与解决"）

1. **空数据被当成"格式错"吞掉了。**
   现象：加载 `empty.json` 时，空数组被 `students.length === 0` 判定为"数据格式错"，走进了降级分支，页面显示的其实是内嵌兜底数据，而不是"暂无数据"提示。
   排查：加载函数把"数组为空"和"不是数组"两件事写成了一个 `throw`。
   解决：只对 `!Array.isArray(...)` 抛错，空数组正常交给 `start()`，由它统一显示空数据提示。

2. **`setStatus(null)` 把空数据警告冲掉了。**
   现象：`start()` 里刚 `setStatus('warning', '空数组')`，回到 `loadData` 后又被 `setStatus(null)` 隐藏，空数据提示一闪而过。
   解决：状态提示只由 `start()` 一处负责，`loadData` 不再在调用后清空状态。


