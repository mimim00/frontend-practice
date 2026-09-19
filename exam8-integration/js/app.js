

'use strict';


const state = {
  all: null,              // 原始数据 { title, source, updated, rooms: [] }
  usedFallback: false,    // 是否走了内嵌数据兜底
  filter: { floor: 'all', status: 'all', keyword: '' }
};

const charts = {
  usage: null,   // ECharts 实例，同一容器只能 init 一次
  status: null   // Chart.js 实例，重渲染前先 destroy
};

const STATUS_ORDER = ['开放', '维修', '闭馆'];
const STATUS_BADGE = { '开放': 'bg-success', '维修': 'bg-warning text-dark', '闭馆': 'bg-secondary' };

/* ============================================================
 * 工具
 * ============================================================ */
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (ch) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[ch]));

const usageRate = (room) => (room.seats === 0 ? 0 : Math.round((room.occupied / room.seats) * 100));

/* 空数组也要给图表一个交代，别让 setOption 拿到 undefined */
const sum = (list, pick) => list.reduce((acc, item) => acc + pick(item), 0);

/* ============================================================
 * 1. 数据加载：加载中 / 成功 / 空数据 / 格式错 / 网络失败
 *    三种失败都要在页面上出声，不能白屏，也不能把错误注释掉假装没事。
 * ============================================================ */

/* 故障注入钩子（质量自查用，讲义第六部分要求"故意实验"看失败提示）。
 * 手动做法是把 data/studyrooms.json 改名再刷新，测完改回来；
 * 这里再加一个等价入口，截图留证时不用真去动文件名：
 *   index.html?simulate=offline   → 指向不存在的文件，模拟断网 / 路径写错
 *   index.html?simulate=empty     → 指向 rooms 为空的 JSON，模拟空数据
 * 正常提交的页面不带这个参数，走的还是 data/studyrooms.json。 */
const SIMULATE = new URLSearchParams(location.search).get('simulate');
const DATA_URL = SIMULATE === 'empty' ? 'data/empty.json' : 'data/studyrooms.json';
const FORCE_MISSING = SIMULATE === 'offline';

const setStatus = (kind, text) => {
  const $status = $('#status');
  if (!kind) { $status.hide(); return; }
  $status.attr('class', 'alert alert-' + kind + ' mb-0').text(text).show();
};

const loadData = async () => {
  setStatus('warning', '正在加载数据……');
  try {
    const url = FORCE_MISSING ? 'data/studyrooms-not-found.json' : DATA_URL;
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('HTTP ' + response.status + '（文件不存在或路径不对）');
    }
    const data = await response.json();            // JSON 语法错会在这里抛
    validate(data);
    start(data, false);
  } catch (error) {
    /* 兜底：file:// 直接双击打开时 fetch 必被 CORS 拦，JSON 也许确实被改名。
       这时用内嵌副本继续跑，同时在页面上说清楚发生了什么——是降级，不是掩盖。 */
    const fallback = window.CAMPUS_STUDYROOMS;
    if (!fallback) {
      setStatus('danger', '数据加载失败：' + error.message + '。页面无法渲染，请检查 data/studyrooms.json 是否存在。');
      $('#room-summary').text('没有可用数据。');
      return;
    }
    state.usedFallback = true;
    start(fallback, true);
    setStatus('warning',
      '读取 ' + (FORCE_MISSING ? 'data/studyrooms.json' : DATA_URL) + ' 失败（' + error.message + '），' +
      '已回退到内嵌数据 studyrooms.js。完整功能请在 integration/ 目录启动本地服务器后访问，见 README 的运行方法。');
    console.warn('[降级] fetch 数据失败：', error.message, '已使用内嵌副本 window.CAMPUS_STUDYROOMS');
  }
};

/* 格式校验：结构不对就是"数据格式错"，早报早定位，别让 undefined 渗到渲染层 */
const validate = (data) => {
  if (!data || typeof data !== 'object') throw new Error('顶层不是对象');
  if (!Array.isArray(data.rooms)) throw new Error('缺少 rooms 数组');
};

const start = (data, usedFallback) => {
  state.all = data;

  if (!usedFallback) setStatus(null);

  if (data.rooms.length === 0) {
    /* 空数据：卡片、图表、表格都要有明确提示，而不是空白加一句"暂无" */
    setStatus('warning', '接口返回的 rooms 是空数组：当前没有可展示的自习室数据。');
    $('#data-source').text('数据来源：（空数据）');
    renderCards([]);
    renderRoomTable([]);
    renderSummary([]);
    renderUsageChart([]);
    renderStatusChart();
    return;
  }

  $('#data-source').text(
    '数据来源：' + data.source + (data.updated ? '　数据日期：' + data.updated : '')
  );
  renderCards(data.rooms);
  renderAll();
};

