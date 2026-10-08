/* ============================================================
   食堂查询页
   功能：JSON 加载 → 关键字搜索（含档口/菜品）→ 校区、营业状态
         筛选 → 排序 → 卡片渲染 → 详情弹窗。
         营业状态由当前系统时间与营业时段实时计算。
   ============================================================ */
(function () {
  'use strict';

  var canteens = [];
  var filters = { kw: '', campus: '', status: '', sort: 'rating' };
  var detailModal = null;

  function esc(s) { return App.esc(s); }

  /* ---------- 营业状态计算 ---------- */
  function toMin(s) {
    var p = s.split(':');
    return Number(p[0]) * 60 + Number(p[1] || 0);
  }

  function isOpenNow(hours) {
    if (!hours || hours.indexOf('全天') >= 0) { return true; }
    var parts = hours.split('-');
    if (parts.length !== 2) { return true; }
    var a = toMin(parts[0].trim());
    var b = toMin(parts[1].trim());
    var now = new Date();
    var m = now.getHours() * 60 + now.getMinutes();
    if (a <= b) { return m >= a && m <= b; }
    return m >= a || m <= b; // 跨零点营业（如 17:00-24:00）
  }

  /* ---------- 初始化 ---------- */
  function init() {
    bindToolbar();
    detailModal = new bootstrap.Modal(document.getElementById('detailModal'));
    loadData();
  }

  function loadData() {
    var area = document.getElementById('errorArea');
    App.clearError(area);
    App.loadJSON('data/canteens.json')
      .then(function (data) {
        canteens = data;
        populateCampus();
        render();
        App.toast('食堂数据加载成功，共 ' + canteens.length + ' 家');
      })
      .catch(function (err) {
        App.showError(area, err.message, loadData);
      });
  }

  function populateCampus() {
    var list = [];
    canteens.forEach(function (c) {
      if (list.indexOf(c.campus) < 0) { list.push(c.campus); }
    });
    list.sort();
    var sel = document.getElementById('fCampus2');
    var cur = filters.campus;
    sel.innerHTML = '<option value="">全部校区</option>' + list.map(function (c) {
      return '<option value="' + esc(c) + '"' + (c === cur ? ' selected' : '') + '>' + esc(c) + '</option>';
    }).join('');
  }

  /* ---------- 筛选 ---------- */
  function applyFilter() {
    var kw = filters.kw.trim().toLowerCase();
    return canteens.filter(function (c) {
      if (filters.campus && c.campus !== filters.campus) { return false; }
      if (filters.status) {
        var open = isOpenNow(c.hours);
        if ((filters.status === 'open' && !open) || (filters.status === 'closed' && open)) { return false; }
      }
      if (kw) {
        var winText = (c.windows || []).map(function (w) { return w.name + ' ' + w.category; }).join(' ');
        var hay = (c.name + ' ' + winText + ' ' + (c.specialties || []).join(' ')).toLowerCase();
        if (hay.indexOf(kw) < 0) { return false; }
      }
      return true;
    }).sort(function (a, b) {
      if (filters.sort === 'queue') {
        var order = { '少': 1, '中': 2, '多': 3 };
        return (order[a.queue] || 9) - (order[b.queue] || 9);
      }
      if (filters.sort === 'name') {
        return a.name.localeCompare(b.name, 'zh');
      }
      return b.rating - a.rating;
    });
  }

  /* ---------- 渲染 ---------- */
  function render() {
    var list = applyFilter();
    document.getElementById('canteenList').innerHTML = list.map(cardHtml).join('');
    document.getElementById('canteenEmpty').classList.toggle('d-none', list.length > 0);

    var openCount = 0, winCount = 0;
    canteens.forEach(function (c) {
      if (isOpenNow(c.hours)) { openCount++; }
      winCount += (c.windows || []).length;
    });
    document.getElementById('statCanteens').textContent = list.length;
    document.getElementById('statOpen').textContent = openCount;
    document.getElementById('statWindows').textContent = winCount;
  }

  function cardHtml(c) {
    var open = isOpenNow(c.hours);
    var statusHtml = open
      ? '<span class="badge badge-soft-open">营业中</span>'
      : '<span class="badge badge-soft-closed">已打烊</span>';

    var stars = '⭐'.repeat(Math.round(c.rating));
    var winChips = (c.windows || []).slice(0, 3).map(function (w) {
      return '<span class="facility-chip">' + esc(w.name) + ' ¥' + w.price + '</span>';
    }).join('');
    var more = (c.windows || []).length > 3 ? '<span class="facility-chip">+' + ((c.windows || []).length - 3) + ' 个档口</span>' : '';

    return '<div class="col-12 col-md-6 col-xl-4">' +
      '<div class="card room-card shadow-sm h-100">' +
        '<div class="card-body">' +
          '<div class="d-flex justify-content-between align-items-start">' +
            '<h3 class="card-title mb-1">' + esc(c.name) + '</h3>' + statusHtml +
          '</div>' +
          '<p class="text-muted small mb-2">📍 ' + esc(c.campus) + ' · ' + esc(c.floor) +
            '　⏰ ' + esc(c.hours) + '　🚶 排队：' + esc(c.queue) + '</p>' +
          '<div class="mb-2">' + winChips + more + '</div>' +
          '<div class="d-flex justify-content-between align-items-center">' +
            '<span class="small">' + stars + ' <strong>' + c.rating.toFixed(1) + '</strong> 分</span>' +
            '<button type="button" class="btn btn-sm btn-outline-primary btn-detail" data-id="' + c.id + '">查看详情 →</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ---------- 详情弹窗 ---------- */
  function showDetail(id) {
    var c = canteens.find(function (x) { return x.id === id; });
    if (!c) { return; }
    var open = isOpenNow(c.hours);
    document.getElementById('detailTitle').textContent = c.name + '（' + c.campus + '）';

    var rows = (c.windows || []).map(function (w) {
      return '<tr><td>' + esc(w.name) + '</td><td>' + esc(w.category) + '</td>' +
        '<td class="text-end">¥' + w.price + '</td>' +
        '<td class="text-end">' + w.rating.toFixed(1) + ' ⭐</td>' +
        '<td class="text-end">' + w.sales + ' 份</td></tr>';
    }).join('');

    var specHtml = (c.specialties || []).map(function (s) {
      return '<span class="facility-chip">🥢 ' + esc(s) + '</span>';
    }).join('');

    document.getElementById('detailBody').innerHTML =
      '<div class="d-flex flex-wrap gap-2 mb-3">' +
        (open
          ? '<span class="badge badge-soft-open">营业中</span>'
          : '<span class="badge badge-soft-closed">已打烊</span>') +
        '<span class="badge text-bg-light border">营业时间 ' + esc(c.hours) + '</span>' +
        '<span class="badge text-bg-light border">当前排队：' + esc(c.queue) + '</span>' +
        '<span class="badge text-bg-light border">综合评分 ' + c.rating.toFixed(1) + '</span>' +
      '</div>' +
      '<h3 class="h6 fw-bold">🪟 档口明细（' + (c.windows || []).length + ' 个）</h3>' +
      '<div class="table-responsive"><table class="table table-sm table-hover align-middle">' +
        '<thead class="table-light"><tr><th>档口</th><th>类别</th><th class="text-end">均价</th>' +
        '<th class="text-end">评分</th><th class="text-end">今日销量</th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table></div>' +
      '<h3 class="h6 fw-bold mt-3">🥢 招牌推荐</h3><div>' + specHtml + '</div>' +
      '<p class="text-muted small mt-3 mb-0">以上数据来自 data/canteens.json，为模拟演示数据。</p>';

    detailModal.show();
  }

  /* ---------- 事件绑定 ---------- */
  function bindToolbar() {
    document.getElementById('kwCanteen').addEventListener('input', function () {
      filters.kw = this.value;
      render();
    });
    document.getElementById('fCampus2').addEventListener('change', function () {
      filters.campus = this.value;
      render();
    });
    document.getElementById('fStatus2').addEventListener('change', function () {
      filters.status = this.value;
      render();
    });
    document.getElementById('fSort2').addEventListener('change', function () {
      filters.sort = this.value;
      render();
    });
    document.getElementById('btnReset2').addEventListener('click', function () {
      filters = { kw: '', campus: '', status: '', sort: 'rating' };
      document.getElementById('kwCanteen').value = '';
      document.getElementById('fStatus2').value = '';
      document.getElementById('fSort2').value = 'rating';
      populateCampus();
      render();
    });
    document.getElementById('canteenList').addEventListener('click', function (e) {
      var btn = e.target.closest('.btn-detail');
      if (btn) { showDetail(Number(btn.getAttribute('data-id'))); }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
