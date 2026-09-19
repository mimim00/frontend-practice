/* ============================================================
 * scene.js —— 校园三维导览（第八次课案例复现·第三步）
 *
 * 与课堂七的区别：那里的场景是手写死的一栋楼，
 * 这里的地标全部由 integration/data/campus.json 生成——
 * 改数据就能改场景，三维区和首页自习室数据用的是同一套校园主题。
 *
 * 运行方式：必须经本地服务器打开（.html 走 http 才能 fetch 到 json）。
 *           file:// 双击打开时会回退到 data/campus.js 并在页面上提示。
 *
 * 心智模型（沿用课堂七）：场景里摆东西 → 相机去看 → 渲染器不停拍。
 * ============================================================ */

'use strict';

/* ---------- 页面元素 ---------- */
const host = document.getElementById('scene-host');
const statusBox = document.querySelector('#scene-status');
const listBox = document.querySelector('#building-list');
const detailBox = document.querySelector('#building-detail');
const sourceLine = document.querySelector('#scene-source');

const setSceneStatus = (kind, text) => {
  if (!kind) { statusBox.innerHTML = ''; return; }
  statusBox.innerHTML = '<p class="alert alert-' + kind + '">' + text + '</p>';
};

/* ============================================================
 * 1. 数据：fetch campus.json，失败回退内嵌副本
 * ============================================================ */
const loadCampus = async () => {
  setSceneStatus('warning', '正在加载校园数据……');
  try {
    const response = await fetch('../data/campus.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    if (!Array.isArray(data.buildings) || data.buildings.length === 0) {
      throw new Error('campus.json 里没有 buildings');
    }
    return { data, fallback: false };
  } catch (error) {
    const embedded = window.CAMPUS_SCENE;
    if (!embedded) throw new Error('读取 campus.json 失败（' + error.message + '），且没有内嵌副本可用');
    console.warn('[降级] fetch ../data/campus.json 失败：', error.message, '已使用内嵌副本 window.CAMPUS_SCENE');
    return { data: embedded, fallback: true, reason: error.message };
  }
};

/* ============================================================
 * 2. 场景骨架：场景 / 相机 / 渲染器
 * ============================================================ */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9dc3e6);          // 天空色
scene.fog = new THREE.Fog(0x9dc3e6, 40, 95);           // 雾的远端必须小于相机 far，否则远处"糊成一片"

const camera = new THREE.PerspectiveCamera(
  48,
  host.clientWidth / host.clientHeight,
  0.1,
  200
);
camera.position.set(0, 18, 30);                        // 先给个全景位，数据到了再微调

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));   // 高分屏限到 2 倍，再高就是白烧性能
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
host.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.target.set(0, 2, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 8;
controls.maxDistance = 60;
controls.maxPolarAngle = Math.PI / 2.15;               // 不许钻到地面以下
controls.update();

/* ---------- 光源：环境光打底 + 方向光造型 ---------- */
scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const sun = new THREE.DirectionalLight(0xfff4e0, 0.85);
sun.position.set(22, 34, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -30;
sun.shadow.camera.right = 30;
sun.shadow.camera.top = 30;
sun.shadow.camera.bottom = -30;
sun.shadow.camera.far = 120;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xcfe4ff, 0x4c6b3c, 0.35));   // 天光/地光，免得背光面死黑

/* ============================================================
 * 3. 按数据建场景
 * ============================================================ */
const campusGroup = new THREE.Group();
scene.add(campusGroup);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const pickables = [];          // 可以点选的楼栋 mesh（附 userData.building）
const sculptureMeshes = [];    // 可点击变色的雕塑
const flagMeshes = [];         // 旗帜，动画循环里让它飘
const treeCrowns = [];         // 树冠，动画循环里让它摆
const allLabels = [];          // 所有名字标签 { sprite, buildingId }

const matBody = (color) => new THREE.MeshStandardMaterial({
  color: new THREE.Color(color), metalness: 0.1, roughness: 0.75
});
const matRoof = (color) => new THREE.MeshStandardMaterial({
  color: new THREE.Color(color), metalness: 0.2, roughness: 0.6
});