/* ============================================================
 * 2. 筛选：唯一的数据入口，改完 filter 统一走 renderAll()
 * ============================================================ */
const applyFilter = (rooms) => {
  const { floor, status, keyword } = state.filter;
  const kw = keyword.trim();
  return rooms.filter((room) => {
    if (floor !== 'all' && Number(room.floor) !== Number(floor)) return false;
    if (status !== 'all' && room.status !== status) return false;
    if (kw && room.name.indexOf(kw) === -1) return false;
    return true;
  });
};

const renderAll = () => {
  const rooms = applyFilter(state.all.rooms);
  renderRoomTable(rooms);
  renderSummary(rooms);
  /* 卡片也跟着筛选走：否则表格筛到 4 间、上面的"座位总数"还是全校 1170，
     两个数字打架，用户第一反应是"哪个才是对的"。 */
  renderCards(rooms);
  renderUsageChart(rooms);
  renderStatusChart();
};

/* ============================================================
 * 3. 首页概览卡片（跟随筛选一起变，首页不只是静态介绍）
 * ============================================================ */
const renderCards = (rooms) => {
  if (rooms.length === 0) {
    $('#cards').html('<div class="col-12"><div class="alert alert-secondary mb-0">' +
      '暂无统计数据：没有可以汇总的自习室。</div></div>');
    return;
  }
  const openRooms = rooms.filter((r) => r.status === '开放');
  const stats = [
    { label: '自习室总数', value: rooms.length, unit: '间' },
    { label: '座位总数', value: sum(rooms, (r) => r.seats), unit: '个' },
    { label: '空闲座位', value: sum(openRooms, (r) => r.seats - r.occupied), unit: '个' },
    { label: '整体使用率', value: usageRate({ seats: sum(rooms, (r) => r.seats), occupied: sum(rooms, (r) => r.occupied) }), unit: '%' }
  ];
  $('#cards').html(stats.map((s) => `
    <div class="col-6 col-md-3">
      <div class="card shadow-sm h-100">
        <div class="card-body">
          <p class="card-title small mb-1">${escapeHtml(s.label)}</p>
          <p class="stat-value fs-3 mb-0">${s.value}<span class="fs-6 text-muted"> ${escapeHtml(s.unit)}</span></p>
        </div>
      </div>
    </div>`).join(''));
};

/* ============================================================
 * 4. 自习室表格：渲染前先清空容器
 *    不清空就是讲义附录二里"筛选后残留旧数据"那个坑——append 会越堆越多。
 * ============================================================ */
/* 表格的空状态分两种，别混用同一句话：
 *   1) 数据源本来就是空的（empty.json / 后端没数据）→ "暂无数据"
 *   2) 有数据，但当前筛选条件筛不出东西        → "没有符合条件的"
 * 统一显示"没有符合条件"会让用户以为是自己筛错了。 */
const renderRoomTable = (rooms) => {
  const $body = $('#room-body').empty();
  if (rooms.length === 0) {
    const noData = !state.all || state.all.rooms.length === 0;
    $body.append('<tr><td colspan="9" class="text-center text-muted py-4">' +
      (noData ? '暂无自习室数据。' : '没有符合条件的自习室，换个楼层或状态试试。') +
      '</td></tr>');
    return;
  }

  $body.html(rooms.map((room) => {
    const free = room.seats - room.occupied;
    const rate = usageRate(room);
    const badge = STATUS_BADGE[room.status] || 'bg-secondary';
    return `
      <tr data-room-id="${escapeHtml(room.id)}" tabindex="0">
        <td>${escapeHtml(room.name)}</td>
        <td>${escapeHtml(room.building)}</td>
        <td>${escapeHtml(room.floor)} 层</td>
        <td>${room.seats}</td>
        <td>${room.occupied}</td>
        <td class="${free === 0 ? 'is-full' : ''}">${free}${free === 0 ? '（满）' : ''}</td>
        <td>${rate}%</td>
        <td><span class="badge ${badge}">${escapeHtml(room.status)}</span></td>
        <td>${escapeHtml(room.hours)}</td>
      </tr>`;
  }).join(''));
};

