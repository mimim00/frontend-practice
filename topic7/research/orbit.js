/* ============================================================
 * orbit.js —— 独立研究任务一：OrbitControls 轨道控制器研究
 * 研究问题：OrbitControls 怎么引入？关键配置项各自控制什么？
 * ============================================================ */

/* ---------- 1. 引入方式（两行脚本，顺序不能反） ----------
 *   <script src="../../libs/three.min.js"></script>
 *   <script src="../../libs/OrbitControls.js"></script>
 * OrbitControls.js 是课程离线包里 examples/js 目录下的非模块版本，
 * 它执行时只做一件事：把 OrbitControls 类挂到 THREE 命名空间上（THREE.OrbitControls = OrbitControls）。
 * 所以必须"先 three 后 OrbitControls"——反过来会报 THREE is not defined。
 * 如果是 npm/模块方式，则要 import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'。
 * ------------------------------------------------------------ */

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1220);
scene.fog = new THREE.Fog(0x0b1220, 18, 46);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(7, 5, 10);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

/* ---------- 2. 创建控制器：一行就有鼠标交互 ---------- */
/* 构造参数是"控制哪台相机"和"监听哪个 DOM 元素上的鼠标/触摸事件" */
const controls = new THREE.OrbitControls(camera, renderer.domElement);

/* ---------- 3. 关键配置：每一条都对应面板上的一个开关 ---------- */
controls.target.set(0, 1.4, 0);        // 环绕中心（默认原点）；配合 camera.lookAt 的方向
controls.enableDamping = true;         // 惯性阻尼：松手后继续滑一小段，手感更顺
controls.dampingFactor = 0.06;         // 阻尼系数，越小越"滑"；开了阻尼必须每帧 controls.update()
controls.minDistance = 4;              // 最近距离：防止相机穿进物体内部
controls.maxDistance = 30;             // 最远距离：防止把物体缩成一个点
controls.minPolarAngle = 0.15;         // 俯仰角下限（弧度），0 = 正上方俯视
controls.maxPolarAngle = Math.PI / 2;  // 俯仰角上限：π/2 = 水平视线，超过就钻到地面以下了
controls.enablePan = true;             // 右键平移
controls.enableZoom = true;            // 滚轮缩放
controls.zoomSpeed = 0.9;
controls.enableRotate = true;          // 左键旋转
controls.autoRotate = false;           // 自动环绕：演示时很有用，交付时一般关掉
controls.autoRotateSpeed = 1.0;
controls.keyPanSpeed = 12;             // 方向键平移速度
controls.screenSpacePanning = false;   // false = 沿世界坐标平移（默认），true = 沿屏幕平面平移

/* mouseButtons 可以重映射鼠标键：THREE.MOUSE.LEFT / MIDDLE / RIGHT */
/* 例如把左键改成平移、右键改成旋转： */
/* controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }; */

/* ---------- 4. 场景内容：地面 + 一圈柱子 + 中心结环 ---------- */
scene.add(new THREE.AmbientLight(0xffffff, 0.45));
const dir = new THREE.DirectionalLight(0xffffff, 0.95);
dir.position.set(6, 10, 7);
scene.add(dir);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(10, 64),
  new THREE.MeshStandardMaterial({ color: 0x1c2b3a, roughness: 0.9 })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const grid = new THREE.GridHelper(20, 20, 0x2e5f8a, 0x1b3348);   // 网格线，方便看清环绕效果
scene.add(grid);

for (let i = 0; i < 12; i++) {
  const a = (i / 12) * Math.PI * 2;
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 1.6, 16),
    new THREE.MeshStandardMaterial({ color: 0x455a64 })
  );
  pillar.position.set(Math.cos(a) * 6.5, 0.8, Math.sin(a) * 6.5);
  scene.add(pillar);
}

const knot = new THREE.Mesh(
  new THREE.TorusKnotGeometry(1.1, 0.34, 128, 24),
  new THREE.MeshStandardMaterial({ color: 0x4fc3f7, metalness: 0.6, roughness: 0.22 })
);
knot.position.y = 1.9;
scene.add(knot);

/* ---------- 5. 面板：把 controls 的属性实时接上 ---------- */
const bind = (id, prop) => {
  const el = document.getElementById(id);
  el.checked = controls[prop];
  el.addEventListener('change', () => { controls[prop] = el.checked; });
};
bind('cb-damping', 'enableDamping');
bind('cb-pan', 'enablePan');
bind('cb-zoom', 'enableZoom');
bind('cb-autorotate', 'autoRotate');
bind('cb-ssp', 'screenSpacePanning');

const rng = (id, prop, fmt) => {
  const el = document.getElementById(id);
  const out = document.getElementById(id + '-val');
  const set = () => {
    controls[prop] = el.value.startsWith('PI') ? Math.PI * parseFloat(el.value.slice(3)) : parseFloat(el.value);
    out.textContent = fmt(controls[prop]);
  };
  el.addEventListener('input', set);
  set();
};
rng('rng-damping', 'dampingFactor', (v) => v.toFixed(2));
rng('rng-mind', 'minDistance', (v) => v.toFixed(1));
rng('rng-maxd', 'maxDistance', (v) => v.toFixed(1));
rng('rng-polar', 'maxPolarAngle', (v) => `${v.toFixed(2)} rad ≈ ${(v * 180 / Math.PI).toFixed(0)}°`);

/* ---------- 6. 监听 change 事件：体会"控制器只是在改相机" ---------- */
const camEl = document.getElementById('cam');
const distEl = document.getElementById('dist');
const evtEl = document.getElementById('evt');
let changeCount = 0;
controls.addEventListener('change', () => {
  changeCount++;
  const p = camera.position;
  camEl.textContent = `(${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`;
  distEl.textContent = p.distanceTo(controls.target).toFixed(2);
  evtEl.textContent = changeCount;
});
document.getElementById('btn-log').addEventListener('click', () => {
  const p = camera.position;
  console.log('[OrbitControls] 相机位置', p.toArray().map((n) => +n.toFixed(2)), '距离', p.distanceTo(controls.target).toFixed(2));
});

/* ---------- 7. 动画循环：开了阻尼就必须每帧 update() ---------- */
const animate = () => {
  requestAnimationFrame(animate);
  knot.rotation.y += 0.004;
  knot.position.y = 1.9 + Math.sin(performance.now() * 0.0012) * 0.15;
  controls.update();                    // 关键：不写这行，阻尼和 autoRotate 都不会生效
  renderer.render(scene, camera);
};
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
