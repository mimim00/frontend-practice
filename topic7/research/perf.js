/* ============================================================
 * perf.js —— 独立研究任务三：性能对比研究
 * 研究问题：antialias 开关、物体数量变化，对画面流畅度（帧率）有什么影响？
 * 结论写在页面底部的结果说明里（跑完 6 组后自动给结论）
 * ============================================================ */

const CANVAS_COUNTS = [100, 500, 2000, 5000];   // 要测的物体数量
const AA_STATES = [true, false];                // 要测的 antialias 状态

let renderer = null;
let scene = null;
let camera = null;
let controls = null;
let running = false;
let measuring = false;
let frames = 0;
let lastTime = 0;

const $ = (id) => document.getElementById(id);

/* ---------- 建场景：antialias 只能在 new WebGLRenderer 时定，所以要整块重建 ---------- */
function build(antialias, count) {
  if (renderer) {                       // 1) 拆掉上一次的渲染器，避免叠加一堆 canvas
    renderer.dispose();
    renderer.domElement.remove();
  }
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0f18);
  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(0, 14, 34);
  camera.lookAt(0, 0, 0);

  // ⚠ antialias 是构造参数，创建之后改不了 —— 这正是它成为"性能开关"的原因
  renderer = new THREE.WebGLRenderer({ antialias: antialias });
  renderer.setPixelRatio(1);            // 固定为 1，排除 devicePixelRatio 的干扰，保证公平对比
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(6, 12, 8);
  scene.add(dir);

  // 共享 geometry 和 material：变量只有"物体数量"，不掺内存差异
  const geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  const mat = new THREE.MeshStandardMaterial({ color: 0x4fc3f7, metalness: 0.2, roughness: 0.4 });
  const side = Math.ceil(Math.sqrt(count));
  const group = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(
      ((i % side) - side / 2) * 1.1,
      Math.floor(i / side) % 20 * 0.9 - 6,
      Math.floor(i / (side * 20)) * 1.1
    );
    mesh.rotation.set(i * 0.03, i * 0.05, 0);
    group.add(mesh);                    // 【关键】先加进 Group，再 scene.add(group) —— 只有 1 次场景图变更
  }
  scene.add(group);

  lastTime = performance.now();
  // 每组测量之间把画面清一次，避免上一轮的统计残留
  frames = 0;
}

/* ---------- 动画循环：只在 measuring 时计帧 ---------- */
const loop = () => {
  requestAnimationFrame(loop);
  const now = performance.now();
  lastTime = now;
  if (measuring) frames++;
  controls.update();
  renderer.render(scene, camera);
};

/* ---------- 测一组：先热身 600ms，再正式数 2.5 秒的帧 ---------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function measure(antialias, count) {
  build(antialias, count);
  await sleep(600);                      // 热身：跳过着色器编译、首帧上传贴图的抖动
  frames = 0;
  measuring = true;
  await sleep(2500);                     // 正式采样窗口
  measuring = false;
  const info = renderer.info.render;     // draw calls / triangles 等渲染统计
  return {
    fps: +(frames / 2.5).toFixed(1),
    calls: info.calls,
    triangles: info.triangles
  };
}

/* ---------- 结果表 ---------- */
const results = {};   // results[count][aa] = { fps, calls, triangles }

function paintCell(count, aa) {
  const td = document.getElementById(`cell-${count}-${aa ? 'on' : 'off'}`);
  const r = results[count] && results[count][aa];
  if (!r) { td.textContent = '—'; td.className = ''; return; }
  td.innerHTML = `FPS <b>${r.fps.toFixed(1)}</b><br><span class="dim">draw calls ${r.calls} · 三角形 ${r.triangles.toLocaleString()}</span>`;
  td.className = r.fps >= 50 ? 'good' : r.fps >= 30 ? 'mid' : 'bad';
}

async function runOne(count, aa) {
  $('status').textContent = `正在测量：antialias = ${aa ? '开' : '关'}，物体 ${count} 个 …`;
  results[count] = results[count] || {};
  results[count][aa] = await measure(aa, count);
  paintCell(count, aa);
}

async function runMatrix() {
  if (running) return;
  running = true;
  $('btn-run').disabled = true;
  $('btn-one').disabled = true;
  for (const count of CANVAS_COUNTS) {
    for (const aa of AA_STATES) await runOne(count, aa);
  }
  $('status').textContent = '全部 6 组测量完成 ✅';
  conclusion();
  running = false;
  $('btn-run').disabled = false;
  $('btn-one').disabled = false;
}

/* ---------- 自动生成结论 ---------- */
function conclusion() {
  const rows = CANVAS_COUNTS.map((c) => {
    const on = results[c] && results[c][true];
    const off = results[c] && results[c][false];
    if (!on || !off) return '';
    const gain = ((off.fps / on.fps - 1) * 100).toFixed(1);
    return `物体 ${c} 个：antialias 关比开高 ${gain}%（${on.fps.toFixed(1)} → ${off.fps.toFixed(1)} FPS）`;
  }).filter(Boolean);

  const first = results[CANVAS_COUNTS[0]] && results[CANVAS_COUNTS[0]][true];
  const last = results[CANVAS_COUNTS[CANVAS_COUNTS.length - 1]] && results[CANVAS_COUNTS[CANVAS_COUNTS.length - 1]][true];
  const drop = first && last ? ((1 - last.fps / first.fps) * 100).toFixed(1) : null;

  $('conclusion').innerHTML =
    '<b>结论</b><br>' +
    rows.map((r) => '· ' + r).join('<br>') +
    (drop === null ? '' :
      `<br>· antialias 全开时，物体数从 ${CANVAS_COUNTS[0]} 增到 ${CANVAS_COUNTS[CANVAS_COUNTS.length - 1]}，` +
      `FPS 下降 ${drop}%（draw calls 从 ${first.calls} 涨到 ${last.calls}）<br>`) +
    '<br><b>怎么解释</b><br>' +
    '① antialias 开的是 MSAA 多重采样抗锯齿：每个像素要采样多次再平均，边缘才不锯齿，代价是显存带宽和填充率成倍上升，' +
    '所以越是"小而多的物体 / 大量细边缘"的场景，关掉它帧率提升越明显。<br>' +
    '② 物体数量增加，最先顶不住的是 draw calls（CPU 端每帧要为每个 Mesh 发一次绘制命令），' +
    '所以"卡不卡"往往先看 draw calls 而不是三角形数 —— 解决的常规手段是把大量相同物体合并成 InstancedMesh 或合并几何体。<br>' +
    '③ 注意浏览器有垂直同步（vsync）：只要 60 FPS 没跑满，两组数据就都贴着刷新率上限（常见是 60 或 144），' +
    '差距会被"压平"看不出来 —— 这也是为什么要把物体数加到几千个才测得出区别。';
}

/* ---------- 交互 ---------- */
$('btn-run').addEventListener('click', runMatrix);
$('btn-one').addEventListener('click', async () => {
  if (running) return;
  running = true;
  $('btn-run').disabled = true;
  $('btn-one').disabled = true;
  await runOne(parseInt($('sel-count').value, 10), $('sel-aa').value === 'on');
  $('status').textContent = '单组测量完成 ✅（再点几次取平均更准）';
  running = false;
  $('btn-run').disabled = false;
  $('btn-one').disabled = false;
});

window.addEventListener('resize', () => {
  if (!renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ---------- 启动 ---------- */
build(true, 500);
loop();
