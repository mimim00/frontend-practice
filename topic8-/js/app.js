

'use strict';

const STORAGE_KEY = 'class-workbench-students-v1';

const state = {
  students: [],          // 学生数组（唯一事实来源）
  usedFallback: false,   // 是否用了内嵌数据兜底
  usedLocal: false,      // 是否读到了 localStorage 的持久化副本
  filter: { group: 'all', att: 'all', keyword: '' }
};

const charts = {
  score: null,   // ECharts 分数段分布
  group: null,   // ECharts 各小组平均分
  att: null      // Chart.js 出勤圆环
};

/* ---------- 工具 ---------- */
const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[ch]));

const sum = (list, pick) => list.reduce((acc, x) => acc + pick(x), 0);
const avg = (list, pick) => list.length ? sum(list, pick) / list.length : 0;

/* 成绩按分数段归类：<60 / 60-69 / 70-79 / 80-89 / 90-100 */
const SCORE_BANDS = [
  { label: '<60', min: -Infinity, max: 59 },
  { label: '60-69', min: 60, max: 69 },
  { label: '70-79', min: 70, max: 79 },
  { label: '80-89', min: 80, max: 89 },
  { label: '90-100', min: 90, max: Infinity }
];

/* ============================================================
 * 1. 数据加载：localStorage → fetch → 内嵌兜底，三种失败都要出声
 * ============================================================ */

/* 故障注入钩子（质量自查用，讲义第六部分要求"故意实验"看失败提示）：
 *   index.html?simulate=offline → 强制指向不存在的文件，模拟断网/路径写错
 *   index.html?simulate=empty   → 指向空数组 JSON，模拟空数据
 * 正常提交不带参数，走完整链路。 */
const SIMULATE = new URLSearchParams(location.search).get('simulate');
const DATA_URL = SIMULATE === 'empty' ? 'data/empty.json' : 'data/students.json';
const FORCE_MISSING = SIMULATE === 'offline';

const setStatus = (kind, text) => {
  const $s = $('#status');
  if (!kind) { $s.hide(); return; }
  $s.attr('class', 'alert alert-' + kind + ' mb-0').text(text).show();
};

/* localStorage 读取：内容可能被手工改成非法 JSON，必须 try/catch + 数组校验 */
const loadLocal = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return Array.isArray(data) && data.length > 0 ? data : null;
  } catch (err) {
    console.warn('[存储] localStorage 内容不是合法 JSON，已忽略：', err.message);
    return null;
  }
};

const save = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.students));
    return true;
  } catch (err) {
    /* QuotaExceededError：容量写满时不静默失败，页面出声，save 返回 false 供后续扩展 */
    setStatus('danger', '本地保存失败：' + err.name + '。请导出数据或清理浏览器存储。');
    console.error('[存储] setItem 失败：', err.name, err.message);
    return false;
  }
};

const loadData = async () => {
  setStatus('warning', '正在加载学生数据……');

  /* 正常模式：先读 localStorage（用户上次的增删改），没有再走网络 */
  if (!SIMULATE) {
    const local = loadLocal();
    if (local) {
      state.usedLocal = true;
      start(local, false);
      setStatus('info', '已加载本地保存的数据（' + local.length + ' 名）。改动会继续保存在本浏览器；点"重置演示数据"可恢复 JSON 初始数据。');
      return;
    }
  }

  try {
    const url = FORCE_MISSING ? 'data/students-not-found.json' : DATA_URL;
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error('HTTP ' + response.status + '（文件不存在或路径不对）');
    const data = await response.json();
    if (!Array.isArray(data.students)) {
      throw new Error('students 不是数组（数据格式错）');
    }
    start(data.students, false);   // 空组也走这里，start() 内部会显示空数据提示
  } catch (error) {
    const fallback = window.CLASS_STUDENTS && window.CLASS_STUDENTS.students;
    if (!fallback) {
      setStatus('danger', '数据加载失败：' + error.message + '。页面无法渲染，请检查 data/students.json。');
      $('#roster-summary').text('没有可用数据。');
      return;
    }
    state.usedFallback = true;
    start(fallback, true);
    setStatus('warning',
      '读取 data/students.json 失败（' + error.message + '），已回退到内嵌数据 students.js。' +
      '完整功能请在 practice/ 目录启动本地服务器后访问，见 README 运行方法。');
    console.warn('[降级] fetch 学生数据失败：', error.message, '已使用内嵌副本 window.CLASS_STUDENTS');
  }
};