const renderSummary = (rooms) => {
  if (rooms.length === 0) {
    $('#room-summary').text('当前筛选条件下没有自习室（共 ' + state.all.rooms.length + ' 间）。');
    return;
  }
  const openCount = rooms.filter((r) => r.status === '开放').length;
  const freeSeats = sum(rooms.filter((r) => r.status === '开放'), (r) => r.seats - r.occupied);
  $('#room-summary').text(
    '筛选结果：' + rooms.length + ' 间，其中开放 ' + openCount + ' 间，可用空位 ' + freeSeats + ' 个。'
  );
};

/* ============================================================
 * 5. ECharts 使用率柱状图
 *    同一容器 init 两次会叠影，所以实例只建一次并缓存；
 *    click 处理器也在首次 init 时注册一次，不能写进 setOption 外面反复注册。
 * ============================================================ */
const renderUsageChart = (rooms) => {
  const $box = document.querySelector('#usage-chart');
  if (!charts.usage) {
    charts.usage = echarts.init($box);

    /* 图 → 表 联动：点柱子就把关键字填进搜索框，两张表和筛选栏一起收窄 */
    charts.usage.on('click', (params) => {
      $('#keyword').val(params.name);
      state.filter.keyword = params.name;
      renderAll();
    });
  }

  const sorted = rooms.slice().sort((a, b) => usageRate(a) - usageRate(b));   // y 轴类目从下往上，倒序后使用率高的在上面
  const source = state.all ? state.all.source : '';

  /* 筛到一条不剩时，clear() 掉上一轮柱子。
     notMerge 只替换本次传进去的组件，类目为空但 series.data 为空数组时，
     旧图仍有残留的可能，显式清一次最稳。 */
  if (rooms.length === 0) charts.usage.clear();

  charts.usage.setOption({
    title: {
      text: '各自习室使用率（单位：%）',
      subtext: rooms.length
        ? '数据来源：' + source + '　共 ' + rooms.length + ' 间　点击柱子可按该自习室筛选'
        : '当前筛选条件下没有可用于绘图的数据',
      left: 'center',
      textStyle: { fontSize: 15 },
      subtextStyle: { fontSize: 12 }
    },
    grid: { left: 8, right: 56, top: 64, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'item',
      formatter: (p) => {
        const room = rooms.find((r) => r.name === p.name);
        if (!room) return p.name;
        return room.name + '<br>' + room.building + ' ' + room.floor + ' 层<br>' +
          '座位 ' + room.seats + '，已占用 ' + room.occupied + '<br>' +
          '空位 ' + (room.seats - room.occupied) + '，使用率 ' + usageRate(room) + '%';
      }
    },
    xAxis: { type: 'value', max: 100, name: '%', nameGap: 18 },
    yAxis: { type: 'category', data: sorted.map((r) => r.name), axisLabel: { fontSize: 11 } },
    series: [{
      name: '使用率',
      type: 'bar',
      data: sorted.map((r) => usageRate(r)),
      barMaxWidth: 16,
      itemStyle: {
        /* 高使用率用暖色提醒，但旁边始终有数字，不靠颜色单独传信息 */
        color: (p) => (p.value >= 90 ? '#c05621' : p.value >= 70 ? '#1f4f7d' : '#4a90c4'),
        borderRadius: [0, 3, 3, 0]
      },
      label: { show: true, position: 'right', formatter: '{c}%', fontSize: 11 }
    }]
  }, true);   // notMerge：筛选后类目变了，必须整体替换，否则旧类目会留着
};

/* ============================================================
 * 6. Chart.js 圆环图（开放状态构成）
 * ============================================================ */
const renderStatusChart = () => {
  const rooms = applyFilter(state.all ? state.all.rooms : []);
  const counts = STATUS_ORDER.map((s) => rooms.filter((r) => r.status === s).length);
  const source = state.all ? state.all.source : '';
  const scope = describeFilter();

  if (charts.status) {
    charts.status.destroy();    
  }
  charts.status = new Chart(document.querySelector('#status-chart'), {
    type: 'doughnut',
    data: {
      labels: STATUS_ORDER,
      datasets: [{
        data: counts,
        backgroundColor: ['#2f7d4f', '#c9861f', '#6b7a88'],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '55%',
      plugins: {
        title: {
          display: true,
          text: scope + ' · 开放状态构成（单位：间）',
          subtext: '数据来源：' + source + '　共 ' + rooms.length + ' 间',
          font: { size: 15 },
          padding: { bottom: 8 }
        },
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const total = counts.reduce((a, b) => a + b, 0);
              const pct = total ? Math.round((ctx.parsed / total) * 100) : 0;
              return ctx.label + '：' + ctx.parsed + ' 间（' + pct + '%）';
            }
          }
        }
      }
    }
  });
};

