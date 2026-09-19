/* ============================================================
 * classroom.js —— 教室三维座位图（第八次课自主实践·三维加分模块）
 *
 * 与案例复现"校园信息中心"的三维页差异：那个是数据驱动的校园地标，
 * 这里是数据驱动的教室座位——桌面颜色按出勤状态着色，座位、小组、
 * 姓名全部来自首页同一份 data/students.json。改首页数据，这里跟着变。
 *
 * 心智模型（沿用课堂七）：场景里摆东西 + 相机去看 + 渲染器不停拍。
 * ============================================================ */

'use strict';

const host = document.getElementById('scene-host');
const statusBox = document.querySelector('#scene-status');
const listBox = document.querySelector('#att-list');
const detailBox = document.querySelector('#seat-detail');
const sourceLine = document.querySelector('#scene-source');

const setSceneStatus = (kind, text) => {
  if (!kind) { statusBox.innerHTML = ''; return; }
  statusBox.innerHTML = '<p class="alert alert-' + kind + '">' + text + '</p>';
};

/* ---------- 1. 数据：fetch students.json，失败回退内嵌副本 ---------- */
const loadStudents = async () => {
  setSceneStatus('warning', '正在加载学生数据……');
  try {
    const response = await fetch('../data/students.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    if (!Array.isArray(data.students)) throw new Error('students 不是数组');
    return { students: data.students, fallback: false };
  } catch (error) {
    const embedded = window.CLASS_STUDENTS && window.CLASS_STUDENTS.students;
    if (!embedded) throw new Error('读取 students.json 失败（' + error.message + '），且没有内嵌副本可用');
    console.warn('[降级] fetch ../data/students.json 失败：', error.message, '已使用内嵌副本');
    return { students: embedded, fallback: true, reason: error.message };
  }
};

/* ---------- 2. 场景骨架 ---------- */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x10161a);
scene.fog = new THREE.Fog(0x10161a, 18, 40);

const camera = new THREE.PerspectiveCamera(48, host.clientWidth / host.clientHeight, 0.1, 100);
camera.position.set(0, 9, 16);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
host.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1, 2);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 4;
controls.maxDistance = 30;
controls.maxPolarAngle = Math.PI / 2.05;   // 别钻到地板下面
controls.update();

scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const sun = new THREE.DirectionalLight(0xfff6e6, 0.9);
sun.position.set(8, 12, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -15; sun.shadow.camera.right = 15;
sun.shadow.camera.top = 15; sun.shadow.camera.bottom = -15;
sun.shadow.camera.far = 40;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xd8e8ff, 0x3a3a30, 0.35));

/* ============================================================
 * 3. 按数据建教室
 * ============================================================ */
const room = new THREE.Group();
scene.add(room);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const pickables = [];        // 可点击的桌面 mesh（附 userData.student）
const deskMeshes = new Map(); // student.id -> desk mesh（供"名单聚焦"用）

const ATT_COLOR = { '出勤': 0x1f6b4f, '请假': 0xc9901f, '缺勤': 0xa3521c };

/* 名字标签：canvas 贴图 sprite，永远面向相机。保留 depthTest（该被挡就挡），
   选中时把其余标签淡出，避免"标签贴脸"（案例复现踩过的坑）。 */
const makeLabel = (text) => {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 48;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(12, 22, 18, 0.78)';
  if (ctx.roundRect) ctx.roundRect(6, 6, 244, 36, 8); else ctx.rect(6, 6, 244, 36);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 25);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  sprite.scale.set(1.6, 0.3, 1);
  return sprite;
};

