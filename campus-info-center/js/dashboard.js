/* ============================================================
   数据可视化页：ECharts 四类图表
   柱状图：各楼栋上座率；折线图：一周使用趋势；
   饼图：档口类别占比；雷达图：食堂评价对比。
   数据来源：data/stats.json（fetch 加载）。
   ============================================================ */
(function () {
  'use strict';

  /* 莫兰迪色系图表调色板：灰蓝 / 豆沙绿 / 陶土 / 雾紫 / 干枯玫瑰 / 浅灰蓝 / 暖灰 */
  var PALETTE = ['#7C8E9E', '#9CAF88', '#C2A48F', '#A99BB4', '#C9A7A0', '#8FA3AD', '#B3AFA5'];
  var charts = [];

  function init() {
    loadData();
  }

  function loadData() {
    var area = document.getElementById('errorArea');
    App.clearError(area);
    App.loadJSON('data/stats.json')
      .then(function (data) {
        renderStats(data);
        renderCharts(data);
        App.toast('图表数据加载成功');
      })
      .catch(function (err) {
        App.showError(area, err.message, loadData);
      });
  }

  /* ---------- 顶部统计卡片 -------- */
  function renderStats(data) {
    var ov = data.overview || {};
    document.getElementById('dRooms').textContent = ov.studyRooms ?? '--';
    document.getElementById('dSeats').textContent = ov.availableSeats ?? '--';
    document.getElementById('dCanteens').textContent = ov.canteens ?? '--';
  }

  function makeChart(id) {
    var el = document.getElementById(id);
    if (!el || typeof echarts === 'undefined') { return null; }
    var chart = echarts.init(el);
    charts.push(chart);
    return chart;
  }

  function renderCharts(data) {
    var c = data.charts || {};

    /* ---------- 图1：柱状图 -------- */
    var usageData = (c.buildingUsage || []).map(function (b) {
      return { name: b.name, total: b.total, available: b.available, usage: b.total ? +(100 * (b.total - b.available) / b.total).toFixed(1) : 0 };
    });
    var avgUsage = usageData.length
      ? +(usageData.reduce(function (s, x) { return s + x.usage; }, 0) / usageData.length).toFixed(1)
      : 0;
    var c1 = makeChart('chartUsage');
    if (c1) {
      c1.setOption({
        color: [PALETTE[0]],
        tooltip: {
          trigger: 'axis',
          formatter: function (params) {
            var p = params[0];
            var d = usageData[p.dataIndex];
            return p.name + '<br/>上座率：<strong>' + p.value + '%</strong><br/>' +
              '可用 / 总座位：' + d.available + ' / ' + d.total;
          }
        },
        grid: { left: 40, right: 20, top: 40, bottom: 30 },
        xAxis: { type: 'category', data: usageData.map(function (x) { return x.name; }), axisLabel: { interval: 0 } },
        yAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%' } },
        series: [{
          name: '上座率',
          type: 'bar',
          data: usageData.map(function (x) { return x.usage; }),
          barWidth: '46%',
          itemStyle: { borderRadius: [6, 6, 0, 0] },
          label: { show: true, position: 'top', formatter: '{c}%' },
          markLine: {
            silent: true,
            data: [{ type: 'average', name: '平均上座率 ' + avgUsage + '%' }],
            lineStyle: { color: '#C9A7A0', type: 'dashed' },
            label: { formatter: '平均 {c}%' }
          }
        }]
      });
    }

    /* ---------- 图2：折线图 ---------- */
    var trend = c.weeklyTrend || { days: [], students: [], availableSeats: [] };
    var c2 = makeChart('chartTrend');
    if (c2) {
      c2.setOption({
        color: [PALETTE[0], PALETTE[1]],
        tooltip: { trigger: 'axis' },
        legend: { data: ['自习人次', '可用座位'], top: 0 },
        grid: { left: 60, right: 50, top: 46, bottom: 30 },
        xAxis: { type: 'category', boundaryGap: false, data: trend.days },
        yAxis: [
          { type: 'value', name: '自习人次' },
          { type: 'value', name: '可用座位' }
        ],
        series: [
          {
            name: '自习人次', type: 'line', smooth: true, data: trend.students,
            areaStyle: { opacity: 0.15 },
            label: { show: true, position: 'top' }
          },
          {
            name: '可用座位', type: 'line', smooth: true, yAxisIndex: 1,
            data: trend.availableSeats, lineStyle: { type: 'dashed' }
          }
        ]
      });
    }

    /* ---------- 图3：饼图（环形） ---------- */
    var pieData = (c.canteenCategory || []).map(function (x, i) {
      return { name: x.name, value: x.value, itemStyle: { color: PALETTE[i % PALETTE.length] } };
    });
    var c3 = makeChart('chartPie');
    if (c3) {
      c3.setOption({
        tooltip: { trigger: 'item', formatter: '{b}：{c} 个（{d}%）' },
        legend: { orient: 'vertical', right: 10, top: 'middle' },
        series: [{
          name: '档口类别',
          type: 'pie',
          radius: ['42%', '68%'],
          center: ['42%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
          label: { formatter: '{b}\n{d}%' },
          data: pieData
        }]
      });
    }

    /* ---------- 图4：雷达图 ---------- */
    var radar = c.canteenRating || { indicators: [], series: [] };
    var c4 = makeChart('chartRadar');
    if (c4) {
      c4.setOption({
        color: [PALETTE[0], PALETTE[1], PALETTE[2]],
        tooltip: { trigger: 'item' },
        legend: { data: radar.series.map(function (s) { return s.name; }), top: 0 },
        radar: {
          indicator: radar.indicators,
          radius: '62%',
          splitArea: { areaStyle: { color: ['#f8fafc', '#eef2f7'] } }
        },
        series: [{
          type: 'radar',
          data: radar.series.map(function (s) {
            return { name: s.name, value: s.scores, areaStyle: { opacity: 0.12 } };
          })
        }]
      });
    }
  }

  /* ---------- 自适应 -------- */
  window.addEventListener('resize', function () {
    charts.forEach(function (c) { c.resize(); });
  });

  document.addEventListener('DOMContentLoaded', init);
})();
