
const STORAGE_KEY = 'books';

const STATUS_TEXT = { unread: '未读', reading: '在读', done: '已读' };

let books = [];              
let keyword = '';            
let statusFilter = 'all';    
let editingId = null;        

/* ---------- 元素引用 ---------- */
const form = document.querySelector('#book-form');
const titleInput = document.querySelector('#book-title');
const authorInput = document.querySelector('#book-author');
const ratingInput = document.querySelector('#book-rating');
const statusInput = document.querySelector('#book-status');
const tip = document.querySelector('#tip');
const list = document.querySelector('#book-list');
const countEl = document.querySelector('#count');
const searchInput = document.querySelector('#search');
const filters = document.querySelector('#filters');
const exportBtn = document.querySelector('#export');

const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

const mkBtn = (label, action) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.action = action;
  b.textContent = label;
  return b;
};

const findBook = (id) => books.find(b => b.id === id);

const save = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
    return true;
  } catch (err) {
    // 研究任务 3：超量写入时 QuotaExceededError，给用户友好提示而不是白屏
    tip.textContent = err.name === 'QuotaExceededError'
      ? '本地存储已满，请先“导出 JSON”并清理旧数据'
      : '本地保存失败：' + err.name;
    return false;
  }
};

const load = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw === null ? [] : JSON.parse(raw);   
    books = Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn('本地存档不是合法 JSON，已重置：', err.message);
    tip.textContent = '本地存档损坏，已重置为空列表';
    books = [];
  }
};

const validate = (data, ignoreId = null) => {
  if (data.title === '') return '书名不能为空';
  if (data.title.length > 40) return '书名不能超过 40 个字';
  if (data.author === '') return '作者不能为空';
  if (!Number.isInteger(data.rating) || data.rating < 1 || data.rating > 5) {
    return '评分必须是 1~5 的整数';
  }
  if (books.some(b => b.title === data.title && b.id !== ignoreId)) {
    return '这本《' + data.title + '》已经在收藏里了';
  }
  return '';   
};


const renderRow = (book) => {
  const li = document.createElement('li');
  li.dataset.id = book.id;

  
  if (book.id === editingId) {
    li.className = 'book editing';

    const t = document.createElement('input');
    t.dataset.field = 'title';
    t.value = book.title;

    const a = document.createElement('input');
    a.dataset.field = 'author';
    a.value = book.author;

    const r = document.createElement('input');
    r.dataset.field = 'rating';
    r.type = 'number';
    r.min = '1';
    r.max = '5';
    r.step = '1';
    r.value = book.rating;

    const s = document.createElement('select');
    s.dataset.field = 'status';
    Object.keys(STATUS_TEXT).forEach(key => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = STATUS_TEXT[key];
      if (key === book.status) opt.selected = true;
      s.appendChild(opt);
    });

    const row = document.createElement('div');
    row.className = 'edit-row';
    row.append(t, a, r, s, mkBtn('保存', 'save'), mkBtn('取消', 'cancel'));
    li.appendChild(row);
    return li;
  }

  li.className = 'book' + (book.status === 'done' ? ' done' : '');

  const title = document.createElement('span');
  title.className = 'title';
  title.textContent = book.title;          

  const meta = document.createElement('span');
  meta.className = 'meta';
  meta.textContent = `${book.author} · ${stars(book.rating)} · ${STATUS_TEXT[book.status]}`;

  li.append(title, meta, mkBtn('编辑', 'edit'), mkBtn('删除', 'delete'));
  return li;
};

const render = () => {
  list.replaceChildren();   

  const kw = keyword.trim().toLowerCase();
  const shown = books.filter(b => {
    const hitKeyword = kw === ''
      || b.title.toLowerCase().includes(kw)
      || b.author.toLowerCase().includes(kw);
    const hitStatus = statusFilter === 'all' || b.status === statusFilter;
    return hitKeyword && hitStatus;
  });

  countEl.textContent = `共收藏 ${books.length} 本，当前显示 ${shown.length} 本`;

  if (shown.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = books.length === 0
      ? '还没有收藏，先添加一本吧'
      : '没有符合条件的图书';
    list.appendChild(li);
    return;
  }

  shown.forEach(book => list.appendChild(renderRow(book)));

  if (editingId !== null) {
    const el = list.querySelector(`li[data-id="${editingId}"] input[data-field="title"]`);
    if (el) {
      el.focus();
      el.select();
    }
  }
};

form.addEventListener('submit', (e) => {
  e.preventDefault();                      
  const data = {
    title: titleInput.value.trim(),
    author: authorInput.value.trim(),
    rating: Number(ratingInput.value),      
    status: statusInput.value
  };

  const err = validate(data);
  if (err) {
    tip.textContent = err;                   
    return;
  }

  books.push({ id: Date.now(), ...data });   
  save();                                    
  form.reset();
  statusInput.value = 'unread';
  tip.textContent = '';
  render();                                 
  titleInput.focus();
});


const commitEdit = (id) => {
  const li = list.querySelector(`li[data-id="${id}"]`);
  if (!li) return;

  const data = {
    title: li.querySelector('[data-field="title"]').value.trim(),
    author: li.querySelector('[data-field="author"]').value.trim(),
    rating: Number(li.querySelector('[data-field="rating"]').value),
    status: li.querySelector('[data-field="status"]').value
  };

  const err = validate(data, id);            
  if (err) {
    tip.textContent = err;
    return;
  }

  Object.assign(findBook(id), data);         
  editingId = null;
  tip.textContent = '';
  save();
  render();
};


list.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;

  const li = btn.closest('li');
  const id = Number(li.dataset.id);
  const action = btn.dataset.action;

  if (action === 'edit') {
    editingId = id;
    tip.textContent = '';
    render();
    return;
  }

  if (action === 'delete') {
    books = books.filter(b => b.id !== id);  
    if (editingId === id) editingId = null;
    save();                                  
    render();                                
    return;
  }

  if (action === 'save') {
    commitEdit(id);
    return;
  }

  if (action === 'cancel') {
    editingId = null;
    tip.textContent = '';
    render();
  }
});

list.addEventListener('keydown', (e) => {
  const li = e.target.closest('li');
  if (!li || Number(li.dataset.id) !== editingId) return;
  if (e.key === 'Enter') {
    e.preventDefault();
    commitEdit(editingId);
  } else if (e.key === 'Escape') {
    editingId = null;
    tip.textContent = '';
    render();
  }
});

searchInput.addEventListener('input', () => {
  keyword = searchInput.value;
  render();
});

filters.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  statusFilter = btn.dataset.status;
  filters.querySelectorAll('button').forEach(b =>
    b.classList.toggle('active', b === btn)
  );
  render();
});

/* 导出 JSON（研究任务 2：Blob + createObjectURL）  */
exportBtn.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(books, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);     // 生成一个临时 blob: 地址
  const a = document.createElement('a');
  a.href = url;
  a.download = `books-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);                  // 用完立刻释放，避免内存泄漏
});

/* 启动：先恢复数据，再画第一屏 */
load();
render();
