
const state = { data: null };

let currentBuilding = 'all';  
let buildingChart = null;     
let statusChart = null;       

const loadData = async () => {
  $('#status').text('加载中...').show();         
  try {
    const response = await fetch('../data/studyrooms.json');
    if (!response.ok) {
      throw new Error('HTTP ' + response.status); 
    }
    const data = await response.json();
    if (!data.rooms || data.rooms.length === 0) {
      $('#status').text('暂无数据').show();       
      return;
    }
    state.data = data;                           
    $('#sub-title').text(data.title + ' · ' + data.source);
    $('#status').hide();
    renderCards(data);
    renderBuildingChart(data);    
    renderStatusChart(data);     
    renderBuildingFilters(data); 
    renderRoomTable(data);        
  } catch (error) {
    $('#status').text('加载失败：' + error.message).show();  
  }
};

/* ---------- 统计卡片 ---------- */
const renderCards = (data) => {
  const rooms = data.rooms;
  const openRooms = rooms.filter(r => r.status === '开放');
  const totalSeats = rooms.reduce((s, r) => s + r.seats, 0);
  const freeSeats = openRooms.reduce((s, r) => s + (r.seats - r.occupied), 0);
  const stats = [
    { label: '自习室总数', value: rooms.length, unit: '间' },
    { label: '总座位数', value: totalSeats, unit: '个' },
    { label: '当前空闲座位', value: freeSeats, unit: '个' },
    { label: '开放中自习室', value: openRooms.length, unit: '间' }
  ];
  $('#cards').empty();
  stats.forEach(s => {
    $('#cards').append(`
      <div class="col-6 col-md-3">
        <div class="card shadow-sm">
          <div class="card-body">
            <p class="card-text small text-muted mb-1">${s.label}</p>
            <p class="card-text fs-3 mb-0">${s.value}<span class="fs-6 text-muted"> ${s.unit}</span></p>
          </div>
        </div>
      </div>`);
  });
};

const renderBuildingChart = (data) => {
  const rooms = data.rooms;
  const buildings = [...new Set(rooms.map(r => r.building))];   
  const sumByBuilding = (fn) => buildings.map(b =>
    rooms.filter(r => r.building === b).reduce((s, r) => s + fn(r), 0)
  );
  if (buildingChart === null) {
    buildingChart = echarts.init(document.querySelector('#building-chart'));
  }
  buildingChart.setOption({
    title: { text: '各楼栋座位与占用', left: 'center' },
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0 },
    xAxis: { data: buildings },
    yAxis: { name: '个' },
    series: [
      { name: '座位总数', type: 'bar', data: sumByBuilding(r => r.seats) },
      { name: '已占用', type: 'bar', data: sumByBuilding(r => r.occupied) }
    ]
  });
};

const renderStatusChart = (data) => {
  const rooms = data.rooms;
  const statuses = ['开放', '维修', '闭馆'];
  const counts = statuses.map(s => rooms.filter(r => r.status === s).length);
  if (statusChart !== null) {
    statusChart.destroy();   
  }
  statusChart = new Chart(document.querySelector('#status-chart'), {
    type: 'doughnut',
    data: {
      labels: statuses,
      datasets: [{ data: counts, borderWidth: 1 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: { display: true, text: '自习室开放状态占比（单位：间）' },
        legend: { position: 'bottom' }
      }
    }
  });
};

const renderBuildingFilters = (data) => {
  const buildings = [...new Set(data.rooms.map(r => r.building))];
  const box = $('#building-filters');
  box.empty();
  const mkBtn = (label, val, active) =>
    `<button type="button" class="btn btn-outline-primary ${active ? 'active' : ''}" data-building="${val}">${label}</button>`;
  box.append(mkBtn('全部', 'all', currentBuilding === 'all'));
  buildings.forEach(b => box.append(mkBtn(b, b, currentBuilding === b)));
};

const renderRoomTable = (data) => {
  const rows = data.rooms.filter(r =>
    currentBuilding === 'all' || r.building === currentBuilding
  );
  const $body = $('#room-body');
  $body.empty();
  rows.forEach(r => {
    const free = r.seats - r.occupied;
    const badge = r.status === '开放' ? 'bg-success'
      : r.status === '维修' ? 'bg-warning text-dark' : 'bg-secondary';
    $body.append(`
      <tr data-name="${r.name}">
        <td>${r.name}</td>
        <td>${r.building}</td>
        <td>${r.floor} 层</td>
        <td>${r.seats}</td>
        <td>${r.occupied}</td>
        <td>${free}</td>
        <td><span class="badge ${badge}">${r.status}</span></td>
        <td>${r.hours}</td>
      </tr>`);
  });
  if (rows.length === 0) {
    $body.append('<tr><td colspan="8" class="text-center text-muted">该楼栋暂无自习室</td></tr>');
  }
};

$('#building-filters').on('click', '.btn', function () {
  currentBuilding = $(this).data('building');
  renderBuildingFilters(state.data);  
  renderRoomTable(state.data);        
});

$('#room-body').on('click', 'tr', function () {
  $(this).toggleClass('table-primary');
});

window.addEventListener('resize', () => {
  if (buildingChart) buildingChart.resize();
});

loadData();
