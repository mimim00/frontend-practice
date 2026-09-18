/* ============================================================
 * 研究一：Promise.all 并行请求 vs 串行请求
 * 数据：课程统一数据集 books.json + studyrooms.json
 * 状态：加载中 → 全部完成（统一显示在 #status 上，不靠控制台）
 * ============================================================ */

const DELAY = 600;   // 人为延迟（毫秒），模拟网络往返，放大串行/并行的差异

/* ---------- 单个请求：fetch → 校验状态码 → 解析 JSON → 延迟后返回 ---------- */
const loadOne = (url) => new Promise((resolve, reject) => {
  fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then((data) => setTimeout(() => resolve(data), DELAY))
    .catch(reject);
});

/* ---------- 串行：等第一份到齐，才发第二个请求 ---------- */
const loadSerial = async () => {
  const start = performance.now();
  const books = await loadOne('../data/books.json');
  const rooms = await loadOne('../data/studyrooms.json');
  return { ms: performance.now() - start, books, rooms };
};

/* ---------- 并行：两个请求同时发出，用 Promise.all 一起等 ---------- */
const loadParallel = async () => {
  const start = performance.now();
  const [books, rooms] = await Promise.all([
    loadOne('../data/books.json'),
    loadOne('../data/studyrooms.json')
  ]);
  return { ms: performance.now() - start, books, rooms };
};

/* ---------- 把一次结果追加到表格 ---------- */
const appendRow = (mode, result) => {
  $('#result-body').append(`
    <tr>
      <td>${mode}</td>
      <td><strong>${result.ms.toFixed(0)} ms</strong></td>
      <td>${result.books.title}（${result.books.series.length} 个品类）</td>
      <td>${result.rooms.title}（${result.rooms.rooms.length} 间）</td>
    </tr>`);
};

/* ---------- 统一的状态显示：加载中 / 全部完成 / 失败 ---------- */
const run = async (mode, loader) => {
  $('#status').removeClass('alert-info alert-success alert-danger')
    .addClass('alert-info').text('加载中...');
  try {
    const result = await loader();
    appendRow(mode, result);
    $('#status').removeClass('alert-info').addClass('alert-success')
      .text(`全部完成：${mode}，总耗时 ${result.ms.toFixed(0)} ms（两份数据已同时拿到）`);
  } catch (error) {
    $('#status').removeClass('alert-info').addClass('alert-danger')
      .text('加载失败：' + error.message);
  }
};

$('#btn-serial').on('click', () => run('串行', loadSerial));
$('#btn-parallel').on('click', () => run('并行（Promise.all）', loadParallel));
$('#btn-clear').on('click', () => $('#result-body').empty());