const buildClassroom = (students) => {
  /* 地板 + 三面墙：教室围合感，不引外部贴图 */
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 12),
    new THREE.MeshStandardMaterial({ color: 0x6b5438, roughness: 0.9 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  room.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xdcd6c8, roughness: 0.95 });
  const back = new THREE.Mesh(new THREE.BoxGeometry(18, 4, 0.3), wallMat);
  back.position.set(0, 2, -5.8);
  back.receiveShadow = true;
  room.add(back);
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4, 12), wallMat);
  left.position.set(-8.85, 2, 0);
  left.receiveShadow = true;
  room.add(left);
  const right = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4, 12), wallMat);
  right.position.set(8.85, 2, 0);
  right.receiveShadow = true;
  room.add(right);

  /* 黑板 + 班名标签 */
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(7, 2.4, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x1f3a2d, roughness: 0.4, metalness: 0.1 })
  );
  board.position.set(0, 2.2, -5.62);
  room.add(board);
  const boardLabel = makeLabel('高三2班');
  boardLabel.position.set(0, 3.0, -5.5);
  boardLabel.scale.set(3, 0.6, 1);
  room.add(boardLabel);

  /* 讲台 */
  const podium = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.9, 0.8),
    new THREE.MeshStandardMaterial({ color: 0x8a6d43, roughness: 0.7 })
  );
  podium.position.set(0, 0.45, -4.0);
  podium.castShadow = true;
  room.add(podium);

  /* 课桌：按 group/seat 排 6 列 × 4 行，桌面颜色 = 出勤状态 */
  const deskMat = new THREE.MeshStandardMaterial({ color: 0x9b7e52, roughness: 0.75 });
  const topMat = (att) => new THREE.MeshStandardMaterial({ color: ATT_COLOR[att] || 0x555555, roughness: 0.6 });

  students.forEach((s) => {
    const gx = (s.group - 3.5) * 2.5;                 // 组 1~6 → 沿 X 排开
    const gz = (s.seat - 1) * 1.7 + 0.6;              // 座位 1~4 → 沿 Z 从前到后
    const desk = new THREE.Group();
    desk.position.set(gx, 0, gz);

    const legMat = new THREE.MeshStandardMaterial({ color: 0x5c5344, roughness: 0.8 });
    [[-0.4, 0, -0.2], [0.4, 0, -0.2], [-0.4, 0, 0.2], [0.4, 0, 0.2]].forEach(([lx, , lz]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.7, 0.07), legMat);
      leg.position.set(lx, 0.35, lz);
      desk.add(leg);
    });

    const top = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.55), topMat(s.attendance));
    top.position.y = 0.74;
    top.castShadow = true;
    top.receiveShadow = true;
    top.userData.student = s;                 // 点击时从这里取学生信息
    desk.add(top);
    pickables.push(top);
    deskMeshes.set(String(s.id), top);

    /* 椅背：一块薄板在桌后 */
    const chair = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.06), deskMat);
    chair.position.set(0, 0.35, 0.42);
    chair.castShadow = true;
    desk.add(chair);

    const label = makeLabel(s.name);
    label.position.set(0, 1.15, 0);
    desk.add(label);

    room.add(desk);
  });
};

/* ---------- 4. 名单与聚焦 ---------- */
const renderAttList = (students) => {
  const abnormal = students.filter((s) => s.attendance !== '出勤');
  listBox.innerHTML = abnormal.length === 0
    ? '<li class="list-group-item text-muted">当前无请假或缺勤记录。</li>'
    : abnormal.map((s) => `
      <li class="list-group-item d-flex justify-content-between align-items-center" data-seat-id="${s.id}" tabindex="0" role="button">
        <span>${s.name}（${s.group} 组 ${s.seat} 号）</span>
        <span class="att-badge att-${s.attendance === '请假' ? 'leave' : 'miss'}">${s.attendance}</span>
      </li>`).join('');
};

