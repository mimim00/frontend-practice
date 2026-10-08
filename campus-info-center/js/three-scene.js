/* ============================================================
   三维校园场景（Three.js r128，UMD 版本，兼容 file:// 直开）
   场景：天空 + 雾效、草坪纹理地面、11 栋建筑（窗格贴图 + 悬浮标牌）、
         40 余棵树木、方向光 + 半球光 + 阴影。
   交互：拖拽旋转、滚轮缩放、点击建筑高亮并显示信息、自动旋转、复位。
   ============================================================ */
(function () {
  'use strict';

  var stage, renderer, scene, camera, raycaster;
  var buildings = [];      // 可点击的建筑网格
  var footprints = [];     // 建筑占地（用于避让树木）
  var selected = null;
  var autoRotate = true;
  var theta = 0.65, phi = 1.08, radius = 240;
  var target = new THREE.Vector3(0, 12, 0);

  var PHI_MIN = 0.35, PHI_MAX = 1.45, RADIUS_MIN = 90, RADIUS_MAX = 420;

  /* ==================== 初始化入口 ==================== */
  function init() {
    stage = document.getElementById('threeCanvas');
    if (!stage || typeof THREE === 'undefined') {
      showWebGLError('未找到 Three.js 库，请确认 lib/three.min.js 存在。');
      return;
    }

    // 捕获 WebGL 初始化异常（部分浏览器 / 显卡不支持）
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch (err) {
      console.error('[3D] WebGL 初始化失败', err);
      showWebGLError('当前环境无法创建 WebGL 渲染器：' + err.message);
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(stage.clientWidth, stage.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // 色调映射：把高光柔和地压回 0~1 区间，避免局部过曝死白
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    stage.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdce4e6);   // 莫兰迪雾蓝天空
    scene.fog = new THREE.Fog(0xdce4e6, 260, 700);

    camera = new THREE.PerspectiveCamera(55, stage.clientWidth / stage.clientHeight, 1, 1500);
    raycaster = new THREE.Raycaster();

    buildLights();
    buildGround();
    buildBuildings();
    buildTrees();
    bindControls();

    window.addEventListener('resize', onResize);
    animate();
  }

  function showWebGLError(msg) {
    var box = document.getElementById('webglError');
    if (box) {
      box.classList.remove('d-none');
      box.innerHTML = '<strong>⚠️ 三维场景初始化失败：</strong>' + App.esc(msg);
    }
  }

  /* ==================== 灯光 ====================
     注意：r128 中多盏灯的强度是线性叠加的，强度之和过大（如 0.95 + 1.05 = 2.0）
     会把浅色材质推过 1.0 而被裁剪成纯白（过曝）。这里把总强度控制在约 1.1，
     并让半球光带一点暖灰色调，避免天空光把地面和建筑"洗白"。 */
  function buildLights() {
    scene.add(new THREE.HemisphereLight(0xdfe7ec, 0x6f7c62, 0.5));
    var sun = new THREE.DirectionalLight(0xfff4e2, 0.6);
    sun.position.set(120, 160, 80);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -260;
    sun.shadow.camera.right = 260;
    sun.shadow.camera.top = 260;
    sun.shadow.camera.bottom = -260;
    sun.shadow.camera.far = 600;
    scene.add(sun);
  }

  /* ==================== 地面（草坪纹理 + 网格路网） ==================== */
  function groundTexture() {
    var c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    var g = c.getContext('2d');
    g.fillStyle = '#A9B7A0';
    g.fillRect(0, 0, 512, 512);
    g.strokeStyle = 'rgba(255,255,255,0.16)';
    g.lineWidth = 5;
    for (var i = 0; i <= 512; i += 64) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke();
      g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke();
    }
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(14, 14);   // 地面放大后保持网格密度不变
    return t;
  }

  function buildGround() {
    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1100, 1100),   // 放大地面，避免相机看到地面边缘（露底）
      new THREE.MeshLambertMaterial({ map: groundTexture() })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    scene.add(ground);
  }

  /* ==================== 建筑 ==================== */
  function windowTexture() {
    var c = document.createElement('canvas');
    c.width = 64; c.height = 128;
    var g = c.getContext('2d');
    g.fillStyle = '#e9eef4';
    g.fillRect(0, 0, 64, 128);
    var lit = [];
    for (var i = 0; i < 32; i++) { lit.push(Math.random() < 0.16); } // 随机点亮窗户
    for (var row = 0; row < 8; row++) {
      for (var col = 0; col < 4; col++) {
        g.fillStyle = lit[row * 4 + col] ? '#e3bd8c' : '#a7b6c9';
        g.fillRect(col * 15 + 3, row * 15 + 4, 10, 8);
      }
    }
    return new THREE.CanvasTexture(c);
  }

  function makeLabel(text) {
    var c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    var g = c.getContext('2d');
    g.font = 'bold 30px "Microsoft YaHei", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 8;
    g.strokeStyle = 'rgba(15,23,42,0.6)';
    g.strokeText(text, 128, 32);
    g.fillStyle = '#ffffff';
    g.fillText(text, 128, 32);
    var sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(c),
      transparent: true
    }));
    sprite.scale.set(62, 15.5, 1);
    return sprite;
  }

  function addBuilding(cfg) {
    var tex = windowTexture();
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(Math.max(2, Math.round(cfg.w / 9)), Math.max(2, Math.round(cfg.h / 9)));

    var mesh = new THREE.Mesh(
      new THREE.BoxGeometry(cfg.w, cfg.h, cfg.d),
      new THREE.MeshLambertMaterial({ map: tex, color: cfg.color })
    );
    mesh.position.set(cfg.x, cfg.h / 2, cfg.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = {
      name: cfg.name,
      campus: cfg.campus,
      hours: cfg.hours,
      desc: cfg.desc
    };
    scene.add(mesh);
    buildings.push(mesh);
    footprints.push({ x: cfg.x, z: cfg.z, r: Math.max(cfg.w, cfg.d) / 2 + 14 });

    var label = makeLabel(cfg.name);
    label.position.set(cfg.x, cfg.h + 12, cfg.z);
    scene.add(label);
  }

  function buildBuildings() {
    var WALL_EDU = 0xE7E3DA;   // 教学类建筑：米白
    var WALL_FOOD = 0xEADFCF;  // 食堂类建筑：浅陶土
    var WALL_OTHER = 0xE3E1DB; // 其他建筑：暖灰

    addBuilding({ name: '逸夫图书馆', campus: '东区', x: -80, z: -10, w: 48, h: 28, d: 30, color: WALL_EDU,
      hours: '07:00-22:30', desc: '全校最大自习场所，2-3 层为自习区 A/B，共 300 个座位，配有研讨间与饮水机。' });
    addBuilding({ name: '第一教学楼', campus: '东区', x: -40, z: -90, w: 36, h: 20, d: 20, color: WALL_EDU,
      hours: '全天开放', desc: '1 层设通宵自习室，60 个座位，考试周全天开放。' });
    addBuilding({ name: '第二教学楼', campus: '西区', x: 10, z: -90, w: 32, h: 22, d: 18, color: WALL_EDU,
      hours: '07:00-23:00', desc: '4 层为考研自习室，90 个座位，是全校上座率最高的自习区。' });
    addBuilding({ name: '计算机楼', campus: '西区', x: 70, z: -90, w: 30, h: 16, d: 18, color: WALL_EDU,
      hours: '18:00-22:00', desc: '3 层机房自习室，50 个座位，仅在无课时段开放。' });
    addBuilding({ name: '大学生活动中心', campus: '南区', x: 132, z: -28, w: 34, h: 13, d: 22, color: WALL_OTHER,
      hours: '09:00-22:00', desc: '2 层设自习角，25 个座位，配有沙发区与 WiFi。' });
    addBuilding({ name: '第一食堂', campus: '东区', x: -90, z: 72, w: 40, h: 13, d: 26, color: WALL_FOOD,
      hours: '06:30-20:30', desc: '1-2 层，含兰州拉面、麻辣香锅等 5 个档口，综合评分 4.5。' });
    addBuilding({ name: '第二食堂', campus: '西区', x: -18, z: 84, w: 36, h: 15, d: 24, color: WALL_FOOD,
      hours: '06:30-21:00', desc: '1-3 层，黄焖鸡米饭与麻辣烫人气最高，就餐高峰排队较多。' });
    addBuilding({ name: '第三食堂', campus: '南区', x: 62, z: 72, w: 34, h: 13, d: 22, color: WALL_FOOD,
      hours: '07:00-20:00', desc: '1-2 层，以粤式烧腊、饺子馆为主，排队较少。' });
    addBuilding({ name: '体育馆', campus: '东区', x: 138, z: 58, w: 46, h: 16, d: 30, color: WALL_OTHER,
      hours: '06:30-08:00', desc: '晨读自习室开放时段 06:30-08:00，其余时段为运动场地。' });
    addBuilding({ name: '医学院楼', campus: '南区', x: -142, z: 18, w: 34, h: 20, d: 18, color: WALL_EDU,
      hours: '08:00-21:00', desc: '2 层自习室，70 个座位，环境安静。' });
    addBuilding({ name: '6号宿舍楼', campus: '南区', x: 96, z: 112, w: 44, h: 18, d: 16, color: WALL_OTHER,
      hours: '全天开放', desc: '1 层活动自习室，40 个座位，宿舍区最近的夜间自习点。' });
  }

  /* ==================== 树木 ==================== */
  function addTree(x, z, scale) {
    var group = new THREE.Group();
    var trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.75, 2.6, 8),
      new THREE.MeshLambertMaterial({ color: 0x8A715C })
    );
    trunk.position.y = 1.3;
    trunk.castShadow = true;
    var leaf1 = new THREE.Mesh(
      new THREE.ConeGeometry(2.3, 3.4, 8),
      new THREE.MeshLambertMaterial({ color: 0x7E9678 })
    );
    leaf1.position.y = 3.8;
    leaf1.castShadow = true;
    var leaf2 = new THREE.Mesh(
      new THREE.ConeGeometry(1.6, 2.5, 8),
      new THREE.MeshLambertMaterial({ color: 0x8CA383 })
    );
    leaf2.position.y = 5.6;
    leaf2.castShadow = true;
    group.add(trunk, leaf1, leaf2);
    group.position.set(x, 0, z);
    group.scale.setScalar(scale);
    scene.add(group);
  }

  function buildTrees() {
    var count = 0, tries = 0;
    while (count < 42 && tries < 500) {
      tries++;
      var x = (Math.random() - 0.5) * 500;
      var z = (Math.random() - 0.5) * 500;
      var blocked = footprints.some(function (f) {
        return Math.hypot(x - f.x, z - f.z) < f.r;
      });
      if (!blocked) {
        addTree(x, z, 0.8 + Math.random() * 0.7);
        count++;
      }
    }
  }

  /* ==================== 交互 ==================== */
  function bindControls() {
    var el = renderer.domElement;
    var down = null;

    el.addEventListener('pointerdown', function (e) {
      down = { x: e.clientX, y: e.clientY };
      if (el.setPointerCapture) { el.setPointerCapture(e.pointerId); }
    });

    el.addEventListener('pointermove', function (e) {
      if (!down) { return; }
      var dx = e.clientX - down.x;
      var dy = e.clientY - down.y;
      theta -= dx * 0.005;
      phi = Math.min(PHI_MAX, Math.max(PHI_MIN, phi - dy * 0.005));
      down = { x: e.clientX, y: e.clientY };
    });

    el.addEventListener('pointerup', function (e) {
      if (!down) { return; }
      var moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved > 6) { return; } // 是拖拽不是点击

      var rect = el.getBoundingClientRect();
      var ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(ndc, camera);
      var hits = raycaster.intersectObjects(buildings, false);
      if (hits.length > 0) {
        selectBuilding(hits[0].object);
      } else {
        clearSelection();
      }
    });

    el.addEventListener('pointercancel', function () { down = null; });

    el.addEventListener('wheel', function (e) {
      e.preventDefault();
      radius = Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, radius + e.deltaY * 0.3));
    }, { passive: false });

    document.getElementById('btnAuto').addEventListener('click', function () {
      autoRotate = !autoRotate;
      this.textContent = autoRotate ? '⏸ 暂停旋转' : '▶ 继续旋转';
    });

    document.getElementById('btnReset').addEventListener('click', function () {
      theta = 0.65; phi = 1.08; radius = 240;
      clearSelection();
      App.toast('视角已复位', 'info');
    });

    document.getElementById('btnCloseInfo').addEventListener('click', clearSelection);
  }

  /* 高亮：把建筑整体染成灰蓝并只加极低自发光，
     避免用高强度自发光导致选中建筑再次过曝成死白。 */
  function applyHighlight(mesh, on) {
    if (!mesh) { return; }
    if (mesh.userData._baseColor === undefined) {
      mesh.userData._baseColor = mesh.material.color.getHex();
    }
    if (on) {
      mesh.material.color.setHex(0x9FB6C6);          // 莫兰迪灰蓝染色
      mesh.material.emissive.setHex(0x1E2F3A);
      mesh.material.emissiveIntensity = 0.35;
    } else {
      mesh.material.color.setHex(mesh.userData._baseColor);
      mesh.material.emissive.setHex(0x000000);
      mesh.material.emissiveIntensity = 1;
    }
  }

  function selectBuilding(mesh) {
    if (selected && selected !== mesh) { applyHighlight(selected, false); }
    selected = mesh;
    applyHighlight(mesh, true);

    var u = mesh.userData;
    document.getElementById('infoTitle').textContent = u.name + '（' + u.campus + '）';
    document.getElementById('infoBody').innerHTML =
      '<div class="my-1">🕐 开放时间：<strong>' + App.esc(u.hours) + '</strong></div>' +
      '<div class="my-1">📋 ' + App.esc(u.desc) + '</div>' +
      '<div class="text-primary mt-2">💡 提示：本建筑数据与「自习室查询」「食堂查询」页面中的 JSON 数据对应。</div>';
    document.getElementById('infoPanel').classList.remove('d-none');
  }

  function clearSelection() {
    if (selected) { applyHighlight(selected, false); }
    selected = null;
    document.getElementById('infoPanel').classList.add('d-none');
  }

  /* ==================== 渲染循环 ==================== */
  function onResize() {
    var w = stage.clientWidth, h = stage.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  function animate() {
    requestAnimationFrame(animate);
    if (autoRotate) { theta += 0.0016; }
    camera.position.set(
      target.x + radius * Math.sin(phi) * Math.sin(theta),
      target.y + radius * Math.cos(phi),
      target.z + radius * Math.sin(phi) * Math.cos(theta)
    );
    camera.lookAt(target);
    renderer.render(scene, camera);
  }

  /* 调试钩子：供自动化测试/截图使用（不影响正常功能） */
  window.__threeDebug = {
    select: function (name) {
      var b = null;
      for (var i = 0; i < buildings.length; i++) {
        if (buildings[i].userData && buildings[i].userData.name === name) { b = buildings[i]; break; }
      }
      if (b) { selectBuilding(b); } else { clearSelection(); }
    }
  };

  init();
})();
