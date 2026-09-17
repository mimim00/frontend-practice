
const state = { data: null };

//数据加载：四种界面状态
const loadData = async () => {
  $('#status').text('加载中...').show();          //  加载中
  try {
    const response = await fetch('../data/books.json');
    if (!response.ok) {
      throw new Error('HTTP ' + response.status); // HTTP 层失败
    }
    const data = await response.json();
    if (!data.series || data.series.length === 0) {
      $('#status').text('暂无数据').show();       // 空数据
      return;
    }
    state.data = data;                            // 成功
    $('#sub-title').text(data.title + ' · ' + data.source);
    $('#status').hide();
    renderCards(data);
  } catch (error) {
    $('#status').text('加载失败：' + error.message).show();  // 网络 / 解析失败
  }
};

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

loadData();