const buildGround = () => {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(70, 70),
    new THREE.MeshStandardMaterial({ color: 0x7fae63, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  campusGroup.add(ground);

  /* 十字步道：两条薄板压在地面上方 0.01，避免和地面 z-fighting（闪面） */
  const pathMat = new THREE.MeshStandardMaterial({ color: 0xd9d4c5, roughness: 1 });
  const horizontal = new THREE.Mesh(new THREE.PlaneGeometry(60, 2.4), pathMat);
  horizontal.rotation.x = -Math.PI / 2;
  horizontal.position.set(0, 0.01, 2);
  horizontal.receiveShadow = true;
  campusGroup.add(horizontal);

  const vertical = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 60), pathMat);
  vertical.rotation.x = -Math.PI / 2;
  vertical.position.set(0, 0.01, 0);
  vertical.receiveShadow = true;
  campusGroup.add(vertical);
};

/* 楼栋 = 主体方盒 + 屋顶挑出一点 + 窗户贴面（不用贴图，避免素材版权问题） */
const buildBuilding = (b) => {
  const group = new THREE.Group();
  group.position.set(b.x, 0, b.z);

  const body = new THREE.Mesh(new THREE.BoxGeometry(b.width, b.height, b.depth), matBody(b.bodyColor));
  body.position.y = b.height / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(b.width + 0.5, 0.35, b.depth + 0.5),
    matRoof(b.roofColor)
  );
  roof.position.y = b.height + 0.175;
  roof.castShadow = true;
  group.add(roof);

  /* 每层开一排窗，窗数按宽度算，楼层数来自数据 */
  const winMat = new THREE.MeshStandardMaterial({
    color: 0x9ec9e8, metalness: 0.5, roughness: 0.25, emissive: 0x1b3350, emissiveIntensity: 0.35
  });
  const perFloor = Math.max(2, Math.floor(b.width / 1.2));
  for (let f = 0; f < b.floors; f++) {
    for (let i = 0; i < perFloor; i++) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.06), winMat);
      win.position.set(
        -b.width / 2 + b.width * (i + 0.5) / perFloor,
        0.9 + f * (b.height - 1.4) / Math.max(1, b.floors - 1),
        b.depth / 2 + 0.03
      );
      group.add(win);
    }
  }

  /* 楼名标签：用 canvas 贴图做 sprite，始终朝向相机，不用引入字体库 */
  const label = makeLabel(b.name, b.id);
  label.position.set(0, b.height + 1.1, 0);
  group.add(label);

  /* 让整栋楼都可点选：把组上的 userData 挂到每个子 mesh 上，
     射线检测拿到的总是子 mesh，直接从父组取数据最省事。 */
  group.userData.building = b;
  group.traverse((child) => {
    if (child.isMesh) {
      child.userData.building = b;
      pickables.push(child);
    }
  });

  campusGroup.add(group);
  return group;
};

/* 楼名标签：用 canvas 贴图做 sprite，始终朝向相机，不用引入字体库。
 *
 * 这里踩过一个坑：一开始给标签加了 depthTest: false，想让名字永远压在楼前面别被挡住。
 * 结果靠近某一栋楼时，远处那栋楼的标签不但不会被遮住，反而会撑满整个画面——
 * 因为 sprite 是"世界尺寸固定、屏幕尺寸随距离放大"的，关掉深度测试后它就成了贴脸的大字。
 * 现在的做法：保留 depthTest（该被挡住就被挡住），同时把当前选中的楼之外的标签淡出，
 * 既不会贴脸，也不会一屏全是名字。 */
const makeLabel = (text, buildingId) => {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(23, 57, 91, 0.82)';
  if (ctx.roundRect) ctx.roundRect(4, 8, 248, 48, 10); else ctx.rect(4, 8, 248, 48);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 33);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  sprite.scale.set(2.8, 0.7, 1);          // 世界单位：约 2.8 米宽，远看是一块小牌子
  sprite.userData.buildingId = buildingId || null;
  allLabels.push(sprite);
  return sprite;
};

