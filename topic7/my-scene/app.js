/* ============================================================
 * app.js —— 自主实践：星球宇宙（太阳系）主题三维场景  ·  最终版
 * 主题：把太阳系摆进浏览器，鼠标可环绕观察、点行星看资料
 * 对应讲义第九部分任务书 8 条要求，见 lesson7/README.md 的自检表
 * ============================================================ */

/* ---------- 0. 行星数据表：数据驱动，加一行就多一颗行星 ---------- */
/* radius 半径 / dist 轨道半径 / speed 公转角速度 / spin 自转角速度 / color 颜色 */
const PLANETS = [
  { name: '水星',   radius: 0.34, dist: 5.2,  speed: 1.55, spin: 0.006, color: 0xa9a29b, fact: '离太阳最近，公转最快，一年只有 88 天' },
  { name: '金星',   radius: 0.58, dist: 7.0,  speed: 1.15, spin: 0.004, color: 0xe6c17a, fact: '浓密二氧化碳大气，表面约 465 ℃' },
  { name: '地球',   radius: 0.64, dist: 9.0,  speed: 1.00, spin: 0.010, color: 0x4a90d9, fact: '唯一已知存在生命的行星，带一颗卫星', moon: true },
  { name: '火星',   radius: 0.44, dist: 11.2, speed: 0.78, spin: 0.009, color: 0xc1440e, fact: '表面氧化铁呈红色，有太阳系最高的山' },
  { name: '木星',   radius: 1.30, dist: 14.0, speed: 0.44, spin: 0.014, color: 0xd8ca9d, fact: '质量占全部行星的 70%，大红斑是巨型风暴' },
  { name: '土星',   radius: 1.10, dist: 17.2, speed: 0.32, spin: 0.012, color: 0xe3d9a6, fact: '壮观的环由冰块与岩石碎屑组成', ring: true },
  { name: '天王星', radius: 0.88, dist: 20.2, speed: 0.23, spin: 0.010, color: 0x9fd8e0, fact: '自转轴几乎躺倒，是"滚"着公转的' },
  { name: '海王星', radius: 0.86, dist: 23.0, speed: 0.17, spin: 0.010, color: 0x4b70dd, fact: '风速可超 2000 km/h，是太阳系风暴之王' }
];
const SUN_RADIUS = 2.2;

/* ---------- 1. 场景 ---------- */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x04060f);

/* ---------- 2. 相机：fov / aspect / near / far ---------- */
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 3000);
camera.position.set(0, 18, 34);            // 拉到轨道外面俯视，才能一眼看到整个星系
camera.lookAt(0, 0, 0);

/* ---------- 3. 渲染器 ---------- */
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));   // 高分屏别渲染 3 倍，会掉帧
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

/* ---------- 4. 轨道控制器（研究任务一：鼠标拖拽旋转 + 滚轮缩放） ---------- */
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;             // 惯性阻尼：松手后还能滑一小段
controls.dampingFactor = 0.06;
controls.minDistance = 6;                  // 最近：贴近太阳系内部
controls.maxDistance = 120;                // 最远：看全景
controls.maxPolarAngle = Math.PI * 0.92;   // 允许略微俯视，但不能翻到下面去
controls.zoomSpeed = 0.8;

/* ---------- 5. 星空背景：Points + BufferGeometry（第 3 类对象） ---------- */
const STAR_COUNT = 4000;
const starPos = new Float32Array(STAR_COUNT * 3);
for (let i = 0; i < STAR_COUNT; i++) {
  // 在球壳上均匀撒点（用 acos 反解纬度，避免两极堆成一条线）
  const r = 180 + Math.random() * 320;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(Math.random() * 2 - 1);
  starPos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
  starPos[i * 3 + 1] = r * Math.cos(phi);
  starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
}
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
  color: 0xffffff, size: 1.6, sizeAttenuation: true, transparent: true, opacity: 0.85
}));
scene.add(stars);

/* ---------- 6. 恒星：太阳（球体 + 点光源 + 光晕） ---------- */
const sun = new THREE.Mesh(
  new THREE.SphereGeometry(SUN_RADIUS, 48, 48),
  new THREE.MeshBasicMaterial({ color: 0xffcc55 })     // Basic 不受光，正好当"自发光"的恒星
);
scene.add(sun);

