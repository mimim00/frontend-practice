/* ============================================================
   首页逻辑：加载 stats.json，渲染统计卡片、公告、热门自习室。
   ========================================================= */
(function () {
  'use strict';

  var TAG_STYLE = {
    '通知': 'badge-soft-blue',
    '考试': 'badge-soft-full',
    '活动': 'badge-soft-open',
    '维护': 'badge-soft-closed'
  };

  function init() {
    loadData();
  }

  function loadData() {
    var area = document.getElementById('errorArea');
    App.clearError(area);

    App.loadJSON('data/stats.json')
      .then(function (data) {
        render(data);
      })
      .catch(function (err) {
        App.showError(area, err.message, loadData);
      });
  }

  function render(data) {
    var ov = data.overview || {};
    // 使用 jQuery 更新统计
    $('#sRooms').text(ov.studyRooms ?? '--');
    $('#sOpen').text(ov.openRooms ?? '--');
    $('#sSeats').text(ov.availableSeats ?? '--');
    $('#sCanteens').text(ov.canteens ?? '--');
    $('#updateTime').text(ov.updateTime || '--');

    // 公告列表
    var noticeHtml = (data.notices || []).map(function (n) {
      var style = TAG_STYLE[n.tag] || 'badge-soft-blue';
      return '<li class="list-group-item d-flex justify-content-between align-items-start">' +
        '<div><span class="badge ' + style + ' me-2">' + App.esc(n.tag) + '</span>' + App.esc(n.title) + '</div>' +
        '<span class="text-muted small ms-2 text-nowrap">' + App.esc(n.time) + '</span></li>';
    }).join('');
    $('#noticeList').html(noticeHtml ||
      '<li class="list-group-item text-muted">暂无公告</li>');

    // 热门自习室进度条
    var hotHtml = (data.hotRooms || []).map(function (r) {
      var barColor = r.usage >= 85 ? 'bar-full' : (r.usage >= 70 ? 'bar-high' : 'bar-good');
      return '<div class="mb-3">' +
        '<div class="d-flex justify-content-between small mb-1">' +
        '<span class="text-truncate me-2">' + App.esc(r.name) + '</span>' +
        '<span class="fw-bold">' + r.usage + '%</span></div>' +
        '<div class="progress progress-thin"><div class="progress-bar ' + barColor +
        '" role="progressbar" style="width:' + r.usage + '%" aria-valuenow="' + r.usage +
        '" aria-valuemin="0" aria-valuemax="100"></div></div></div>';
    }).join('');
    $('#hotList').html(hotHtml || '<p class="text-muted small mb-0">暂无数据</p>');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