const start = (students, usedFallback) => {
  state.students = students;
  $('#data-source').text(
    '数据来源：' + (window.CLASS_STUDENTS && window.CLASS_STUDENTS.source || '课程统一数据集') +
    '　班级：高三2班'
  );
  if (!usedFallback && !state.usedLocal) setStatus(null);
  if (students.length === 0) {
    setStatus('warning', '接口返回的 students 是空数组：当前没有可展示的学生数据。');
    renderCards([]);
    renderTable([]);
    renderSummary([]);
    renderScoreChart([]);
    renderGroupChart([]);
    renderAttChart([]);
    renderAttList([]);
    return;
  }
  renderAll();
};

/* ============================================================
 * 2. 筛选：唯一数据入口
 * ============================================================ */
const applyFilter = (students) => {
  const { group, att, keyword } = state.filter;
  const kw = keyword.trim();
  return students.filter((s) => {
    if (group !== 'all' && Number(s.group) !== Number(group)) return false;
    if (att !== 'all' && s.attendance !== att) return false;
    if (kw && s.name.indexOf(kw) === -1 && String(s.id).indexOf(kw) === -1) return false;
    return true;
  });
};

const renderAll = () => {
  const students = applyFilter(state.students);
  renderCards(students);
  renderTable(students);
  renderSummary(students);
  renderScoreChart(students);
  renderGroupChart(students);
  renderAttChart(students);
  renderAttList(students);
};

/* ============================================================
 * 3. 概览卡片（跟随筛选一起变）
 * ============================================================ */
const renderCards = (students) => {
  if (students.length === 0) {
    $('#cards').html('<div class="col-12"><div class="alert alert-secondary mb-0">暂无统计数据：没有可以汇总的学生。</div></div>');
    return;
  }
  const excellent = students.filter((s) => s.examScore >= 90).length;
  const present = students.filter((s) => s.attendance === '出勤').length;
  const stats = [
    { label: '学生总数', value: students.length, unit: '人' },
    { label: '月考平均分', value: avg(students, (s) => s.examScore).toFixed(1), unit: '分' },
    { label: '出勤率', value: Math.round((present / students.length) * 100), unit: '%' },
    { label: '优秀人数(≥90)', value: excellent, unit: '人' }
  ];
  $('#cards').html(stats.map((s) => `
    <div class="col-6 col-md-3">
      <div class="card shadow-sm h-100">
        <div class="card-body">
          <p class="card-title small mb-1">${esc(s.label)}</p>
          <p class="stat-value fs-3 mb-0">${esc(s.value)}<span class="fs-6 text-muted"> ${esc(s.unit)}</span></p>
        </div>
      </div>
    </div>`).join(''));
};

/* ============================================================
 * 4. 学生表格：渲染前先清空容器（防残留），行内编辑 + 删除
 * ============================================================ */
const renderTable = (students) => {
  const $body = $('#student-body').empty();
  if (students.length === 0) {
    $body.append('<tr><td colspan="8" class="text-center text-muted py-4">' +
      (state.students.length === 0 ? '暂无学生数据。' : '没有符合条件的学生，换个筛选条件试试。') +
      '</td></tr>');
    return;
  }

  $body.html(students.map((s) => {
    const low = s.examScore < 60;
    return `
      <tr data-id="${esc(s.id)}">
        <td>${esc(s.id)}</td>
        <td>${esc(s.name)}</td>
        <td>${esc(s.gender)}</td>
        <td>${esc(s.group)} 组</td>
        <td>${esc(s.role || '—')}</td>
        <td>
          <span class="score-tag${low ? ' is-low' : ''}" data-field="examScore">${s.examScore}${low ? '<span class="score-hint">（需关注）</span>' : ''}</span>
        </td>
        <td>
          <span class="att-badge att-${s.attendance === '出勤' ? 'ok' : s.attendance === '请假' ? 'leave' : 'miss'}"
                data-field="attendance">${esc(s.attendance)}</span>
        </td>
        <td>
          <button type="button" class="btn btn-sm btn-outline-primary" data-action="edit">编辑</button>
          <button type="button" class="btn btn-sm btn-outline-danger" data-action="delete">删除</button>
        </td>
      </tr>`;
  }).join(''));
};

