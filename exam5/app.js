// 获取页面元素
const list = document.querySelector('#task-list');
const form = document.querySelector('#add-form');
const input = document.querySelector('#task-input');
const tip = document.querySelector('#tip');

// 状态数组：唯一数据源
let tasks = [];

/**
 * 渲染函数：根据tasks数组重新绘制页面列表
 */
const render = () => {
    list.innerHTML = '';
    // 空状态提示
    if (tasks.length === 0) {
        const li = document.createElement('li');
        li.textContent = '暂无任务';
        list.appendChild(li);
        return;
    }
    // 遍历数组生成列表项
    tasks.forEach(task => {
        const li = document.createElement('li');
        li.textContent = task.text;
        if (task.done) {
            li.classList.add('done');
        }
        list.appendChild(li);
    });
};

// 表单提交添加任务
form.addEventListener('submit', (e) => {
    e.preventDefault(); // 阻止表单默认刷新跳转
    const text = input.value.trim();

    // 输入校验
    if (text === '') {
        tip.textContent = '任务名不能为空';
        return;
    }
    // 修改状态数组
    tasks.push({ text: text, done: false });
    tip.textContent = '';
    input.value = ''; // 清空输入框
    render(); // 重新渲染界面
});

// 页面初次渲染
render();
