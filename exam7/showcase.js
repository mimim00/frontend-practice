/* ============================================================
 * showcase.js —— Three.js 旋转展示台（课堂案例复现·第一步，提交）
 * 运行方式：必须用本地服务器打开 showcase.html（详见 lesson7/README.md）
 * 心智模型：三维场景 = 场景里摆东西 + 相机去看 + 渲染器不停拍
 * ============================================================ */

// ---------- 1. 场景：容器，装所有物体和光源 ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x16213e);
scene.fog = new THREE.Fog(0x16213e, 8, 20);            // 雾：远处渐隐，出氛围

// ---------- 2. 相机：fov / aspect / near / far ----------
const camera = new THREE.PerspectiveCamera(
  45,                                    // fov：视野角度，人眼约 45~60 度
  window.innerWidth / window.innerHeight, // aspect：宽高比，必须与画布一致
  0.1,                                   // near：近裁剪面
  100                                    // far：远裁剪面（雾在 20 就散尽，100 足够）
);
camera.position.set(4, 3, 6);            // 相机默认在原点，必须挪开才能看到展台

// ---------- 3. 渲染器：把相机看到的画到 canvas 上 ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;       // 【我加的】打开阴影总开关
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);   // canvas 挂到页面

// ---------- 4. 轨道控制器：左键旋转 / 滚轮缩放 / 右键平移 ----------
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.6, 0);          // 围绕展品高度转，而不是围绕地面
controls.enableDamping = true;           // 【我加的】惯性阻尼，手感更顺
controls.dampingFactor = 0.08;
controls.minDistance = 4;                // 别让相机穿进展台里
controls.maxDistance = 16;
controls.maxPolarAngle = Math.PI / 2.1;  // 不允许钻到地面以下

// ---------- 5. 光源：环境光打底 + 方向光造型（双光源） ----------
scene.add(new THREE.AmbientLight(0xffffff, 0.4));
const dir = new THREE.DirectionalLight(0xffffff, 0.8);
dir.position.set(3, 6, 4);
dir.castShadow = true;                   // 【我加的】让方向光投影
dir.shadow.mapSize.set(1024, 1024);      // 阴影贴图分辨率，越大越细越吃性能
scene.add(dir);
// 补一盏弱冷光，避免背面死黑（原案例没有，属于"故意实验"的延伸）
const fill = new THREE.DirectionalLight(0x88aaff, 0.25);
fill.position.set(-4, 2, -5);
scene.add(fill);

// ---------- 6. 展台底座：大圆柱（顶半径 2.2、底半径 2.4、高 0.3、48 分段） ----------
const stage = new THREE.Mesh(
  new THREE.CylinderGeometry(2.2, 2.4, 0.3, 48),
  new THREE.MeshStandardMaterial({ color: 0x37474f, metalness: 0.3, roughness: 0.6 })
);
stage.position.y = -0.15;                // 往下挪半个高度，让台面正好落在 y = 0
stage.receiveShadow = true;              // 【我加的】台面接收阴影
scene.add(stage);

// 台面上的一圈发光环，增强"展台"感（纯装饰，几何体 = 圆环）
const ring = new THREE.Mesh(
  new THREE.TorusGeometry(1.95, 0.03, 8, 96),
  new THREE.MeshBasicMaterial({ color: 0x4fc3f7 })   // Basic 材质不受光，当自发光线用
);
ring.rotation.x = -Math.PI / 2;
ring.position.y = 0.02;
scene.add(ring);

// ---------- 7. 展品组：3 个不同几何体摆一圈 ----------
const items = new THREE.Group();         // 组：整体旋转就转组，不用逐个转
const geos = [
  new THREE.BoxGeometry(0.8, 0.8, 0.8),        // 方块：宽、高、深
  new THREE.SphereGeometry(0.5, 32, 32),       // 球：半径、水平分段、垂直分段
  new THREE.TorusGeometry(0.4, 0.16, 16, 48)   // 圆环：半径、管径、分段
];
const colors = [0x4fc3f7, 0xffb74d, 0xe57373];
geos.forEach((geo, i) => {
  const angle = (i / geos.length) * Math.PI * 2;               // 均匀分布在圆周上
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color: colors[i], metalness: 0.35, roughness: 0.3 })
  );
  mesh.position.set(Math.cos(angle) * 1.4, 0.6, Math.sin(angle) * 1.4);
  mesh.castShadow = true;                // 【我加的】展品投影
  mesh.userData.baseY = 0.6;             // 记下基础高度，浮动动画要用
  items.add(mesh);
});
scene.add(items);

// ---------- 8. 动画循环：每帧微调属性 + 重新渲染 ----------
const clock = new THREE.Clock();
const animate = () => {
  requestAnimationFrame(animate);        // 请求下一帧，写在渲染之前帧率才稳

  const t = clock.getElapsedTime();      // 已经过去的秒数

  items.rotation.y += 0.005;             // 展台整体缓转（转组）

  items.children.forEach((m, i) => {     // 【我加的】课后练习 1：展品上下浮动 + 自转
    m.rotation.y += 0.01 + i * 0.004;
    m.position.y = m.userData.baseY + Math.sin(t * 1.6 + i * 2.1) * 0.12;
  });

  // 展台边缘发光环呼吸
  const s = 1 + Math.sin(t * 2) * 0.01;
  ring.scale.set(s, s, s);

  controls.update();                     // 开了阻尼就必须每帧 update
  renderer.render(scene, camera);        // 重新拍一张
};
animate();

// ---------- 9. 窗口适配：只改渲染器不改相机会拉伸变形，两个都要更新 ----------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;   // 1. 更新宽高比
  camera.updateProjectionMatrix();                           // 2. 更新投影矩阵
  renderer.setSize(window.innerWidth, window.innerHeight);   // 3. 重设画布
});

/* ---------- 故意实验（在报告"问题与解决"里可以写这个） ----------
 * 实验 A：把 items.rotation.y 那行换成对 items.children 逐个转（原来的写法要三行），
 *         再换回 Group —— 体会"组"省下的代码量。
 * 实验 B：把 camera.position.set(4, 3, 6) 改成 (0, 0, 0)，
 *         刷新后相机落在展台正中央，看到的是物体内部，画面一片黑 —— 这就是"相机在物体内"。
 * 实验 C：把 scene.add(new THREE.AmbientLight(...)) 注释掉并同时注释方向光，
 *         画面全黑但 Console 无报错 —— 受光材质必须有光源。
 * ------------------------------------------------------------ */
