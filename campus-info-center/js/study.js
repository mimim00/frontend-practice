/* ============================================================
   自习室查询与管理页
   功能：JSON 加载 → 搜索 / 筛选 / 排序 → 卡片渲染；
         添加、修改、删除（localStorage 持久化）；
         表单校验、空状态、错误横幅、Toast 提示。
   ============================================================ */
(function () {
  'use strict';

  var STORAGE_KEY = 'scic_study_rooms_v1';

  var rooms = [];                 // 当前数据源
  var filters = { kw: '', campus: '', building: '', status: '', sort: 'usage' };
  var editingId = null;           // 正在编辑的自习室 id
  var deletingId = null;          // 待删除的自习室 id

  var STATUS_MAP = {
    open:   { text: '开放中', cls: 'badge-soft-open' },
    full:   { text: '已满座', cls: 'badge-soft-full' },
    closed: { text: '已关闭', cls: 'badge-soft-closed' }
  };

  /* ---------- 工具：上座率 ---------- */
  function usageOf(r) {
    if (!r.seats) { return 0; }
    return Math.round((r.seats - r.available) / r.seats * 100);
  }

  function esc(s) { return App.esc(s); }

  /* ---------- 初始化 ---------- */
  function init() {
    bindToolbar();
    bindModal();
    loadData();
  }

  /* ---------- 数据加载（localStorage 优先，其次 JSON） ---------- */
  function loadData() {
    var area = document.getElementById('errorArea');
    App.clearError(area);

    var local = null;
    try { local = localStorage.getItem(STORAGE_KEY); } catch (e) { /* 隐私模式下忽略 */ }

    if (local) {
      try {
        rooms = JSON.parse(local);
        afterLoad(area);
        return;
      } catch (e) {
        console.warn('localStorage 数据损坏，回退到 JSON 数据源', e);
      }
    }

    App.loadJSON('data/study_rooms.json')
      .then(function (data) {
        rooms = data;
        afterLoad(area);
      })
      .catch(function (err) {
        App.showError(area, err.message, loadData);
      });
  }

  function afterLoad() {
    populateSelects();
    render();
    App.toast('自习室数据加载成功，共 ' + rooms.length + ' 间');
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms));
    } catch (e) {
      App.toast('保存失败：浏览器可能处于无痕模式，本次修改仅当前页面有效', 'warning');
    }
  }

  function restoreOriginal() {
    if (!window.confirm('确定放弃所有本地修改，恢复为 data/study_rooms.json 中的原始数据吗？')) { return; }
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    loadData();
    App.toast('已恢复原始数据', 'info');
  }

  /* ---------- 动态填充校区 / 楼栋下拉框 ---------- */
  function populateSelects() {
    var campuses = [], buildings = [];
    rooms.forEach(function (r) {
      if (campuses.indexOf(r.campus) < 0) { campuses.push(r.campus); }
      if (buildings.indexOf(r.building) < 0) { buildings.push(r.building); }
    });
    campuses.sort(); buildings.sort();

    var campusSel = document.getElementById('fCampus');
    var curCampus = filters.campus;
    campusSel.innerHTML = '<option value="">全部校区</option>' + campuses.map(function (c) {
      return '<option value="' + esc(c) + '"' + (c === curCampus ? ' selected' : '') + '>' + esc(c) + '</option>';
    }).join('');

    var buildingSel = document.getElementById('fBuilding');
    var curBuilding = filters.building;
    buildingSel.innerHTML = '<option value="">全部楼栋</option>' + buildings.map(function (b) {
      return '<option value="' + esc(b) + '"' + (b === curBuilding ? ' selected' : '') + '>' + esc(b) + '</option>';
    }).join('');
  }

  /* ---------- 筛选 + 排序 ---------- */
  function applyFilter() {
    var kw = filters.kw.trim().toLowerCase();
    var list = rooms.filter(function (r) {
      if (filters.campus && r.campus !== filters.campus) { return false; }
      if (filters.building && r.building !== filters.building) { return false; }
      if (filters.status && r.status !== filters.status) { return false; }
      if (kw) {
        var hay = (r.name + ' ' + r.building + ' ' + (r.facilities || []).join(' ')).toLowerCase();
        if (hay.indexOf(kw) < 0) { return false; }
      }
      return true;
    });

    if (filters.sort === 'seats') {
      list.sort(function (a, b) { return b.seats - a.seats; });
    } else if (filters.sort === 'name') {
      list.sort(function (a, b) { return a.name.localeCompare(b.name, 'zh'); });
    } else {
      list.sort(function (a, b) { return usageOf(b) - usageOf(a); });
    }
    return list;
  }

  /* ---------- 渲染 ---------- */
  function render() {
    var list = applyFilter();
    var html = list.map(cardHtml).join('');
    // 使用 jQuery 更新列表与空状态
    $('#roomList').html(html);
    $('#roomEmpty').toggleClass('d-none', list.length > 0);

    // 统计条（统计的是当前筛选结果）
    var totalSeats = 0, availSeats = 0;
    list.forEach(function (r) { totalSeats += r.seats; availSeats += r.available; });
    var avg = totalSeats ? Math.round((totalSeats - availSeats) / totalSeats * 100) : 0;
    $('#statRooms').text(list.length);
    $('#statSeats').text(availSeats);
    $('#statAvg').text(avg + '%');
  }

  function cardHtml(r) {
    var st = STATUS_MAP[r.status] || { text: r.status, cls: 'badge-soft-blue' };
    var usage = usageOf(r);
    var barCls = usage >= 100 ? 'bar-full' : (usage >= 70 ? 'bar-high' : 'bar-good');
    var chips = (r.facilities || []).map(function (f) {
      return '<span class="facility-chip">' + esc(f) + '</span>';
    }).join('');

    return '<div class="col-12 col-md-6 col-xl-4">' +
      '<div class="card room-card shadow-sm h-100">' +
        '<div class="card-body">' +
          '<div class="d-flex justify-content-between align-items-start">' +
            '<h3 class="card-title mb-1">' + esc(r.name) + '</h3>' +
            '<span class="badge ' + st.cls + ' text-nowrap">' + st.text + '</span>' +
          '</div>' +
          '<p class="text-muted small mb-2">📍 ' + esc(r.campus) + ' · ' + esc(r.building) +
            ' ' + r.floor + ' 层　⏰ ' + esc(r.hours) + '</p>' +
          '<div class="d-flex justify-content-between small mb-1">' +
            '<span class="text-muted">可用 / 总座位</span>' +
            '<span class="fw-bold">' + r.available + ' / ' + r.seats + '</span>' +
          '</div>' +
          '<div class="progress progress-thin mb-2">' +
            '<div class="progress-bar ' + barCls + '" role="progressbar" style="width:' + usage + '%"' +
            ' aria-valuenow="' + usage + '" aria-valuemin="0" aria-valuemax="100"></div>' +
          '</div>' +
          '<div class="d-flex justify-content-between align-items-center">' +
            '<div>' + chips + '</div>' +
            '<span class="text-muted small text-nowrap ms-2">上座率 ' + usage + '%</span>' +
          '</div>' +
        '</div>' +
        '<div class="card-footer bg-white border-0 pt-0 d-flex justify-content-end gap-2">' +
          '<button type="button" class="btn btn-sm btn-outline-primary btn-edit" data-id="' + r.id + '">✏️ 编辑</button>' +
          '<button type="button" class="btn btn-sm btn-outline-danger btn-del" data-id="' + r.id + '">🗑️ 删除</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ---------- 工具栏事件（jQuery 绑定） ---------- */
  function bindToolbar() {
    $('#kwSearch').on('input', function () { filters.kw = this.value; render(); });
    $('#fCampus').on('change', function () { filters.campus = this.value; render(); });
    $('#fBuilding').on('change', function () { filters.building = this.value; render(); });
    $('#fStatus').on('change', function () { filters.status = this.value; render(); });
    $('#fSort').on('change', function () { filters.sort = this.value; render(); });
    $('#btnReset').on('click', function () {
      filters = { kw: '', campus: '', building: '', status: '', sort: 'usage' };
      $('#kwSearch').val('');
      $('#fStatus').val('');
      $('#fSort').val('usage');
      populateSelects();
      render();
    });
    $('#btnRestore').on('click', restoreOriginal);

    // jQuery 事件委托：动态渲染出来的「编辑 / 删除」按钮
    $('#roomList').on('click', '.btn-edit', function () {
      openEdit(Number($(this).attr('data-id')));
    });
    $('#roomList').on('click', '.btn-del', function () {
      askDelete(Number($(this).attr('data-id')));
    });
  }

  /* ---------- 添加 / 修改 ---------- */
  var roomModal = null, delModal = null;

  function bindModal() {
    roomModal = new bootstrap.Modal(document.getElementById('roomModal'));
    delModal = new bootstrap.Modal(document.getElementById('delModal'));

    $('#btnAdd').on('click', openAdd);
    $('#roomForm').on('submit', function (e) { e.preventDefault(); saveFromForm(); });
    $('#btnDelConfirm').on('click', confirmDelete);

    // 可用座位数联动校验：修改总数时提示可用数不能超过总数
    $('#inpSeats').on('input', function () {
      var $av = $('#inpAvail');
      if ($av.val() !== '') {
        $av[0].setCustomValidity(Number($av.val()) > Number(this.value)
          ? '可用座位不能大于座位总数。' : '');
      }
    });
  }

  function openAdd() {
    editingId = null;
    document.getElementById('roomModalTitle').textContent = '添加自习室';
    var form = document.getElementById('roomForm');
    form.reset();
    form.classList.remove('was-validated');
    document.getElementById('inpId').value = '';
    document.getElementById('inpFloor').value = '1';
    clearCustomValidity();
    roomModal.show();
  }

  function openEdit(id) {
    var r = rooms.find(function (x) { return x.id === id; });
    if (!r) {
      App.toast('未找到该自习室，可能已被删除', 'warning');
      return;
    }
    editingId = id;
    document.getElementById('roomModalTitle').textContent = '修改自习室';
    var form = document.getElementById('roomForm');
    form.classList.remove('was-validated');
    document.getElementById('inpId').value = String(r.id);
    document.getElementById('inpName').value = r.name;
    document.getElementById('inpCampus').value = r.campus;
    document.getElementById('inpBuilding').value = r.building;
    document.getElementById('inpFloor').value = r.floor;
    document.getElementById('inpSeats').value = r.seats;
    document.getElementById('inpAvail').value = r.available;
    document.getElementById('inpStatus').value = r.status;
    document.getElementById('inpHours').value = r.hours;
    document.querySelectorAll('.facility-cb').forEach(function (cb) {
      cb.checked = (r.facilities || []).indexOf(cb.value) >= 0;
    });
    clearCustomValidity();
    roomModal.show();
  }

  function clearCustomValidity() {
    ['inpName', 'inpCampus', 'inpBuilding', 'inpFloor', 'inpSeats', 'inpAvail', 'inpStatus', 'inpHours']
      .forEach(function (id) { document.getElementById(id).setCustomValidity(''); });
  }

  function saveFromForm() {
    var form = document.getElementById('roomForm');
    var name = document.getElementById('inpName').value.trim();
    var campus = document.getElementById('inpCampus').value;
    var building = document.getElementById('inpBuilding').value.trim();
    var floor = Number(document.getElementById('inpFloor').value);
    var seats = Number(document.getElementById('inpSeats').value);
    var avail = Number(document.getElementById('inpAvail').value);
    var status = document.getElementById('inpStatus').value;
    var hours = document.getElementById('inpHours').value.trim();
    var facilities = [];
    document.querySelectorAll('.facility-cb:checked').forEach(function (cb) { facilities.push(cb.value); });

    // ---- 非法输入校验（对应"错误处理"中的非法输入） ----
    var nameInput = document.getElementById('inpName');
    var dup = rooms.some(function (r) {
      return r.name === name && String(r.id) !== document.getElementById('inpId').value;
    });
    nameInput.setCustomValidity(dup ? '该名称已存在，请换一个名称。' : '');
    if (!name) { nameInput.setCustomValidity('请输入自习室名称。'); }

    var floorInput = document.getElementById('inpFloor');
    floorInput.setCustomValidity(
      (!floor || floor < 1 || floor > 30 || floor % 1 !== 0) ? '楼层为 1-30 的整数。' : '');

    var seatsInput = document.getElementById('inpSeats');
    seatsInput.setCustomValidity(
      (!seats || seats < 1 || seats > 999 || seats % 1 !== 0) ? '座位总数为 1-999 的整数。' : '');

    var availInput = document.getElementById('inpAvail');
    availInput.setCustomValidity(
      (isNaN(avail) || avail < 0 || avail % 1 !== 0)
        ? '可用座位为不小于 0 的整数。'
        : (avail > seats ? '可用座位不能大于座位总数。' : ''));

    if (!form.checkValidity()) {
      form.classList.add('was-validated');
      App.toast('表单填写有误，请检查红色提示项', 'danger');
      return;
    }

    // ---- 保存 ----
    if (editingId === null) {
      rooms.unshift({
        id: Date.now(),
        name: name, campus: campus, building: building, floor: floor,
        seats: seats, available: avail, status: status, hours: hours, facilities: facilities
      });
      App.toast('已添加自习室：' + name);
    } else {
      var r = rooms.find(function (x) { return x.id === editingId; });
      if (r) {
        r.name = name; r.campus = campus; r.building = building; r.floor = floor;
        r.seats = seats; r.available = avail; r.status = status; r.hours = hours; r.facilities = facilities;
        App.toast('已保存修改：' + name);
      }
    }
    persist();
    populateSelects();
    render();
    roomModal.hide();
  }

  /* ---------- 删除 ---------- */
  function askDelete(id) {
    var r = rooms.find(function (x) { return x.id === id; });
    if (!r) { return; }
    deletingId = id;
    document.getElementById('delName').textContent = r.name;
    delModal.show();
  }

  function confirmDelete() {
    if (deletingId === null) { return; }
    var r = rooms.find(function (x) { return x.id === deletingId; });
    rooms = rooms.filter(function (x) { return x.id !== deletingId; });
    deletingId = null;
    persist();
    populateSelects();
    render();
    delModal.hide();
    App.toast('已删除自习室：' + (r ? r.name : ''), 'warning');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
