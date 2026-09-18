/* ============================================================
 * raycast.js —— 独立研究任务二：Raycaster 射线拾取研究
 * 研究问题：鼠标在二维屏幕上点一下，程序怎么知道点到了哪个三维物体？
 * ============================================================ */

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0f18);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 4.2, 11);
camera.lookAt(0, 1, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1, 0);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2.05;

/* ---------- 光源与地面 ---------- */
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const dir = new THREE.DirectionalLight(0xffffff, 0.9);
dir.position.set(4, 8, 6);
scene.add(dir);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(30, 20),
  new THREE.MeshStandardMaterial({ color: 0x18222f, roughness: 0.95 })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

/* ---------- 6 个可拾取物体：不同几何体 + 不同材质，排成一行 ---------- */
const items = [
  { name: '方块 BoxGeometry',        color: 0x4fc3f7, geo: () => new THREE.BoxGeometry(1.3, 1.3, 1.3) },
  { name: '球体 SphereGeometry',      color: 0xffb74d, geo: () => new THREE.SphereGeometry(0.75, 32, 32) },
  { name: '圆柱 CylinderGeometry',    color: 0x9ccc65, geo: () => new THREE.CylinderGeometry(0.6, 0.6, 1.5, 32) },
  { name: '圆环 TorusGeometry',       color: 0xe57373, geo: () => new THREE.TorusGeometry(0.6, 0.24, 16, 48) },
  { name: '圆锥 ConeGeometry',        color: 0xba68c8, geo: () => new THREE.ConeGeometry(0.75, 1.5, 32) },
  { name: '二十面体 Icosahedron',     color: 0x4dd0e1, geo: () => new THREE.IcosahedronGeometry(0.8, 0) }
];

const pickables = [];
items.forEach((it, i) => {
  const mesh = new THREE.Mesh(
    it.geo(),
    new THREE.MeshStandardMaterial({ color: it.color, metalness: 0.25, roughness: 0.35 })
  );
  mesh.position.set(-3.6 + i * 1.44, 1, 0);   // 间距收窄一点，别被左上角的说明面板挡住
  mesh.userData = { name: it.name, baseColor: it.color, baseY: 1, phase: i * 0.7 };
  scene.add(mesh);
  pickables.push(mesh);
});

/* ---------- 把射线画出来：让"从相机穿过鼠标发一条射线"看得见 ---------- */
const rayGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
const rayLine = new THREE.Line(rayGeo, new THREE.LineBasicMaterial({ color: 0xff5252 }));
rayLine.visible = false;
scene.add(rayLine);

const hitDot = new THREE.Mesh(
  new THREE.SphereGeometry(0.09, 12, 12),
  new THREE.MeshBasicMaterial({ color: 0xff1744 })
);
hitDot.visible = false;
scene.add(hitDot);

/* ---------- 核心：三个对象 + 三步 ---------- */
const raycaster = new THREE.Raycaster();     // 1) 射线投射器
const pointer = new THREE.Vector2();         // 2) 鼠标的归一化设备坐标（NDC）
const infoEl = document.getElementById('info');
let selected = null;

/* 屏幕像素坐标 → NDC：
 *   ndcX =  (鼠标 X - 画布左边) / 画布宽 * 2 - 1      → [-1, 1]，右为正
 *   ndcY = -((鼠标 Y - 画布上边) / 画布高) * 2 + 1     → [-1, 1]，上为正（Y 轴要翻转！）
 * 之所以要翻转，是因为屏幕坐标原点在左上角、Y 向下，而 NDC 原点在中心、Y 向上。 */
function toNDC(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function shoot(event) {
  toNDC(event);
  raycaster.setFromCamera(pointer, camera);        // 3) 用相机和 NDC 构造射线（内部改 ray.origin / ray.direction）
  const hits = raycaster.intersectObjects(pickables, false);
  /* intersectObjects 返回数组，每个元素形如：
   *   { distance, point, face, faceIndex, object, uv }
   * 数组按 distance 升序排好，所以 hits[0] 就是"离相机最近的那次命中"，也就是用户看到并点到的那个。
   * 第二个参数 false 表示不递归子对象；如果要连子对象一起测，传 true。 */
  return hits;
}

function reset(mesh) {
  mesh.material.emissive.setHex(0x000000);
  mesh.material.color.setHex(mesh.userData.baseColor);
  mesh.scale.setScalar(1);
}

function select(mesh, hits) {
  if (selected) reset(selected);
  selected = mesh;
  if (mesh) {
    mesh.material.emissive.setHex(0x555500);       // 自发光 → 看起来"亮起来"
    mesh.material.color.setHex(0xffffff);
    mesh.scale.setScalar(1.2);
  }
  // 画射线：从相机出发，穿过命中点再延长一段
  const hit = hits[0];
  const origin = raycaster.ray.origin;
  const end = raycaster.ray.at(hit.distance + 6, new THREE.Vector3());
  rayGeo.setFromPoints([origin.clone(), end]);
  rayLine.visible = true;
  hitDot.position.copy(hit.point);
  hitDot.visible = true;

  infoEl.classList.add('show');
  infoEl.innerHTML =
    `<b>${mesh.userData.name}</b><br>` +
    `鼠标 NDC：(${pointer.x.toFixed(3)}, ${pointer.y.toFixed(3)})<br>` +
    `命中距离：${hit.distance.toFixed(3)}<br>` +
    `命中点世界坐标：(${hit.point.x.toFixed(2)}, ${hit.point.y.toFixed(2)}, ${hit.point.z.toFixed(2)})<br>` +
    `命中面索引：${hit.faceIndex}`;
}

document.querySelector('canvas').addEventListener('click', (event) => {
  const hits = shoot(event);
  if (hits.length === 0) {                       // 点空了：清空状态，射线先留着方便观察
    if (selected) reset(selected);
    selected = null;
    hitDot.visible = false;
    infoEl.innerHTML = '<b>没点到任何物体</b><br>intersectObjects 返回长度 0 的数组。';
    return;
  }
  select(hits[0].object, hits);
});

document.querySelector('canvas').addEventListener('mousemove', (event) => {
  const hits = shoot(event);
  renderer.domElement.style.cursor = hits.length ? 'pointer' : 'crosshair';
  document.getElementById('hover').textContent = hits.length ? hits[0].object.userData.name : '（空）';
});

/* ---------- 动画：物体上下浮动 + 自转 ---------- */
const animate = () => {
  requestAnimationFrame(animate);
  const t = performance.now() * 0.001;
  pickables.forEach((m, i) => {
    m.rotation.y += 0.008;
    m.position.y = m.userData.baseY + Math.sin(t * 1.5 + m.userData.phase) * 0.18;
  });
  controls.update();
  renderer.render(scene, camera);
};
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