const renderSummary = (students) => {
  $('#roster-summary').text(students.length === 0
    ? '当前筛选条件下没有学生（全班共 ' + state.students.length + ' 人）。'
    : '筛选结果：' + students.length + ' 人，平均分 ' + avg(students, (s) => s.examScore).toFixed(1) + ' 分。');
};

/* ============================================================
 * 5. 增删改（事件委托：列表是动态生成的，只在 tbody 上挂监听）
 * ============================================================ */
const nextId = () => {
  const ids = state.students.map((s) => Number(s.id)).filter((n) => !isNaN(n));
  return String(ids.length ? Math.max(...ids) + 1 : 20260001);
};

$('#add-form').on('submit', (e) => {
  e.preventDefault();                       // 表单默认行为是提交+刷新，第一行必须拦住
  const name = $('#f-name').val().trim();
  const score = Number($('#f-score').val());

  $('#add-form input, #add-form select').removeClass('is-invalid').removeAttr('aria-invalid');
  $('#form-tip').text('');

  if (!name) {
    $('#f-name').addClass('is-invalid').attr('aria-invalid', 'true').focus();
    $('#form-tip').text('姓名不能为空。');
    return;
  }
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    $('#f-score').addClass('is-invalid').attr('aria-invalid', 'true').focus();
    $('#form-tip').text('成绩必须是 0~100 之间的数字。');
    return;
  }

  const group = Number($('#f-group').val());
  const inGroup = state.students.filter((s) => s.group === group).length;

  const student = {
    id: nextId(),
    name,
    gender: $('#f-gender').val(),
    group,
    seat: inGroup + 1,                      // 自动排到该组下一个座位
    role: $('#f-role').val().trim(),
    examScore: score,
    attendance: '出勤'
  };
  state.students.push(student);             // 1. 先改数组
  save();                                   // 2. 再存
  renderAll();                              // 3. 最后重画
  $('#add-form')[0].reset();
  $('#f-group').val(group);
  $('#f-score').val('60');
});

/* 行内编辑：把成绩/出勤两格替换成输入控件，回车或失焦保存，Esc 取消 */
let editing = null;
const startEdit = (tr) => {
  if (editing) cancelEdit(editing.tr);
  const id = tr.dataset.id;
  const student = state.students.find((s) => String(s.id) === id);
  if (!student) return;

  const scoreCell = tr.querySelector('[data-field="examScore"]');
  const attCell = tr.querySelector('[data-field="attendance"]');
  const scoreVal = student.examScore;
  const attVal = student.attendance;

  scoreCell.innerHTML = `<input type="number" class="form-control form-control-sm inline-input" data-edit="examScore" min="0" max="100" value="${scoreVal}" aria-label="月考成绩（行内编辑）">`;
  attCell.innerHTML = `<select class="form-select form-select-sm inline-input" data-edit="attendance" aria-label="出勤状态（行内编辑）">
    <option value="出勤" ${attVal === '出勤' ? 'selected' : ''}>出勤</option>
    <option value="请假" ${attVal === '请假' ? 'selected' : ''}>请假</option>
    <option value="缺勤" ${attVal === '缺勤' ? 'selected' : ''}>缺勤</option>
  </select>`;

  tr.querySelector('[data-action="edit"]').textContent = '保存';
  tr.querySelector('[data-action="delete"]').textContent = '取消';
  editing = { tr, id };
  scoreCell.querySelector('input').focus();
};

const commitEdit = (tr) => {
  if (!editing || editing.tr !== tr) return;
  const student = state.students.find((s) => String(s.id) === editing.id);
  if (student) {
    const score = Number(tr.querySelector('[data-edit="examScore"]').value);
    if (Number.isFinite(score) && score >= 0 && score <= 100) student.examScore = score;
    student.attendance = tr.querySelector('[data-edit="attendance"]').value;
    save();
  }
  editing = null;
  renderAll();
};

const cancelEdit = (tr) => {
  if (editing && editing.tr === tr) editing = null;
  renderAll();
};

