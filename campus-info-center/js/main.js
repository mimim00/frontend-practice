/* ============================================================
   智慧校园 · 信息与数据展示中心 —— 公共工具库
   职责：JSON 加载（含错误处理）、Toast 提示、错误横幅、
        导航高亮、字符串转义等，所有页面共用。
   ============================================================ */
(function (global) {
  'use strict';

  var App = (global.App = global.App || {});

  /* ---------- 1. JSON 数据加载（含完整的错误处理） ----------
     统一入口：所有页面通过 App.loadJSON('data/xxx.json') 读取数据。
     失败时给出对用户友好的中文错误信息，并支持"重试"。 */
  App.loadJSON = function (url) {
    return fetch(url, { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) {
          throw new Error('HTTP ' + res.status + '，文件不存在或服务器出错');
        }
        return res.json();
      })
      .catch(function (err) {
        var msg;
        if (global.location.protocol === 'file:') {
          // 最常见的错误场景：双击 HTML 直接打开，浏览器禁止读取本地 JSON
          msg = '检测到页面通过 file:// 协议直接打开，浏览器出于安全策略禁止读取本地 JSON 文件。' +
                '请改用本地静态服务器运行：双击运行 start.bat，' +
                '或在项目目录执行 "python -m http.server 8000"，然后访问 http://localhost:8000 。';
        } else {
          msg = '数据加载失败（' + url + '）：' + err.message;
        }
        console.error('[loadJSON]', url, err);
        return Promise.reject(new Error(msg));
      });
  };

  /* ---------- 2. 错误横幅 ----------
     area：放置横幅的容器元素；msg：错误文案；retryFn：点击"重试"的回调 */
  App.showError = function (area, msg, retryFn) {
    if (!area) { return; }
    var box = document.createElement('div');
    box.className = 'alert alert-danger alert-dismissible fade show error-alert shadow-sm';
    box.setAttribute('role', 'alert');
    var text = document.createElement('div');
    text.className = 'd-flex align-items-start';
    text.innerHTML =
      '<span style="font-size:1.3rem;margin-right:.6rem;">⚠️</span>' +
      '<div><strong>数据加载出错</strong><div class="small mt-1">' + App.esc(msg) + '</div></div>';
    var btnRow = document.createElement('div');
    btnRow.className = 'mt-2';
    var closeBtn = document.createElement('button');
    closeBtn.className = 'btn btn-sm btn-outline-danger me-2';
    closeBtn.textContent = '关闭';
    closeBtn.addEventListener('click', function () { box.remove(); });
    btnRow.appendChild(closeBtn);
    if (typeof retryFn === 'function') {
      var retryBtn = document.createElement('button');
      retryBtn.className = 'btn btn-sm btn-danger';
      retryBtn.textContent = '重新加载';
      retryBtn.addEventListener('click', function () {
        box.remove();
        retryFn();
      });
      btnRow.appendChild(retryBtn);
    }
    var dismiss = document.createElement('button');
    dismiss.className = 'btn-close';
    dismiss.setAttribute('data-bs-dismiss', 'alert');
    dismiss.setAttribute('aria-label', 'Close');
    dismiss.addEventListener('click', function () { box.remove(); });
    box.appendChild(dismiss);
    box.appendChild(text);
    box.appendChild(btnRow);
    area.innerHTML = '';
    area.appendChild(box);
  };

  App.clearError = function (area) {
    if (area) { area.innerHTML = ''; }
  };

  /* ---------- 3. Toast 轻提示 ---------- */
  App.toast = function (msg, type) {
    type = type || 'success';
    var host = document.getElementById('toastHost');
    if (!host) {
      host = document.createElement('div');
      host.id = 'toastHost';
      host.className = 'toast-host';
      document.body.appendChild(host);
    }
    var el = document.createElement('div');
    el.className = 'toast toast-app show text-bg-' + type;
    el.setAttribute('role', 'status');
    el.innerHTML = '<div class="d-flex"><div class="toast-body">' + App.esc(msg) + '</div>' +
      '<button type="button" class="btn-close btn-close-white me-2 m-auto" aria-label="Close"></button></div>';
    host.appendChild(el);
    el.querySelector('.btn-close').addEventListener('click', function () { el.remove(); });
    setTimeout(function () {
      el.classList.add('hide');
      setTimeout(function () { el.remove(); }, 300);
    }, 3200);
  };

  /* ---------- 4. 文本转义（防 XSS，配合模板字符串使用） ---------- */
  App.esc = function (s) {
    if (s === null || s === undefined) { return ''; }
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  /* ---------- 5. 导航栏高亮（按当前文件名匹配，使用 jQuery 选择器） ---------- */
  App.initNav = function () {
    var file = global.location.pathname.split('/').pop() || 'index.html';
    global.$('.navbar-app .nav-link[data-page]').each(function () {
      var $a = global.$(this);
      if ($a.attr('data-page') === file) {
        $a.addClass('active').attr('aria-current', 'page');
      }
    });
  };

  /* ---------- 6. 全局脚本错误兜底 ---------- */
  global.addEventListener('error', function (e) {
    console.error('[全局错误]', e.message, e.filename, e.lineno);
    App.toast('页面脚本出现异常，请按 F12 打开控制台查看详情', 'danger');
  });

  /* 页面加载完成后统一初始化导航 */
  document.addEventListener('DOMContentLoaded', App.initNav);
})(window);
