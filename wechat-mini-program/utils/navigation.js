const walkGraph = require('../data/walk-graph')

const EARTH_RADIUS = 6371000
const SPEED = { walk: 1.25, bike: 3.9 }
const CAMPUS_BOUNDS = {
  minLat: 41.6474,
  maxLat: 41.6584,
  minLon: 123.4178,
  maxLon: 123.4308
}

function toRad(value) {
  return value * Math.PI / 180
}

function distanceBetween(a, b) {
  if (!a || !b) return 0
  const lat1 = toRad(a.latitude)
  const lat2 = toRad(b.latitude)
  const dLat = lat2 - lat1
  const dLon = toRad(b.longitude - a.longitude)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(h))
}

function bearingBetween(a, b) {
  if (!a || !b) return 0
  const lat1 = toRad(a.latitude)
  const lat2 = toRad(b.latitude)
  const dLon = toRad(b.longitude - a.longitude)
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
}

function normalizeDelta(angle) {
  let value = angle
  while (value > 180) value -= 360
  while (value < -180) value += 360
  return value
}

function compassDirection(bearing) {
  const directions = ['北', '东北', '东', '东南', '南', '西南', '西', '西北']
  return directions[Math.round(((bearing % 360) + 360) % 360 / 45) % 8]
}

function formatDistance(meters) {
  if (meters < 1000) return `${Math.max(1, Math.round(meters))}米`
  return `${(meters / 1000).toFixed(1)}公里`
}

function formatDuration(seconds) {
  if (seconds < 60) return '不到1分钟'
  return `${Math.max(1, Math.ceil(seconds / 60))}分钟`
}

function pointFromNode(node) {
  return { latitude: node.lat, longitude: node.lng }
}

function inCampus(point) {
  return point.latitude >= CAMPUS_BOUNDS.minLat && point.latitude <= CAMPUS_BOUNDS.maxLat &&
    point.longitude >= CAMPUS_BOUNDS.minLon && point.longitude <= CAMPUS_BOUNDS.maxLon
}

function buildGraph() {
  const nodes = {}
  const adjacency = {}

  walkGraph.edges.forEach(edge => {
    const first = edge.path[0]
    const last = edge.path[edge.path.length - 1]
    nodes[edge.from] = { id: edge.from, lat: first[0], lng: first[1] }
    nodes[edge.to] = { id: edge.to, lat: last[0], lng: last[1] }
    if (!adjacency[edge.from]) adjacency[edge.from] = []
    if (!adjacency[edge.to]) adjacency[edge.to] = []

    adjacency[edge.from].push({ nodeId: edge.to, distance: edge.distance, path: edge.path })
    const reversePath = edge.path.slice().reverse()
    adjacency[edge.to].push({ nodeId: edge.from, distance: edge.distance, path: reversePath })
  })

  return { nodes, adjacency }
}

const graph = buildGraph()

function nearestGraphNode(point) {
  let nearest = null
  let nearestDistance = Infinity
  Object.keys(graph.nodes).forEach(id => {
    const node = graph.nodes[id]
    const nodePoint = pointFromNode(node)
    if (!inCampus(nodePoint)) return
    const distance = distanceBetween(point, nodePoint)
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearest = { node, point: nodePoint, distance }
    }
  })
  return nearest
}

function shortestPath(startId, endId) {
  if (startId === endId) return { nodeIds: [startId], edges: [], distance: 0 }
  const distances = {}
  const previous = {}
  const unvisited = new Set(Object.keys(graph.nodes))

  Object.keys(graph.nodes).forEach(id => {
    distances[id] = Infinity
    previous[id] = null
  })
  distances[startId] = 0

  while (unvisited.size) {
    let currentId = null
    let currentDistance = Infinity
    unvisited.forEach(id => {
      if (distances[id] < currentDistance) {
        currentDistance = distances[id]
        currentId = id
      }
    })
    if (currentId === null) break
    unvisited.delete(currentId)
    if (currentId === endId) break

    const links = graph.adjacency[currentId] || []
    links.forEach(link => {
      if (!unvisited.has(link.nodeId)) return
      const nextDistance = distances[currentId] + link.distance
      if (nextDistance < distances[link.nodeId]) {
        distances[link.nodeId] = nextDistance
        previous[link.nodeId] = currentId
      }
    })
  }

  if (!isFinite(distances[endId])) return null

  const nodeIds = []
  let cursor = endId
  while (cursor) {
    nodeIds.unshift(cursor)
    cursor = previous[cursor]
  }

  const usedEdges = []
  for (let i = 0; i < nodeIds.length - 1; i += 1) {
    const from = nodeIds[i]
    const to = nodeIds[i + 1]
    const link = (graph.adjacency[from] || []).find(item => item.nodeId === to)
    if (link) usedEdges.push(link)
  }

  return { nodeIds, edges: usedEdges, distance: distances[endId] }
}

function dedupePoints(points) {
  const result = []
  points.forEach(point => {
    if (!point) return
    const last = result[result.length - 1]
    if (!last || distanceBetween(last, point) > 0.45) result.push(point)
  })
  return result
}

function straightRoute(start, destination) {
  const midLat = (start.latitude + destination.latitude) / 2
  const midLon = (start.longitude + destination.longitude) / 2
  const dLat = destination.latitude - start.latitude
  const dLon = destination.longitude - start.longitude
  const points = [
    { latitude: start.latitude, longitude: start.longitude },
    { latitude: midLat - dLon * 0.08, longitude: midLon + dLat * 0.08 },
    { latitude: destination.latitude, longitude: destination.longitude }
  ]
  return finalizeRoute(points, destination, 'walk')
}

