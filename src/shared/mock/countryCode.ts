/**
 * 【原型说明】国际电话区号数据，仅用于原型演示「手机号支持选择国际区号」的交互，
 * 不代表任何真实号码归属地校验方案。默认选择中国 +86。
 * 数据范围：ISO 3166-1 国家/地区全量列表。
 */

export interface CountryCode {
  /** ISO 3166-1 两位国家/地区代码 */
  iso2: string
  /** 中文名称 */
  nameCn: string
  /** 英文名称 */
  nameEn: string
  /** 国际电话区号，含前导 + */
  code: string
}

const RAW: Array<[string, string, string, string]> = [
  ['CN', '中国', 'China', '+86'],
  ['HK', '中国香港', 'Hong Kong', '+852'],
  ['MO', '中国澳门', 'Macao', '+853'],
  ['TW', '中国台湾', 'Taiwan', '+886'],
  ['SG', '新加坡', 'Singapore', '+65'],
  ['MY', '马来西亚', 'Malaysia', '+60'],
  ['JP', '日本', 'Japan', '+81'],
  ['KR', '韩国', 'South Korea', '+82'],
  ['VN', '越南', 'Vietnam', '+84'],
  ['TH', '泰国', 'Thailand', '+66'],
  ['ID', '印度尼西亚', 'Indonesia', '+62'],
  ['PH', '菲律宾', 'Philippines', '+63'],
  ['KH', '柬埔寨', 'Cambodia', '+855'],
  ['LA', '老挝', 'Laos', '+856'],
  ['MM', '缅甸', 'Myanmar', '+95'],
  ['BN', '文莱', 'Brunei', '+673'],
  ['IN', '印度', 'India', '+91'],
  ['PK', '巴基斯坦', 'Pakistan', '+92'],
  ['BD', '孟加拉国', 'Bangladesh', '+880'],
  ['LK', '斯里兰卡', 'Sri Lanka', '+94'],
  ['NP', '尼泊尔', 'Nepal', '+977'],
  ['BT', '不丹', 'Bhutan', '+975'],
  ['MV', '马尔代夫', 'Maldives', '+960'],
  ['MN', '蒙古', 'Mongolia', '+976'],
  ['KZ', '哈萨克斯坦', 'Kazakhstan', '+7'],
  ['UZ', '乌兹别克斯坦', 'Uzbekistan', '+998'],
  ['KG', '吉尔吉斯斯坦', 'Kyrgyzstan', '+996'],
  ['TJ', '塔吉克斯坦', 'Tajikistan', '+992'],
  ['TM', '土库曼斯坦', 'Turkmenistan', '+993'],
  ['AZ', '阿塞拜疆', 'Azerbaijan', '+994'],
  ['GE', '格鲁吉亚', 'Georgia', '+995'],
  ['AM', '亚美尼亚', 'Armenia', '+374'],
  ['AF', '阿富汗', 'Afghanistan', '+93'],
  ['US', '美国', 'United States', '+1'],
  ['CA', '加拿大', 'Canada', '+1'],
  ['MX', '墨西哥', 'Mexico', '+52'],
  ['BR', '巴西', 'Brazil', '+55'],
  ['AR', '阿根廷', 'Argentina', '+54'],
  ['CL', '智利', 'Chile', '+56'],
  ['CO', '哥伦比亚', 'Colombia', '+57'],
  ['PE', '秘鲁', 'Peru', '+51'],
  ['VE', '委内瑞拉', 'Venezuela', '+58'],
  ['EC', '厄瓜多尔', 'Ecuador', '+593'],
  ['BO', '玻利维亚', 'Bolivia', '+591'],
  ['PY', '巴拉圭', 'Paraguay', '+595'],
  ['UY', '乌拉圭', 'Uruguay', '+598'],
  ['GY', '圭亚那', 'Guyana', '+592'],
  ['SR', '苏里南', 'Suriname', '+597'],
  ['CR', '哥斯达黎加', 'Costa Rica', '+506'],
  ['PA', '巴拿马', 'Panama', '+507'],
  ['GT', '危地马拉', 'Guatemala', '+502'],
  ['HN', '洪都拉斯', 'Honduras', '+504'],
  ['SV', '萨尔瓦多', 'El Salvador', '+503'],
  ['NI', '尼加拉瓜', 'Nicaragua', '+505'],
  ['BZ', '伯利兹', 'Belize', '+501'],
  ['CU', '古巴', 'Cuba', '+53'],
  ['DO', '多米尼加', 'Dominican Republic', '+1809'],
  ['HT', '海地', 'Haiti', '+509'],
  ['JM', '牙买加', 'Jamaica', '+1876'],
  ['TT', '特立尼达和多巴哥', 'Trinidad and Tobago', '+1868'],
  ['BB', '巴巴多斯', 'Barbados', '+1246'],
  ['BS', '巴哈马', 'Bahamas', '+1242'],
  ['GD', '格林纳达', 'Grenada', '+1473'],
  ['LC', '圣卢西亚', 'Saint Lucia', '+1758'],
  ['VC', '圣文森特和格林纳丁斯', 'Saint Vincent', '+1784'],
  ['AG', '安提瓜和巴布达', 'Antigua and Barbuda', '+1268'],
  ['DM', '多米尼克', 'Dominica', '+1767'],
  ['KN', '圣基茨和尼维斯', 'Saint Kitts and Nevis', '+1869'],
  ['PR', '波多黎各', 'Puerto Rico', '+1787'],
  ['GB', '英国', 'United Kingdom', '+44'],
  ['IE', '爱尔兰', 'Ireland', '+353'],
  ['FR', '法国', 'France', '+33'],
  ['DE', '德国', 'Germany', '+49'],
  ['IT', '意大利', 'Italy', '+39'],
  ['ES', '西班牙', 'Spain', '+34'],
  ['PT', '葡萄牙', 'Portugal', '+351'],
  ['NL', '荷兰', 'Netherlands', '+31'],
  ['BE', '比利时', 'Belgium', '+32'],
  ['LU', '卢森堡', 'Luxembourg', '+352'],
  ['CH', '瑞士', 'Switzerland', '+41'],
  ['AT', '奥地利', 'Austria', '+43'],
  ['SE', '瑞典', 'Sweden', '+46'],
  ['NO', '挪威', 'Norway', '+47'],
  ['DK', '丹麦', 'Denmark', '+45'],
  ['FI', '芬兰', 'Finland', '+358'],
  ['IS', '冰岛', 'Iceland', '+354'],
  ['PL', '波兰', 'Poland', '+48'],
  ['CZ', '捷克', 'Czechia', '+420'],
  ['SK', '斯洛伐克', 'Slovakia', '+421'],
  ['HU', '匈牙利', 'Hungary', '+36'],
  ['RO', '罗马尼亚', 'Romania', '+40'],
  ['BG', '保加利亚', 'Bulgaria', '+359'],
  ['GR', '希腊', 'Greece', '+30'],
  ['HR', '克罗地亚', 'Croatia', '+385'],
  ['SI', '斯洛文尼亚', 'Slovenia', '+386'],
  ['RS', '塞尔维亚', 'Serbia', '+381'],
  ['BA', '波斯尼亚和黑塞哥维那', 'Bosnia and Herzegovina', '+387'],
  ['ME', '黑山', 'Montenegro', '+382'],
  ['MK', '北马其顿', 'North Macedonia', '+389'],
  ['AL', '阿尔巴尼亚', 'Albania', '+355'],
  ['EE', '爱沙尼亚', 'Estonia', '+372'],
  ['LV', '拉脱维亚', 'Latvia', '+371'],
  ['LT', '立陶宛', 'Lithuania', '+370'],
  ['BY', '白俄罗斯', 'Belarus', '+375'],
  ['UA', '乌克兰', 'Ukraine', '+380'],
  ['MD', '摩尔多瓦', 'Moldova', '+373'],
  ['RU', '俄罗斯', 'Russia', '+7'],
  ['TR', '土耳其', 'Turkey', '+90'],
  ['CY', '塞浦路斯', 'Cyprus', '+357'],
  ['MT', '马耳他', 'Malta', '+356'],
  ['MC', '摩纳哥', 'Monaco', '+377'],
  ['AD', '安道尔', 'Andorra', '+376'],
  ['SM', '圣马力诺', 'San Marino', '+378'],
  ['LI', '列支敦士登', 'Liechtenstein', '+423'],
  ['GI', '直布罗陀', 'Gibraltar', '+350'],
  ['FO', '法罗群岛', 'Faroe Islands', '+298'],
  ['GL', '格陵兰', 'Greenland', '+299'],
  ['IM', '马恩岛', 'Isle of Man', '+44'],
  ['JE', '泽西岛', 'Jersey', '+44'],
  ['GG', '根西岛', 'Guernsey', '+44'],
  ['BM', '百慕大', 'Bermuda', '+1441'],
  ['KY', '开曼群岛', 'Cayman Islands', '+1345'],
  ['VG', '英属维尔京群岛', 'British Virgin Islands', '+1284'],
  ['TC', '特克斯和凯科斯群岛', 'Turks and Caicos', '+1649'],
  ['AI', '安圭拉', 'Anguilla', '+1264'],
  ['MS', '蒙特塞拉特', 'Montserrat', '+1664'],
  ['AW', '阿鲁巴', 'Aruba', '+297'],
  ['CW', '库拉索', 'Curacao', '+599'],
  ['SX', '荷属圣马丁', 'Sint Maarten', '+1721'],
  ['AU', '澳大利亚', 'Australia', '+61'],
  ['NZ', '新西兰', 'New Zealand', '+64'],
  ['FJ', '斐济', 'Fiji', '+679'],
  ['PG', '巴布亚新几内亚', 'Papua New Guinea', '+675'],
  ['SB', '所罗门群岛', 'Solomon Islands', '+677'],
  ['VU', '瓦努阿图', 'Vanuatu', '+678'],
  ['WS', '萨摩亚', 'Samoa', '+685'],
  ['TO', '汤加', 'Tonga', '+676'],
  ['KI', '基里巴斯', 'Kiribati', '+686'],
  ['PF', '法属波利尼西亚', 'French Polynesia', '+689'],
  ['NC', '新喀里多尼亚', 'New Caledonia', '+687'],
  ['GU', '关岛', 'Guam', '+1671'],
  ['MP', '北马里亚纳群岛', 'Northern Mariana Islands', '+1670'],
  ['AS', '美属萨摩亚', 'American Samoa', '+1684'],
  ['AE', '阿联酋', 'United Arab Emirates', '+971'],
  ['SA', '沙特阿拉伯', 'Saudi Arabia', '+966'],
  ['QA', '卡塔尔', 'Qatar', '+974'],
  ['KW', '科威特', 'Kuwait', '+965'],
  ['BH', '巴林', 'Bahrain', '+973'],
  ['OM', '阿曼', 'Oman', '+968'],
  ['YE', '也门', 'Yemen', '+967'],
  ['JO', '约旦', 'Jordan', '+962'],
  ['LB', '黎巴嫩', 'Lebanon', '+961'],
  ['SY', '叙利亚', 'Syria', '+963'],
  ['IQ', '伊拉克', 'Iraq', '+964'],
  ['IR', '伊朗', 'Iran', '+98'],
  ['IL', '以色列', 'Israel', '+972'],
  ['PS', '巴勒斯坦', 'Palestine', '+970'],
  ['EG', '埃及', 'Egypt', '+20'],
  ['LY', '利比亚', 'Libya', '+218'],
  ['TN', '突尼斯', 'Tunisia', '+216'],
  ['DZ', '阿尔及利亚', 'Algeria', '+213'],
  ['MA', '摩洛哥', 'Morocco', '+212'],
  ['SD', '苏丹', 'Sudan', '+249'],
  ['SS', '南苏丹', 'South Sudan', '+211'],
  ['ET', '埃塞俄比亚', 'Ethiopia', '+251'],
  ['ER', '厄立特里亚', 'Eritrea', '+291'],
  ['DJ', '吉布提', 'Djibouti', '+253'],
  ['SO', '索马里', 'Somalia', '+252'],
  ['KE', '肯尼亚', 'Kenya', '+254'],
  ['TZ', '坦桑尼亚', 'Tanzania', '+255'],
  ['UG', '乌干达', 'Uganda', '+256'],
  ['RW', '卢旺达', 'Rwanda', '+250'],
  ['BI', '布隆迪', 'Burundi', '+257'],
  ['NG', '尼日利亚', 'Nigeria', '+234'],
  ['GH', '加纳', 'Ghana', '+233'],
  ['CI', '科特迪瓦', 'Cote d Ivoire', '+225'],
  ['SN', '塞内加尔', 'Senegal', '+221'],
  ['ML', '马里', 'Mali', '+223'],
  ['BF', '布基纳法索', 'Burkina Faso', '+226'],
  ['NE', '尼日尔', 'Niger', '+227'],
  ['GN', '几内亚', 'Guinea', '+224'],
  ['GW', '几内亚比绍', 'Guinea-Bissau', '+245'],
  ['SL', '塞拉利昂', 'Sierra Leone', '+232'],
  ['LR', '利比里亚', 'Liberia', '+231'],
  ['TG', '多哥', 'Togo', '+228'],
  ['BJ', '贝宁', 'Benin', '+229'],
  ['GM', '冈比亚', 'Gambia', '+220'],
  ['CV', '佛得角', 'Cape Verde', '+238'],
  ['MR', '毛里塔尼亚', 'Mauritania', '+222'],
  ['CM', '喀麦隆', 'Cameroon', '+237'],
  ['TD', '乍得', 'Chad', '+235'],
  ['CF', '中非共和国', 'Central African Republic', '+236'],
  ['GA', '加蓬', 'Gabon', '+241'],
  ['CG', '刚果（布）', 'Congo', '+242'],
  ['CD', '刚果（金）', 'DR Congo', '+243'],
  ['GQ', '赤道几内亚', 'Equatorial Guinea', '+240'],
  ['AO', '安哥拉', 'Angola', '+244'],
  ['ZM', '赞比亚', 'Zambia', '+260'],
  ['ZW', '津巴布韦', 'Zimbabwe', '+263'],
  ['MW', '马拉维', 'Malawi', '+265'],
  ['MZ', '莫桑比克', 'Mozambique', '+258'],
  ['MG', '马达加斯加', 'Madagascar', '+261'],
  ['MU', '毛里求斯', 'Mauritius', '+230'],
  ['SC', '塞舌尔', 'Seychelles', '+248'],
  ['KM', '科摩罗', 'Comoros', '+269'],
  ['NA', '纳米比亚', 'Namibia', '+264'],
  ['BW', '博茨瓦纳', 'Botswana', '+267'],
  ['ZA', '南非', 'South Africa', '+27'],
  ['LS', '莱索托', 'Lesotho', '+266'],
  ['SZ', '斯威士兰', 'Eswatini', '+268'],
  ['RE', '留尼汪', 'Reunion', '+262'],
  ['YT', '马约特', 'Mayotte', '+262'],
  ['GP', '瓜德罗普', 'Guadeloupe', '+590'],
  ['MQ', '马提尼克', 'Martinique', '+596'],
  ['GF', '法属圭亚那', 'French Guiana', '+594'],
]