const describeFilter = () => {
  const parts = [];
  parts.push(state.filter.floor === 'all' ? '全部楼层' : state.filter.floor + ' 层');
  parts.push(state.filter.status === 'all' ? '全部状态' : state.filter.status);
  if (state.filter.keyword.trim()) parts.push('名称含"' + state.filter.keyword.trim() + '"');
  return parts.join(' · ');
};

const syncFilterButtons = () => {
  $('#floor-filters .btn').each(function () {
    const on = String($(this).data('floor')) === String(state.filter.floor);
    $(this).toggleClass('is-on', on).attr('aria-pressed', on ? 'true' : 'false');
  });
  $('#status-filters .btn').each(function () {
    const on = String($(this).data('status')) === String(state.filter.status);
    $(this).toggleClass('is-on', on).attr('aria-pressed', on ? 'true' : 'false');
  });
};

$('#filters').on('click', '#floor-filters .btn', function () {
  state.filter.floor = String($(this).data('floor'));
  syncFilterButtons();
  renderAll();
});

$('#filters').on('click', '#status-filters .btn', function () {
  state.filter.status = String($(this).data('status'));
  syncFilterButtons();
  renderAll();
});

/* 搜索框：input 事件即时生效；改成"非法输入"也不怕，只是筛不出结果 */
$('#keyword').on('input', function () {
  state.filter.keyword = $(this).val();
  renderAll();
});

/* 点表格行高亮（事件委托，行是动态生成的） */
$('#room-body').on('click', 'tr', function () {
  $(this).toggleClass('is-picked');
});
/* 键盘也能选中行：Enter / 空格等价于点击 */
$('#room-body').on('keydown', 'tr', function (event) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    $(this).toggleClass('is-picked');
  }
});

/* 导航当前项高亮：点导航立即高亮，滚动到位后按实际所在区块再校正一次 */
const NAV_TARGETS = ['home', 'rooms', 'stats'];
const highlightNav = (id) => {
  $('.navbar .nav-link').removeClass('is-active').removeAttr('aria-current');
  $('.navbar .nav-link[href="#' + id + '"]').addClass('is-active').attr('aria-current', 'true');
};

$('.navbar').on('click', '.nav-link[href^="#"]', function () {
  highlightNav(($(this).attr('href') || '').slice(1));
});

/* 滚动时校正高亮：取最后一个已经滚过顶部的区块 */
$(window).on('scroll', () => {
  const line = $(window).scrollTop() + 140;
  let current = NAV_TARGETS[0];
  NAV_TARGETS.forEach((id) => {
    const $section = $('#' + id);
    if ($section.length && $section.offset().top <= line) current = id;
  });
  highlightNav(current);
});

/* 窗口变化：ECharts 不会自己跟着容器变，必须手动 resize；Chart.js 是 responsive，不用管 */
let resizeTimer = null;
$(window).on('resize', () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    if (charts.usage) charts.usage.resize();
  }, 150);
});

/* 标签页切回前台时把图表重新量一次尺寸。
   不在这里重渲染：一是没必要，二是 Chart.js 重建实例会让圆环图闪一下。 */
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && charts.usage) charts.usage.resize();
});

/* ---------- 启动 ---------- */
syncFilterButtons();
loadData();

/* ============================================================
 * 故意实验记录（写进进度报告"问题与解决"）：
 * 1) 把 index.html 里 echarts.min.js 那行挪到 app.js 之后 →
 *    Console 报 "echarts is not defined"，但代码一个字没错，是加载顺序问题。
 * 2) 把 .chart-box 的 height 删掉 → 图表区域塌成 0 高度，页面看着"没画出来"。
 * 3) 把 renderRoomTable 里的 $body.empty() 删掉 → 切楼层后旧行残留，
 *    出现"筛选后条数越点越多"的假象。
 * 4) 把 renderUsageChart 里的 notMerge（setOption 第二参 true）删掉 →
 *    从"全部"切到"1 层"后，y 轴仍留着其余楼层的类目名。
 * ============================================================ */