// 光晕：外壳球，反面渲染 + 半透明，做出大气感
const glow = new THREE.Mesh(
  new THREE.SphereGeometry(SUN_RADIUS * 1.18, 32, 32),
  new THREE.MeshBasicMaterial({ color: 0xffaa33, transparent: true, opacity: 0.18, side: THREE.BackSide })
);
sun.add(glow);

// 太阳光：点光源挂在太阳中心；distance 传 0 表示不衰减，才能照亮最远的海王星
const sunLight = new THREE.PointLight(0xfff2cc, 1.8, 0, 1);
sun.add(sunLight);

/* ---------- 7. 用 Canvas 生成文字贴图，做成永远面向相机的 Sprite 标签 ---------- */
/* 全用代码画，不引入任何外部图片，规避模型/贴图版权风险 */
function makeLabel(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 34px "Microsoft YaHei", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 80, 32);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture, transparent: true, depthWrite: false, opacity: 0.85
  }));
  sprite.scale.set(2.0, 0.8, 1);
  return sprite;
}

/* ---------- 8. 行星系统：每颗行星一个 pivot（公转轴）+ mesh（自转体） ---------- */
const pickables = [];        // 能被射线点中的对象（研究任务二）
const planets = [];          // 动画循环要用的引用

PLANETS.forEach((cfg, i) => {
  // 8.1 公转轴：pivot 放在太阳中心，行星挂在 pivot 上偏离 dist
  const pivot = new THREE.Object3D();
  pivot.rotation.y = (i / PLANETS.length) * Math.PI * 2;   // 初始相位错开，不要排成一条直线
  scene.add(pivot);

  // 8.2 行星本体
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(cfg.radius, 32, 32),
    new THREE.MeshStandardMaterial({
      color: cfg.color, roughness: 0.85, metalness: 0.05,
      emissive: 0x000000                        // 预留给"点击高亮"
    })
  );
  mesh.position.x = cfg.dist;
  mesh.userData = { cfg };
  pivot.add(mesh);
  pickables.push(mesh);

  // 8.3 土星环：RingGeometry 默认躺在 xy 平面朝 +z，绕 x 轴 -90° 才躺平
  if (cfg.ring) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(cfg.radius * 1.4, cfg.radius * 2.3, 96),
      new THREE.MeshBasicMaterial({ color: 0xd7ccc8, side: THREE.DoubleSide, transparent: true, opacity: 0.7 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.rotation.z = 0.18;                     // 稍微歪一点，更真实
    mesh.add(ring);
  }

  // 8.4 地球的月球：挂在地球上，再自己绕地球转
  let moonPivot = null;
  if (cfg.moon) {
    moonPivot = new THREE.Object3D();
    mesh.add(moonPivot);
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 20, 20),
      new THREE.MeshStandardMaterial({ color: 0xcfd8dc, roughness: 0.95 })
    );
    moon.position.x = 1.3;
    moonPivot.add(moon);
  }

  // 8.5 轨道圈：一个极细的圆环，纯视觉参考（不参与拾取）
  const orbitLine = new THREE.Mesh(
    new THREE.RingGeometry(cfg.dist - 0.02, cfg.dist + 0.02, 160),
    new THREE.MeshBasicMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.18, side: THREE.DoubleSide })
  );
  orbitLine.rotation.x = -Math.PI / 2;
  scene.add(orbitLine);

  // 8.6 行星名标签
  const label = makeLabel(cfg.name);
  label.position.set(0, cfg.radius + 0.55, 0);
  mesh.add(label);

  planets.push({ cfg, pivot, mesh, moonPivot });
});

/* ---------- 9. 环境光：给行星背面一点基础亮度，否则暗面全黑 ---------- */
scene.add(new THREE.AmbientLight(0xffffff, 0.16));

/* ---------- 10. 点击拾取（研究任务二：Raycaster） ---------- */
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const infoEl = document.getElementById('info');
let selected = null;