const buildLandmark = (item) => {
  const group = new THREE.Group();
  group.position.set(item.x, 0, item.z);

  if (item.kind === 'flagpole') {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, item.height, 16),
      new THREE.MeshStandardMaterial({ color: 0xcfd3d8, metalness: 0.6, roughness: 0.35 })
    );
    pole.position.y = item.height / 2;
    pole.castShadow = true;
    group.add(pole);

    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 1.4),
      new THREE.MeshStandardMaterial({ color: 0xd32f2f, side: THREE.DoubleSide, roughness: 0.85 })
    );
    flag.position.set(1.1, item.height - 0.9, 0);
    flag.castShadow = true;
    flag.userData.flag = true;          // 动画循环里靠这个标记找旗子
    group.add(flag);
    flagMeshes.push(flag);              // 建的时候就登记，省掉后面全场景遍历一遍

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 1.1, 0.4, 24),
      new THREE.MeshStandardMaterial({ color: 0xe0e0e0, roughness: 0.9 })
    );
    base.position.y = 0.2;
    base.receiveShadow = true;
    group.add(base);
  }

  if (item.kind === 'sculpture') {
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.85, 1.0, 1.1, 24),
      new THREE.MeshStandardMaterial({ color: 0xcfd8dc, metalness: 0.25, roughness: 0.6 })
    );
    pedestal.position.y = 0.55;
    pedestal.castShadow = true;
    pedestal.receiveShadow = true;
    group.add(pedestal);

    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.8, 32, 32),
      new THREE.MeshStandardMaterial({ color: 0x8d6e63, metalness: 0.35, roughness: 0.4 })
    );
    ball.position.y = 1.9;
    ball.castShadow = true;
    ball.userData.sculpture = true;      // 点击变色的判定标记
    group.add(ball);
    sculptureMeshes.push(ball);

    const label = makeLabel(item.name, item.id);
    label.position.set(0, 3.4, 0);
    group.add(label);
  }

  if (item.kind === 'gate') {
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0xb0bec5, roughness: 0.8 });
    [-3, 3].forEach((x) => {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 4.2, 0.9), pillarMat);
      pillar.position.set(x, 2.1, 0);
      pillar.castShadow = true;
      group.add(pillar);
    });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.7, 1.1), matRoof(0x8d6e63));
    beam.position.y = 4.55;
    beam.castShadow = true;
    group.add(beam);

    /* 门楣上沿在 4.9 米，标签放它上面一点；
       原来放 6 米，镜头一靠近校门那三个大字就顶在画面正中挡住整条街。 */
    const label = makeLabel(item.name, item.id);
    label.position.set(0, 5.3, 0);
    group.add(label);
  }

  campusGroup.add(group);
};

const buildTree = (t) => {
  const group = new THREE.Group();
  group.position.set(t.x, 0, t.z);

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.22, 1.2, 8),
    new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 0.95 })
  );
  trunk.position.y = 0.6;
  trunk.castShadow = true;
  group.add(trunk);

  /* 用 group.userData 存一个相位，让每棵树的摆动不同步 */
  const crown = new THREE.Mesh(
    new THREE.SphereGeometry(0.85, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0x3f7d3a, roughness: 1 })
  );
  crown.position.y = 1.8;
  crown.castShadow = true;
  crown.userData.swaySeed = Math.random() * Math.PI * 2;
  crown.userData.baseY = 1.8;
  group.add(crown);
  treeCrowns.push(crown);       // 只把树冠登记进来，避免每帧遍历整棵场景树

  campusGroup.add(group);
};

/* ============================================================
 * 4. 右侧清单：DOM 与三维场景的双向入口
 * ============================================================ */
const listItems = new Map();     // building.id -> <li>

const renderBuildingList = (buildings) => {
  listBox.innerHTML = buildings.map((b) => `
    <li class="list-group-item d-flex justify-content-between align-items-start"
        data-building-id="${b.id}" tabindex="0" role="button">
      <span>
        <strong>${b.name}</strong>
        <span class="d-block small text-muted">${b.floors} 层 · 座位约 ${b.seatCapacity} 个</span>
      </span>
      <span class="badge bg-secondary align-self-center">定位</span>
    </li>`).join('');

  listBox.querySelectorAll('[data-building-id]').forEach((el) => {
    listItems.set(el.dataset.buildingId, el);
  });
};

