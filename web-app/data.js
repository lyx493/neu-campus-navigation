const CAMPUS = {
  name: '东北大学浑南校区',
  address: '辽宁省沈阳市浑南区创新路195号',
  center: { lat: 41.6508, lng: 123.4185 },
  map: { imageWidth:1536, imageHeight:1536, north:41.65649719441144, south:41.64418347939746, west:123.409423828125, east:123.4259033203125 },
  demoStart: { lat: 41.64612, lng: 123.41875 }
};
const CATEGORIES = [
  { id:'all', name:'全部', icon:'◎' }, { id:'study', name:'教学', icon:'▤' },
  { id:'food', name:'餐饮', icon:'◒' }, { id:'life', name:'生活', icon:'⌂' },
  { id:'sports', name:'运动', icon:'◉' }, { id:'service', name:'服务', icon:'✚' }
];
const COLORS = { study:'#377d6a', food:'#df7544', life:'#748b4b', sports:'#3478bf', service:'#a76874' };
const LOCATIONS = [
  { id:'library', name:'浑南校区图书馆', short:'图书馆', category:'study', categoryName:'学习空间', emoji:'▤', lat:41.652836, lng:123.418361, subtitle:'校园知识中心', open:'07:30 - 22:30', floor:'共 5 层', tags:['自习','借阅','研讨室'], facilities:['Wi-Fi','充电插座','饮水机','自助打印'], description:'东北大学浑南校区图书馆位于校园中部，提供图书借阅、自习、研讨与自助打印服务。', tips:'考试周座位紧张，建议早上提前到馆。', aliases:['东大图书馆','图书馆','自习室'] },
  { id:'architecture', name:'建筑学馆', short:'建筑学馆', category:'study', categoryName:'教学科研', emoji:'▥', lat:41.653419, lng:123.416623, subtitle:'建筑与设计教学空间', open:'07:00 - 22:00', floor:'教学科研楼', tags:['设计课','评图','专业教室'], facilities:['专业教室','模型室','饮水机'], description:'建筑学馆位于校园西北侧，是建筑与设计相关课程、评图和专业教室集中使用的教学楼。', tips:'评图周人流较多，请预留时间。', aliases:['建筑馆','建筑学馆'] },
  { id:'information', name:'信息学馆', short:'信息学馆', category:'study', categoryName:'教学科研', emoji:'⌘', lat:41.653371, lng:123.420378, subtitle:'信息与计算机学科楼', open:'07:00 - 22:00', floor:'教学科研楼', tags:['计算机','实验','上课'], facilities:['机房','实验室','电梯'], description:'信息学馆位于校园东北侧，主要承担信息科学、计算机及相关实验教学任务。', tips:'实验室课程请提前查看具体房间。', aliases:['信息馆','计算机楼'] },
  { id:'humanities', name:'文管学馆', short:'文管学馆', category:'study', categoryName:'教学科研', emoji:'文', lat:41.652040, lng:123.417149, subtitle:'人文与管理学科楼', open:'07:00 - 22:00', floor:'教学科研楼', tags:['公共课','人文','管理'], facilities:['教室','讨论室','饮水机'], description:'文管学馆位于图书馆西南侧，承担人文、管理类课程与学术活动。', tips:'一层大厅可查看当日教室安排。', aliases:['文科楼','文管馆'] },
  { id:'life_science', name:'生命学馆', short:'生命学馆', category:'study', categoryName:'教学科研', emoji:'⚗', lat:41.651784, lng:123.420627, subtitle:'生命科学教学科研楼', open:'07:00 - 22:00', floor:'教学科研楼', tags:['实验室','科研','上课'], facilities:['实验室','教室','电梯'], description:'生命学馆承担生命科学相关教学、实验与科研任务，是浑南校区的重要学科楼。', tips:'进入实验室请提前完成安全培训。', aliases:['生命科学大楼','生命馆'] },
  { id:'building1', name:'一号楼', short:'一号楼', category:'study', categoryName:'公共教学', emoji:'1', lat:41.649764, lng:123.419547, subtitle:'公共教学与自习空间', open:'06:30 - 23:00', floor:'公共教学楼', tags:['公共课','自习','阶梯教室'], facilities:['智慧教室','饮水机','自动售货机'], description:'一号楼是浑南校区主要公共教学楼之一，日常课程、考试与自习较为集中。', tips:'课间换教室人流较大，建议预留时间。', aliases:['1号楼','一教'] },
  { id:'canteen', name:'一食堂', short:'一食堂', category:'food', categoryName:'校园餐饮', emoji:'◒', lat:41.649859, lng:123.415245, subtitle:'生活服务中心餐饮区', open:'06:30 - 21:30', floor:'生活服务中心内', tags:['基本伙食','风味窗口','清真食堂'], facilities:['移动支付','餐具回收','超市'], description:'一食堂分布在生活服务中心楼层内，提供基本伙食与风味特色窗口，是浑南校区主要日常就餐区域。', tips:'午餐高峰约 11:45 - 12:25，错峰用餐更从容。', aliases:['第一食堂','食堂','生活服务中心'] },
  { id:'coffee', name:'瑞幸咖啡', short:'瑞幸咖啡', category:'food', categoryName:'校园餐饮', emoji:'☕', lat:41.65002, lng:123.41555, subtitle:'生活服务中心咖啡与轻食', open:'08:00 - 21:00', floor:'生活服务中心 A104', tags:['咖啡','轻食','外带'], facilities:['小程序点单','外带'], description:'瑞幸咖啡位于生活服务中心 A104，适合上课前后购买咖啡与轻食。', tips:'第一节课前点单人数较多，可提前下单。', aliases:['luckin','咖啡'] },
  { id:'student_center', name:'学生服务中心', short:'服务中心', category:'life', categoryName:'生活服务', emoji:'◇', lat:41.648774, lng:123.417416, subtitle:'事务办理与生活配套', open:'08:00 - 21:00', floor:'综合服务区域', tags:['事务办理','便利店','打印'], facilities:['事务咨询','便利店','文印'], description:'学生服务中心集中提供校园事务咨询与生活配套服务，周边分布便利店、打印店等设施。', tips:'办理线下业务前可先查看所需材料。', aliases:['服务中心','打印店'] },
  { id:'dorm1', name:'第一学生宿舍楼', short:'一舍', category:'life', categoryName:'学生公寓', emoji:'⌂', lat:41.648505, lng:123.416076, subtitle:'学生生活区', open:'门禁以公寓通知为准', floor:'学生公寓', tags:['宿舍','门禁','快递'], facilities:['门禁','洗衣房','便利店'], description:'第一学生宿舍楼位于校园西南侧生活区，靠近学生服务中心与一食堂。', tips:'晚间生活区人流较多，骑行请减速。', aliases:['一舍','第一宿舍'] },
  { id:'dorm2', name:'第二学生宿舍楼', short:'二舍', category:'life', categoryName:'学生公寓', emoji:'⌂', lat:41.648505, lng:123.413769, subtitle:'学生生活区', open:'门禁以公寓通知为准', floor:'学生公寓', tags:['宿舍','门禁','洗衣房'], facilities:['门禁','洗衣房'], description:'第二学生宿舍楼位于校园西南侧，靠近西门与生活服务区域。', tips:'夜间从西门返校请留意开放时间。', aliases:['二舍','第二宿舍'] },
  { id:'dorm3', name:'第三学生宿舍楼', short:'三舍', category:'life', categoryName:'学生公寓', emoji:'⌂', lat:41.649747, lng:123.413737, subtitle:'学生生活区', open:'门禁以公寓通知为准', floor:'学生公寓', tags:['宿舍','门禁','快递'], facilities:['门禁','快递柜'], description:'第三学生宿舍楼位于校园西侧生活区，距离一食堂与西门较近。', tips:'晚归请按公寓管理规定登记。', aliases:['三舍','第三宿舍'] },
  { id:'dorm5', name:'第五学生宿舍楼', short:'五舍', category:'life', categoryName:'学生公寓', emoji:'⌂', lat:41.649763, lng:123.421322, subtitle:'学生生活区', open:'门禁以公寓通知为准', floor:'学生公寓', tags:['宿舍','门禁','快递'], facilities:['门禁','洗衣房','快递服务'], description:'第五学生宿舍楼位于校园东侧学生生活区，靠近研究生宿舍与生活配套区域。', tips:'晚归请按公寓管理规定登记进入。', aliases:['五舍','第五宿舍'] },
  { id:'grad_dorm', name:'研究生宿舍楼', short:'研究生宿舍', category:'life', categoryName:'学生公寓', emoji:'⌂', lat:41.648692, lng:123.421322, subtitle:'研究生生活区', open:'门禁以公寓通知为准', floor:'学生公寓', tags:['研究生','宿舍','生活区'], facilities:['门禁','洗衣房','便利店'], description:'研究生宿舍楼位于校园东南侧，与第五学生宿舍楼相邻。', tips:'晚间生活区人流较多，骑行请减速。', aliases:['研舍','研究生宿舍'] },
  { id:'sports', name:'风雨操场', short:'风雨操场', category:'sports', categoryName:'运动场馆', emoji:'◉', lat:41.655038, lng:123.415111, subtitle:'室内运动与体育教学', open:'06:00 - 22:00', floor:'校园西北侧', tags:['体育课','室内运动','球场'], facilities:['运动场地','储物柜','急救箱'], description:'风雨操场位于校园西北侧，承担体育教学与室内运动功能。', tips:'开放时间可能随教学安排调整。', aliases:['体育馆','操场'] },
  { id:'clinic', name:'校医院（卫生所）', short:'校医院', category:'service', categoryName:'校园服务', emoji:'✚', lat:41.654783, lng:123.422859, subtitle:'校园健康服务', open:'以校医院通知为准', floor:'校园东北侧', tags:['门诊','药房','应急'], facilities:['门诊','药房','急救'], description:'校医院位于校园东北侧，提供基础门诊、药品与应急医疗服务。', tips:'紧急情况请同时联系校园保卫处。', aliases:['卫生所','医务室'] },
  { id:'south_gate', name:'浑南校区南门', short:'南门', category:'service', categoryName:'校园出入口', emoji:'⌁', lat:41.6458814, lng:123.4188138, subtitle:'创新路主入口', open:'校园开放时间以通知为准', floor:'创新路', tags:['出入口','公交','访客'], facilities:['访客登记','公交站','门卫室'], description:'南门位于创新路，是进出校园的重要通道，附近设有公交站与访客入校通道。', tips:'访客入校请携带有效身份证件。', aliases:['南门','正门'] },
  { id:'east_gate', name:'浑南校区东门', short:'东门', category:'service', categoryName:'校园出入口', emoji:'⌁', lat:41.6496, lng:123.4235352, subtitle:'校园东侧主要入口', open:'校园开放时间以通知为准', floor:'校园东侧', tags:['出入口','人行','访客'], facilities:['访客登记','共享单车','门卫室'], description:'东门位于校园东侧，是浑南校区主要人行入口之一。', tips:'校外访客可通过人行通道按学校规定入校。', aliases:['东门'] },
  { id:'west_gate', name:'浑南校区西门', short:'西门', category:'service', categoryName:'校园出入口', emoji:'⌁', lat:41.6507, lng:123.4127156, subtitle:'校园西侧入口', open:'开放时间以学校通知为准', floor:'校园西侧', tags:['出入口','人行','非机动车'], facilities:['人行通道','门卫室'], description:'西门位于校园西侧，开放安排可能随校园管理调整。', tips:'出行前请留意当日校门开放安排。', aliases:['西门'] }
];
LOCATIONS.forEach(item => { item.color = COLORS[item.category]; item.soft = ({study:'#e6f1ea',food:'#faeee4',life:'#f0f2e4',sports:'#e8f1f7',service:'#f7eaea'})[item.category]; });


