const campus = {
  id: 'neu-hunnan',
  name: '东北大学浑南校区',
  shortName: '东大浑南',
  address: '辽宁省沈阳市浑南区创新路195号',
  center: { latitude: 41.6531626, longitude: 123.4224780 },
  scale: 16,
  southWest: { latitude: 41.6481, longitude: 123.4186 },
  northEast: { latitude: 41.6578, longitude: 123.4299 }
}

const categories = [
  { id: 'all', name: '全部', icon: '◎' },
  { id: 'study', name: '教学', icon: '▤' },
  { id: 'food', name: '餐饮', icon: '◒' },
  { id: 'life', name: '生活', icon: '⌂' },
  { id: 'sports', name: '运动', icon: '◉' },
  { id: 'service', name: '服务', icon: '✚' }
]

const locations = [
  {
    id: 'library', name: '浑南校区图书馆', shortName: '图书馆', subtitle: '校园知识中心',
    category: 'study', categoryName: '学习空间', emoji: '▤', color: '#2f6f58', softColor: '#e6f1ea',
    latitude: 41.6552606, longitude: 123.4244874,
    open: '07:30 - 22:30', floor: '共 5 层', tags: ['自习', '借阅', '研讨室'],
    aliases: ['图书馆', '东大图书馆', '自习室'],
    description: '东北大学浑南校区图书馆位于校园中部偏北，提供图书借阅、自习、研讨与自助打印服务。',
    facilities: ['免费 Wi-Fi', '充电插座', '饮水机', '自助打印'],
    tips: '考试周座位紧张，建议早上提前到馆。'
  },
  {
    id: 'life_science', name: '生命学馆', shortName: '生命学馆', subtitle: '生命科学教学科研楼',
    category: 'study', categoryName: '教学科研', emoji: '⚗', color: '#486f76', softColor: '#e5f0f0',
    latitude: 41.6542067, longitude: 123.4267518,
    open: '07:00 - 22:00', floor: '教学科研楼', tags: ['实验室', '上课', '科研'],
    aliases: ['生命科学大楼', '生命学馆', '生命科学'],
    description: '生命学馆承担生命科学相关教学、实验与科研任务，是浑南校区的重要学科楼之一。',
    facilities: ['实验室', '教室', '电梯'],
    tips: '进入实验室请提前完成安全培训。'
  },
  {
    id: 'building_1', name: '一号楼', shortName: '一号楼', subtitle: '公共教学与自习空间',
    category: 'study', categoryName: '教学科研', emoji: '▥', color: '#527866', softColor: '#e8f0ea',
    latitude: 41.6521872, longitude: 123.4256722,
    open: '06:30 - 23:00', floor: '公共教学楼', tags: ['公共课', '自习', '阶梯教室'],
    aliases: ['一号楼', '1号楼', '一教'],
    description: '一号楼是浑南校区主要公共教学楼之一，日常课程、考试与自习较为集中。',
    facilities: ['智慧教室', '饮水机', '自动售货机'],
    tips: '课间换教室人流较大，建议预留时间。'
  },
  {
    id: 'canteen', name: '一食堂', shortName: '一食堂', subtitle: '生活服务中心餐饮区',
    category: 'food', categoryName: '校园餐饮', emoji: '◒', color: '#c96b3b', softColor: '#faeee4',
    latitude: 41.6522850, longitude: 123.4213723,
    open: '06:30 - 21:30', floor: '生活服务中心内', tags: ['基本伙食', '风味窗口', '清真食堂'],
    aliases: ['一食堂', '第一食堂', '生活服务中心', '食堂'],
    description: '一食堂分布在生活服务中心楼层内，提供基本伙食与风味特色窗口，是浑南校区主要的日常就餐区域。',
    facilities: ['移动支付', '餐具回收', '超市'],
    tips: '午餐高峰约 11:45 - 12:25，错峰用餐更从容。'
  },
  {
    id: 'coffee', name: '瑞幸咖啡（生活服务中心）', shortName: '瑞幸咖啡', subtitle: '课间咖啡与轻食',
    category: 'food', categoryName: '校园餐饮', emoji: '☕', color: '#a87545', softColor: '#f6ede2',
    latitude: 41.6523500, longitude: 123.4214500,
    open: '08:00 - 21:00', floor: '生活服务中心 A104', tags: ['咖啡', '轻食', '外带'],
    aliases: ['瑞幸', '咖啡', 'luckin'],
    description: '位于生活服务中心 A104，适合上课前后购买咖啡与轻食。',
    facilities: ['小程序点单', '外带'],
    tips: '上午第一节课前点单人数较多，可提前下单。'
  },
  {
    id: 'student_center', name: '学生服务中心', shortName: '服务中心', subtitle: '校园事务与生活配套',
    category: 'life', categoryName: '生活服务', emoji: '◇', color: '#6b8359', softColor: '#edf2e8',
    latitude: 41.6511985, longitude: 123.4235423,
    open: '08:00 - 21:00', floor: '综合服务区域', tags: ['事务办理', '便利店', '打印'],
    aliases: ['学生服务中心', '服务中心', '打印店'],
    description: '学生服务中心集中提供校园事务咨询与生活配套服务，周边分布便利店、打印店等设施。',
    facilities: ['事务咨询', '便利店', '文印'],
    tips: '办理线下业务前可先查看所需材料。'
  },
  {
    id: 'dorm_5', name: '第五学生宿舍楼', shortName: '五舍', subtitle: '学生生活区',
    category: 'life', categoryName: '学生公寓', emoji: '⌂', color: '#73814d', softColor: '#f0f2e4',
    latitude: 41.6521847, longitude: 123.4274461,
    open: '门禁以公寓通知为准', floor: '学生公寓', tags: ['宿舍', '门禁', '快递'],
    aliases: ['五舍', '第五宿舍', '5舍'],
    description: '第五学生宿舍楼位于校园东侧学生生活区，靠近研究生宿舍与生活配套区域。',
    facilities: ['门禁', '洗衣房', '快递服务'],
    tips: '晚归请按公寓管理规定登记进入。'
  },
  {
    id: 'grad_dorm', name: '研究生宿舍楼', shortName: '研究生宿舍', subtitle: '研究生生活区',
    category: 'life', categoryName: '学生公寓', emoji: '⌂', color: '#73814d', softColor: '#f0f2e4',
    latitude: 41.6511135, longitude: 123.4274459,
    open: '门禁以公寓通知为准', floor: '学生公寓', tags: ['研究生', '宿舍', '生活区'],
    aliases: ['研究生宿舍', '研舍'],
    description: '研究生宿舍楼位于校园东南侧，与第五学生宿舍楼相邻。',
    facilities: ['门禁', '洗衣房', '便利店'],
    tips: '晚间生活区人流较多，骑行请减速。'
  },
  {
    id: 'sports', name: '风雨操场', shortName: '风雨操场', subtitle: '室内运动与体育教学',
    category: 'sports', categoryName: '运动场馆', emoji: '◉', color: '#4378a2', softColor: '#e8f1f7',
    latitude: 41.6574651, longitude: 123.4212391,
    open: '06:00 - 22:00', floor: '校园西北侧', tags: ['体育课', '室内运动', '球场'],
    aliases: ['风雨操场', '体育馆', '操场'],
    description: '风雨操场位于校园西北侧，承担体育教学与室内运动功能。',
    facilities: ['运动场地', '储物柜', '急救箱'],
    tips: '场馆开放时间可能随教学安排调整。'
  },
  {
    id: 'clinic', name: '校医院（卫生所）', shortName: '校医院', subtitle: '校园健康服务',
    category: 'service', categoryName: '校园服务', emoji: '✚', color: '#a25f5f', softColor: '#f7eaea',
    latitude: 41.6572044, longitude: 123.4289826,
    open: '以校医院通知为准', floor: '校园东北侧', tags: ['门诊', '药房', '应急'],
    aliases: ['校医院', '卫生所', '医务室'],
    description: '校医院位于校园东北侧，提供基础门诊、药品与应急医疗服务。',
    facilities: ['门诊', '药房', '急救'],
    tips: '紧急情况请同时联系校园保卫处。'
  },
  {
    id: 'south_gate', name: '东北大学浑南校区南门', shortName: '南门', subtitle: '创新路主入口',
    category: 'service', categoryName: '校园出入口', emoji: '⌁', color: '#596d62', softColor: '#e9efeb',
    latitude: 41.6483043, longitude: 123.4249389,
    open: '校园开放时间以通知为准', floor: '创新路', tags: ['出入口', '公交', '访客'],
    aliases: ['南门', '正门', '浑南校区南门'],
    description: '南门位于创新路，是进出校园的重要通道，附近设有公交站与访客入校通道。',
    facilities: ['访客登记', '公交站', '门卫室'],
    tips: '访客入校请携带有效身份证件。'
  },
  {
    id: 'east_gate', name: '东北大学浑南校区东门', shortName: '东门', subtitle: '桃仙机场二路入口',
    category: 'service', categoryName: '校园出入口', emoji: '⌁', color: '#596d62', softColor: '#e9efeb',
    latitude: 41.6520197, longitude: 123.4296575,
    open: '校园开放时间以通知为准', floor: '校园东侧', tags: ['出入口', '人行', '访客'],
    aliases: ['东门', '浑南校区东门'],
    description: '东门位于校园东侧，是浑南校区主要人行入口之一。',
    facilities: ['访客登记', '共享单车', '门卫室'],
    tips: '校外访客可通过人行通道按学校规定入校。'
  },
  {
    id: 'west_gate', name: '东北大学浑南校区西门', shortName: '西门', subtitle: '飞云路入口',
    category: 'service', categoryName: '校园出入口', emoji: '⌁', color: '#596d62', softColor: '#e9efeb',
    latitude: 41.6531275, longitude: 123.4188437,
    open: '开放时间以学校通知为准', floor: '校园西侧', tags: ['出入口', '人行', '非机动车'],
    aliases: ['西门', '浑南校区西门'],
    description: '西门位于校园西侧，开放安排可能随校园管理调整。',
    facilities: ['人行通道', '门卫室'],
    tips: '出行前请留意当日校门开放安排。'
  }
]

const defaultDestinationId = 'library'
const defaultFrom = { id: 'current', name: '我的位置', shortName: '当前位置', nodeId: null }

function getLocation(id) {
  return locations.find(item => item.id === id)
}

function searchLocations(keyword, categoryId) {
  const q = (keyword || '').trim().toLowerCase()
  return locations.filter(item => {
    const matchCategory = !categoryId || categoryId === 'all' || item.category === categoryId
    if (!matchCategory) return false
    if (!q) return true
    const haystack = [item.name, item.shortName, item.subtitle, item.categoryName]
      .concat(item.aliases || [])
      .concat(item.tags || [])
      .join(' ')
      .toLowerCase()
    return haystack.indexOf(q) > -1
  })
}

module.exports = {
  campus,
  categories,
  locations,
  defaultDestinationId,
  defaultFrom,
  getLocation,
  searchLocations
}