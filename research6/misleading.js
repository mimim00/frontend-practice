

const TRUNCATED_MIN = 240;   // 错误示范的 y 轴起点（真实最小值是 243）

const draw = (months, counts, category, range) => {
  const min = Math.min(...counts);
  const max = Math.max(...counts);

  /* ---------- 左：错误示范（y 轴截断） ---------- */
  const misleading = echarts.init(document.querySelector('#chart-misleading'));
  misleading.setOption({
    title: { text: '文学类月度借阅量', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    xAxis: { data: months },
    yAxis: { min: TRUNCATED_MIN, name: '册' },
    series: [{
      name: category,
      type: 'bar',
      data: counts,
      itemStyle: { color: '#c0392b' }
    }]
  });

  const honest = echarts.init(document.querySelector('#chart-honest'));
  honest.setOption({
    title: {
      text: '文学类月度借阅量（单位：册）',
      subtext: `${range}　数据来源：课程统一数据集`,
      left: 'center',
      textStyle: { fontSize: 14 }
    },
    tooltip: { trigger: 'axis' },
    xAxis: { data: months },
    yAxis: { min: 0, name: '册' },
    series: [{
      name: category,
      type: 'bar',
      data: counts,
      itemStyle: { color: '#2e7d32' }
    }]
  });

  window.addEventListener('resize', () => {
    misleading.resize();
    honest.resize();
  });

  const realRatio = (max / min).toFixed(2);
  const truncatedRatio = ((max - TRUNCATED_MIN) / (min - TRUNCATED_MIN)).toFixed(1);
  const honestPercent = ((min / max) * 100).toFixed(0);


};

/* ---------- 读取课程数据集 ---------- */
const loadData = async () => {
  $('#status').text('加载中...').show();
  try {
    const response = await fetch('../data/books.json');
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    if (!data.series || data.series.length === 0) {
      $('#status').text('暂无数据').show();
      return;
    }
    const target = data.series[0];   // 取第一个品类（文学）
    $('#sub-title').text(`${data.title} · ${data.source}`);
    $('#status').hide();
    draw(data.months, target.counts, target.category, data.period);
  } catch (error) {
    $('#status').text('加载失败：' + error.message).show();
  }
};

loadData();