const focusStudent = (id) => {
  const desk = deskMeshes.get(String(id));
  if (!desk) return;
  const s = desk.userData.student;

  const radius = 2.2;
  const dist = Math.max(radius / Math.sin((camera.fov * Math.PI / 180) / 2) * 1.5, 4.5);
  targetCamera = new THREE.Vector3(desk.getWorldPosition(new THREE.Vector3()).x + dist * 0.55,
    dist * 0.62, desk.getWorldPosition(new THREE.Vector3()).z + dist * 0.78);
  targetLook = desk.getWorldPosition(new THREE.Vector3()).clone();

  detailBox.innerHTML = '<strong>' + s.name + '</strong>（' + s.id + '）<br>' +
    s.gender + ' · ' + s.group + ' 组 ' + s.seat + ' 号' + (s.role ? ' · ' + s.role : '') + '<br>' +
    '月考 ' + s.examScore + ' 分 · 出勤：' + s.attendance;
  listBox.querySelectorAll('[data-seat-id]').forEach((el) => el.classList.toggle('is-on', el.dataset.seatId === String(id)));
};

listBox.addEventListener('click', (e) => {
  const el = e.target.closest('[data-seat-id]');
  if (el) focusStudent(el.dataset.seatId);
});
listBox.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const el = e.target.closest('[data-seat-id]');
  if (!el) return;
  e.preventDefault();
  focusStudent(el.dataset.seatId);
});

/* ---------- 5. 鼠标拾取：点桌面看信息 ---------- */
const updatePointer = (event) => {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
};

renderer.domElement.addEventListener('click', (event) => {
  updatePointer(event);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(pickables, false)[0];
  if (hit && hit.object.userData.student) {
    focusStudent(hit.object.userData.student.id);
  }
});
renderer.domElement.addEventListener('pointermove', (event) => {
  updatePointer(event);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(pickables, false)[0];
  renderer.domElement.style.cursor = hit ? 'pointer' : 'grab';
});

/* ---------- 6. 动画循环 + 相机缓动 ---------- */
const clock = new THREE.Clock();
let targetCamera = null;
let targetLook = null;
let frameId = null;
let running = false;

const animate = () => {
  frameId = requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  if (targetCamera) {
    camera.position.lerp(targetCamera, 0.12);
    controls.target.lerp(targetLook, 0.12);
    if (camera.position.distanceTo(targetCamera) < 0.2) {
      camera.position.copy(targetCamera);
      controls.target.copy(targetLook);
      targetCamera = null;
      targetLook = null;
    }
  }

  controls.update();
  renderer.render(scene, camera);
};

const startLoop = () => {
  if (running) return;
  running = true;
  clock.start();
  animate();
};
const stopLoop = () => {
  running = false;
  if (frameId !== null) { cancelAnimationFrame(frameId); frameId = null; }
};
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopLoop(); else startLoop();
});

const resizeOnce = () => {
  const w = host.clientWidth;
  const h = host.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
};
window.addEventListener('resize', resizeOnce);

/* ---------- 7. 启动 ---------- */
loadStudents()
  .then(({ students, fallback, reason }) => {
    buildClassroom(students);
    renderAttList(students);
    sourceLine.textContent = '场景来源：data/students.json（' + students.length + ' 名学生 · 6 组 × 4 座）';
    camera.position.set(0, 10, 17);
    controls.target.set(0, 1, 2);
    controls.update();
    resizeOnce();
    startLoop();
    if (fallback) {
      setSceneStatus('warning',
        '读取 ../data/students.json 失败（' + reason + '），已回退到内嵌数据 students.js。' +
        '要读真实 JSON，请在 practice/ 目录启动本地服务器后访问，见 README。');
    } else {
      setSceneStatus(null);
    }
  })
  .catch((error) => {
    setSceneStatus('danger', '学生数据加载失败：' + error.message + '。三维场景无法渲染。');
    sourceLine.textContent = '场景来源：加载失败';
  });

/* 故意实验记录：
 * 1) 把 controls.maxPolarAngle 删掉 → 相机能转到地板下面，从地底看桌子。
 * 2) 把 renderer.setPixelRatio 的 Math.min(..., 2) 改成 4 → 高分屏像素量翻四倍，帧率掉。
 * 3) 注释 visibilitychange 那段 → 切到别的标签页渲染循环仍在跑。
 * ============================================================ */