export const COUNTRY_CODES: CountryCode[] = RAW.map(([iso2, nameCn, nameEn, code]) => ({
  iso2,
  nameCn,
  nameEn,
  code,
}))

/** 默认区号：中国 +86 */
export const DEFAULT_COUNTRY_CODE = '+86'

/** 默认区号对应国家/地区 */
export const DEFAULT_COUNTRY_ISO2 = 'CN'

/** 拼接规范化手机号标识：区号 + 本地号码，均不含分隔符 */
export function composePhoneIdentifier(countryCode: string, local: string): string {
  return `+${countryCode.replace(/\D/g, '')}${local.replace(/\D/g, '')}`
}

export function findCountryByCode(code: string): CountryCode {
  return COUNTRY_CODES.find((item) => item.code === code) ?? COUNTRY_CODES[0]
}

export function findCountryByIso2(iso2: string): CountryCode {
  return COUNTRY_CODES.find((item) => item.iso2 === iso2) ?? COUNTRY_CODES[0]
}

/**
 * 将规范化手机号拆分为国家/地区与本地号码。
 * 区号存在共用情况（如 +1、+7、+44），优先取最长匹配；无法确定具体国家/地区时取列表中靠前者。
 */
export function splitPhoneIdentifier(canonical: string): {
  iso2: string
  countryCode: string
  local: string
} {
  const digits = canonical.replace(/\D/g, '')
  const matched = [...COUNTRY_CODES]
    .sort((a, b) => b.code.length - a.code.length)
    .find((item) => digits.startsWith(item.code.replace('+', '')))
  const country = matched ?? COUNTRY_CODES[0]
  return {
    iso2: country.iso2,
    countryCode: country.code,
    local: digits.slice(country.code.replace('+', '').length),
  }
}

/** 下拉选项：label 同时包含中文名、区号、英文名与 ISO 代码，便于按任意字段搜索 */
export const COUNTRY_OPTIONS = COUNTRY_CODES.map((item) => ({
  label: `${item.nameCn} ${item.code}`,
  value: item.iso2,
  nameCn: item.nameCn,
  nameEn: item.nameEn,
  code: item.code,
  iso2: item.iso2,
}))
