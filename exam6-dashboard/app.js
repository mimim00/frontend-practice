

const state = { data: null };

let barChart = null;   // ECharts 实例缓存，只 init 一次
let lineChart = null;  // Chart.js 实例缓存，重建前先 destroy

const loadData = async () => {
  $('#status').text('加载中...').show();          
  try {
    const response = await fetch('../data/books.json');
    if (!response.ok) {
      throw new Error('HTTP ' + response.status); 
    }
    const data = await response.json();
    if (!data.series || data.series.length === 0) {
      $('#status').text('暂无数据').show();       
      return;
    }
    state.data = data;                           
    $('#sub-title').text(data.title + ' · ' + data.source);
    $('#status').hide();
    renderCards(data);
    renderBarChart(data);                         
    renderLineChart(data);                       
  } catch (error) {
    $('#status').text('加载失败：' + error.message).show();  
  }
};

/* ---------- 统计卡片 ---------- */
const renderCards = (data) => {
  $('#cards').empty();
  data.series.forEach(s => {
    const total = s.counts.reduce((sum, n) => sum + n, 0);
    $('#cards').append(`
      <div class="col-md-4">
        <div class="card shadow-sm">
          <div class="card-body">
            <h3 class="card-title h6">${s.category}</h3>
            <p class="card-text fs-3 mb-1">${total}</p>
            <p class="card-text small text-muted">共 ${data.months.length} 个月累计借阅（册）</p>
          </div>
        </div>
      </div>`);
  });
};

const renderBarChart = (data) => {
  if (barChart === null) {
    barChart = echarts.init(document.querySelector('#bar-chart'));
  }
  barChart.setOption({
    title: { text: '各月各品类借阅量', left: 'center' },
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0 },
    xAxis: { data: data.months },
    yAxis: { name: '册' },
    series: data.series.map(s => ({
      name: s.category,
      type: 'bar',
      data: s.counts
    }))
  });
};

const renderLineChart = (data) => {
  if (lineChart !== null) {
    lineChart.destroy();   // 防重复初始化：重复 new Chart 会叠加甚至报错
  }
  const ctx = document.querySelector('#line-chart');
  lineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.months,
      datasets: data.series.map(s => ({
        label: s.category,
        data: s.counts,
        borderWidth: 1
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,   // 高度交给容器 .chart-box
      plugins: { title: { display: true, text: '借阅趋势（单位：册）' } }
    }
  });
};

window.addEventListener('resize', () => {
  if (barChart) barChart.resize();   // ECharts 需手动 resize；Chart.js 默认响应式
});

loadData();