function highlight(mesh) {
  if (selected) {                                    // 先把上一次的高亮还原
    selected.material.emissive.setHex(0x000000);
    selected.material.color.setHex(selected.userData.cfg.color);
    selected.scale.setScalar(1);
  }
  if (mesh) {
    mesh.material.emissive.setHex(0x445500);         // 高亮：加自发光
    mesh.material.color.setHex(0xffffff);            // 底色提亮，自发光才看得出来
    mesh.scale.setScalar(1.25);
    const cfg = mesh.userData.cfg;
    infoEl.innerHTML =
      `<b>${cfg.name}</b><br>半径 ${cfg.radius}（地球 = 0.64）<br>` +
      `轨道半径 ${cfg.dist}<br>公转相对速度 ${cfg.speed.toFixed(2)}<br>` +
      `<span class="fact">${cfg.fact}</span>`;
    infoEl.classList.add('show');
  } else {
    infoEl.classList.remove('show');
  }
  selected = mesh;
}

// 屏幕坐标 → 归一化设备坐标（NDC）：x、y 都落到 [-1, 1]，y 轴要翻转
function toNDC(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function pick(event) {
  toNDC(event);
  raycaster.setFromCamera(pointer, camera);                 // 从相机穿过鼠标位置发一条射线
  const hits = raycaster.intersectObjects(pickables, false); // 与哪些物体相交，结果已按距离升序
  return hits.length ? hits[0].object : null;               // 最近的命中就是用户点到的那个
}

// 区分"点击"和"拖拽"：OrbitControls 拖动结束也会触发 click，位移超过 5px 就不当作点击
let downX = 0;
let downY = 0;
renderer.domElement.addEventListener('pointerdown', (e) => { downX = e.clientX; downY = e.clientY; });
renderer.domElement.addEventListener('click', (event) => {
  if (Math.hypot(event.clientX - downX, event.clientY - downY) > 5) return;
  highlight(pick(event));
});
renderer.domElement.addEventListener('mousemove', (event) => {
  renderer.domElement.style.cursor = pick(event) ? 'pointer' : 'grab';
});

/* ---------- 11. 动画循环 + 帧率统计（研究任务三要用到 FPS） ---------- */
const clock = new THREE.Clock();
let elapsed = 0;          // 自己累计时间：getDelta 和 getElapsedTime 混用会互相"偷"时间
let frames = 0;
let fpsTimer = 0;
let paused = false;
const fpsEl = document.getElementById('fps');

const animate = () => {
  requestAnimationFrame(animate);              // 请求下一帧，写在渲染之前帧率才稳
  const raw = clock.getDelta();                // 距上一帧的秒数
  const dt = paused ? 0 : raw;                 // 暂停时把时间增量归零，画面就静止
  elapsed += dt;

  // 11.1 太阳：自转 + 光晕呼吸
  sun.rotation.y += dt * 0.15;
  glow.scale.setScalar(1 + Math.sin(elapsed * 1.8) * 0.02);

  // 11.2 行星：公转（转 pivot）+ 自转（转 mesh），月球绕地球转
  planets.forEach(({ cfg, pivot, mesh, moonPivot }) => {
    pivot.rotation.y += cfg.speed * dt * 0.25;
    mesh.rotation.y += paused ? 0 : cfg.spin;
    if (moonPivot) moonPivot.rotation.y += dt * 1.6;
  });

  // 11.3 星空极缓自转：完全不动的星空看起来像贴纸
  stars.rotation.y += dt * 0.004;

  // 11.4 帧率统计：每 0.5 秒刷新一次读数
  frames++;
  fpsTimer += raw;
  if (fpsTimer >= 0.5) {
    fpsEl.textContent = (frames / fpsTimer).toFixed(0);
    frames = 0;
    fpsTimer = 0;
  }

  controls.update();                           // 开了阻尼必须每帧 update
  renderer.render(scene, camera);
};
animate();

/* ---------- 12. 窗口适配（任务书要求 4：Three.js 场景必须做 resize） ---------- */
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;   // 1. 更新宽高比
  camera.updateProjectionMatrix();                           // 2. 更新投影矩阵
  renderer.setSize(window.innerWidth, window.innerHeight);   // 3. 重设画布尺寸
});

/* ---------- 13. 两个按钮：重置视角 / 暂停公转 ---------- */
document.getElementById('btn-reset').addEventListener('click', () => {
  camera.position.set(0, 18, 34);
  controls.target.set(0, 0, 0);
  controls.update();
  highlight(null);
});
document.getElementById('btn-pause').addEventListener('click', (e) => {
  paused = !paused;
  e.target.textContent = paused ? '继续公转' : '暂停公转';
});