/* 事件委托：任意"编辑/删除"按钮，冒泡到 tbody 统一处理 */
$('#student-body').on('click', '[data-action]', function () {
  const tr = $(this).closest('tr')[0];
  const action = $(this).data('action');

  if (editing && editing.tr === tr) {
    if (action === 'delete') { cancelEdit(tr); return; }   // 编辑态下"删除"按钮文字已变成"取消"
    if (action === 'edit') { commitEdit(tr); return; }     // 编辑态下"编辑"按钮文字已变成"保存"
  }

  if (action === 'edit') { startEdit(tr); return; }
  if (action === 'delete') {
    const id = tr.dataset.id;
    state.students = state.students.filter((s) => String(s.id) !== id);   // 先改数组
    save();
    renderAll();
  }
});

/* 编辑态回车保存、Esc 取消（也是事件委托，处理动态生成的输入控件） */
$('#student-body').on('keydown', '[data-edit]', function (e) {
  const tr = $(this).closest('tr')[0];
  if (e.key === 'Enter') { e.preventDefault(); commitEdit(tr); }
  if (e.key === 'Escape') { cancelEdit(tr); }
});

/* 行高亮（点击行本身，不点到按钮时） */
$('#student-body').on('click', 'tr', function (e) {
  if (e.target.closest('[data-action]') || e.target.closest('[data-edit]')) return;
  $(this).toggleClass('is-picked');
});

/* 重置演示数据：清 localStorage，回到 JSON 初始数据 */
$('#reset-data').on('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  state.usedLocal = false;
  state.usedFallback = false;
  loadData();
});

/* ============================================================
 * 6. 筛选栏事件
 * ============================================================ */
const syncFilterButtons = () => {
  $('#group-filters .btn').each(function () {
    const on = String($(this).data('group')) === String(state.filter.group);
    $(this).toggleClass('is-on', on).attr('aria-pressed', on ? 'true' : 'false');
  });
  $('#att-filters .btn').each(function () {
    const on = String($(this).data('att')) === String(state.filter.att);
    $(this).toggleClass('is-on', on).attr('aria-pressed', on ? 'true' : 'false');
  });
};

$('#filters').on('click', '#group-filters .btn', function () {
  state.filter.group = String($(this).data('group'));
  syncFilterButtons();
  renderAll();
});
$('#filters').on('click', '#att-filters .btn', function () {
  state.filter.att = String($(this).data('att'));
  syncFilterButtons();
  renderAll();
});
$('#keyword').on('input', function () {
  state.filter.keyword = $(this).val();
  renderAll();
});

/* ============================================================
 * 7. 图表：分数段分布 / 各小组平均分 / 出勤构成
 * ============================================================ */
const renderScoreChart = (students) => {
  if (!charts.score) charts.score = echarts.init(document.querySelector('#score-chart'));
  const counts = SCORE_BANDS.map((b) => students.filter((s) => s.examScore >= b.min && s.examScore <= b.max).length);
  if (students.length === 0) charts.score.clear();
  charts.score.setOption({
    title: {
      text: '月考分数段分布（单位：人）',
      subtext: students.length ? '共 ' + students.length + ' 人' : '当前无数据',
      left: 'center', textStyle: { fontSize: 14 }, subtextStyle: { fontSize: 12 }
    },
    tooltip: { trigger: 'axis' },
    grid: { left: 8, right: 16, top: 64, bottom: 8, containLabel: true },
    xAxis: { type: 'category', data: SCORE_BANDS.map((b) => b.label) },
    yAxis: { type: 'value', name: '人', minInterval: 1 },
    series: [{
      name: '人数', type: 'bar', data: counts, barMaxWidth: 40,
      itemStyle: {
        color: (p) => p.dataIndex === 0 ? '#a3521c' : '#1f6b4f',
        borderRadius: [3, 3, 0, 0]
      },
      label: { show: true, position: 'top', fontSize: 11 }
    }]
  }, true);
};

const renderGroupChart = (students) => {
  if (!charts.group) charts.group = echarts.init(document.querySelector('#group-chart'));
  const groups = (window.CLASS_STUDENTS && window.CLASS_STUDENTS.groups) || [1, 2, 3, 4, 5, 6];
  const data = groups.map((g) => {
    const members = students.filter((s) => s.group === g);
    return members.length ? Number(avg(members, (s) => s.examScore).toFixed(1)) : null;
  });
  if (students.length === 0) charts.group.clear();
  charts.group.setOption({
    title: {
      text: '各小组平均分（单位：分）',
      subtext: students.length ? '按当前筛选结果计算' : '当前无数据',
      left: 'center', textStyle: { fontSize: 14 }, subtextStyle: { fontSize: 12 }
    },
    tooltip: { trigger: 'axis', valueFormatter: (v) => (v == null ? '无数据' : v + ' 分') },
    grid: { left: 8, right: 16, top: 64, bottom: 8, containLabel: true },
    xAxis: { type: 'category', data: groups.map((g) => g + ' 组') },
    yAxis: { type: 'value', name: '分', min: 0, max: 100 },
    series: [{
      name: '平均分', type: 'bar', data, barMaxWidth: 40,
      itemStyle: { color: '#1f6b4f', borderRadius: [3, 3, 0, 0] },
      label: { show: true, position: 'top', fontSize: 11, formatter: (p) => (p.value == null ? '—' : p.value) }
    }]
  }, true);
};

