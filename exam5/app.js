const list = document.querySelector('#task-list');
const form = document.querySelector('#add-form');
const input = document.querySelector('#task-input');
const tip = document.querySelector('#tip');
const filters = document.querySelector('.filters');

let tasks = [];
let currentFilter = 'all';

const render = () => {
    list.innerHTML = '';
    console.log("=====执行render(),清空列表，重建所有li====");

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

        // ✅ 在render内部，每一轮新建li就绑定click
        li.addEventListener('click', () => {
            console.log('触发任务点击，切换done状态，old:', task.done);
            task.done = !task.done;
            render();
        });

        // 删除按钮
        const delBtn = document.createElement('span');
        delBtn.className = 'del';
        delBtn.textContent = '[删除]';
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = tasks.indexOf(task);
            tasks.splice(idx, 1);
            render();
        });

        li.appendChild(delBtn);
        list.appendChild(li);
    });
};

// 添加任务
form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (text === '') {
        tip.textContent = '任务名不能为空';
        return;
    }
    tasks.push({ text: text, done: false });
    tip.textContent = '';
    input.value = '';
    render();
});

// 过滤按钮
filters.addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON') return;
    console.log("点击过滤按钮，filter=", e.target.dataset.filter);
    currentFilter = e.target.dataset.filter;
    render();
});

render();
