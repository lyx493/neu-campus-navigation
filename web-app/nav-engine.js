(function () {
  const R = 6371000;
  const SPEED = { walk: 1.25, bike: 3.9 };
  const BOUNDS = { minLat: 41.6450, maxLat: 41.6561, minLon: 123.4120, maxLon: 123.4241 };
  const toRad = v => v * Math.PI / 180;
  const dist = (a, b) => {
    if (!a || !b) return 0;
    const lat1 = toRad(a.lat), lat2 = toRad(b.lat), dLat = lat2 - lat1, dLon = toRad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };
  const bearing = (a, b) => {
    const lat1 = toRad(a.lat), lat2 = toRad(b.lat), dLon = toRad(b.lng - a.lng);
    return (Math.atan2(Math.sin(dLon) * Math.cos(lat2), Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)) * 180 / Math.PI + 360) % 360;
  };
  const deltaAngle = a => { while (a > 180) a -= 360; while (a < -180) a += 360; return a; };
  const compass = b => ['北','东北','东','东南','南','西南','西','西北'][Math.round(((b % 360 + 360) % 360) / 45) % 8];
  const fmtDist = m => m < 1000 ? `${Math.max(1, Math.round(m))}米` : `${(m / 1000).toFixed(1)}公里`;
  const fmtTime = s => s < 60 ? '不到1分钟' : `${Math.max(1, Math.ceil(s / 60))}分钟`;
  const nodes = {}, adj = {};
  if (window.WALK_GRAPH && Array.isArray(window.WALK_GRAPH.edges)) {
    window.WALK_GRAPH.edges.forEach(edge => {
      const first = edge.path[0], last = edge.path[edge.path.length - 1];
      nodes[edge.from] = nodes[edge.from] || { id:edge.from, lat:first[0], lng:first[1] };
      nodes[edge.to] = nodes[edge.to] || { id:edge.to, lat:last[0], lng:last[1] };
      (adj[edge.from] = adj[edge.from] || []).push({ to:edge.to, distance:edge.distance, path:edge.path });
      (adj[edge.to] = adj[edge.to] || []).push({ to:edge.from, distance:edge.distance, path:edge.path.slice().reverse() });
    });
  }
  const inBounds = p => p && p.lat >= BOUNDS.minLat && p.lat <= BOUNDS.maxLat && p.lng >= BOUNDS.minLon && p.lng <= BOUNDS.maxLon;
  function nearest(point) {
    let best = null;
    Object.values(nodes).forEach(n => {
      if (!inBounds(n)) return;
      const d = dist(point, n);
      if (!best || d < best.distance) best = { node:n, point:n, distance:d };
    });
    return best;
  }
  function shortest(startId, endId) {
    if (startId === endId) return { ids:[startId], edges:[], distance:0 };
    const ds = {}, prev = {}, open = new Set(Object.keys(nodes));
    Object.keys(nodes).forEach(id => { ds[id] = Infinity; prev[id] = null; });
    ds[startId] = 0;
    while (open.size) {
      let id = null, value = Infinity;
      open.forEach(k => { if (ds[k] < value) { value = ds[k]; id = k; } });
      if (!id) break;
      open.delete(id);
      if (id === endId) break;
      (adj[id] || []).forEach(link => {
        if (!open.has(link.to)) return;
        const nd = ds[id] + link.distance;
        if (nd < ds[link.to]) { ds[link.to] = nd; prev[link.to] = id; }
      });
    }
    if (!Number.isFinite(ds[endId])) return null;
    const ids = []; let cur = endId;
    while (cur) { ids.unshift(cur); cur = prev[cur]; }
    const edges = [];
    for (let i = 0; i < ids.length - 1; i++) {
      const link = (adj[ids[i]] || []).find(x => x.to === ids[i + 1]);
      if (link) edges.push(link);
    }
    return { ids, edges, distance:ds[endId] };
  }
  function dedupe(points) {
    const out = [];
    points.forEach(p => { if (p && (!out.length || dist(out[out.length - 1], p) > .35)) out.push(p); });
    return out;
  }
  function length(points) { let total = 0; for (let i = 0; i < points.length - 1; i++) total += dist(points[i], points[i + 1]); return total; }
  function turnsFor(points) {
    const turns = []; let accumulated = 0;
    for (let i = 1; i < points.length - 1; i++) {
      accumulated += dist(points[i - 1], points[i]);
      const b1 = bearing(points[i - 1], points[i]);
      const b2 = bearing(points[i], points[i + 1]);
      const turn = deltaAngle(b2 - b1);
      if (Math.abs(turn) > 25) turns.push({ at:accumulated, dir:turn > 0 ? 'right' : 'left', text:turn > 0 ? '右转' : '左转', bearing:b2 });
    }
    return turns;
  }
  function pointAt(points, at) {
    let walked = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const d = dist(points[i], points[i + 1]);
      if (walked + d >= at) {
        const ratio = d ? (at - walked) / d : 0;
        return { lat:points[i].lat + (points[i + 1].lat - points[i].lat) * ratio, lng:points[i].lng + (points[i + 1].lng - points[i].lng) * ratio, bearing:bearing(points[i], points[i + 1]) };
      }
      walked += d;
    }
    const last = points[points.length - 1];
    return { lat:last.lat, lng:last.lng, bearing:bearing(points[Math.max(0, points.length - 2)], last) };
  }
  function remainingPoints(points, traveled) {
    let walked = 0; const result = [];
    for (let i = 0; i < points.length - 1; i++) {
      const d = dist(points[i], points[i + 1]);
      if (walked + d >= traveled) {
        result.push(pointAt(points, Math.min(traveled, length(points))));
        result.push(...points.slice(i + 1));
        break;
      }
      walked += d;
    }
    return result.length ? dedupe(result) : [points[points.length - 1]];
  }
  function direct(start, destination) {
    const mid = { lat:(start.lat + destination.lat) / 2 - (destination.lng - start.lng) * .035, lng:(start.lng + destination.lng) / 2 + (destination.lat - start.lat) * .035 };
    return [start, mid, destination];
  }
  function plan(start, destination, mode) {
    if (!start || !destination) return null;
    let points;
    const sn = nearest(start), en = nearest(destination);
    const path = sn && en ? shortest(sn.node.id, en.node.id) : null;
    if (sn && en && path) {
      points = [start, sn.point];
      path.edges.forEach(edge => edge.path.forEach(p => points.push({ lat:p[0], lng:p[1] })));
      points.push(en.point, destination);
    } else {
      points = direct(start, destination);
    }
    points = dedupe(points);
    const distance = length(points);
    const duration = distance / SPEED[mode || 'walk'];
    const turns = turnsFor(points);
    const startBearing = points.length > 1 ? bearing(points[0], points[1]) : 0;
    const firstTurn = turns[0];
    const startInstruction = firstTurn ? `向${compass(startBearing)}出发，直行${fmtDist(firstTurn.at)}后${firstTurn.text}` : `沿步道向${compass(startBearing)}方向前进`;
    const steps = [{ icon:'起', title:'从当前位置出发', desc:startInstruction }].concat(turns.map(t => ({ icon:t.text === '左转' ? '↰' : '↱', title:t.text, desc:`在前方路口${t.text}，继续沿校园步道前进` }))).concat([{ icon:'终', title:`到达${destination.short || destination.name}`, desc:'目的地就在附近' }]);
    return { points, distance, duration, distanceText:fmtDist(distance), durationText:fmtTime(duration), turns, startBearing, startInstruction, steps, mode };
  }
  function instruction(route, progress, traveled) {
    if (!route) return { title:'正在规划路线', detail:'正在获取校园步道', distanceText:'--', symbol:'↑' };
    const remain = Math.max(0, route.distance - (traveled || 0));
    if (remain < 12) return { title:'即将到达目的地', detail:'目的地就在附近，请注意观察', distanceText:fmtDist(remain), symbol:'终' };
    const next = route.turns.find(t => t.at > (traveled || 0) + 2);
    const turnDistance = next ? next.at - (traveled || 0) : remain;
    let title = `沿蓝色路线向${compass(route.startBearing)}直行`;
    let symbol = '↑';
    if (progress && progress.bearing != null) {
      const diff = deltaAngle(route.startBearing - progress.bearing);
      if (Math.abs(diff) > 72) { title = diff > 0 ? '请向右调整方向' : '请向左调整方向'; symbol = diff > 0 ? '↱' : '↰'; }
    }
    if (next && turnDistance <= 18) { title = `前方路口${next.text}`; symbol = next.text === '左转' ? '↰' : '↱'; }
    return { title, detail:next ? `${fmtDist(turnDistance)}后${next.text}` : `继续直行，距离目的地${fmtDist(remain)}`, distanceText:fmtDist(turnDistance), symbol };
  }
  window.NavEngine = { dist, bearing, compass, fmtDist, fmtTime, plan, instruction, pointAt, remainingPoints, length };
})();