const INDOOR_BUILDINGS = [
  {
    id: 'building1',
    name: '一号楼',
    note: '公共教学楼',
    floors: [1, 2],
    planImages: {
      1: './assets/indoor/building1-1f.jpg',
      2: './assets/indoor/building1-2f.jpg'
    },
    roomsByFloor: {
      1: [
        { code:'A101', type:'教室', x:48.5, y:86.8 },
        { code:'A102', type:'教室', x:48.4, y:63.7 },
        { code:'A103', type:'教室', x:52.5, y:86.8 },
        { code:'A104', type:'教室', x:59.7, y:63.7 },
        { code:'A105', type:'教室', x:76.0, y:86.8 },
        { code:'A107', type:'教室', x:87.3, y:64.1 },
        { code:'A109', type:'教室', x:87.3, y:45.7 },
        { code:'B101', type:'教室', x:6.9, y:91.5 },
        { code:'B103', type:'教室', x:7.9, y:78.2 },
        { code:'B105', type:'教室', x:7.9, y:67.6 },
        { code:'B106', type:'教室', x:19.8, y:45.0 },
        { code:'B107', type:'教室', x:7.9, y:52.8 },
        { code:'B108', type:'教室', x:19.8, y:36.0 },
        { code:'B109', type:'教室', x:7.9, y:41.4 },
        { code:'B111', type:'教室', x:7.9, y:32.0 },
        { code:'B112', type:'教室', x:43.3, y:22.3 },
        { code:'B113', type:'教室', x:8.5, y:21.9 },
        { code:'B114', type:'教室', x:49.0, y:22.3 },
        { code:'B115', type:'教室', x:8.2, y:10.2 },
        { code:'B116', type:'教室', x:54.6, y:22.3 },
        { code:'B118', type:'教室', x:60.3, y:22.3 },
        { code:'B123', type:'教室', x:94.5, y:10.2 },
        { code:'B125', type:'教室', x:94.5, y:14.0 }
      ],
      2: [
        { code:'A201', type:'教室', x:53.5, y:85.9 },
        { code:'A202', type:'教室', x:48.2, y:64.8 },
        { code:'A203', type:'教室', x:76.9, y:85.9 },
        { code:'A204', type:'教室', x:60.2, y:64.8 },
        { code:'A205', type:'教室', x:92.3, y:64.8 },
        { code:'A207', type:'教室', x:92.3, y:45.3 },
        { code:'B201', type:'教室', x:7.4, y:91.4 },
        { code:'B203', type:'教室', x:8.0, y:79.7 },
        { code:'B205', type:'教室', x:8.0, y:67.6 },
        { code:'B206', type:'教室', x:21.1, y:45.3 },
        { code:'B207', type:'教室', x:8.0, y:56.2 },
        { code:'B209', type:'教室', x:8.0, y:45.3 },
        { code:'B211', type:'教室', x:8.0, y:32.8 },
        { code:'B212', type:'教室', x:45.5, y:22.3 },
        { code:'B213', type:'教室', x:9.0, y:22.3 },
        { code:'B215', type:'教室', x:8.4, y:10.2 },
        { code:'B216', type:'教室', x:56.9, y:22.3 },
        { code:'B217', type:'教室', x:45.5, y:7.8 },
        { code:'B219', type:'教室', x:53.5, y:7.8 },
        { code:'B221', type:'教室', x:60.2, y:7.8 },
        { code:'B223', type:'教室', x:66.9, y:7.8 },
        { code:'B225', type:'教室', x:74.9, y:7.8 },
        { code:'B227', type:'教室', x:83.6, y:7.8 },
        { code:'B229', type:'教室', x:90.3, y:7.8 },
        { code:'B231', type:'教室', x:96.0, y:7.8 },
        { code:'B233', type:'教室', x:98.0, y:11.0 }
      ]
    }
  }
];


const INDOOR_STAIRS = [
  { id:'northwest', name:'西北侧楼梯', floor1:{x:17,y:7}, floor2:{x:18,y:5} },
  { id:'west', name:'西侧楼梯', floor1:{x:19,y:22}, floor2:{x:20,y:24} },
  { id:'east', name:'东侧楼梯', floor1:{x:72,y:38}, floor2:{x:76,y:37} },
  { id:'northeast', name:'东北侧楼梯', floor1:{x:85,y:22}, floor2:{x:90,y:20} },
  { id:'south', name:'南侧楼梯', floor1:{x:60,y:92}, floor2:{x:62,y:92} }
];




const INDOOR_DOORS = [
  {
    id: 'door_a105_east',
    name: '一号楼1F东南出口门',
    shortName: '东南出口门',
    x: 91,
    y: 88,
    note: 'A105教室右侧、图中红色圈出的出口门',
    confirmed: true
  }
];
