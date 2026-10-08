/**
 * 【原型说明】组织架构模块的存储键与规则常量，仅用于原型演示。
 * 规则取值对齐《产品需求文档-组织架构》v1.0 的业务规则。
 */

export const ORG_NODES_KEY = 'proto_org_nodes'
export const ORG_LOGS_KEY = 'proto_org_logs'
export const ORG_VERSION_KEY = 'proto_org_data_version'

/** 【原型说明】演示数据结构版本，调整演示数据时提升版本以清理旧数据 */
export const ORG_DATA_VERSION = '6'

/** 节点名称长度（PRD F-ORG-03 业务规则） */
export const NAME_MIN = 2
export const NAME_MAX = 30
/** 详细地址与备注长度上限 */
export const ADDRESS_MAX = 100
export const REMARK_MAX = 200
/** 单企业节点数量上限（Q-ORG-03：层级不限、单企业 ≤ 500 个节点） */
export const NODE_LIMIT = 500
/** 搜索关键字长度上限 */
export const SEARCH_MAX = 30

/** 【原型说明】用于演示结构上限的节点数量；改小便于验证「节点数量已达上限」提示 */
export const DEMO_NODE_LIMIT = NODE_LIMIT

export const ORG_ALL_KEYS = [ORG_NODES_KEY, ORG_LOGS_KEY] as const