function routeLength(points) {
  let total = 0
  for (let i = 0; i < points.length - 1; i += 1) total += distanceBetween(points[i], points[i + 1])
  return total
}

function createSteps(points, destination, mode) {
  if (points.length < 2) return []
  const steps = []
  let sinceTurn = 0
  let firstBearing = bearingBetween(points[0], points[1])

  for (let i = 1; i < points.length - 1; i += 1) {
    const leg = distanceBetween(points[i - 1], points[i])
    sinceTurn += leg
    const prevBearing = bearingBetween(points[i - 1], points[i])
    const nextBearing = bearingBetween(points[i], points[i + 1])
    const turn = normalizeDelta(nextBearing - prevBearing)
    if (Math.abs(turn) > 24 && sinceTurn > 5) {
      const text = turn > 0 ? '右转' : '左转'
      steps.push({
        type: 'turn',
        distance: sinceTurn,
        title: text,
        desc: `在前方路口${text}，继续沿步道前进`,
        bearing: nextBearing
      })
      sinceTurn = 0
    }
  }

  const remain = sinceTurn + distanceBetween(points[points.length - 2], points[points.length - 1])
  const firstTurn = steps[0]
  const startInstruction = firstTurn
    ? `向${compassDirection(firstBearing)}出发，直行${formatDistance(firstTurn.distance)}后${firstTurn.title}`
    : `沿步道向${compassDirection(firstBearing)}方向前进`

  return {
    startBearing: firstBearing,
    startInstruction,
    turns: steps,
    remainToDestination: remain,
    list: [
      {
        icon: '起',
        title: '从当前位置出发',
        desc: startInstruction
      }
    ].concat(steps.map(step => ({
      icon: step.title === '左转' ? '↰' : '↱',
      title: step.title,
      desc: step.desc
    }))).concat([{
      icon: '终',
      title: `到达${destination.shortName || destination.name}`,
      desc: mode === 'bike' ? '请将单车停放在指定停车区域' : '目的地就在附近'
    }])
  }
}

function finalizeRoute(points, destination, mode) {
  const cleaned = dedupePoints(points)
  const distance = routeLength(cleaned)
  const duration = distance / SPEED[mode || 'walk']
  const guidance = createSteps(cleaned, destination, mode)
  return {
    points: cleaned,
    distance,
    duration,
    distanceText: formatDistance(distance),
    durationText: formatDuration(duration),
    guidance,
    source: 'campus'
  }
}

function planCampusRoute(start, destination, mode) {
  if (!start || !destination) return null
  const startPoint = { latitude: start.latitude, longitude: start.longitude }
  const endPoint = { latitude: destination.latitude, longitude: destination.longitude }
  if (distanceBetween(startPoint, endPoint) < 3) {
    return finalizeRoute([startPoint, endPoint], destination, mode)
  }

  const startSnap = nearestGraphNode(startPoint)
  const endSnap = nearestGraphNode(endPoint)
  if (!startSnap || !endSnap) return straightRoute(startPoint, endPoint)

  const path = shortestPath(startSnap.node.id, endSnap.node.id)
  if (!path) return straightRoute(startPoint, endPoint)

  const points = [startPoint, startSnap.point]
  path.edges.forEach(edge => {
    edge.path.forEach(coords => {
      points.push({ latitude: coords[0], longitude: coords[1] })
    })
  })
  points.push(endSnap.point, endPoint)
  return finalizeRoute(points, destination, mode)
}

function navigationInstruction(route, heading) {
  if (!route || !route.points || route.points.length < 2) {
    return { title: '路线加载中', detail: '正在获取你的位置', distanceText: '--', symbol: '●' }
  }

  if (route.distance < 18) {
    return { title: '即将到达目的地', detail: '目的地就在附近，请注意观察', distanceText: formatDistance(route.distance), symbol: '终' }
  }

  const guidance = route.guidance
  const firstTurn = guidance.turns[0]
  const turnDistance = firstTurn ? firstTurn.distance : route.distance
  let title = ''
  let symbol = '↑'

  if (firstTurn && turnDistance <= 18) {
    title = `前方路口${firstTurn.title}`
    symbol = firstTurn.title === '左转' ? '↰' : '↱'
  } else if (heading === null || typeof heading === 'undefined') {
    title = `向${compassDirection(guidance.startBearing)}方向前进`
  } else {
    const difference = normalizeDelta(guidance.startBearing - heading)
    if (Math.abs(difference) > 75) {
      title = difference > 0 ? '请向右调整方向' : '请向左调整方向'
      symbol = difference > 0 ? '↱' : '↰'
    } else {
      title = `沿蓝色路线向${compassDirection(guidance.startBearing)}直行`
    }
  }

  const detail = firstTurn
    ? `${formatDistance(turnDistance)}后${firstTurn.title}`
    : `继续直行，距离目的地${formatDistance(route.distance)}`

  return {
    title,
    detail,
    distanceText: formatDistance(turnDistance),
    symbol
  }
}

function routeToPolyline(points) {
  return [{
    points: points.map(point => ({ latitude: point.latitude, longitude: point.longitude })),
    color: '#176b45',
    width: 8,
    arrowLine: true,
    borderColor: '#c6e6d3',
    borderWidth: 2
  }]
}

module.exports = {
  distanceBetween,
  bearingBetween,
  compassDirection,
  formatDistance,
  formatDuration,
  planCampusRoute,
  navigationInstruction,
  routeToPolyline
}