const renderAttChart = (students) => {
  const kinds = ['出勤', '请假', '缺勤'];
  const counts = kinds.map((k) => students.filter((s) => s.attendance === k).length);
  if (charts.att) charts.att.destroy();       // 防重复初始化
  charts.att = new Chart(document.querySelector('#att-chart'), {
    type: 'doughnut',
    data: {
      labels: kinds,
      datasets: [{ data: counts, backgroundColor: ['#1f6b4f', '#c9901f', '#a3521c'], borderWidth: 1 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '55%',
      plugins: {
        title: {
          display: true,
          text: '出勤构成（单位：人）',
          subtext: students.length ? '共 ' + students.length + ' 人' : '当前无数据',
          font: { size: 14 }, padding: { bottom: 8 }
        },
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const total = counts.reduce((a, b) => a + b, 0);
              const pct = total ? Math.round((ctx.parsed / total) * 100) : 0;
              return ctx.label + '：' + ctx.parsed + ' 人（' + pct + '%）';
            }
          }
        }
      }
    }
  });
};

const renderAttList = (students) => {
  const abnormal = students.filter((s) => s.attendance !== '出勤');
  const $list = $('#att-list').empty();
  if (abnormal.length === 0) {
    $list.append('<li class="list-group-item text-muted">当前筛选结果中无请假或缺勤记录。</li>');
    return;
  }
  abnormal.forEach((s) => {
    $list.append(`
      <li class="list-group-item d-flex justify-content-between align-items-center">
        <span>${esc(s.name)}（${esc(s.id)}，${esc(s.group)} 组）</span>
        <span class="att-badge att-${s.attendance === '请假' ? 'leave' : 'miss'}">${esc(s.attendance)}</span>
      </li>`);
  });
};

/* ============================================================
 * 8. 导航高亮 + resize
 * ============================================================ */
const NAV_TARGETS = ['overview', 'roster', 'scores', 'attendance'];
const highlightNav = (id) => {
  $('.navbar .nav-link').removeClass('is-active').removeAttr('aria-current');
  $('.navbar .nav-link[href="#' + id + '"]').addClass('is-active').attr('aria-current', 'true');
};
$('.navbar').on('click', '.nav-link[href^="#"]', function () {
  highlightNav(($(this).attr('href') || '').slice(1));
});
$(window).on('scroll', () => {
  const line = $(window).scrollTop() + 140;
  let current = NAV_TARGETS[0];
  NAV_TARGETS.forEach((id) => {
    const $sec = $('#' + id);
    if ($sec.length && $sec.offset().top <= line) current = id;
  });
  highlightNav(current);
});

let resizeTimer = null;
$(window).on('resize', () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    [charts.score, charts.group].forEach((c) => c && c.resize());
  }, 150);
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) [charts.score, charts.group].forEach((c) => c && c.resize());
});

/* ---------- 启动 ---------- */
syncFilterButtons();
loadData();

/* ============================================================
 * 故意实验记录（写进进度报告"问题与解决"）：
 * 1) 把 #add-form 的 submit 处理函数里的 e.preventDefault() 删掉 →
 *    点"添加"后输入框一闪而空、列表无变化、Console 无报错，页面其实被刷新了。
 * 2) 把 renderTable 里的 $body.empty() 删掉 → 筛选切换后旧行残留，越点越多。
 * 3) 把 ECharts setOption 的第二个参数 true(notMerge) 删掉 → 分数段类目变了，
 *    旧类目仍留在图上。
 * 4) 把 Chart.js 重画前的 destroy() 删掉 → 同一 canvas 反复 new Chart 叠影。
 * ============================================================ */
