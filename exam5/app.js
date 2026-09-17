/* ============================================================
 * 交互式任务清单 —— 课堂案例复现（第五次课 第八部分）
 * 固定节奏：用户操作 → 改数组 → save() → render() → 界面更新
 * ============================================================ */

const STORAGE_KEY = 'tasks';

let tasks = [];             // 唯一事实来源：所有界面都由它算出来
let currentFilter = 'all';  // all / active / done

/* ---------- 1. 选择元素（script 在 body 末尾，此时元素已存在） ---------- */
const form = document.querySelector('#add-form');
const input = document.querySelector('#task-input');
const tip = document.querySelector('#tip');
const list = document.querySelector('#task-list');
const filters = document.querySelector('#filters');
const counter = document.querySelector('#counter');

/* ---------- 2. localStorage 存取（第三步） ---------- */
const save = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    return true;
  } catch (err) {
    // 隐私模式或容量超限时会抛异常，兜住，不让脚本整体挂掉
    tip.textContent = '本地保存失败：' + err.name;
    return false;
  }
};

const load = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);        // 没有存档返回 null
    const data = raw === null ? [] : JSON.parse(raw);     // 首次访问必须落到空数组
    tasks = Array.isArray(data) ? data : [];
  } catch (err) {
    // 手动把存档改成非法 JSON 时会走到这里（课后练习 3）
    console.warn('本地数据损坏，已重置：', err.message);
    tip.textContent = '本地数据损坏，已重置为空列表';
    tasks = [];
  }
};

/* ---------- 3. 渲染：清空 → 按数组重建（唯一改界面的地方） ---------- */
const updateCounter = () => {
  const left = tasks.filter(t => !t.done).length;
  counter.textContent = `共 ${tasks.length} 条，未完成 ${left} 条`;
};

const render = () => {
  list.replaceChildren();   // 清空旧界面；等价于 innerHTML = ''，但不解析 HTML

  const shown = tasks.filter(t =>
    currentFilter === 'all' ? true :
    currentFilter === 'active' ? !t.done : t.done
  );

  // 空状态：区分“一条都没有”和“过滤后没有”
  if (shown.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = tasks.length === 0 ? '暂无任务，添加一个吧' : '没有符合条件的任务';
    list.appendChild(li);
    updateCounter();
    return;
  }

  shown.forEach(task => {
    const li = document.createElement('li');
    li.dataset.id = task.id;
    if (task.done) li.classList.add('done');

    const span = document.createElement('span');
    span.className = 'text';
    span.textContent = task.text;   // 用户输入一律 textContent，防 XSS
    li.appendChild(span);

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'del';
    del.textContent = '删除';
    li.appendChild(del);

    // 点任务行切换完成状态（改的是数组里的那个对象）
    li.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;   // 点删除按钮时不触发切换
      task.done = !task.done;                   // 1. 先改数组
      save();                                   // 2. 再存
      render();                                 // 3. 再重画
    });

    list.appendChild(li);
  });

  updateCounter();
};

/* ---------- 4. 添加：表单提交 ---------- */
form.addEventListener('submit', (e) => {
  e.preventDefault();                       // 必写第一行，否则页面刷新，看着“什么都没发生”
  const text = input.value.trim();          // 校验三件套：读值 trim
  if (text === '') {                        // 判空给提示
    tip.textContent = '任务名不能为空';
    input.focus();
    return;                                 // 失败就返回，不往下走
  }
  if (text.length > 50) {
    tip.textContent = '任务名不能超过 50 个字';
    return;
  }

  tasks.push({ id: Date.now(), text: text, done: false });  // 1. 改数组
  save();                                                   // 2. 存
  input.value = '';                                         // 清空输入框
  tip.textContent = '';                                     // 清掉错误提示
  render();                                                 // 3. 画
  input.focus();
});

/* ---------- 5. 删除：事件委托（render 重建的 li 绑监听永远会漏） ---------- */
list.addEventListener('click', (e) => {
  const del = e.target.closest('.del');
  if (!del) return;
  const id = Number(del.closest('li').dataset.id);
  tasks = tasks.filter(t => t.id !== id);   // 1. 改数组
  save();                                   // 2. 存
  render();                                 // 3. 画
});

/* ---------- 6. 过滤：同样用委托，父元素一个监听器管三个按钮 ---------- */
filters.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  currentFilter = btn.dataset.filter;       // data-filter 属性
  filters.querySelectorAll('button').forEach(b =>
    b.classList.toggle('active', b === btn)
  );
  render();
});

/* ---------- 7. 启动：先恢复数据，再画第一屏 ---------- */
load();
render();