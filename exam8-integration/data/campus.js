/* 由 campus.json 生成，请勿手改；改数据请改 campus.json 后重新生成：
 *   node ../_tools/embed-data.js
 * 用途：file:// 直接双击打开时 fetch 会被浏览器拦截（CORS），
 *       此时脚本回退到这份内嵌副本，并在页面上明确提示"已回退"。
 * 注意：这是"加载失败"的降级路径，不是把错误藏起来——
 *       页面上会同时显示一条 alert-warning，说明 JSON 没读到、正在用内嵌数据。 */
window.CAMPUS_SCENE = {
  "campus": "云南大学呈贡校区（示意）",
  "source": "课程统一数据集（教学演示数据，非真实测绘）",
  "unit": "米",
  "buildings": [
  {"id":"library","name":"图书馆","kind":"building","x":-5,"z":-4,"width":5,"depth":4,"height":6.5,"floors":4,"bodyColor":"#e8eaf0","roofColor":"#8d6e63","seatCapacity":350,"description":"四层，馆内一至三层为自习区，本次自习室数据里有三间属于这里。"},
  {"id":"science","name":"理科楼","kind":"building","x":5,"z":-5,"width":4.5,"depth":4.5,"height":5,"floors":3,"bodyColor":"#dfe7ef","roofColor":"#546e7a","seatCapacity":152,"description":"含一层通宵自习室，是全校唯一全天开放的自习点。"},
  {"id":"arts","name":"文科楼","kind":"building","x":0,"z":-8.5,"width":6,"depth":3.5,"height":7.5,"floors":5,"bodyColor":"#f1e6df","roofColor":"#a1887f","seatCapacity":176,"description":"四层考研自习室使用率最高，晚场常满座。"},
  {"id":"nanyuan","name":"楠苑宿舍区","kind":"building","x":-7,"z":3,"width":4,"depth":3,"height":4.5,"floors":3,"bodyColor":"#e6eef7","roofColor":"#7986cb","seatCapacity":264,"description":"苑内一至三层各有一间自习室，就近上自习的主要去处。"},
  {"id":"ziyuan","name":"梓苑宿舍区","kind":"building","x":7,"z":3,"width":4,"depth":3,"height":4.5,"floors":3,"bodyColor":"#f3ece4","roofColor":"#8d6e63","seatCapacity":228,"description":"二楼自习室仍在维修，暂时不开放。"}
  ],
  "landmarks": [
  {"id":"flagpole","name":"国旗杆","kind":"flagpole","x":-2,"z":2,"height":6,"description":"广场中心，旗帜有轻微飘动动画。"},
  {"id":"sculpture","name":"校训雕塑","kind":"sculpture","x":-2.6,"z":0.5,"description":"点击后会变色，用来验证鼠标拾取是否生效。"},
  {"id":"gate","name":"校门","kind":"gate","x":0,"z":9,"description":"南侧主入口，两根门柱加一道横梁。"}
  ],
  "trees": [
  {"x":-9,"z":8},
  {"x":-6,"z":8.5},
  {"x":6,"z":8.5},
  {"x":9,"z":8},
  {"x":-9.5,"z":-2},
  {"x":9.5,"z":-2},
  {"x":-4,"z":6},
  {"x":4.5,"z":6}
  ]
};
