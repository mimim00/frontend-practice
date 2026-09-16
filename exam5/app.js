const list = document.querySelector('#task-list');
const form = document.querySelector('#add-form');
const input = document.querySelector('#task-input');
const tip = document.querySelector('#tip');
const filters = document.querySelector('.filters');

// 页面加载：从localStorage恢复任务；没有数据用空数组
let tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
let currentFilter = 'all';

// 保存到本地存储
const save = () => {
    localStorage.setItem('tasks', JSON.stringify(tasks));
};

const render = () => {
    list.innerHTML = '';
    const shown = tasks.filter(t => {
        if (currentFilter === 'all') return true;
        if (currentFilter === 'active') return !t.done;
        if (currentFilter === 'done') return t.done;
    });

    if (shown.length === 0) {
        const li = document.createElement('li');
        li.textContent = '没有符合条件的任务';
        list.appendChild(li);
        return;
    }

    shown.forEach(task => {
        const li = document.createElement('li');
        li.textContent = task.text;
        if (task.done) {
            li.classList.add('done');
        }

        li.addEventListener('click', () => {
            task.done = !task.done;
            save(); // 修改数组，先保存
            render();
        });

        const delBtn = document.createElement('span');
        delBtn.className = 'del';
        delBtn.textContent = '[删除]';
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = tasks.indexOf(task);
            tasks.splice(idx, 1);
            save(); // 删除后保存
            render();
        });

        li.appendChild(delBtn);
        list.appendChild(li);
    });
};

form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (text === '') {
        tip.textContent = '任务名不能为空';
        return;
    }
    tasks.push({ text: text, done: false });
    save(); // 添加任务后保存
    tip.textContent = '';
    input.value = '';
    render();
});

filters.addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON') return;
    currentFilter = e.target.dataset.filter;
    render();
});

render();