const focusBuilding = (b) => {
  /* 相机移过去，而不是把楼搬过来——三维里"放大看某处"就是这个动作。
   * 距离怎么定：先把楼近似成半径 radius 的球，相机 fov 是 48 度，
   * 要让整栋楼落在视锥里，相机到楼心的距离至少要 radius / sin(fov/2)。
   * 这里取 1.45 倍留余量——楼顶上面还飘着一个名字标签，太贴边会被切掉。
   * （一开始就是按"楼宽 × 2.6"拍的脑袋，结果镜头顶在墙上只看到一片灰色。） */
  const radius = Math.max(b.width, b.depth, b.height) * 0.72;
  const distance = Math.max(radius / Math.sin((camera.fov * Math.PI / 180) / 2) * 1.45, 14);

  /* 从南偏东 40 度方向进场：正南看是纯正面，太像平面图，斜一点才看得出体量 */
  const azimuth = Math.PI * 0.22;
  targetCamera = new THREE.Vector3(
    b.x + Math.sin(azimuth) * distance,
    b.height * 0.9 + distance * 0.3,
    b.z + Math.cos(azimuth) * distance
  );
  targetLook = new THREE.Vector3(b.x, b.height * 0.5, b.z);

  /* 选中的楼标签压暗，别糊在自己楼面上；其余楼的标签也淡下去，让焦点清晰 */
  allLabels.forEach((sprite) => {
    const id = sprite.userData.buildingId;
    sprite.material.opacity = id === b.id ? 0.35 : (id ? 0.55 : 0.8);
  });

  listItems.forEach((el, id) => el.classList.toggle('is-on', id === b.id));
  detailBox.innerHTML = `<strong>${b.name}</strong><br>${b.description}<br>
    <span class="text-muted">${b.floors} 层，座位约 ${b.seatCapacity} 个</span>`;
};

listBox.addEventListener('click', (event) => {
  const el = event.target.closest('[data-building-id]');
  if (!el) return;
  const b = currentData.buildings.find((x) => x.id === el.dataset.buildingId);
  if (b) focusBuilding(b);
});
listBox.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const el = event.target.closest('[data-building-id]');
  if (!el) return;
  event.preventDefault();
  const b = currentData.buildings.find((x) => x.id === el.dataset.buildingId);
  if (b) focusBuilding(b);
});

/* ============================================================
 * 5. 鼠标拾取：点楼定位、点雕塑变色
 * ============================================================ */
const updatePointer = (event) => {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
};

renderer.domElement.addEventListener('click', (event) => {
  updatePointer(event);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(pickables.concat(sculptureMeshes), false);
  if (hits.length === 0) return;

  const picked = hits[0].object;

  if (picked.userData.sculpture) {
    /* 雕塑变色：颜色在冷暖之间来回切，Console 里也留一条记录便于自查 */
    const isWarm = picked.material.color.getHex() === 0xffd54f;
    picked.material.color.set(isWarm ? 0x8d6e63 : 0xffd54f);
    detailBox.innerHTML = '<strong>校训雕塑</strong><br>点击已触发变色，说明射线拾取生效。再点一次恢复原色。';
    console.log('[拾取] 校训雕塑被点击，颜色切换为', isWarm ? '#8d6e63' : '#ffd54f');
    return;
  }

  if (picked.userData.building) focusBuilding(picked.userData.building);
});

/* 悬停时把鼠标变成手型，告诉用户"这里能点"（也顺便验证射线是否命中） */
renderer.domElement.addEventListener('pointermove', (event) => {
  updatePointer(event);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(pickables.concat(sculptureMeshes), false)[0];
  renderer.domElement.style.cursor = hit ? 'pointer' : 'grab';
});

/* ============================================================
 * 6. 动画循环：每帧微调 + 相机缓动 + 重新渲染
 * ============================================================ */
const clock = new THREE.Clock();
let targetCamera = null;    // 不为 null 时代表"相机正在飞向目标"
let targetLook = null;
let frameId = null;         // 保存帧号，才能真的把循环停下来
let running = false;

