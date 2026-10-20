const { nodes, edges } = require('../data/campus')

function getNodeMap() {
  return nodes.reduce((map, node) => {
    map[node.id] = node
    return map
  }, {})
}

function findShortestPath(startId, endId, mode) {
  const nodeMap = getNodeMap()
  if (!nodeMap[startId] || !nodeMap[endId]) return null

  const usableEdges = edges.filter(edge => {
    if (mode === 'bike') return typeof edge.bike === 'number'
    return typeof edge.walk === 'number'
  })

  const distances = {}
  const previous = {}
  const unvisited = new Set(nodes.map(node => node.id))

  nodes.forEach(node => {
    distances[node.id] = Infinity
    previous[node.id] = null
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

    usableEdges.forEach(edge => {
      let neighborId = null
      if (edge.from === currentId) neighborId = edge.to
      if (edge.to === currentId) neighborId = edge.from
      if (!neighborId || !unvisited.has(neighborId)) return

      const weight = mode === 'bike' ? edge.bike : edge.walk
      const nextDistance = distances[currentId] + weight
      if (nextDistance < distances[neighborId]) {
        distances[neighborId] = nextDistance
        previous[neighborId] = currentId
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
  let totalDistance = 0
  let totalTime = 0
  for (let i = 0; i < nodeIds.length - 1; i += 1) {
    const a = nodeIds[i]
    const b = nodeIds[i + 1]
    const edge = usableEdges.find(item => (item.from === a && item.to === b) || (item.from === b && item.to === a))
    if (edge) {
      usedEdges.push(edge)
      totalDistance += edge.distance
      totalTime += mode === 'bike' ? edge.bike : edge.walk
    }
  }

  return {
    nodeIds,
    nodes: nodeIds.map(id => nodeMap[id]),
    edges: usedEdges,
    distance: totalDistance,
    time: totalTime
  }
}

function createSegments(path) {
  if (!path) return []
  return path.nodes.slice(0, -1).map((node, index) => {
    const next = path.nodes[index + 1]
    const dx = next.x - node.x
    const dy = next.y - node.y
    const length = Math.sqrt(dx * dx + dy * dy)
    return {
      id: `${node.id}-${next.id}`,
      left: node.x,
      top: node.y,
      width: length,
      angle: Math.atan2(dy, dx) * 180 / Math.PI
    }
  })
}

function createSteps(path, mode) {
  if (!path || path.edges.length === 0) {
    return [{ index: 1, title: '就在附近', desc: '起点与终点为同一地点', icon: '●' }]
  }

  const steps = path.edges.map((edge, index) => {
    const startNode = path.nodes[index]
    const endNode = path.nodes[index + 1]
    return {
      index: index + 1,
      title: index === 0 ? `从${startNode.name}出发` : `经过${startNode.name}`,
      desc: `沿${edge.via}前往${endNode.name} · ${edge.distance}米`,
      icon: index === 0 ? '起' : String(index + 1)
    }
  })

  const destination = path.nodes[path.nodes.length - 1]
  steps.push({
    index: steps.length + 1,
    title: `到达${destination.name}`,
    desc: mode === 'bike' ? '请将单车停放在指定区域' : '目的地就在你的右手边',
    icon: '终'
  })
  return steps
}

function formatDistance(meters) {
  if (meters < 1000) return `${meters}m`
  return `${(meters / 1000).toFixed(1)}km`
}

function formatDuration(seconds) {
  if (seconds < 60) return '不到1分钟'
  return `${Math.max(1, Math.ceil(seconds / 60))}分钟`
}

module.exports = { findShortestPath, createSegments, createSteps, formatDistance, formatDuration }