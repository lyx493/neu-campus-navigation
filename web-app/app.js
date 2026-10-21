(function () {
  const $ = id => document.getElementById(id);
  const els = {
    app:$('app'), viewport:$('mapViewport'), world:$('mapWorld'), svg:$('routeSvg'), markers:$('markersLayer'), user:$('userMarker'), heading:$('userHeading'),
    top:$('homeTop'), controls:$('mapControls'), homeSheet:$('homeSheet'), selectedSheet:$('selectedSheet'), routeSetup:$('routeSetup'), routeSheet:$('routeSheet'), navInstruction:$('navInstruction'), navPanel:$('navPanel'),
    nearbyList:$('nearbyList'), categoryRow:$('categoryRow'), topPanel:$('homeTop'), searchOverlay:$('searchOverlay'), searchInput:$('searchInput'), searchResults:$('searchResults'),
    favoritesScreen:$('favoritesScreen'), profileScreen:$('profileScreen'), detailOverlay:$('detailOverlay'), toast:$('toast'), locationPill:$('locationPill')
  };
  const stored = key => { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } };
  const state = {
    tab:'map', category:'all', selectedId:null, detailId:null, mode:'walk', destinationId:'library', indoorDestination:null, roomDestFloor:1, roomDestIndex:0,
    current:{ lat:CAMPUS.demoStart.lat, lng:CAMPUS.demoStart.lng }, demo:true, heading:null,
    locationMode:'demo', accuracy:0, gpsAccuracy:null, mapWatchId:null, indoorAnchor:null, steps:0, lastStepAt:0, sensorOn:false, indoorPanelOpen:false, calibrating:false, followUser:true, indoorSuggested:false,
    currentPlace:'', calibrationBuildingId:'building1', calibrationFloor:1, calibrationRoomIndex:0, handoffArmed:false, outdoorPromptCooldown:0, rawHeading:null, headingOffset:0, headingAbsolute:false, routeBearing:null, stepLength:0.64, pickingIndoorPosition:false, positionSource:'manual', indoorPosition:null, exitId:'auto', sensorTracking:false, lastHeadingWarning:0,
    map:{ scale:.58, cx:0, cy:0 },
    route:null, navigating:false, traveled:0, timer:null, watchId:null, arrived:false, indoorGuide:null,
    favorites:new Set(stored('neu_web_favorites') || ['library','canteen','building1']),
    recent:stored('neu_web_recent') || ['library','canteen','building1','sports'],
    routes:Number(stored('neu_web_routes')) || 12, showSteps:false
  };
  const diag = { errors:[], motionEvents:0, orientationEvents:0, dragEvents:0, lastGpsAt:0, lastExternalAt:0, lastAccuracy:null, timer:null };
  const POSITION_SOURCE_LABELS = { manual:'人工校准', sensor:'传感器路线估算', uwb:'UWB 实时定位', ble:'蓝牙信标定位', wifi:'Wi-Fi 指纹定位', external:'外部实时定位' };
  function normalizePositionSource(source) { return String(source || 'external').toLowerCase(); }
  function positionSourceLabel(source) { const key = normalizePositionSource(source); return POSITION_SOURCE_LABELS[key] || String(source || '外部实时定位'); }
  function isExternalPositionSource(source) { return ['uwb','ble','wifi','external'].includes(normalizePositionSource(source)); }
  window.addEventListener('error', event => diag.errors.push(event.message || 'script error'));
  window.addEventListener('unhandledrejection', event => diag.errors.push(String(event.reason || 'promise rejection')));

  function mercatorY(lat) { return Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)); }
  function project(point) {
    const m = CAMPUS.map;
    const x = (point.lng - m.west) / (m.east - m.west) * m.imageWidth;
    const topY = mercatorY(m.north), bottomY = mercatorY(m.south);
    const y = (mercatorY(point.lat) - topY) / (bottomY - topY) * m.imageHeight;
    return { x, y };
  }
  function viewportSize() { const r = els.viewport.getBoundingClientRect(); return { w:r.width, h:r.height }; }
  function screenOf(point) {
    const p = project(point), v = viewportSize();
    return { x:v.w / 2 + (p.x - state.map.cx) * state.map.scale, y:v.h / 2 + (p.y - state.map.cy) * state.map.scale };
  }
  function clampCenter(x, y) { return { x:Math.max(0, Math.min(CAMPUS.map.imageWidth, x)), y:Math.max(0, Math.min(CAMPUS.map.imageHeight, y)) }; }
  function unprojectScreen(x, y) {
    const v = viewportSize(); const m = CAMPUS.map;
    const px = state.map.cx + (x - v.w / 2) / state.map.scale;
    const py = state.map.cy + (y - v.h / 2) / state.map.scale;
    const lng = m.west + px / m.imageWidth * (m.east - m.west);
    const topY = mercatorY(m.north), bottomY = mercatorY(m.south);
    const my = topY + py / m.imageHeight * (bottomY - topY);
    const lat = (2 * Math.atan(Math.exp(my)) - Math.PI / 2) * 180 / Math.PI;
    return { lat, lng };
  }
  function panTo(point, scale) {
    const p = project(point);
    state.map.cx = p.x; state.map.cy = p.y;
    if (scale) state.map.scale = scale;
    renderMap();
  }
  function renderMap() {
    const v = viewportSize();
    const offsetX = v.w / 2 - state.map.cx * state.map.scale;
    const offsetY = v.h / 2 - state.map.cy * state.map.scale;
    els.world.style.transform = `translate3d(${offsetX}px,${offsetY}px,0) scale(${state.map.scale})`;
    renderMarkers();
    renderUser();
    renderRouteSvg();
  }
  let pendingMapFrame = null;
  function scheduleMapRender() {
    if (pendingMapFrame != null) return;
    pendingMapFrame = requestAnimationFrame(() => { pendingMapFrame = null; renderMap(); });
  }
  function visibleLocations() {
    return LOCATIONS.filter(loc => state.category === 'all' || loc.category === state.category);
  }
  function renderMarkers() {
    const v = viewportSize();
    const current = visibleLocations();
    els.markers.innerHTML = current.map(loc => {
      const p = screenOf(loc);
      if (p.x < -60 || p.x > v.w + 60 || p.y < -60 || p.y > v.h + 60) return '';
      const selected = state.selectedId === loc.id;
      return `<button class="map-pin ${selected ? 'selected' : ''}" data-id="${loc.id}" data-label="${loc.short}" style="left:${p.x}px;top:${p.y}px;--pin-color:${loc.color}" aria-label="${loc.name}"><span>${loc.emoji}</span></button>`;
    }).join('');
  }
  function renderUser() {
    const p = screenOf(state.current);
    els.user.style.left = p.x + 'px';
    els.user.style.top = p.y + 'px';
    els.user.style.display = p.x < -30 || p.y < -30 || p.x > viewportSize().w + 30 || p.y > viewportSize().h + 30 ? 'none' : 'block';
    if (state.heading != null) els.heading.style.transform = `rotate(${state.heading}deg)`;
    const placeLabel = $('userPlaceLabel');
    placeLabel.hidden = false;
    placeLabel.textContent = state.currentPlace || '我的位置';
  }
  function routeDisplayPoints() {
    if (state.indoorGuide && state.navigating) return [];
    if (!state.route) return [];
    return state.navigating ? NavEngine.remainingPoints(state.route.points, state.traveled) : state.route.points;
  }
  function renderRouteSvg() {
    const points = routeDisplayPoints().map(screenOf);
    if (points.length < 2) { els.svg.innerHTML = ''; return; }
    const v = viewportSize();
    els.svg.setAttribute('viewBox', `0 0 ${v.w} ${v.h}`);
    const str = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const end = points[points.length - 1];
    els.svg.innerHTML = `<polyline class="route-shadow" points="${str}"></polyline><polyline class="route-path" points="${str}"></polyline><circle class="route-end" cx="${end.x.toFixed(1)}" cy="${end.y.toFixed(1)}" r="6"></circle>`;
  }
  function renderCategories() {
    els.categoryRow.innerHTML = CATEGORIES.map(cat => `<button class="category-chip ${state.category === cat.id ? 'active' : ''}" data-cat="${cat.id}"><i>${cat.icon}</i>${cat.name}</button>`).join('');
  }
  function locById(id) { return LOCATIONS.find(l => l.id === id); }
  function activeDestination() {
    return state.indoorDestination || locById(state.destinationId) || LOCATIONS[0];
  }
  function roomDestinationPoint(room, floor) {
    const base = locById('building1');
    const offset = INDOOR_BUILDINGS[0].roomsByFloor[floor].indexOf(room);
    return {
      lat: base.lat + (floor === 1 ? -.000025 : .000025) + (offset % 2) * .00004,
      lng: base.lng + (Math.floor(offset / 2) - 1) * .000045
    };
  }
  function renderRoomDestination() {
    const isBuilding = state.destinationId === 'building1';
    $('roomDestination').hidden = !isBuilding;
    if (!isBuilding) { state.indoorDestination = null; renderExitChoice(); return; }
    const building = INDOOR_BUILDINGS[0];
    state.roomDestFloor = building.floors.includes(state.roomDestFloor) ? state.roomDestFloor : 1;
    $('roomDestFloors').innerHTML = building.floors.map(floor => `<button class="room-dest-floor ${floor === state.roomDestFloor ? 'active' : ''}" data-room-floor="${floor}">${floor}F</button>`).join('');
    const rooms = building.roomsByFloor[state.roomDestFloor];
    state.roomDestIndex = Math.min(state.roomDestIndex, rooms.length - 1);
    $('roomDestinationSelect').innerHTML = rooms.map((room, index) => `<option value="${index}" ${index === state.roomDestIndex ? 'selected' : ''}>${room.code}${room.type}</option>`).join('');
    const room = rooms[state.roomDestIndex];
    const point = roomDestinationPoint(room, state.roomDestFloor);
    state.indoorDestination = {
      id:'building1-room', buildingId:'building1', indoor:true, floor:state.roomDestFloor,
      roomIndex:state.roomDestIndex, roomCode:room.code, roomType:room.type,
      name:`一号楼 ${state.roomDestFloor}F ${room.code}${room.type}`,
      short:`${room.code}${room.type}`, subtitle:`一号楼 ${state.roomDestFloor}F`,
      ...point
    };
    renderExitChoice();
  }
  function refreshPill() {
    const indoor = state.locationMode === 'indoor';
    const real = !state.demo;
    els.locationPill.classList.toggle('demo', state.demo);
    els.locationPill.classList.toggle('real', real);
    const pillText = state.demo ? '演示定位' : indoor ? '室内定位' : '实时定位';
    els.locationPill.querySelector('span').textContent = pillText;
    const sheetState = $('sheetLocate');
    sheetState.classList.toggle('real', real);
    sheetState.querySelector('span').textContent = '室内导航 ›';
    $('routeStartName').textContent = state.demo ? '演示位置' : indoor ? '室内定位' : '我的位置';
    renderIndoorUI();
  }
  function updatePositionSourceUI() {
    const badge = $('indoorPositionSource');
    const fixLabel = $('positionFixSourceLabel');
    const position = state.indoorPosition;
    const source = position && position.source ? position.source : state.positionSource;
    const label = positionSourceLabel(source);
    const age = position && position.updatedAt ? Math.max(0, Math.round((Date.now() - position.updatedAt) / 1000)) : null;
    if (badge) {
      badge.textContent = position && position.accuracy ? `${label} · ±${Math.round(position.accuracy)}米` : label;
      badge.classList.toggle('live', isExternalPositionSource(source));
      badge.classList.toggle('estimated', normalizePositionSource(source) === 'sensor');
      badge.title = age != null ? `${age} 秒前更新` : '通过平面图人工校准';
    }
    if (fixLabel) fixLabel.textContent = `位置来源：${label}`;
  }
  function renderIndoorUI() {
    const weakGps = state.gpsAccuracy && state.gpsAccuracy > 25;
    const modeText = state.locationMode === 'indoor' ? positionSourceLabel(state.positionSource) : state.locationMode === 'gps' ? (weakGps ? 'GPS 信号较弱' : 'GPS 实时定位') : state.indoorSuggested ? '等待室内校准' : '演示位置';
    $('indoorModeText').textContent = modeText;
    $('indoorAccuracy').textContent = state.accuracy ? `±${Math.round(state.accuracy)}米` : (state.gpsAccuracy ? `GPS ±${Math.round(state.gpsAccuracy)}米` : '--');
    $('indoorSteps').textContent = state.steps;
    $('indoorStatusDot').classList.toggle('ready', state.locationMode === 'indoor' || state.locationMode === 'gps');
    const placePrefix = state.currentPlace ? `当前位置：${state.currentPlace}。` : '';
    $('indoorNote').textContent = state.locationMode === 'indoor'
      ? `${placePrefix}${state.positionSource === 'sensor' ? '当前位置由手机方向和步数沿规划路线实时估算，可能出现漂移；请用“修正位置”或外部定位重新校准。' : isExternalPositionSource(state.positionSource) ? '当前位置来自外部硬件实时坐标。' : '当前位置来自你对平面图的明确校准。'}`
      : state.gpsAccuracy && state.gpsAccuracy > 25
        ? '当前 GPS 精度较弱，建议点击“校准位置”标注所在点，再开启室内辅助。'
        : '室内位置来自外部定位或人工校准；开始导航后会使用手机方向和步数估算前进。';
    updatePositionSourceUI();
  }
  function renderNearby() {
    const list = LOCATIONS.slice().map(loc => Object.assign({}, loc, { distance:NavEngine.dist(state.current, loc) })).sort((a,b) => a.distance - b.distance).slice(0,3);
    $('nearbyCount').textContent = `${list.length} 个校园地标`;
    els.nearbyList.innerHTML = list.map(loc => `<button class="nearby-item" data-id="${loc.id}"><span class="nearby-icon" style="background:${loc.soft};color:${loc.color}">${loc.emoji}</span><span class="nearby-copy"><b>${loc.name}</b><small>${loc.categoryName} · ${loc.tags[0]} · ${loc.short}</small></span><span class="nearby-distance">${NavEngine.fmtDist(loc.distance)}</span><span class="nearby-arrow">›</span></button>`).join('');
    if (state.selectedId && state.tab === 'map') renderSelected();
  }
  function renderSelected() {
    const loc = locById(state.selectedId);
    if (!loc) { els.selectedSheet.hidden = true; els.homeSheet.hidden = false; return; }
    $('selectedIcon').textContent = loc.emoji;
    $('selectedIcon').style.background = loc.soft;
    $('selectedIcon').style.color = loc.color;
    $('selectedName').textContent = loc.name;
    $('selectedDistance').textContent = NavEngine.fmtDist(NavEngine.dist(state.current, loc));
    $('selectedMeta').textContent = `${loc.categoryName} · ${loc.tags[0]}`;
    $('selectedOpen').textContent = loc.open;
    $('selectedFloor').textContent = loc.floor;
    els.selectedSheet.hidden = false;
    els.homeSheet.hidden = true;
  }
  function deselect() {
    state.selectedId = null;
    els.selectedSheet.hidden = true;
    if (state.tab === 'map') els.homeSheet.hidden = false;
    renderMarkers();
  }
  function updateTabs() {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.tab === state.tab));
  }
  function hideMapPanels() {
    els.top.hidden = true; els.controls.hidden = true; els.homeSheet.hidden = true; els.selectedSheet.hidden = true;
    els.routeSetup.hidden = true; els.routeSheet.hidden = true; els.navInstruction.hidden = true; els.navPanel.hidden = true;
    els.favoritesScreen.hidden = true; els.profileScreen.hidden = true;
    $('indoorPanel').hidden = true;
    $('indoorCalibration').hidden = true;
    $('positionFixPanel').hidden = true;
    $('calibrationTip').hidden = true;
    state.indoorPanelOpen = false;
    state.calibrating = false;
    document.querySelector('.map-source').style.display = 'none';
  }
  function setTab(tab) {
    state.tab = tab;
    updateTabs();
    hideMapPanels();
    if (tab === 'map') {
      els.top.hidden = false; els.controls.hidden = false;
      if (state.selectedId) renderSelected(); else els.homeSheet.hidden = false;
      document.querySelector('.map-source').style.display = 'block';
      renderNearby();
    } else if (tab === 'route') {
      els.controls.hidden = false;
      document.querySelector('.map-source').style.display = 'block';
      if (state.navigating) {
        els.navInstruction.hidden = false;
        els.navPanel.hidden = false;
        $('indoorNavCard').hidden = !state.indoorGuide;
        requestAnimationFrame(syncIndoorNavLayout);
      }
      else { els.routeSetup.hidden = false; els.routeSheet.hidden = false; }
      if (!state.route) planRoute();
      renderRouteUI();
    } else if (tab === 'favorites') {
      els.favoritesScreen.hidden = false;
      renderFavorites();
    } else if (tab === 'profile') {
      els.profileScreen.hidden = false;
      renderProfile();
    }
    if (tab !== 'route' && state.navigating) endNavigation(true);
    renderMap();
  }
  function renderRouteUI() {
    if (!state.route) return;
    const route = state.route;
    $('routeDistance').textContent = route.distanceText;
    $('routeDuration').textContent = state.indoorDestination ? `${route.durationText} · 室内路线` : `${route.durationText} · ${state.mode === 'bike' ? '骑行' : '步行'}校园路线`;
    $('routeEta').textContent = route.durationText;
    $('routeStartInstruction').textContent = route.startInstruction;
    $('startNavText').textContent = state.indoorDestination ? '开始室内导航' : `开始${state.mode === 'bike' ? '骑行' : '步行'}导航`;
    $('routeSourceNote').textContent = state.indoorDestination ? '室内标准化路线 · 同层直达或跨楼层导航' : '校园内部实时导航 · 出楼确认后切换百度地图';
    $('stepsList').innerHTML = route.steps.map(step => `<div class="step-item"><i class="${step.icon === '终' ? 'finish' : ''}">${step.icon}</i><div class="step-copy"><b>${step.title}</b><small>${step.desc}</small></div></div>`).join('');
    $('stepsList').hidden = !state.showSteps;
    $('toggleSteps').textContent = state.showSteps ? '收起' : '路线详情';
    const dest = activeDestination() || { name:'地图选点', short:'目的地' };
    $('nextDestination').textContent = `目的地：${dest.short}`;
    $('externalNav').hidden = !!state.indoorDestination;
    renderExitChoice();
  }
  function nearestIndoorStair(room, floor) {
    const key = floor === 2 ? 'floor2' : 'floor1';
    return INDOOR_STAIRS.reduce((best, stair) => {
      const d = Math.hypot(room.x - stair[key].x, room.y - stair[key].y);
      return !best || d < best.distance ? { stair, distance:d, point:stair[key] } : best;
    }, null);
  }
  function dedupePercent(points) {
    return points.filter((p, i) => i === 0 || Math.hypot(p.x - points[i-1].x, p.y - points[i-1].y) > .5);
  }
  function shortestIndoorNodePath(floor, startId, endId) {
    const graph = INDOOR_ROUTE_GRAPHS[floor];
    if (!graph || !graph.nodes[startId] || !graph.nodes[endId]) return null;
    const adjacency = {};
    graph.edges.forEach(([a,b]) => {
      (adjacency[a] ||= []).push(b);
      (adjacency[b] ||= []).push(a);
    });
    const distance = {}, previous = {}, unvisited = new Set(Object.keys(graph.nodes));
    Object.keys(graph.nodes).forEach(id => { distance[id] = Infinity; });
    distance[startId] = 0;
    while (unvisited.size) {
      let current = null, best = Infinity;
      for (const id of unvisited) if (distance[id] < best) { current = id; best = distance[id]; }
      if (!current || current === endId) break;
      unvisited.delete(current);
      for (const next of adjacency[current] || []) {
        if (!unvisited.has(next)) continue;
        const a = graph.nodes[current], b = graph.nodes[next];
        const candidate = distance[current] + Math.hypot(a.x-b.x, a.y-b.y);
        if (candidate < distance[next]) { distance[next] = candidate; previous[next] = current; }
      }
    }
    if (!Number.isFinite(distance[endId])) return null;
    const path = [endId];
    while (path[0] !== startId) path.unshift(previous[path[0]]);
    return path;
  }
  function indoorNodePoints(floor, ids) {
    const graph = INDOOR_ROUTE_GRAPHS[floor];
    return (ids || []).map(id => ({ x:graph.nodes[id].x, y:graph.nodes[id].y }));
  }
  function indoorRoomRoute(floor, a, b) {
    const graph = INDOOR_ROUTE_GRAPHS[floor];
    const start = graph && graph.roomDoors[a && a.code];
    const end = graph && graph.roomDoors[b && b.code];
    if (!start || !end) return null;
    const nodes = shortestIndoorNodePath(floor, start.corridor, end.corridor);
    if (!nodes) return null;
    return dedupePercent([
      { x:a.x, y:a.y }, { x:start.x, y:start.y },
      ...indoorNodePoints(floor, nodes),
      { x:end.x, y:end.y }, { x:b.x, y:b.y }
    ]);
  }
  function indoorRoomToStairRoute(floor, room, stair) {
    const graph = INDOOR_ROUTE_GRAPHS[floor];
    const start = graph && graph.roomDoors[room && room.code];
    const entry = graph && graph.stairs[stair && stair.id];
    if (!start || !entry) return null;
    const nodes = shortestIndoorNodePath(floor, start.corridor, entry.entry);
    if (!nodes) return null;
    return dedupePercent([
      { x:room.x, y:room.y }, { x:start.x, y:start.y },
      ...indoorNodePoints(floor, nodes), { x:entry.point.x, y:entry.point.y }
    ]);
  }
  function indoorStairToRoomRoute(floor, stair, room) {
    const graph = INDOOR_ROUTE_GRAPHS[floor];
    const start = graph && graph.stairs[stair && stair.id];
    const end = graph && graph.roomDoors[room && room.code];
    if (!start || !end) return null;
    const nodes = shortestIndoorNodePath(floor, start.entry, end.corridor);
    if (!nodes) return null;
    return dedupePercent([
      { x:start.point.x, y:start.point.y }, ...indoorNodePoints(floor, nodes),
      { x:end.x, y:end.y }, { x:room.x, y:room.y }
    ]);
  }
  function indoorRoomToDoorRoute(floor, room, door) {
    const graph = INDOOR_ROUTE_GRAPHS[floor];
    const start = graph && graph.roomDoors[room && room.code];
    const exit = graph && graph.exitDoors[door && door.id];
    if (!start || !exit) return null;
    const nodes = shortestIndoorNodePath(floor, start.corridor, exit.node);
    if (!nodes) return null;
    return dedupePercent([
      { x:room.x, y:room.y }, { x:start.x, y:start.y },
      ...indoorNodePoints(floor, nodes), { x:exit.x, y:exit.y }
    ]);
  }
  function indoorStairToDoorRoute(floor, stair, door) {
    const graph = INDOOR_ROUTE_GRAPHS[floor];
    const start = graph && graph.stairs[stair && stair.id];
    const exit = graph && graph.exitDoors[door && door.id];
    if (!start || !exit) return null;
    const nodes = shortestIndoorNodePath(floor, start.entry, exit.node);
    if (!nodes) return null;
    return dedupePercent([
      { x:start.point.x, y:start.point.y }, ...indoorNodePoints(floor, nodes), { x:exit.x, y:exit.y }
    ]);
  }
  function indoorExitById(id) {
    return INDOOR_EXITS.find(exit => exit.id === id) || null;
  }
  function indoorExitCampusPoint(exit) {
    const base = locById('building1');
    if (!base || !exit) return base ? { lat:base.lat, lng:base.lng } : null;
    return {
      lat: base.lat + (50 - exit.y) * 0.0000045,
      lng: base.lng + (exit.x - 50) * 0.0000060
    };
  }
  function indoorRouteToExit(floor, room, exit) {
    if (!exit) return null;
    if (exit.type === 'door') {
      const door = INDOOR_DOORS.find(item => item.id === exit.doorId);
      if (!door) return null;
      if (floor === 2) {
        const nearest = nearestIndoorStair(room, 2);
        if (!nearest) return null;
        const toStair = indoorRoomToStairRoute(2, room, nearest.stair);
        const toDoor = indoorStairToDoorRoute(1, nearest.stair, door);
        return toStair && toDoor ? [...toStair, ...toDoor.slice(1)] : null;
      }
      return indoorRoomToDoorRoute(floor, room, door);
    }
    const stair = INDOOR_STAIRS.find(item => item.id === exit.stairId);
    if (!stair) return null;
    return indoorRoomToStairRoute(floor, room, stair);
  }
  function resolveIndoorExit(floor, room) {
    if (state.exitId !== 'auto') {
      const selected = indoorExitById(state.exitId);
      if (selected) return selected;
    }
    const destination = activeDestination();
    const eligible = INDOOR_EXITS.filter(exit => exit.autoEligible);
    let best = null;
    for (const exit of eligible) {
      const route = indoorRouteToExit(floor, room, exit);
      if (!route) continue;
      const indoorDistance = estimateRouteMeters(route);
      const campusPoint = indoorExitCampusPoint(exit);
      let outdoorDistance = 0;
      if (!state.indoorDestination && destination && campusPoint) {
        try { outdoorDistance = NavEngine.plan(campusPoint, destination, state.mode).distance || 0; } catch (error) { outdoorDistance = 0; }
      }
      const score = indoorDistance + outdoorDistance + (exit.penalty || 0);
      if (!best || score < best.score) best = { exit, score };
    }
    return best ? best.exit : INDOOR_EXITS[0];
  }
  function renderExitChoice() {
    const wrap = $('exitChoice');
    if (!wrap) return;
    const room = currentCalibrationRooms()[state.calibrationRoomIndex] || currentCalibrationRooms()[0];
    const show = state.locationMode === 'indoor' && !state.indoorDestination && !!room;
    wrap.hidden = !show;
    if (!show) return;
    const select = $('exitSelect');
    const known = INDOOR_EXITS.some(exit => exit.id === state.exitId);
    if (!known && state.exitId !== 'auto') state.exitId = 'auto';
    select.innerHTML = '<option value="auto">自动选择最佳出口（推荐）</option>' + INDOOR_EXITS.map(exit =>
      `<option value="${exit.id}">${exit.name} · ${exit.accessType === 'stair' ? '楼梯出口' : '普通出口'}${exit.confirmed ? '' : '（现场可用时）'}</option>`
    ).join('');
    select.value = state.exitId;
    const selected = resolveIndoorExit(state.calibrationFloor || 1, room);
    $('exitChoiceNote').textContent = state.exitId === 'auto'
      ? `算法预计：${selected ? selected.name : 'A105旁东南普通出口'}。同时比较普通出口、楼梯出口和室外路线。`
       : `已手动选择：${selected ? selected.name : 'A105旁东南普通出口'}。`;
  }
  function corridorRoute(a, b, floor) {
    const graphRoute = indoorRoomRoute(floor, a, b);
    if (graphRoute) return graphRoute;
    let corridorY = 38;
    if (a.y < 45 && b.y < 45) corridorY = 22;
    else if (a.y > 60 && b.y > 60) corridorY = 88;
    else if (Math.abs(a.y - b.y) < 16) corridorY = (a.y + b.y) / 2;
    return dedupePercent([{ x:a.x, y:a.y }, { x:a.x, y:corridorY }, { x:b.x, y:corridorY }, { x:b.x, y:b.y }]);
  }
  function estimateRouteMeters(points) {
    let percent = 0;
    for (let i = 0; i < points.length - 1; i++) percent += Math.hypot(points[i+1].x - points[i].x, points[i+1].y - points[i].y);
    return Math.max(10, Math.round(percent * 1.05));
  }
  function buildIndoorGuide() {
    const floor = state.calibrationFloor || 1;
    const room = currentCalibrationRooms()[state.calibrationRoomIndex] || currentCalibrationRooms()[0];
    const destination = activeDestination();
    const stageList = [];
    const building = INDOOR_BUILDINGS[0];

    if (state.indoorDestination && destination.buildingId === 'building1') {
      const destRoom = building.roomsByFloor[destination.floor][destination.roomIndex];
      if (destination.floor === floor) {
        const route = corridorRoute(room, destRoom, floor);
        stageList.push({ floor, type:'room', route, distance:estimateRouteMeters(route), icon:'↱', title:`前往${destination.floor}F ${destination.roomCode}${destination.roomType}`, detail:`从${room.code}教室出发，沿${floor}F走廊前往${destination.roomCode}${destination.roomType}`, nextLabel:'我已到达目的地' });
        stageList.push({ floor, type:'arrive', route:[destRoom, destRoom], distance:0, icon:'终', title:`到达${destination.roomCode}${destination.roomType}`, detail:`目的地${destination.roomCode}${destination.roomType}就在附近`, nextLabel:'已到达' });
        return { mode:'indoor', floor, room, destination, stageIndex:0, startSteps:state.steps, manualOffset:0, renderedKey:'', stages:stageList, summary:`${floor}F ${room.code} → ${destination.floor}F ${destination.roomCode}` };
      }

      const nearest = nearestIndoorStair(room, floor);
      const stair = nearest.stair;
      const stairPoint = nearest.point;
      const corridorY = stairPoint.y < 15 ? 10 : stairPoint.y > 70 ? 88 : stairPoint.y < 45 ? 22 : 38;
      const toStair = indoorRoomToStairRoute(floor, room, stair) || dedupePercent([{ x:room.x, y:room.y }, { x:room.x, y:corridorY }, { x:stairPoint.x, y:corridorY }, { x:stairPoint.x, y:stairPoint.y }]);
      const directionText = destination.floor < floor ? '下' : '上';
      stageList.push({ floor, type:'stairs', route:toStair, distance:estimateRouteMeters(toStair), icon:'↱', title:`沿${floor}F走廊前往${stair.name}`, detail:`从${room.code}教室出发，前往${stair.name}，然后${directionText}到${destination.floor}F`, nextLabel:`我已到楼梯，${directionText}到${destination.floor}F` });
      const destStair = stair[`floor${destination.floor}`];
      const toDest = indoorStairToRoomRoute(destination.floor, stair, destRoom) || corridorRoute(destStair, destRoom, destination.floor);
      stageList.push({ floor:destination.floor, type:'room', route:toDest, distance:estimateRouteMeters(toDest), icon:'↱', title:`前往${destination.floor}F ${destination.roomCode}${destination.roomType}`, detail:`从${stair.name}沿${destination.floor}F走廊前往${destination.roomCode}${destination.roomType}`, nextLabel:'我已到达目的地' });
      stageList.push({ floor:destination.floor, type:'arrive', route:[destRoom, destRoom], distance:0, icon:'终', title:`到达${destination.roomCode}${destination.roomType}`, detail:'已到达室内目的地', nextLabel:'已到达' });
      return { mode:'indoor', floor, room, destination, stair, stageIndex:0, startSteps:state.steps, manualOffset:0, renderedKey:'', stages:stageList, summary:`${floor}F ${room.code} → ${destination.floor}F ${destination.roomCode}` };
    }

    const selectedExit = resolveIndoorExit(floor, room);
    const exitCampusPoint = indoorExitCampusPoint(selectedExit);
    if (selectedExit.type === 'stair') {
      const stair = INDOOR_STAIRS.find(item => item.id === selectedExit.stairId) || nearestIndoorStair(room, floor).stair;
      const stairPoint = stair[`floor${floor}`];
      const exitPoint = stair.floor1;
      if (floor === 2) {
        const corridorY = stairPoint.y < 15 ? 10 : stairPoint.y > 70 ? 88 : stairPoint.y < 45 ? 22 : 38;
        const toStair = indoorRoomToStairRoute(2, room, stair) || dedupePercent([{ x:room.x, y:room.y }, { x:room.x, y:corridorY }, { x:stairPoint.x, y:corridorY }, { x:stairPoint.x, y:stairPoint.y }]);
        stageList.push({ floor:2, type:'stairs', route:toStair, distance:estimateRouteMeters(toStair), icon:'↱', title:`沿2F走廊前往${stair.name}`, detail:`从${room.code}教室出发，沿走廊前往${stair.name}，然后下到1F出口`, nextLabel:'我已到楼梯，下一层' });
      } else {
        const toExit = indoorRoomToStairRoute(1, room, stair) || dedupePercent([{ x:room.x, y:room.y }, { x:stair.floor1.x, y:stair.floor1.y }]);
        stageList.push({ floor:1, type:'door', route:toExit, distance:estimateRouteMeters(toExit), icon:'↱', title:`沿1F走廊前往${selectedExit.name}`, detail:`从${room.code}教室沿一层走廊前往${selectedExit.name}`, nextLabel:`我已到${selectedExit.name}`, exit:selectedExit });
      }
      stageList.push({ floor:1, type:'outside', route:[exitPoint, exitPoint], distance:0, icon:'终', title:`到达${selectedExit.name}`, detail:'看到出口后直接出去，并确认已到室外', nextLabel:'已到门外', exit:selectedExit });
      return { mode:'outdoor', exit:selectedExit, exitCampusPoint, stair, destination, stageIndex:0, startSteps:state.steps, manualOffset:0, renderedKey:'', stages:stageList, summary:floor === 2 ? `2F ${room.code} → ${stair.name} → 室外` : `1F ${room.code} → ${selectedExit.name} → 室外` };
    }

    const door = INDOOR_DOORS.find(item => item.id === selectedExit.doorId) || INDOOR_DOORS[0];
    const nearest = nearestIndoorStair(room, floor);
    const stair = nearest.stair;
    const stairPoint = nearest.point;
    if (floor === 2) {
      const corridorY = stairPoint.y < 15 ? 10 : stairPoint.y > 70 ? 88 : stairPoint.y < 45 ? 22 : 38;
      const toStair = indoorRoomToStairRoute(2, room, stair) || dedupePercent([{ x:room.x, y:room.y }, { x:room.x, y:corridorY }, { x:stairPoint.x, y:corridorY }, { x:stairPoint.x, y:stairPoint.y }]);
      stageList.push({ floor:2, type:'stairs', route:toStair, distance:estimateRouteMeters(toStair), icon:'↱', title:`沿2F走廊前往${stair.name}`, detail:`从${room.code}教室出发，沿走廊前往${stair.name}，然后下到1F`, nextLabel:'我已到楼梯，下一层' });
    }
    const floor1Start = floor === 2 ? stair.floor1 : room;
    const toDoor = (floor === 2
      ? indoorStairToDoorRoute(1, stair, door)
      : indoorRoomToDoorRoute(1, room, door))
      || dedupePercent([{ x:floor1Start.x, y:floor1Start.y }, { x:floor1Start.x, y:88 }, { x:door.x, y:88 }, { x:door.x, y:door.y }]);
    stageList.push({ floor:1, type:'door', route:toDoor, distance:estimateRouteMeters(toDoor), icon:'↱', title:`沿1F走廊前往${selectedExit.name}`, detail:`从${floor === 2 ? stair.name : room.code + '教室'}沿一层走廊前往${selectedExit.name}`, nextLabel:`我已到${selectedExit.name}`, exit:selectedExit, door });
    stageList.push({ floor:1, type:'outside', route:[door, door], distance:0, icon:'终', title:`到达${door.name}`, detail:'出口就在前方，看到出口后直接出去，再确认已到室外', nextLabel:'已到门外', exit:selectedExit, door });
    return { mode:'outdoor', exit:selectedExit, exitCampusPoint, stair, door, destination, stageIndex:0, startSteps:state.steps, manualOffset:0, renderedKey:'', stages:stageList, summary:floor === 2 ? `2F ${room.code} → 楼梯 → ${selectedExit.name} → 室外` : `1F ${room.code} → ${selectedExit.name} → 室外` };
  }
  function pointAlongPercentRoute(points, ratio) {
    if (!points.length) return { x:0, y:0 };
    if (points.length === 1) return points[0];
    let total = 0;
    const lengths = [];
    for (let i = 0; i < points.length - 1; i++) {
      const d = Math.hypot(points[i+1].x - points[i].x, points[i+1].y - points[i].y);
      lengths.push(d); total += d;
    }
    let target = Math.max(0, Math.min(1, ratio)) * total;
    for (let i = 0; i < lengths.length; i++) {
      if (target <= lengths[i] || i === lengths.length - 1) {
        const r = lengths[i] ? target / lengths[i] : 0;
        return { x:points[i].x + (points[i+1].x - points[i].x) * r, y:points[i].y + (points[i+1].y - points[i].y) * r };
      }
      target -= lengths[i];
    }
    return points[points.length - 1];
  }
  function normalizeDeg(value) { while (value < 0) value += 360; while (value >= 360) value -= 360; return value; }
  function normalizeDiff(value) { while (value > 180) value -= 360; while (value < -180) value += 360; return value; }
  function compassLabel(deg) { return ['北','东北','东','东南','南','西南','西','西北'][Math.round(normalizeDeg(deg) / 45) % 8]; }
  function routeBearingAt(points, ratio) {
    if (!points || points.length < 2) return null;
    const segments = [];
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const dx = points[i+1].x - points[i].x, dy = points[i+1].y - points[i].y;
      const d = Math.hypot(dx, dy); segments.push({ dx, dy, d }); total += d;
    }
    let target = Math.max(0, Math.min(1, ratio)) * total;
    for (const seg of segments) {
      if (target <= seg.d || seg === segments[segments.length - 1]) {
        return normalizeDeg(Math.atan2(seg.dx, -seg.dy) * 180 / Math.PI);
      }
      target -= seg.d;
    }
    return null;
  }
  function updateCompassUI() {
    const hasHeading = state.rawHeading != null;
    const heading = hasHeading ? normalizeDeg(state.heading) : 0;
    $('compassHeading').textContent = hasHeading ? (state.headingAbsolute ? `${Math.round(heading)}° ${compassLabel(heading)}` : `相对 ${Math.round(heading)}°`) : '--';
    $('compassNeedle').style.transform = `translateX(-50%) rotate(${heading}deg)`;
    let status = '方向未开启';
    let diff = 0;
    if (hasHeading && state.routeBearing != null) {
      diff = normalizeDiff(heading - state.routeBearing);
      const baseStatus = Math.abs(diff) <= 30 ? '方向正确' : diff > 0 ? '向左调整' : '向右调整';
      status = state.headingAbsolute ? baseStatus : `相对方向 · ${baseStatus}`;
    } else if (hasHeading) {
      status = '指南针已开启';
    }
    $('compassStatus').textContent = status;
    $('calibrateCompass').textContent = hasHeading ? '校准方向' : '开启指南针';
    const arrow = $('indoorNavHeadingArrow');
    arrow.hidden = !hasHeading;
    arrow.style.transform = `translate(-50%,-100%) rotate(${diff}deg)`;
    arrow.classList.toggle('off-course', Math.abs(diff) > 55);
    $('compassNeedle').style.opacity = hasHeading ? '1' : '.22';
  }
  function drawCleanIndoorNav(source, canvas, callback) {
    const ctx = canvas.getContext('2d', { willReadFrequently:true });
    const width = 680;
    const height = Math.round(width * source.naturalHeight / source.naturalWidth);
    canvas.width = width; canvas.height = height;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(source, 0, 0, width, height);
    const image = ctx.getImageData(0, 0, width, height);
    const d = image.data;
    for (let i = 0; i < d.length; i += 4) {
      const lum = (d[i] * 299 + d[i+1] * 587 + d[i+2] * 114) / 1000;
      if (lum > 238) d[i+3] = 0;
      else {
        d[i] = 34; d[i+1] = 50; d[i+2] = 68;
        d[i+3] = lum < 110 ? 255 : Math.min(190, Math.max(35, (238 - lum) * 2.6));
      }
    }
    ctx.putImageData(image, 0, 0);
    callback && callback();
  }
  function updateIndoorNavMap(force) {
    const guide = state.indoorGuide;
    if (!guide) return;
    const stage = guide.stages[guide.stageIndex];
    const key = `${stage.floor}-${guide.stageIndex}`;
    const source = $('indoorNavSource');
    const canvas = $('indoorNavCanvas');
    const drawOverlay = () => {
      const points = stage.route.map(p => `${p.x},${p.y}`).join(' ');
      $('indoorNavRouteSvg').innerHTML = `<polyline class="nav-route-white" points="${points}"></polyline><polyline class="nav-route-blue" points="${points}"></polyline>`;
      const walked = Math.max(0, guide.manualOffset || 0);
      const ratio = stage.distance > 0 ? Math.min(1, walked / stage.distance) : 1;
      const routePoint = pointAlongPercentRoute(stage.route, ratio);
      const livePosition = state.indoorPosition && state.indoorPosition.floor === stage.floor ? state.indoorPosition : null;
      const dot = livePosition || routePoint;
      const routeRatio = livePosition ? nearestRatioOnRoute(stage.route, livePosition) : ratio;
      state.routeBearing = routeBearingAt(stage.route, routeRatio);
      $('indoorNavDot').style.left = dot.x + '%';
      $('indoorNavDot').style.top = dot.y + '%';
      $('indoorNavDot').classList.toggle('external-position', !!livePosition && isExternalPositionSource(livePosition.source));
      updateCompassUI();
      $('navFloor2').classList.toggle('active', stage.floor === 2);
      $('navFloor1').classList.toggle('active', stage.floor === 1);
      $('indoorNavSummary').textContent = guide.summary || '室内标准化路线';
      const scroller = $('indoorNavScroll');
      const plan = $('indoorNavPlan');
      scroller.scrollLeft = Math.max(0, plan.clientWidth * dot.x / 100 - scroller.clientWidth / 2);
      scroller.scrollTop = Math.max(0, plan.clientHeight * dot.y / 100 - scroller.clientHeight / 2);
    };
    if (force || guide.renderedKey !== key) {
      guide.renderedKey = key;
      const src = getCalibrationBuilding().planImages[stage.floor];
      source.onload = () => drawCleanIndoorNav(source, canvas, drawOverlay);
      source.src = src;
    } else {
      drawOverlay();
    }
  }
  function updateIndoorGuideProgress(autoAdvance) {
    const guide = state.indoorGuide;
    if (!guide) return;
    const stage = guide.stages[guide.stageIndex];
    const walked = Math.max(0, guide.manualOffset || 0);
    if (autoAdvance && stage.distance > 0 && walked >= stage.distance && guide.stageIndex < guide.stages.length - 1) {
      if (stage.type === 'stairs') {
        guide.manualOffset = stage.distance;
        updateIndoorNavMap(false);
        return;
      }
      advanceIndoorGuide();
      return;
    }
    updateIndoorNavMap(false);
  }
  function advanceIndoorByStep() {
    const guide = state.indoorGuide;
    if (!guide || !state.navigating || !state.sensorTracking || isExternalPositionSource(state.positionSource)) return;
    if (state.rawHeading != null && state.routeBearing != null) {
      const diff = normalizeDiff(state.heading - state.routeBearing);
      if (Math.abs(diff) > 70) {
        if (Date.now() - state.lastHeadingWarning > 2500) {
          state.lastHeadingWarning = Date.now();
          showToast(diff > 0 ? '方向偏离，请向左调整后再前进' : '方向偏离，请向右调整后再前进');
        }
        return;
      }
    }
    let remaining = state.stepLength || .64;
    let guard = 0;
    while (remaining > .01 && state.indoorGuide && guard++ < 6) {
      const activeGuide = state.indoorGuide;
      const stage = activeGuide.stages[activeGuide.stageIndex];
      if (!stage) break;
      const left = stage.distance - Math.max(0, activeGuide.manualOffset || 0);
      if (left <= .01) {
        if (stage.type === 'stairs') break;
        updateIndoorGuideProgress(true);
        continue;
      }
      const advance = Math.min(remaining, left);
      activeGuide.manualOffset = Math.max(0, activeGuide.manualOffset || 0) + advance;
      remaining -= advance;
      if (activeGuide.manualOffset >= stage.distance - .01) {
        if (stage.type === 'stairs') break;
        updateIndoorGuideProgress(true);
      } else {
        break;
      }
    }
    if (!state.indoorGuide) return;
    const activeGuide = state.indoorGuide;
    const stage = activeGuide.stages[activeGuide.stageIndex];
    const ratio = stage.distance > 0 ? Math.min(1, (activeGuide.manualOffset || 0) / stage.distance) : 1;
    const point = pointAlongPercentRoute(stage.route, ratio);
    state.positionSource = 'sensor';
    state.accuracy = 4;
    state.indoorPosition = { floor:stage.floor, x:point.x, y:point.y, accuracy:4, source:'sensor', updatedAt:Date.now() };
    updatePositionSourceUI();
    updateIndoorNavMap(false);
    updateNavUI();
  }
  function advanceIndoorGuide() {
    const guide = state.indoorGuide;
    if (!guide) return;
    if (guide.stageIndex < guide.stages.length - 1) {
      guide.stageIndex += 1;
      guide.startSteps = state.steps;
      guide.manualOffset = 0;
      const nextStage = guide.stages[guide.stageIndex];
      const nextPoint = nextStage.route[0];
      state.indoorPosition = { floor:nextStage.floor, x:nextPoint.x, y:nextPoint.y, accuracy:2, source:'manual', updatedAt:Date.now() };
      state.positionSource = 'manual';
      state.accuracy = 2;
      updatePositionSourceUI();
      updateIndoorNavMap(true);
      updateNavUI();
      showToast(nextStage.title);
      if (guide.stageIndex === guide.stages.length - 1) {
        if (guide.mode === 'indoor') arrive();
        else {
          $('outdoorSwitch').classList.add('alert');
          startMapWatch();
          if (navigator.vibrate) navigator.vibrate([70, 40, 70]);
        }
      }
    }
  }
  function syncIndoorNavLayout() {
    if ($('indoorNavCard').hidden || $('navPanel').hidden) return;
    const appRect = $('app').getBoundingClientRect();
    const panelRect = $('navPanel').getBoundingClientRect();
    $('indoorNavCard').style.bottom = Math.max(120, appRect.bottom - panelRect.top + 8) + 'px';
  }
  function setNavCollapsed(collapsed) {
    $('navPanel').classList.toggle('collapsed', collapsed);
    $('navSheetHint').textContent = collapsed ? '上拉展开' : '下拉收起';
    requestAnimationFrame(syncIndoorNavLayout);
    setTimeout(syncIndoorNavLayout, 260);
  }
  function setStepLength(value) {
    state.stepLength = value;
    document.querySelectorAll('.step-length-btn').forEach(btn => btn.classList.toggle('active', Number(btn.dataset.stepLength) === value));
    updateIndoorNavMap(false);
    updateNavUI();
    showToast(value < .6 ? '已使用短步长' : value > .7 ? '已使用长步长' : '已使用标准步长');
  }
  function startPickingIndoorPosition() {
    if (!state.indoorGuide) { showToast('请先开始室内导航'); return; }
    closePositionFix();
    state.pickingIndoorPosition = true;
    $('indoorNavCard').classList.add('picking');
    showToast('请在地图上点击你实际所在的位置');
  }
  function nearestPointOnRoute(points, target) {
    if (!points || !points.length) return { distance:Infinity, ratio:0, point:{ x:0, y:0 } };
    if (points.length === 1) return { distance:Math.hypot(target.x-points[0].x, target.y-points[0].y), ratio:0, point:points[0] };
    let total = 0, best = { distance:Infinity, ratio:0, point:points[0] };
    const lengths = [];
    for (let i = 0; i < points.length - 1; i++) {
      const d = Math.hypot(points[i+1].x - points[i].x, points[i+1].y - points[i].y);
      lengths.push(d); total += d;
    }
    let walked = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i+1];
      const dx = b.x - a.x, dy = b.y - a.y;
      const lenSq = dx*dx + dy*dy;
      const t = lenSq ? Math.max(0, Math.min(1, ((target.x-a.x)*dx + (target.y-a.y)*dy) / lenSq)) : 0;
      const point = { x:a.x + dx*t, y:a.y + dy*t };
      const distance = Math.hypot(target.x-point.x, target.y-point.y);
      if (distance < best.distance) best = { distance, ratio: total ? (walked + lengths[i]*t) / total : 0, point };
      walked += lengths[i];
    }
    return best;
  }
  function nearestRatioOnRoute(points, target) { return nearestPointOnRoute(points, target).ratio; }
  function applyPickedIndoorPosition(event) {
    if (!state.pickingIndoorPosition || !state.indoorGuide) return;
    const plan = $('indoorNavPlan');
    const rect = plan.getBoundingClientRect();
    const target = { x:(event.clientX - rect.left) / rect.width * 100, y:(event.clientY - rect.top) / rect.height * 100 };
    const guide = state.indoorGuide;
    const stage = guide.stages[guide.stageIndex];
    const ratio = nearestRatioOnRoute(stage.route, target);
    const targetDistance = stage.distance * ratio;
    guide.manualOffset = targetDistance;
    state.positionSource = 'manual';
    state.accuracy = 2;
    state.indoorPosition = { floor:stage.floor, x:target.x, y:target.y, accuracy:2, source:'manual', updatedAt:Date.now() };
    state.pickingIndoorPosition = false;
    updatePositionSourceUI();
    $('indoorNavCard').classList.remove('picking');
    updateIndoorNavMap(false);
    updateNavUI();
    showToast('已按点选位置校准');
  }
  function renderPositionFixList() {
    const guide = state.indoorGuide;
    if (!guide) return;
    $('positionFixList').innerHTML = guide.stages.map((stage, index) => {
      const label = index === 0 ? `我还在${guide.room.code}教室` : `我已到达：${stage.title}`;
      return `<button class="position-fix-item ${index === guide.stageIndex ? 'active' : ''}" data-fix-stage="${index}"><i>${index + 1}</i><span>${label}</span></button>`;
    }).join('');
  }
  function openPositionFix() {
    if (!state.indoorGuide) { showToast('请先开始室内导航'); return; }
    $('positionFixPanel').hidden = false;
    renderPositionFixList();
  }
  function closePositionFix() { $('positionFixPanel').hidden = true; }
  function setPositionCheckpoint(index) {
    const guide = state.indoorGuide;
    if (!guide || !Number.isFinite(index)) return;
    guide.stageIndex = Math.max(0, Math.min(index, guide.stages.length - 1));
    guide.startSteps = state.steps;
    guide.manualOffset = 0;
    state.positionSource = 'manual';
    state.accuracy = 2;
    const checkpoint = guide.stages[guide.stageIndex].route[0];
    state.indoorPosition = { floor:guide.stages[guide.stageIndex].floor, x:checkpoint.x, y:checkpoint.y, accuracy:2, source:'manual', updatedAt:Date.now() };
    updatePositionSourceUI();
    updateIndoorNavMap(true);
    updateNavUI();
    closePositionFix();
    showToast(`位置已修正到：${guide.stages[guide.stageIndex].title}`);
  }
  function nudgeIndoorPosition(delta) {
    const guide = state.indoorGuide;
    if (!guide) return;
    guide.manualOffset = Math.max(0, (guide.manualOffset || 0) + delta);
    const stage = guide.stages[guide.stageIndex];
    const ratio = stage.distance > 0 ? Math.min(1, guide.manualOffset / stage.distance) : 1;
    const point = pointAlongPercentRoute(stage.route, ratio);
    state.positionSource = 'manual';
    state.accuracy = 2;
    state.indoorPosition = { floor:stage.floor, x:point.x, y:point.y, accuracy:2, source:'manual', updatedAt:Date.now() };
    updatePositionSourceUI();
    updateIndoorNavMap(false);
    updateNavUI();
    showToast(delta > 0 ? '位置前移2米' : '位置后退2米');
  }
  function resetIndoorSteps() {
    const guide = state.indoorGuide;
    if (!guide) return;
    guide.startSteps = state.steps;
    guide.manualOffset = 0;
    updateIndoorNavMap(false);
    updateNavUI();
    showToast('已从此处重新计步');
  }
  function updateNavUI() {
    if (!state.route) return;
    if (state.indoorGuide) {
      const guide = state.indoorGuide;
      const stage = guide.stages[guide.stageIndex];
      const walked = Math.max(0, guide.manualOffset || 0);
      const remaining = Math.max(0, stage.distance - walked);
      const distanceText = stage.distance === 0 || remaining <= 0 ? '已到达' : `约${Math.round(remaining)}米`;
      $('navArrow').textContent = stage.icon;
      $('navTitle').textContent = stage.title;
      $('navDetail').textContent = stage.detail;
      $('navDistance').textContent = distanceText;
      $('navRemaining').textContent = NavEngine.fmtDist(remaining);
      $('navEta').textContent = NavEngine.fmtTime(remaining / 1.25);
      $('nextArrow').textContent = stage.icon;
      $('nextTitle').textContent = stage.title;
      $('nextDistance').textContent = distanceText;
      $('followMode').textContent = positionSourceLabel(state.positionSource);
      $('outdoorSwitch').hidden = guide.mode !== 'outdoor';
      const atSelectedExit = guide.mode === 'outdoor' && stage.type === 'outside';
      const exitName = guide.exit ? guide.exit.name : '所选出口';
      $('confirmOutdoorInline').disabled = guide.mode === 'outdoor' && !atSelectedExit;
      $('confirmOutdoorInline').textContent = atSelectedExit ? '已到室外' : `到达${exitName}后确认`;
      $('outdoorSwitchQuestion').textContent = `是否已从${exitName}到室外？`;
      $('outdoorSwitchHint').textContent = '确认后切换到百度地图继续室外导航';
      $('indoorStepIcon').textContent = stage.icon;
      $('indoorStepTitle').textContent = stage.title;
      $('indoorStepDetail').textContent = stage.detail;
      $('indoorStepDistance').textContent = distanceText;
      $('indoorNextStep').hidden = guide.stageIndex >= guide.stages.length - 1;
      $('indoorNextStep').textContent = stage.nextLabel;
      updateIndoorNavMap(false);
      requestAnimationFrame(syncIndoorNavLayout);
      return;
    }
    const remaining = Math.max(0, state.route.distance - state.traveled);
    const p = NavEngine.pointAt(state.route.points, state.traveled);
    const ins = NavEngine.instruction(state.route, p, state.traveled);
    $('navArrow').textContent = ins.symbol;
    $('navTitle').textContent = ins.title;
    $('navDetail').textContent = ins.detail;
    $('navDistance').textContent = ins.distanceText;
    $('navRemaining').textContent = NavEngine.fmtDist(remaining);
    $('navEta').textContent = NavEngine.fmtTime(remaining / (state.mode === 'bike' ? 3.9 : 1.25));
    $('nextArrow').textContent = ins.symbol;
    $('nextTitle').textContent = ins.title;
    $('nextDistance').textContent = ins.distanceText;
    $('followMode').textContent = 'GPS 实时跟随';
    $('indoorNextStep').hidden = true;
  }
  function renderFavorites() {
    $('favoriteCount').textContent = state.favorites.size;
    const favs = [...state.favorites].map(locById).filter(Boolean);
    $('favoriteList').innerHTML = favs.length ? favs.map(loc => `<div class="favorite-card" data-id="${loc.id}"><span class="poi-icon" style="background:${loc.soft};color:${loc.color}">${loc.emoji}</span><span class="favorite-copy"><b>${loc.name}</b><small>${loc.categoryName} · 距你${NavEngine.fmtDist(NavEngine.dist(state.current, loc))}</small></span><button data-route="${loc.id}">导航</button></div>`).join('') : `<div class="empty-favorites"><i>♡</i><b>还没有收藏地点</b><small>在地点详情中点亮爱心，常用地点会出现在这里</small></div>`;
    const recent = state.recent.slice(0,4).map(locById).filter(Boolean);
    $('recentList').innerHTML = recent.length ? recent.map(loc => `<div class="recent-card" data-id="${loc.id}"><span class="poi-icon" style="background:${loc.soft};color:${loc.color}">${loc.emoji}</span><b>${loc.name}</b><span>${NavEngine.fmtDist(NavEngine.dist(state.current, loc))}</span></div>`).join('') : `<div class="recent-card"><b>暂无最近到访</b></div>`;
  }
  function renderProfile() {
    $('profileRoutes').textContent = state.routes;
    $('profileFavorites').textContent = state.favorites.size;
  }
  function showToast(text) {
    els.toast.textContent = text; els.toast.classList.add('show');
    clearTimeout(showToast.timer); showToast.timer = setTimeout(() => els.toast.classList.remove('show'), 1800);
  }
  function persist() {
    localStorage.setItem('neu_web_favorites', JSON.stringify([...state.favorites]));
    localStorage.setItem('neu_web_recent', JSON.stringify(state.recent));
    localStorage.setItem('neu_web_routes', JSON.stringify(state.routes));
  }
  function addRecent(id) { state.recent = [id, ...state.recent.filter(x => x !== id)].slice(0,8); persist(); }
  window.__campus = { state, els, project, screenOf, panTo, renderMap, renderCategories, renderNearby, renderSelected, deselect, setTab, renderRouteUI, updateNavUI, renderFavorites, renderProfile, showToast, addRecent, locById, refreshPill };  function planRoute() {
    const dest = activeDestination();
    state.route = NavEngine.plan(state.current, dest, state.mode);
    if (state.indoorDestination) {
      const preview = buildIndoorGuide();
      const indoorDistance = preview.stages.reduce((sum, stage) => sum + stage.distance, 0);
      state.route.distance = indoorDistance;
      state.route.duration = indoorDistance / 1.25;
      state.route.distanceText = NavEngine.fmtDist(indoorDistance);
      state.route.durationText = NavEngine.fmtTime(indoorDistance / 1.25);
      state.route.source = 'indoor';
    }
    state.traveled = 0;
    state.arrived = false;
    renderRouteUI();
    renderMap();
  }
  function fitRoute() {
    if (!state.route || state.route.points.length < 2) return;
    const points = state.route.points;
    const mid = { lat:(points[0].lat + points[points.length - 1].lat) / 2, lng:(points[0].lng + points[points.length - 1].lng) / 2 };
    state.followUser = false;
    panTo(mid, .66);
  }
  function openRoute(id) {
    state.destinationId = id || state.destinationId || 'library';
    state.roomDestFloor = state.calibrationFloor || 1;
    state.roomDestIndex = 0;
    renderRoomDestination();
    state.navigating = false;
    state.traveled = 0;
    state.arrived = false;
    addRecent(state.destinationId);
    planRoute();
    setTab('route');
    fitRoute();
    renderRouteUI();
  }
  function outOfChina(lat, lng) {
    return lng < 72.004 || lng > 137.8347 || lat < .8293 || lat > 55.8271;
  }
  function wgs84ToGcj02(lat, lng) {
    if (outOfChina(lat, lng)) return { lat, lng };
    const a = 6378245.0, ee = 0.00669342162296594323;
    const transformLat = (x, y) => {
      let r = -100 + 2*x + 3*y + .2*y*y + .1*x*y + .2*Math.sqrt(Math.abs(x));
      r += (20*Math.sin(6*x*Math.PI) + 20*Math.sin(2*x*Math.PI)) * 2/3;
      r += (20*Math.sin(y*Math.PI) + 40*Math.sin(y/3*Math.PI)) * 2/3;
      r += (160*Math.sin(y/12*Math.PI) + 320*Math.sin(y*Math.PI/30)) * 2/3;
      return r;
    };
    const transformLng = (x, y) => {
      let r = 300 + x + 2*y + .1*x*x + .1*x*y + .1*Math.sqrt(Math.abs(x));
      r += (20*Math.sin(6*x*Math.PI) + 20*Math.sin(2*x*Math.PI)) * 2/3;
      r += (20*Math.sin(x*Math.PI) + 40*Math.sin(x/3*Math.PI)) * 2/3;
      r += (150*Math.sin(x/12*Math.PI) + 300*Math.sin(x/30*Math.PI)) * 2/3;
      return r;
    };
    let dLat = transformLat(lng - 105, lat - 35);
    let dLng = transformLng(lng - 105, lat - 35);
    const radLat = lat / 180 * Math.PI;
    let magic = Math.sin(radLat);
    magic = 1 - ee * magic * magic;
    const sqrtMagic = Math.sqrt(magic);
    dLat = (dLat * 180) / ((a * (1 - ee)) / (magic * sqrtMagic) * Math.PI);
    dLng = (dLng * 180) / (a / sqrtMagic * Math.cos(radLat) * Math.PI);
    return { lat:lat + dLat, lng:lng + dLng };
  }
  function toBaidu09(point) {
    const gcj = wgs84ToGcj02(point.lat, point.lng);
    const x = gcj.lng, y = gcj.lat;
    const z = Math.sqrt(x*x + y*y) + .00002 * Math.sin(y * Math.PI * 3000);
    const theta = Math.atan2(y, x) + .000003 * Math.cos(x * Math.PI * 3000);
    return { lat:z * Math.sin(theta) + .006, lng:z * Math.cos(theta) + .0065 };
  }
  function baiduNavigationUrl() {
    const loc = activeDestination();
    if (!loc || state.indoorDestination) return '';
    const origin = toBaidu09(state.current);
    const dest = toBaidu09(loc);
    const mode = state.mode === 'bike' ? 'riding' : 'walking';
    return `https://api.map.baidu.com/direction?origin=latlng:${origin.lat},${origin.lng}|name:${encodeURIComponent('我的位置')}&destination=latlng:${dest.lat},${dest.lng}|name:${encodeURIComponent(loc.name)}&mode=${mode}&region=${encodeURIComponent('沈阳市')}&output=html&src=webapp.neu-campus`;
  }
  function openExternalNavigation() {
    const url = baiduNavigationUrl();
    if (url) window.open(url, '_blank', 'noopener');
  }
  function showOutdoorConfirmation() {
    $('outdoorConfirm').hidden = true;
    $('outdoorSwitch').classList.add('alert');
    showToast('检测到可能已到室外，请在导航面板中确认');
    if (navigator.vibrate) navigator.vibrate([60, 30, 60]);
  }
  function cancelOutdoorConfirmation() {
    $('outdoorConfirm').hidden = true;
    $('outdoorSwitch').classList.remove('alert');
    state.handoffArmed = true;
    state.outdoorPromptCooldown = Date.now() + 60000;
    showToast('继续室内导航');
  }
  function confirmOutdoorHandoff() {
    const guide = state.indoorGuide;
    const exitReached = !guide || guide.mode !== 'outdoor' || guide.stages[guide.stageIndex].type === 'outside';
    if (!exitReached) {
      showToast(`请先到达${guide && guide.exit ? guide.exit.name : '所选出口'}，再切换到室外`);
      return;
    }
    if (guide && guide.exitCampusPoint) state.current = guide.exitCampusPoint;
    $('outdoorConfirm').hidden = true;
    $('indoorNavCard').hidden = true;
    $('indoorNextStep').hidden = true;
    $('outdoorSwitch').classList.remove('alert');
    state.handoffArmed = false;
    clearNavigationRuntime();
    state.navigating = false;
    els.navInstruction.hidden = true;
    els.navPanel.hidden = true;
    showToast('已确认到室外，正在打开百度地图');
    const url = baiduNavigationUrl();
    setTimeout(() => { if (url) location.href = url; }, 500);
  }
  function maybePromptOutdoor(force) {
    if (!state.handoffArmed || !state.navigating) return false;
    if (state.indoorGuide && state.indoorGuide.mode === 'indoor') return false;
    if (!force && state.indoorGuide) {
      const stage = state.indoorGuide.stages[state.indoorGuide.stageIndex];
      if (stage.type !== 'outside') return false;
    }
    if (Date.now() < state.outdoorPromptCooldown) return false;
    const building = locById('building1');
    if (!building) return false;
    const distance = NavEngine.dist(state.current, building);
    if (!force && distance <= 65) return false;
    showOutdoorConfirmation();
    return true;
  }
  function applyGpsPosition(position, continuous) {
    const p = { lat:position.coords.latitude, lng:position.coords.longitude, accuracy:position.coords.accuracy };
    state.gpsAccuracy = p.accuracy;
    diag.lastGpsAt = Date.now();
    diag.lastAccuracy = p.accuracy;
    const campusDistance = NavEngine.dist(p, CAMPUS.center);
    if (campusDistance > 8000) {
      if (!continuous) showToast(`你距浑南校区约${NavEngine.fmtDist(campusDistance)}，保留当前地图`);
      renderIndoorUI();
      return false;
    }
    if (state.locationMode === 'indoor' && p.accuracy > 12) {
      renderIndoorUI();
      return false;
    }
    const wasIndoor = state.locationMode === 'indoor';
    const previous = state.current;
    const moved = NavEngine.dist(previous, p);
    if (state.locationMode === 'gps' && p.accuracy > 45 && moved > 20) {
      renderIndoorUI();
      return false;
    }
    let next = p;
    if (state.locationMode === 'gps' && moved > .4 && moved < 80) {
      next = {
        lat: previous.lat + (p.lat - previous.lat) * .42,
        lng: previous.lng + (p.lng - previous.lng) * .42,
        accuracy: p.accuracy
      };
    }
    state.demo = false;
    state.locationMode = 'gps';
    state.accuracy = p.accuracy || 0;
    if (moved > 1.2) state.heading = NavEngine.bearing(previous, next);
    state.current = next;
    if (wasIndoor) maybePromptOutdoor(p.accuracy <= 15);
    refreshPill(); renderNearby();
    if (state.followUser) panTo(p, state.map.scale); else renderMap();
    if (state.tab === 'route') {
      if (state.navigating) { state.route = NavEngine.plan(p, locById(state.destinationId), state.mode); state.traveled = 0; updateNavUI(); }
      else planRoute();
    }
    return true;
  }
  function startMapWatch() {
    if (!navigator.geolocation) return;
    if (state.mapWatchId != null) navigator.geolocation.clearWatch(state.mapWatchId);
    state.mapWatchId = navigator.geolocation.watchPosition(
      position => applyGpsPosition(position, true),
      () => suggestIndoor('GPS 信号弱，正在切换到室内定位'),
      { enableHighAccuracy:true, maximumAge:2000, timeout:15000 }
    );
  }
  function suggestIndoor(message) {
    if (state.locationMode === 'indoor' || state.calibrating) return;
    const firstSuggestion = !state.indoorSuggested;
    state.gpsAccuracy = state.gpsAccuracy || 99;
    state.indoorSuggested = true;
    renderIndoorUI();
    openIndoorPanel();
    if (firstSuggestion) showToast(message || '室内信号较弱，已打开室内定位');
  }
  function requestRealLocation(showFailure) {
    if (!navigator.geolocation) { suggestIndoor('浏览器不支持 GPS，请使用室内定位'); setTimeout(startCalibration, 260); return; }
    if (showFailure) showToast('正在请求精确定位…');
    navigator.geolocation.getCurrentPosition(position => {
      if (applyGpsPosition(position, false)) {
        startMapWatch();
        showToast('已开启持续定位');
      }
    }, error => {
      suggestIndoor(error.code === 1 ? '定位权限未开启，请校准室内位置' : '室内信号较弱，正在进入室内定位');
      setTimeout(startCalibration, 260);
    }, { enableHighAccuracy:true, maximumAge:1000, timeout:10000 });
  }
  function openIndoorPanel() {
    state.indoorPanelOpen = true;
    $('indoorPanel').hidden = false;
    renderIndoorUI();
  }
  function closeIndoorPanel() {
    state.indoorPanelOpen = false;
    $('indoorPanel').hidden = true;
    if (state.tab === 'indoor') setTab('map');
  }
  function requestSensorPermission() {
    const tasks = [];
    if (window.DeviceMotionEvent && typeof DeviceMotionEvent.requestPermission === 'function') tasks.push(DeviceMotionEvent.requestPermission());
    if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') tasks.push(DeviceOrientationEvent.requestPermission());
    return Promise.all(tasks).catch(() => ['denied']);
  }
  let sensorBound = false;
  function bindSensors() {
    if (sensorBound) return;
    sensorBound = true;
    const handleOrientation = (event, absolute) => {
      diag.orientationEvents += 1;
      let raw = null;
      let isAbsolute = false;
      const screenAngle = (screen.orientation && typeof screen.orientation.angle === 'number')
        ? screen.orientation.angle
        : (typeof window.orientation === 'number' ? window.orientation : 0);
      if (typeof event.webkitCompassHeading === 'number' && event.webkitCompassHeading >= 0) {
        raw = event.webkitCompassHeading;
        isAbsolute = true;
      } else if (typeof event.alpha === 'number' && (absolute || event.absolute)) {
        raw = normalizeDeg(360 - event.alpha + screenAngle);
        isAbsolute = true;
      } else if (typeof event.alpha === 'number' && state.rawHeading == null) {
        raw = normalizeDeg(360 - event.alpha + screenAngle);
        isAbsolute = false;
      }
      if (raw == null) return;
      state.headingAbsolute = isAbsolute;
      state.rawHeading = normalizeDeg(raw);
      state.heading = normalizeDeg(state.rawHeading - state.headingOffset);
      renderUser();
      updateCompassUI();
    };
    window.addEventListener('deviceorientationabsolute', event => handleOrientation(event, true));
    window.addEventListener('deviceorientation', event => handleOrientation(event, !!event.absolute));
    window.addEventListener('devicemotion', event => {
      diag.motionEvents += 1;
      if (state.locationMode !== 'indoor') return;
      const acc = event.accelerationIncludingGravity || event.acceleration;
      if (!acc) return;
      const magnitude = Math.sqrt((acc.x || 0) ** 2 + (acc.y || 0) ** 2 + (acc.z || 0) ** 2);
      const threshold = event.accelerationIncludingGravity ? 12.0 : 2.2;
      const now = Date.now();
      if (magnitude > threshold && now - state.lastStepAt > 330) {
        state.lastStepAt = now;
        state.steps += 1;
        renderIndoorUI();
        advanceIndoorByStep();
      }
    });
  }
  function applyExternalIndoorPosition(position) {
    if (!position) return { ok:false, error:'缺少定位数据' };
    if (position.outdoor === true) {
      state.positionSource = 'external';
      if (state.navigating && state.indoorGuide && state.indoorGuide.mode === 'outdoor') showOutdoorConfirmation();
      return { ok:true, outdoor:true };
    }
    const floor = Number(position.floor);
    const x = Number(position.x);
    const y = Number(position.y);
    if (!INDOOR_BUILDINGS[0].floors.includes(floor) || !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 100 || y < 0 || y > 100) {
      return { ok:false, error:'floor 必须为 1/2，x/y 必须为 0-100 的百分比坐标' };
    }
    const source = normalizePositionSource(position.source);
    const accuracy = Number.isFinite(Number(position.accuracy)) && Number(position.accuracy) > 0 ? Number(position.accuracy) : 1.5;
    const building = INDOOR_BUILDINGS[0];
    const rooms = building.roomsByFloor[floor] || [];
    const roomCode = position.roomCode ? String(position.roomCode).toUpperCase() : '';
    const roomIndex = roomCode ? rooms.findIndex(room => room.code.toUpperCase() === roomCode) : -1;
    state.locationMode = 'indoor';
    state.demo = false;
    state.positionSource = source;
    state.accuracy = accuracy;
    state.calibrationFloor = floor;
    if (roomIndex >= 0) state.calibrationRoomIndex = roomIndex;
    state.indoorPosition = { floor, x, y, accuracy, source, roomCode:roomCode || undefined, updatedAt:Date.now() };
    state.currentPlace = roomCode ? `一号楼 · ${floor}F · ${roomCode}` : `一号楼 · ${floor}F`;
    diag.lastExternalAt = Date.now();
    if (state.indoorGuide) {
      const guide = state.indoorGuide;
      let best = null;
      guide.stages.forEach((stage, index) => {
        if (stage.floor !== floor) return;
        const nearest = nearestPointOnRoute(stage.route, { x, y });
        if (!best || nearest.distance < best.distance) best = { index, ratio:nearest.ratio, distance:nearest.distance };
      });
      if (best) {
        guide.stageIndex = best.index;
        const stage = guide.stages[guide.stageIndex];
        guide.manualOffset = stage.distance * best.ratio;
        guide.startSteps = state.steps;
      }
      updateIndoorNavMap(true);
      updateNavUI();
    }
    refreshPill();
    renderIndoorUI();
    renderMap();
    updatePositionSourceUI();
    window.dispatchEvent(new CustomEvent('campus-indoor-position-applied', { detail:{ floor, x, y, accuracy, source } }));
    return { ok:true, floor, x, y, accuracy, source };
  }
  let externalPositionSocket = null;
  function connectExternalPositioning(url) {
    if (!url) return false;
    disconnectExternalPositioning();
    externalPositionSocket = new WebSocket(url);
    externalPositionSocket.addEventListener('message', event => {
      try { applyExternalIndoorPosition(JSON.parse(event.data)); } catch (error) { diag.errors.push(`外部定位数据格式错误：${error.message}`); }
    });
    externalPositionSocket.addEventListener('error', () => showToast('外部定位连接失败'));
    return true;
  }
  function disconnectExternalPositioning() {
    if (externalPositionSocket) { externalPositionSocket.close(); externalPositionSocket = null; }
  }
  async function calibrateCompass() {
    if (state.rawHeading == null) {
      await requestSensorPermission();
      bindSensors();
      updateCompassUI();
      showToast('指南针已开启，请面向路线前进方向后再次点击校准');
      return;
    }
    if (state.routeBearing == null) {
      state.headingOffset = state.rawHeading;
      state.heading = 0;
      state.routeBearing = 0;
      updateCompassUI();
      showToast('已将当前朝向设为地图正北');
      return;
    }
    state.headingOffset = normalizeDeg(state.rawHeading - state.routeBearing);
    state.heading = normalizeDeg(state.rawHeading - state.headingOffset);
    updateCompassUI();
    showToast('已按当前路线方向校准指南针');
  }
  async function enableIndoorMode() {
    const permissions = await requestSensorPermission();
    const denied = permissions.some(result => result === 'denied');
    state.sensorOn = !denied;
    state.sensorTracking = !denied;
    state.locationMode = 'indoor';
    state.demo = false;
    state.accuracy = 4;
    state.indoorAnchor = { lat:state.current.lat, lng:state.current.lng };
    state.steps = 0;
    bindSensors();
    refreshPill(); renderIndoorUI(); renderMap();
    showToast(denied ? '传感器权限未开启，可继续人工校准位置' : '传感器已开启，导航时会沿路线估算实时位置');
  }
  function getCalibrationBuilding() {
    return INDOOR_BUILDINGS[0];
  }
  function currentCalibrationRooms() {
    const building = getCalibrationBuilding();
    return building.roomsByFloor[state.calibrationFloor] || [];
  }
  function calibrationRoomLabel() {
    const building = getCalibrationBuilding();
    const room = currentCalibrationRooms()[state.calibrationRoomIndex] || currentCalibrationRooms()[0];
    if (!room) return `${building.name} · ${state.calibrationFloor}F`;
    return `${building.name} · ${state.calibrationFloor}F · ${room.code}${room.type === '教室' ? room.type : ''}`;
  }
  function centerSelectedRoom(rooms) {
    const selectedRoom = rooms[state.calibrationRoomIndex];
    const wrap = $('calFloorCanvas').parentElement;
    const scroller = $('calFloorCanvas').closest('.floorplan-scroll');
    if (!selectedRoom || !wrap || !scroller) return;
    scroller.scrollLeft = wrap.clientWidth * selectedRoom.x / 100 - scroller.clientWidth / 2;
    scroller.scrollTop = wrap.clientHeight * selectedRoom.y / 100 - scroller.clientHeight / 2;
  }
  function renderCleanFloorPlan(building, floor, callback) {
    const source = $('calFloorImage');
    const canvas = $('calFloorCanvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const draw = () => {
      const width = 720;
      const height = Math.round(width * source.naturalHeight / source.naturalWidth);
      canvas.width = width;
      canvas.height = height;
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(source, 0, 0, width, height);
      const image = ctx.getImageData(0, 0, width, height);
      const d = image.data;
      for (let i = 0; i < d.length; i += 4) {
        const lum = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
        if (lum > 238) {
          d[i + 3] = 0;
        } else {
          const alpha = lum < 110 ? 255 : Math.min(190, Math.max(35, (238 - lum) * 2.6));
          d[i] = 34;
          d[i + 1] = 50;
          d[i + 2] = 68;
          d[i + 3] = alpha;
        }
      }
      ctx.putImageData(image, 0, 0);
      callback && callback();
    };
    const src = building.planImages[floor];
    if (source.dataset.src === src && source.complete) draw();
    else {
      source.dataset.src = src;
      source.onload = draw;
      source.src = src;
    }
  }
  function renderIndoorCalibration() {
    const building = getCalibrationBuilding();
    $('calBuildings').innerHTML = `<button class="cal-building active" data-building="${building.id}">${building.name}</button><span class="cal-building-note">当前仅开放 1F / 2F</span>`;
    $('calFloors').innerHTML = building.floors.map(floor => `<button class="cal-floor ${floor === state.calibrationFloor ? 'active' : ''}" data-floor="${floor}">${floor}F</button>`).join('');
    $('calFloorPlanTitle').textContent = `${building.name} · ${state.calibrationFloor}F · 标准化地图`;
    const rooms = currentCalibrationRooms();
    $('calRooms').innerHTML = rooms.map((room, index) => `
      <button class="room-hotspot ${index === state.calibrationRoomIndex ? 'selected' : ''}"
        data-room-index="${index}" style="left:${room.x}%;top:${room.y}%;"
        aria-label="${room.code}${room.type}"><span>${room.code}</span></button>`).join('');
    $('calSelected').textContent = calibrationRoomLabel();
    const key = `${building.id}-${state.calibrationFloor}`;
    if (state.renderedPlanKey !== key) {
      state.renderedPlanKey = key;
      renderCleanFloorPlan(building, state.calibrationFloor, () => centerSelectedRoom(rooms));
    } else {
      setTimeout(() => centerSelectedRoom(rooms), 30);
    }
  }
  function startCalibration() {
    state.calibrating = true;
    state.indoorPanelOpen = false;
    state.calibrationFloor = state.indoorPosition && INDOOR_BUILDINGS[0].floors.includes(state.indoorPosition.floor) ? state.indoorPosition.floor : (state.calibrationFloor === 2 ? 2 : 1);
    state.calibrationRoomIndex = Math.min(state.calibrationRoomIndex, currentCalibrationRooms().length - 1);
    $('indoorPanel').hidden = true;
    $('calibrationTip').hidden = true;
    $('indoorCalibration').hidden = false;
    renderIndoorCalibration();
  }
  function cancelCalibration() {
    state.calibrating = false;
    $('calibrationTip').hidden = true;
    $('indoorCalibration').hidden = true;
    openIndoorPanel();
  }
  function applyCalibration(point, label, indoorPosition) {
    state.current = point;
    state.currentPlace = label || '地图校准位置';
    state.demo = false;
    state.locationMode = 'indoor';
    state.positionSource = 'manual';
    state.accuracy = indoorPosition ? 2 : 3;
    state.indoorPosition = indoorPosition ? { ...indoorPosition, accuracy:2, source:'manual', updatedAt:Date.now() } : null;
    state.indoorAnchor = { lat:point.lat, lng:point.lng };
    state.steps = 0;
    state.calibrating = false;
    $('calibrationTip').hidden = true;
    $('indoorCalibration').hidden = true;
    state.followUser = true;
    refreshPill(); updatePositionSourceUI(); renderNearby(); panTo(point, .96);
    if (state.tab === 'route') planRoute();
    showToast(`已校准到${state.currentPlace}`);
    openIndoorPanel();
  }
  function confirmIndoorCalibration() {
    const base = locById('building1');
    if (!base) return;
    const room = currentCalibrationRooms()[state.calibrationRoomIndex];
    const offset = state.calibrationRoomIndex % 4;
    const floorOffset = state.calibrationFloor === 1 ? -0.000025 : 0.000025;
    const point = {
      lat: base.lat + floorOffset + (offset % 2) * .00004,
      lng: base.lng + (Math.floor(offset / 2) - 1) * .000045
    };
    applyCalibration(point, calibrationRoomLabel(), { floor:state.calibrationFloor, x:room.x, y:room.y, roomCode:room.code });
  }
  function useMapCalibration() {
    $('indoorCalibration').hidden = true;
    $('calibrationTip').hidden = false;
    state.calibrating = true;
  }
  function startWatchNavigation() {
    if (!navigator.geolocation) {
      state.navigating = false;
      showToast('当前浏览器无法实时定位，请使用室内校准');
      openIndoorTab();
      return;
    }
    if (state.watchId != null) navigator.geolocation.clearWatch(state.watchId);
    state.watchId = navigator.geolocation.watchPosition(position => {
      const p = { lat:position.coords.latitude, lng:position.coords.longitude, accuracy:position.coords.accuracy };
      if (NavEngine.dist(p, CAMPUS.center) > 8000) { showToast('当前位置不在浑南校区附近'); return; }
      if (state.current) state.heading = NavEngine.bearing(state.current, p);
      state.current = p; state.demo = false; state.locationMode = 'gps'; state.accuracy = p.accuracy;
      refreshPill(); renderIndoorUI();
      state.route = NavEngine.plan(state.current, locById(state.destinationId), state.mode);
      state.traveled = 0;
      if (state.followUser) panTo(p, .9); else renderMap();
      updateNavUI();
      if (state.route.distance < 12) arrive();
    }, () => {
      state.navigating = false;
      els.navInstruction.hidden = true;
      els.navPanel.hidden = true;
      showToast('实时定位中断，请检查 GPS 或位置权限');
    }, { enableHighAccuracy:true, maximumAge:1000, timeout:12000 });
  }
  async function startNavigation() {
    if (state.demo) {
      showToast('请先校准室内位置或开启实时定位');
      openIndoorTab();
      return;
    }
    if (state.locationMode === 'indoor' && state.positionSource === 'manual' && !state.sensorOn) {
      const permissions = await requestSensorPermission();
      const denied = permissions.some(result => result === 'denied');
      state.sensorOn = !denied;
      state.sensorTracking = !denied;
      if (!denied) bindSensors();
    }
    if (!state.route) planRoute();
    state.navigating = true;
    state.traveled = 0;
    state.arrived = false;
    state.routes += 1; persist(); addRecent(state.destinationId);
    state.handoffArmed = false;
    state.outdoorPromptCooldown = 0;
    $('outdoorSwitch').classList.remove('alert');
    setTab('route');
    els.routeSetup.hidden = true; els.routeSheet.hidden = true;
    els.navInstruction.hidden = false; els.navPanel.hidden = false;
    if (state.locationMode === 'indoor') {
      state.indoorGuide = buildIndoorGuide();
      const guideFloor = state.indoorGuide.stages[0].floor;
      if (!state.indoorPosition || state.indoorPosition.floor !== guideFloor) {
        const startRoom = state.indoorGuide.room;
        state.indoorPosition = { floor:guideFloor, x:startRoom.x, y:startRoom.y, accuracy:2, source:'manual', updatedAt:Date.now() };
        state.positionSource = 'manual';
      }
      state.handoffArmed = state.indoorGuide.mode === 'outdoor';
      $('outdoorSwitch').hidden = state.indoorGuide.mode !== 'outdoor';
      $('indoorNavCard').hidden = false;
      $('indoorNextStep').hidden = false;
      els.controls.hidden = true;
      $('navPanel').classList.add('collapsed');
      $('navSheetHint').textContent = '上拉展开';
      updateIndoorGuideProgress(false);
      updateNavUI();
      panTo(state.current, .9);
      requestAnimationFrame(syncIndoorNavLayout);
      updatePositionSourceUI();
      showToast(`室内导航已开始 · ${positionSourceLabel(state.positionSource)}`);
    } else {
      state.indoorGuide = null;
      $('indoorNavCard').hidden = true;
      $('indoorNextStep').hidden = true;
      els.controls.hidden = false;
      updateNavUI();
      panTo(state.current, .9);
      startWatchNavigation();
      showToast('GPS 实时导航已开始');
    }
  }
  function clearNavigationRuntime() {
    clearInterval(state.timer); state.timer = null;
    if (state.watchId != null && navigator.geolocation) navigator.geolocation.clearWatch(state.watchId);
    state.watchId = null;
  }
  function endNavigation(silent) {
    clearNavigationRuntime();
    state.navigating = false;
    state.handoffArmed = false;
    state.traveled = 0;
    state.indoorGuide = null;
    $('indoorNavCard').hidden = true;
    $('indoorNextStep').hidden = true;
    els.controls.hidden = false;
    els.navInstruction.hidden = true; els.navPanel.hidden = true;
    if (state.tab === 'route') {
      els.routeSetup.hidden = false; els.routeSheet.hidden = false;
      planRoute(); renderRouteUI(); fitRoute();
    }
    if (!silent) showToast('已结束导航');
  }
  function arrive() {
    clearNavigationRuntime();
    state.navigating = false; state.arrived = true; state.handoffArmed = false; state.indoorGuide = null; $('indoorNavCard').hidden = true; $('indoorNextStep').hidden = true;
    const loc = activeDestination();
    $('arrivalText').textContent = `你已到达${loc ? loc.name : '目的地'}`;
    $('arrivalModal').hidden = false;
    els.navInstruction.hidden = true; els.navPanel.hidden = true;
    state.current = { lat:loc.lat, lng:loc.lng };
    renderMap();
  }
  function openDetail(id) {
    const loc = locById(id); if (!loc) return;
    state.detailId = id; addRecent(id);
    $('detailIcon').textContent = loc.emoji; $('detailIcon').style.background = loc.soft; $('detailIcon').style.color = loc.color;
    $('detailName').textContent = loc.name;
    $('detailSubtitle').textContent = `${loc.subtitle} · ${loc.categoryName}`;
    $('detailOpen').textContent = loc.open; $('detailFloor').textContent = loc.floor;
    $('detailDescription').textContent = loc.description;
    $('detailTips').textContent = loc.tips;
    $('detailTags').innerHTML = loc.tags.map(t => `<span>${t}</span>`).join('');
    $('detailFacilities').innerHTML = loc.facilities.map(t => `<span>${t}</span>`).join('');
    $('favoriteToggle').classList.toggle('active', state.favorites.has(id));
    $('favoriteToggle').textContent = state.favorites.has(id) ? '♥' : '♡';
    els.detailOverlay.hidden = false;
    panTo(loc, .86);
  }
  function closeDetail() { els.detailOverlay.hidden = true; state.detailId = null; }
  function selectLocation(id, openSheetOnly) {
    const loc = locById(id); if (!loc) return;
    state.selectedId = id;
    renderSelected();
    panTo(loc, .84);
    if (!openSheetOnly) renderMarkers();
  }
  function renderSearch(query) {
    const q = (query || '').trim().toLowerCase();
    const matched = LOCATIONS.filter(loc => [loc.name,loc.short,loc.subtitle,loc.categoryName,...(loc.aliases || []),...(loc.tags || [])].join(' ').toLowerCase().includes(q));
    $('searchCount').textContent = `${matched.length} 个结果`;
    els.searchResults.innerHTML = matched.length ? matched.map(loc => `<button class="result-item" data-id="${loc.id}"><span class="poi-icon" style="background:${loc.soft};color:${loc.color}">${loc.emoji}</span><span class="result-copy"><b>${loc.name}</b><small>${loc.categoryName} · ${loc.tags[0]}</small></span><span class="result-go">➤</span></button>`).join('') : `<div class="search-empty">没有找到相关地点<br>试试搜索“图书馆”“食堂”或“南门”</div>`;
  }
  function openSearch() { els.searchOverlay.hidden = false; renderSearch(''); setTimeout(() => els.searchInput.focus(), 30); }
  function closeSearch() { els.searchOverlay.hidden = true; els.searchInput.value = ''; }
  function zoomBy(factor) {
    state.map.scale = Math.max(.34, Math.min(1.7, state.map.scale * factor));
    renderMap();
  }

  $('indoorButton').addEventListener('click', openIndoorPanel);
  $('closeIndoor').addEventListener('click', closeIndoorPanel);
  $('enableIndoor').addEventListener('click', enableIndoorMode);
  $('indoorPlanRoute').addEventListener('click', () => { closeIndoorPanel(); openRoute(state.destinationId); });
  $('calibratePosition').addEventListener('click', startCalibration);
  $('calibrateCenter').addEventListener('click', startCalibration);
  $('tryGps').addEventListener('click', () => requestRealLocation(true));
  $('cancelCalibration').addEventListener('click', cancelCalibration);
  window.addEventListener('keydown', e => {
    if (!state.navigating || state.locationMode !== 'indoor' || ['INPUT','SELECT'].includes(document.activeElement.tagName)) return;
    if (e.key === 'ArrowRight') setNavCollapsed(false);
    if (e.key === 'ArrowLeft') setNavCollapsed(true);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.mapWatchId != null && navigator.geolocation) { navigator.geolocation.clearWatch(state.mapWatchId); state.mapWatchId = null; }
    else if (!document.hidden && state.locationMode !== 'indoor' && state.locationMode !== 'demo') startMapWatch();
  });
  function renderDebugPanel() {
    const age = diag.lastGpsAt ? `${Math.max(0, Math.round((Date.now() - diag.lastGpsAt) / 1000))}秒前` : '尚未获取';
    const secure = window.isSecureContext ? '是' : '否（部分 API 受限）';
    const motion = window.DeviceMotionEvent ? `支持 · ${diag.motionEvents}次事件` : '不支持';
    const orientation = window.DeviceOrientationEvent ? `支持 · ${diag.orientationEvents}次事件` : '不支持';
    $('debugSecure').textContent = secure;
    $('debugGeoSupport').textContent = navigator.geolocation ? '支持' : '不支持';
    $('debugAccuracy').textContent = diag.lastAccuracy != null ? `±${Math.round(diag.lastAccuracy)}米 · ${age}` : age;
    $('debugMotion').textContent = motion;
    $('debugOrientation').textContent = orientation;
    $('debugDrag').textContent = `${diag.dragEvents} 次 · ${state.followUser ? '自动跟随' : '自由浏览'}`;
    $('debugMode').textContent = state.locationMode + (state.currentPlace ? ` · ${state.currentPlace}` : '');
    $('debugViewport').textContent = `${window.innerWidth}×${window.innerHeight} @${window.devicePixelRatio || 1}x`;
    $('debugPositionSource').textContent = positionSourceLabel(state.positionSource);
    $('debugExternal').textContent = diag.lastExternalAt ? `${Math.max(0, Math.round((Date.now() - diag.lastExternalAt) / 1000))}秒前` : '尚未收到';
    $('debugLog').textContent = [
      `URL: ${location.href}`,
      `UA: ${navigator.userAgent}`,
      `GPS: ${navigator.geolocation ? 'available' : 'unavailable'}`,
      `SecureContext: ${window.isSecureContext}`,
      `MotionEvent: ${!!window.DeviceMotionEvent}`,
      `OrientationEvent: ${!!window.DeviceOrientationEvent}`,
      `Errors: ${diag.errors.length}`,
      ...diag.errors.slice(-4).map((e, i) => `#${i + 1} ${e}`)
    ].join('\n');
  }
  function openDebugPanel() {
    $('debugPanel').hidden = false;
    $('debugFab').hidden = false;
    renderDebugPanel();
    clearInterval(diag.timer);
    diag.timer = setInterval(renderDebugPanel, 1000);
  }
  function closeDebugPanel() {
    $('debugPanel').hidden = true;
    clearInterval(diag.timer);
    diag.timer = null;
  }
  function debugText() {
    return [
      `screen=${window.innerWidth}x${window.innerHeight}`,
      `dpr=${window.devicePixelRatio}`,
      `secure=${window.isSecureContext}`,
      `geolocation=${!!navigator.geolocation}`,
      `gpsAccuracy=${diag.lastAccuracy}`,
      `gpsAgeMs=${diag.lastGpsAt ? Date.now() - diag.lastGpsAt : null}`,
      `motionEvents=${diag.motionEvents}`,
      `orientationEvents=${diag.orientationEvents}`,
      `dragEvents=${diag.dragEvents}`,
      `mode=${state.locationMode}`,
      `positionSource=${state.positionSource}`,
      `indoorPosition=${JSON.stringify(state.indoorPosition)}`,
      `externalAgeMs=${diag.lastExternalAt ? Date.now() - diag.lastExternalAt : null}`,
      `place=${state.currentPlace}`,
      `errors=${JSON.stringify(diag.errors.slice(-5))}`,
      `ua=${navigator.userAgent}`
    ].join('\n');
  }
  $('closeDebug').addEventListener('click', closeDebugPanel);
  $('closeDebugBottom').addEventListener('click', closeDebugPanel);
  $('debugFab').addEventListener('click', openDebugPanel);
  $('copyDebug').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(debugText()); showToast('诊断信息已复制'); }
    catch (e) { showToast('复制失败，请截图诊断面板'); }
  });

  $('calClose').addEventListener('click', cancelCalibration);
  $('calCancel').addEventListener('click', cancelCalibration);
  $('calConfirm').addEventListener('click', confirmIndoorCalibration);
  $('calUseMap').addEventListener('click', useMapCalibration);
  $('calFloors').addEventListener('click', e => {
    const button = e.target.closest('[data-floor]'); if (!button) return;
    state.calibrationFloor = Number(button.dataset.floor);
    state.calibrationRoomIndex = 0;
    renderIndoorCalibration();
  });
  $('calRooms').addEventListener('click', e => {
    const button = e.target.closest('[data-room-index]'); if (!button) return;
    state.calibrationRoomIndex = Number(button.dataset.roomIndex);
    renderIndoorCalibration();
  });

  function openIndoorTab() {
    state.tab = 'indoor';
    hideMapPanels();
    els.top.hidden = false;
    els.controls.hidden = false;
    document.querySelector('.map-source').style.display = 'block';
    updateTabs();
    openIndoorPanel();
    renderMap();
  }
  document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => {
    const target = tab.dataset.tab;
    if (target === 'indoor') { openIndoorTab(); return; }
    if (target === 'route' && !state.route) openRoute(state.destinationId);
    else setTab(target);
  }));
  els.categoryRow.addEventListener('click', e => {
    const btn = e.target.closest('[data-cat]'); if (!btn) return;
    state.category = btn.dataset.cat; renderCategories(); renderMarkers();
  });
  els.markers.addEventListener('click', e => {
    const pin = e.target.closest('[data-id]'); if (!pin) return;
    selectLocation(pin.dataset.id);
  });
  els.nearbyList.addEventListener('click', e => { const row = e.target.closest('[data-id]'); if (row) selectLocation(row.dataset.id); });
  $('closeSelected').addEventListener('click', deselect);
  $('detailButton').addEventListener('click', () => openDetail(state.selectedId));
  $('routeButton').addEventListener('click', () => openRoute(state.selectedId));
  $('closeRoute').addEventListener('click', () => setTab('map'));
  $('destinationSelect').addEventListener('change', e => {
    state.destinationId = e.target.value;
    state.roomDestFloor = state.calibrationFloor || 1;
    state.roomDestIndex = 0;
    renderRoomDestination();
    renderExitChoice();
    planRoute(); fitRoute();
  });
  $('roomDestFloors').addEventListener('click', e => {
    const button = e.target.closest('[data-room-floor]'); if (!button) return;
    state.roomDestFloor = Number(button.dataset.roomFloor);
    state.roomDestIndex = 0;
    renderRoomDestination(); renderExitChoice(); planRoute(); fitRoute();
  });
  $('exitSelect').addEventListener('change', e => {
    state.exitId = e.target.value;
    renderExitChoice();
  });
  $('roomDestinationSelect').addEventListener('change', e => {
    state.roomDestIndex = Number(e.target.value);
    renderRoomDestination(); planRoute(); fitRoute();
  });
  document.querySelectorAll('.mode-tab').forEach(btn => btn.addEventListener('click', () => {
    state.mode = btn.dataset.mode;
    document.querySelectorAll('.mode-tab').forEach(b => b.classList.toggle('active', b === btn));
    planRoute(); fitRoute(); renderExitChoice();
  }));
  $('centerDestination').addEventListener('click', () => showToast('请直接点击地图上的地点标记'));
  $('toggleSteps').addEventListener('click', () => { state.showSteps = !state.showSteps; renderRouteUI(); });
  let navHandleStart = null;
  $('navSheetToggle').addEventListener('pointerdown', e => {
    navHandleStart = e.clientY;
    $('navSheetToggle').setPointerCapture(e.pointerId);
  });
  $('navSheetToggle').addEventListener('pointerup', e => {
    if (navHandleStart == null) return;
    const delta = e.clientY - navHandleStart;
    navHandleStart = null;
    if (delta > 18) setNavCollapsed(true);
    else if (delta < -18) setNavCollapsed(false);
    else setNavCollapsed(!$('navPanel').classList.contains('collapsed'));
  });
  $('startNavigation').addEventListener('click', startNavigation);
  $('endNavigation').addEventListener('click', () => endNavigation(false));
  $('indoorNextStep').addEventListener('click', advanceIndoorGuide);
  $('externalNav').addEventListener('click', openExternalNavigation);
  $('calibrateCompass').addEventListener('click', calibrateCompass);
  $('openPositionFix').addEventListener('click', openPositionFix);
  $('closePositionFix').addEventListener('click', closePositionFix);
  $('nudgeBack').addEventListener('click', () => nudgeIndoorPosition(-2));
  $('nudgeForward').addEventListener('click', () => nudgeIndoorPosition(2));
  $('resetSteps').addEventListener('click', resetIndoorSteps);
  $('pickOnMap').addEventListener('click', startPickingIndoorPosition);
  document.querySelectorAll('.step-length-btn').forEach(btn => btn.addEventListener('click', () => setStepLength(Number(btn.dataset.stepLength))));
  $('indoorNavPlan').addEventListener('click', applyPickedIndoorPosition);
  $('positionFixList').addEventListener('click', e => {
    const button = e.target.closest('[data-fix-stage]'); if (!button) return;
    setPositionCheckpoint(Number(button.dataset.fixStage));
  });
  $('cancelOutdoorInline').addEventListener('click', cancelOutdoorConfirmation);
  $('confirmOutdoorInline').addEventListener('click', confirmOutdoorHandoff);
  $('relocateRoute').addEventListener('click', () => requestRealLocation(true));
  $('cancelOutdoor').addEventListener('click', cancelOutdoorConfirmation);
  $('confirmOutdoor').addEventListener('click', confirmOutdoorHandoff);
  $('arrivalClose').addEventListener('click', () => {
    $('arrivalModal').hidden = true;
    state.route = null; state.selectedId = state.destinationId; setTab('map'); renderSelected(); panTo(locById(state.destinationId), .9);
  });
  els.locationPill.addEventListener('click', openIndoorPanel);
  $('sheetLocate').addEventListener('click', openIndoorPanel);
  $('locateButton').addEventListener('click', () => { if (state.demo) requestRealLocation(true); else { state.followUser = true; panTo(state.current, .92); } });
  $('desktopLocate').addEventListener('click', openIndoorPanel);
  $('zoomIn').addEventListener('click', () => zoomBy(1.22));
  $('zoomOut').addEventListener('click', () => zoomBy(.82));
  $('openSearch').addEventListener('click', openSearch);
  $('closeSearch').addEventListener('click', closeSearch);
  $('clearSearch').addEventListener('click', () => { els.searchInput.value = ''; renderSearch(''); els.searchInput.focus(); });
  els.searchInput.addEventListener('input', e => renderSearch(e.target.value));
  els.searchResults.addEventListener('click', e => {
    const row = e.target.closest('[data-id]'); if (!row) return;
    closeSearch(); state.category = 'all'; renderCategories(); selectLocation(row.dataset.id);
  });
  $('detailBack').addEventListener('click', closeDetail);
  $('favoriteToggle').addEventListener('click', () => {
    if (!state.detailId) return;
    if (state.favorites.has(state.detailId)) state.favorites.delete(state.detailId); else state.favorites.add(state.detailId);
    persist(); const isFav = state.favorites.has(state.detailId);
    $('favoriteToggle').classList.toggle('active', isFav); $('favoriteToggle').textContent = isFav ? '♥' : '♡';
    showToast(isFav ? '已收藏' : '已取消收藏'); renderFavorites(); renderProfile();
  });
  $('detailExternal').addEventListener('click', () => { const loc = locById(state.detailId); if (loc) window.open(`https://uri.amap.com/marker?position=${loc.lng},${loc.lat}&name=${encodeURIComponent(loc.name)}&coordinate=wgs84&callnative=1`, '_blank', 'noopener'); });
  $('detailRoute').addEventListener('click', () => { const id = state.detailId; closeDetail(); openRoute(id); });
  els.favoritesScreen.addEventListener('click', e => {
    const routeBtn = e.target.closest('[data-route]');
    if (routeBtn) { openRoute(routeBtn.dataset.route); return; }
    const card = e.target.closest('[data-id]'); if (card) openDetail(card.dataset.id);
  });
  $('profileCampus').addEventListener('click', () => window.open(`https://uri.amap.com/marker?position=${CAMPUS.center.lng},${CAMPUS.center.lat}&name=${encodeURIComponent(CAMPUS.name)}&coordinate=wgs84&callnative=1`, '_blank', 'noopener'));
  document.querySelectorAll('.profile-menu button').forEach(btn => btn.addEventListener('click', () => {
    if (btn.dataset.debug) openDebugPanel(); else showToast(btn.dataset.tip);
  }));
  $('fullscreenToggle').addEventListener('click', () => { document.body.classList.toggle('fullscreen'); $('fullscreenToggle').textContent = document.body.classList.contains('fullscreen') ? '退出全屏' : '全屏预览'; setTimeout(renderMap, 60); });
  window.addEventListener('resize', () => { renderMap(); syncIndoorNavLayout(); });

  let drag = null;
  let suppressMapClick = false;
  els.viewport.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    state.followUser = false;
    drag = { x:e.clientX, y:e.clientY, cx:state.map.cx, cy:state.map.cy, moved:false };
    els.viewport.classList.add('dragging');
    els.viewport.setPointerCapture(e.pointerId);
  });
  els.viewport.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 5) {
      if (!drag.moved) diag.dragEvents += 1;
      drag.moved = true;
    }
    state.map.cx = drag.cx - dx / state.map.scale;
    state.map.cy = drag.cy - dy / state.map.scale;
    const c = clampCenter(state.map.cx, state.map.cy);
    state.map.cx = c.x; state.map.cy = c.y;
    scheduleMapRender();
  });
  const endDrag = () => {
    if (drag && drag.moved) { suppressMapClick = true; showToast('已暂停自动跟随，点定位恢复'); }
    drag = null;
    els.viewport.classList.remove('dragging');
    setTimeout(() => { suppressMapClick = false; }, 120);
  };
  els.viewport.addEventListener('pointerup', endDrag);
  els.viewport.addEventListener('pointercancel', endDrag);
  els.viewport.addEventListener('click', e => {
    if (suppressMapClick || !state.calibrating || e.target.closest('button')) return;
    const rect = els.viewport.getBoundingClientRect();
    applyCalibration(unprojectScreen(e.clientX - rect.left, e.clientY - rect.top));
  });
  els.viewport.addEventListener('wheel', e => { e.preventDefault(); const v = viewportSize(); const r = els.viewport.getBoundingClientRect(); const mx = e.clientX - r.left, my = e.clientY - r.top; const wx = state.map.cx + (mx - v.w / 2) / state.map.scale; const wy = state.map.cy + (my - v.h / 2) / state.map.scale; state.map.scale = Math.max(.34, Math.min(1.7, state.map.scale * (e.deltaY < 0 ? 1.12 : .89))); state.map.cx = wx - (mx - v.w / 2) / state.map.scale; state.map.cy = wy - (my - v.h / 2) / state.map.scale; renderMap(); }, { passive:false });

  function init() {
    const center = project(state.current);
    state.map.cx = center.x; state.map.cy = center.y;
    renderCategories();
    $('destinationSelect').innerHTML = LOCATIONS.map(loc => `<option value="${loc.id}" ${loc.id === state.destinationId ? 'selected' : ''}>${loc.name}</option>`).join('');
    refreshPill(); renderNearby(); renderExitChoice(); setTab('map'); renderMap();
    setTimeout(renderMap, 120);
    const tick = () => { const d = new Date(); $('clock').textContent = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; };
    tick(); setInterval(tick, 30000);
    if (new URLSearchParams(location.search).get('debug') === '1') {
      $('debugFab').hidden = false;
      showToast('诊断模式已开启，点击左下角 ! 查看');
    }
  }
  window.addEventListener('campus-indoor-position', event => applyExternalIndoorPosition(event.detail));
  window.CampusIndoorPositioning = {
    update: applyExternalIndoorPosition,
    connect: connectExternalPositioning,
    disconnect: disconnectExternalPositioning,
    getState: () => state.indoorPosition ? { ...state.indoorPosition } : null,
    simulateStep: (distance) => {
      if (!state.navigating || !state.indoorGuide || isExternalPositionSource(state.positionSource)) return false;
      const previous = state.stepLength;
      state.sensorTracking = true;
      if (Number.isFinite(distance) && distance > 0) state.stepLength = distance;
      advanceIndoorByStep();
      state.stepLength = previous;
      return state.indoorPosition ? { ...state.indoorPosition } : false;
    },
    getNavigationState: () => ({
      mode:state.locationMode,
      source:state.positionSource,
      navigating:state.navigating,
      position:state.indoorPosition ? { ...state.indoorPosition } : null,
      stageIndex:state.indoorGuide ? state.indoorGuide.stageIndex : null,
      stageTitle:state.indoorGuide ? state.indoorGuide.stages[state.indoorGuide.stageIndex].title : null,
      stageFloor:state.indoorGuide ? state.indoorGuide.stages[state.indoorGuide.stageIndex].floor : null
    })
  };
  init();
})();