/**
 * 【原型说明】跨模块复用的业务字典数据，仅用于原型展示。
 * 行业与地区字典同时服务注册企业信息采集与后续「组织与用户管理」模块。
 */

/** 企业所属行业预设列表（对应交互文档待办 TODO-04） */
export const INDUSTRY_OPTIONS = [
  '制造业',
  '建筑业',
  '电力热力燃气及水生产和供应业',
  '交通运输、仓储和邮政业',
  '批发和零售业',
  '住宿和餐饮业',
  '信息传输、软件和信息技术服务业',
  '金融业',
  '房地产业',
  '科学研究和技术服务业',
  '教育',
  '卫生和社会工作',
  '公共管理、社会保障和社会组织',
  '其他',
].map((label) => ({ label, value: label }))

/** 企业所在地区级联数据（对应交互文档待办 TODO-05，原型仅展示部分省市） */
export const REGION_OPTIONS = [
  {
    label: '广东省',
    value: '广东省',
    children: [
      { label: '深圳市', value: '深圳市' },
      { label: '广州市', value: '广州市' },
      { label: '东莞市', value: '东莞市' },
      { label: '佛山市', value: '佛山市' },
    ],
  },
  {
    label: '江苏省',
    value: '江苏省',
    children: [
      { label: '南京市', value: '南京市' },
      { label: '苏州市', value: '苏州市' },
      { label: '无锡市', value: '无锡市' },
    ],
  },
  {
    label: '浙江省',
    value: '浙江省',
    children: [
      { label: '杭州市', value: '杭州市' },
      { label: '宁波市', value: '宁波市' },
    ],
  },
  {
    label: '山东省',
    value: '山东省',
    children: [
      { label: '青岛市', value: '青岛市' },
      { label: '济南市', value: '济南市' },
    ],
  },
]