const animate = () => {
  frameId = requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  /* 旗子轻微飘动：用 sin 改 x 轴缩放，比换模型省事 */
  flagMeshes.forEach((flag, i) => {
    flag.scale.x = 1 + Math.sin(t * 2.4 + i) * 0.06;
    flag.rotation.y = Math.sin(t * 1.6 + i) * 0.12;
  });

  /* 树冠呼吸式摆动：只遍历登记过的树冠，不扫整棵场景树 */
  treeCrowns.forEach((crown) => {
    crown.position.y = crown.userData.baseY + Math.sin(t * 1.4 + crown.userData.swaySeed) * 0.04;
  });

  /* 相机缓动：每帧靠近目标 12%，接近了就吸附并停止，避免永远抖动 */
  if (targetCamera) {
    camera.position.lerp(targetCamera, 0.12);
    controls.target.lerp(targetLook, 0.12);
    if (camera.position.distanceTo(targetCamera) < 0.25) {
      camera.position.copy(targetCamera);
      controls.target.copy(targetLook);
      targetCamera = null;
      targetLook = null;
    }
  }

  controls.update();                 // 开了阻尼就必须每帧 update
  renderer.render(scene, camera);
};

/* 页面切到后台就停下渲染循环：附录二里"三维页返回后卡顿"就是这个坑，
   回来后再启动。光把 running 置 false 没用——已经排队的 requestAnimationFrame
   还会再触发一次 animate，必须 cancelAnimationFrame 才真的停。 */
const startLoop = () => {
  if (running) return;
  running = true;
  clock.start();
  animate();
};
const stopLoop = () => {
  running = false;
  if (frameId !== null) {
    cancelAnimationFrame(frameId);
    frameId = null;
  }
};
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopLoop();
  else startLoop();
});

/* ---------- 窗口尺寸变化：相机与渲染器都要更新，否则画面拉伸 ---------- */
window.addEventListener('resize', () => {
  resizeOnce();
});

/* ============================================================
 * 7. 启动
 * ============================================================ */
let currentData = null;

const build = (data) => {
  currentData = data;

  buildGround();
  data.buildings.forEach(buildBuilding);
  data.landmarks.forEach(buildLandmark);
  data.trees.forEach(buildTree);

  renderBuildingList(data.buildings);

  /* 相机对着校园中心稍微俯视，能看到全部楼栋。
     高度 15 / 距离 36 大约 18 度俯角：再平就只剩一片楼顶轮廓，
     再高就变成航拍图，看不出立体感。 */
  camera.position.set(0, 15, 36);
  controls.target.set(0, 3, 0);
  controls.update();

  sourceLine.textContent = '场景来源：' + data.source + '（' + data.buildings.length + ' 栋楼 · ' +
    data.landmarks.length + ' 处地标 · ' + data.trees.length + ' 棵树）';

  resizeOnce();
  startLoop();
};

const resizeOnce = () => {
  const w = host.clientWidth;
  const h = host.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
};

loadCampus()
  .then(({ data, fallback, reason }) => {
    build(data);
    if (fallback) {
      setSceneStatus('warning',
        '读取 ../data/campus.json 失败（' + reason + '），已回退到内嵌数据 campus.js。' +
        '要读真实 JSON，请在 integration/ 目录启动本地服务器后访问，见 README。');
    } else {
      setSceneStatus(null);
    }
  })
  .catch((error) => {
    setSceneStatus('danger', '校园数据加载失败：' + error.message + '。三维场景无法渲染。');
    sourceLine.textContent = '场景来源：加载失败';
  });

/* ============================================================
 * 故意实验记录（写进进度报告"问题与解决"）：
 * 1) 把 scene.fog 的 far 调到 200（大于相机 far 的 150）→ 远处不再渐隐，
 *    雾失去作用；反过来把 near 调到 5，近处全是灰雾。
 * 2) 把 controls.maxPolarAngle 那行删掉 → 拖拽可以把相机转到地面以下，
 *    从地底看校园，地面变成一张"天花板"。
 * 3) 把 renderer.setPixelRatio 那行改成 4 → 高分屏上像素量翻四倍，
 *    帧率明显掉，这就是研究三里说的"过度绘制"。
 * 4) 注释掉 document.visibilitychange 那段 → 切到别的标签页后，
 *    这个页面的渲染循环仍在跑，风扇会响。
 * ============================================================ */
