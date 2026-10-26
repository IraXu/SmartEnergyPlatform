<template>
  <!-- 页面级无权限：整页空态，不渲染页签、条件区与列表（STATE-RPT-04） -->
  <div v-if="!canView" class="energy-page">
    <section class="energy-panel" aria-label="无访问权限">
      <div class="energy-state">
        <span class="energy-state__icon energy-state__icon--empty"><LockOutlined /></span>
        <p class="energy-state__title">当前账号无权限执行此操作</p>
        <p class="energy-state__desc">
          统计报表用于生成、预览与导出安全报告、用能报告与系统运行报告。如需访问，请联系管理员为当前账号分配「统计报表」权限。
        </p>
        <a-button type="primary" size="small" @click="goHome">返回</a-button>
      </div>
    </section>
  </div>

  <div v-else class="energy-page">
    <!-- AREA-RPT-00 报告类型页签 -->
    <section class="energy-panel rpt-tabs" aria-label="报告类型">
      <Tabs :active-key="activeType" class="rpt-tabs__inner" @change="handleTypeChange">
        <TabPane v-for="item in reportTypes" :key="item.value" :tab="item.label" />
      </Tabs>
    </section>

    <!-- AREA-RPT-01 顶部条件区 -->
    <section class="energy-toolbar" aria-label="报告生成条件">
      <div class="energy-toolbar__item">
        <div class="rpt-label-row">
          <label class="energy-toolbar__label">报告周期</label>
          <a-tooltip :title="annualDisabled ? ANNUAL_HINT : '月报 / 年报'">
            <QuestionCircleOutlined class="rpt-label-row__icon" />
          </a-tooltip>
        </div>
        <a-radio-group v-model:value="period" button-style="solid" class="rpt-control">
          <a-radio-button value="monthly">月报</a-radio-button>
          <a-radio-button value="annual" :disabled="annualDisabled">年报</a-radio-button>
        </a-radio-group>
      </div>

      <div class="energy-toolbar__item">
        <label class="energy-toolbar__label">统计期间</label>
        <a-date-picker
          v-model:value="periodValue"
          class="rpt-control"
          :picker="period === 'monthly' ? 'month' : 'year'"
          :format="period === 'monthly' ? 'YYYY年M月' : 'YYYY年'"
          :allow-clear="false"
          placeholder="选择统计期间"
        />
      </div>

      <div class="energy-toolbar__item">
        <label class="energy-toolbar__label">范围</label>
        <TreeSelect
          v-model:value="rangeUnitId"
          class="rpt-control"
          :tree-data="scopeTreeData"
          :title="rangePath"
          show-search
          tree-node-filter-prop="title"
          :allow-clear="false"
          placeholder="请选择企业 / 组织单元 / 用能单元"
          :styles="{ popup: { root: { maxHeight: '360px', overflow: 'auto', minWidth: '360px' } } }"
          tree-default-expand-all
        />
      </div>

      <div class="energy-toolbar__actions">
        <a-button
          v-if="canGenerate"
          type="primary"
          class="rpt-generate-btn"
          :loading="generatingBusy"
          :disabled="!canSubmit || !scopeHasDevices"
          @click="handleGenerate"
        >
          <template #icon><PlusOutlined /></template>
          生成报告
        </a-button>
      </div>

      <p class="rpt-type-hint">{{ typeHint }}</p>
      <p v-if="!scopeHasDevices" class="rpt-scope-warning">
        当前范围（{{ scopeKindLabel }}）暂无设备，无法生成报告，请改选有设备的组织单元或用能单元。
      </p>
    </section>

    <!-- AREA-RPT-02 报告列表容器 -->
    <section class="energy-panel rpt-list" aria-label="报告列表">
      <div class="energy-notice energy-notice--info">
        <span>
          一行代表报告的一个版本。对同一报告类型、周期、期间、范围再次生成时，系统新增一行版本（版本号 +1）并保留旧版本快照，
          旧版本的报告内容与生成时间不会改变。
        </span>
      </div>

      <!-- STATE-RPT-06 生成中提示 -->
      <div v-if="generatingCount" class="energy-notice energy-notice--info">
        <span>报告生成中，完成后可在列表查看</span>
        <span class="energy-notice__extra">当前类型共 {{ generatingCount }} 个版本生成中</span>
      </div>

      <!-- STATE-RPT-01 加载中 -->
      <div v-if="loading" class="rpt-list__skeleton">
        <a-skeleton active :paragraph="{ rows: 6 }" />
      </div>

      <!-- STATE-RPT-03 暂无报告：按当前报告类型区分空态 -->
      <div v-else-if="!currentReports.length" class="energy-state">
        <span class="energy-state__icon energy-state__icon--empty">
          <component :is="emptyIcon" />
        </span>
        <p class="energy-state__title">{{ emptyTitle }}</p>
        <p class="energy-state__desc">选择报告周期、统计期间与范围后点击「生成报告」</p>
        <a-button
          v-if="canGenerate"
          type="primary"
          size="small"
          :disabled="!canSubmit"
          @click="handleGenerate"
        >
          <template #icon><PlusOutlined /></template>
          生成报告
        </a-button>
      </div>

      <!-- STATE-RPT-07 / 08 报告列表（一行 = 一个版本） -->
      <a-table
        v-else
        class="rpt-table"
        :columns="columns"
        :data-source="currentReports"
        :pagination="paginationConfig"
        :scroll="{ x: 1190 }"
        row-key="id"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <span class="rpt-cell__name" :title="record.name">{{ record.name }}</span>
          </template>

          <template v-else-if="column.key === 'scope'">
            <span class="rpt-cell__scope" :title="scopeOf(record)">{{ scopeOf(record) }}</span>
          </template>

          <template v-else-if="column.key === 'periodText'">
            {{ record.periodText }}
          </template>

          <template v-else-if="column.key === 'version'">
            <span :class="{ 'rpt-cell__version--latest': latestVersionIds.has(record.id) }">
              v{{ record.version }}
            </span>
          </template>

          <template v-else-if="column.key === 'status'">
            <a-tag :color="statusColor(record.status)">{{ statusText(record.status) }}</a-tag>
            <a-progress
              v-if="record.status === 'generating'"
              class="rpt-progress"
              :percent="progressMap[record.id] ?? 0"
              :show-info="false"
              size="small"
            />
          </template>

          <template v-else-if="column.key === 'generatedAt'">
            <span class="rpt-cell__time">{{ record.generatedAt }}</span>
          </template>

          <template v-else-if="column.key === 'action'">
            <div class="rpt-actions">
              <template v-if="record.status === 'generated'">
                <a-tooltip title="预览报告">
                  <a-button
                    type="text"
                    class="rpt-action-btn rpt-action-btn--preview"
                    aria-label="预览报告"
                    @click="handlePreview(record)"
                  >
                    <template #icon><EyeOutlined /></template>
                  </a-button>
                </a-tooltip>
                <a-tooltip v-if="canExport" title="导出 PDF">
                  <a-button
                    type="text"
                    class="rpt-action-btn rpt-action-btn--export"
                    aria-label="导出 PDF"
                    @click="handleExport"
                  >
                    <template #icon><DownloadOutlined /></template>
                  </a-button>
                </a-tooltip>
                <a-tooltip v-if="canGenerate" title="重新生成">
                  <a-button
                    type="text"
                    class="rpt-action-btn rpt-action-btn--regenerate"
                    aria-label="重新生成"
                    @click="handleRegenerate(record)"
                  >
                    <template #icon><ReloadOutlined /></template>
                  </a-button>
                </a-tooltip>
              </template>
              <a-tooltip v-else-if="record.status === 'failed' && canGenerate" title="重试生成">
                <a-button
                  type="text"
                  class="rpt-action-btn rpt-action-btn--retry"
                  aria-label="重试生成"
                  @click="handleRetry(record)"
                >
                  <template #icon><RedoOutlined /></template>
                </a-button>
              </a-tooltip>
            </div>
          </template>
        </template>
      </a-table>
    </section>
  </div>

  <!-- OVERLAY-RPT-PREVIEW 报告预览浮层 -->
  <a-modal
    v-model:open="previewOpen"
    :width="960"
    :mask="{ closable: !exportingPdf }"
    :keyboard="!exportingPdf"
    :closable="!exportingPdf"
    :destroy-on-hidden="true"
    :styles="modalStyles"
  >
    <template #title>
      <div class="rpt-modal-title">
        <span class="rpt-modal-title__name">{{ previewReport?.name }}</span>
        <span class="rpt-modal-title__ver">版本 v{{ previewReport?.version }}</span>
      </div>
    </template>

    <div v-if="previewReport" class="rpt-modal-body">
      <!-- 报告头信息：报告身份信息仅在此展示一次 -->
      <div class="energy-report-head">
        <div class="rpt-meta">
          <div class="rpt-meta__row">
            <span class="rpt-meta__label">报告类型</span>
            <span class="rpt-meta__value">
              <span class="rpt-type-tag">{{ reportTypeLabel(previewReport.type) }}</span>
            </span>
          </div>
          <div class="rpt-meta__row">
            <span class="rpt-meta__label">报告名称</span>
            <span class="rpt-meta__value">{{ previewReport.name }}</span>
          </div>
          <div class="rpt-meta__row">
            <span class="rpt-meta__label">范围</span>
            <span class="rpt-meta__value">{{ previewRange }}</span>
          </div>
          <div class="rpt-meta__row">
            <span class="rpt-meta__label">范围层级</span>
            <span class="rpt-meta__value">{{ previewScopeKindLabel }}</span>
          </div>
          <div class="rpt-meta__row">
            <span class="rpt-meta__label">统计期间</span>
            <span class="rpt-meta__value">{{ previewReport.periodText }}</span>
          </div>
          <div class="rpt-meta__row">
            <span class="rpt-meta__label">报告周期</span>
            <span class="rpt-meta__value">{{ previewReport.period === 'monthly' ? '月报' : '年报' }}</span>
          </div>
          <div class="rpt-meta__row">
            <span class="rpt-meta__label">版本</span>
            <span class="rpt-meta__value">v{{ previewReport.version }}</span>
          </div>
          <div class="rpt-meta__row">
            <span class="rpt-meta__label">生成时间</span>
            <span class="rpt-meta__value">{{ previewReport.generatedAt }}</span>
          </div>
          <div class="rpt-meta__row">
            <span class="rpt-meta__label">数据版本</span>
            <span class="rpt-meta__value">v{{ dataVersion }}</span>
          </div>
        </div>
      </div>

      <!-- ==================== 安全报告（7 部分） ==================== -->
      <template v-if="previewReport.type === 'safety'">
        <section class="energy-report-section">
          <h4 class="rpt-section__title">1 报告说明与数据完整性</h4>
          <div class="rpt-metric-row rpt-metric-row--four">
            <div class="rpt-metric">
              <span class="rpt-metric__label">应采集设备数</span>
              <span class="rpt-metric__value">{{ safety.shouldCollectDevices }}<em>台</em></span>
            </div>
            <div class="rpt-metric">
              <span class="rpt-metric__label">设备数据覆盖率</span>
              <span class="rpt-metric__value">{{ safety.dataCoverage }}<em>%</em></span>
            </div>
            <div class="rpt-metric">
              <span class="rpt-metric__label">有效采集天数</span>
              <span class="rpt-metric__value">{{ safety.validDays }}<em>/ {{ safety.totalDays }} 天</em></span>
            </div>
            <div class="rpt-metric">
              <span class="rpt-metric__label">告警数据</span>
              <span class="rpt-metric__value rpt-metric__value--text">{{ safety.alarmDataText }}</span>
            </div>
          </div>
          <p class="rpt-hint">
            设备数据覆盖率 = Σ(每台设备期间有效采集天数) ÷ (应采集设备数 × 期间自然日数)；缺失不当作 0。
            安全报告只展示汇总级告警统计与设备级隐患摘要，不展示告警原文。
          </p>
        </section>

        <section class="energy-report-section">
          <h4 class="rpt-section__title">2 安全评分与风险等级</h4>
          <template v-if="safety.scoreAvailable">
            <div class="rpt-score-card">
              <div class="rpt-score-card__main">
                <span class="rpt-score-card__label">平台安全评分</span>
                <div class="rpt-score-card__score">
                  {{ safety.score }}<em>分</em>
                </div>
                <span class="rpt-level-tag" :class="`rpt-level-tag--${safetyLevelTone}`">{{ safety.level }}</span>
              </div>
              <div class="rpt-score-card__side">
                <div class="rpt-score-item">
                  <span class="rpt-score-item__label">高危计分事件</span>
                  <span class="rpt-score-item__value rpt-score-item__value--danger">{{ safety.highRiskEvents }}</span>
                </div>
                <div class="rpt-score-item">
                  <span class="rpt-score-item__label">中危计分事件</span>
                  <span class="rpt-score-item__value rpt-score-item__value--warning">{{ safety.midRiskEvents }}</span>
                </div>
                <div class="rpt-score-item">
                  <span class="rpt-score-item__label">涉及设备 / 单元</span>
                  <span class="rpt-score-item__value">{{ safety.involvedDevices }} 台 / {{ safety.involvedUnits }} 个</span>
                </div>
              </div>
            </div>
          </template>
          <div v-else class="rpt-content-state rpt-content-state--muted">
            <span class="rpt-content-state__title">样本不足，暂不评分</span>
            <span class="rpt-content-state__desc">
              当前范围应采集设备 {{ safety.shouldCollectDevices }} 台（少于 5 台），不输出安全评分与风险等级；
              隐患清单、参数分析与整改建议照常输出。
            </span>
          </div>
          <p v-if="safety.sampleSmall" class="rpt-sample-tip">
            样本较小（{{ safety.shouldCollectDevices }} 台），评分波动较大，建议结合隐患清单判断。
          </p>
          <p class="rpt-hint">
            计分事件按「设备 + 事件类型 + 自然日」去重；评分为平台内相对评分，用于趋势观察与隐患排序，
            不替代法定安全检测、消防验收或安全评价。
            <template v-if="safety.comparison">
              上期评分 {{ safety.previousScore }}，本期变化
              {{ safety.comparison.scoreDelta > 0 ? '+' : '' }}{{ safety.comparison.scoreDelta }}。
            </template>
            <template v-else>无上期同范围报告，暂不对比。</template>
          </p>
        </section>

        <section class="energy-report-section">
          <h4 class="rpt-section__title">3 告警与隐患分析</h4>
          <div class="rpt-metric-row">
            <div class="rpt-metric">
              <span class="rpt-metric__label">告警记录数（按期间记录数）</span>
              <span class="rpt-metric__value">{{ safety.alarmRecordCount }}<em>条</em></span>
            </div>
            <div class="rpt-metric">
              <span class="rpt-metric__label">有告警设备数（按设备去重）</span>
              <span class="rpt-metric__value">{{ safety.alarmDeviceCount }}<em>台</em></span>
            </div>
          </div>
          <div class="rpt-subblock">
            <p class="rpt-subblock__title">按事件类别分布（高危 / 中危合计）</p>
            <EnergyBarChart :items="safetyCategoryItems" unit="条" :height="180" />
          </div>
          <div class="rpt-subblock">
            <p class="rpt-subblock__title">
              {{ isUnitScope ? '按设备 / 回路分布' : '按下级组织 / 用能单元分布' }}
            </p>
            <EnergyBarChart v-if="safetyDistribution.length" :items="safetyDistribution" unit="条" :height="180" />
            <p v-else class="rpt-empty-inline">当前范围暂无隐患设备</p>
          </div>
          <div class="rpt-subblock">
            <p class="rpt-subblock__title">告警日趋势</p>
            <EnergyLineChart :series="safetyTrendSeriesList" unit="条" :height="220" legend-position="bottom" />
          </div>
          <div class="rpt-subblock">
            <p class="rpt-subblock__title">Top 隐患设备</p>
            <div v-if="safety.topDevices.length" class="rpt-mini-table">
              <div class="rpt-mini-table__head">
                <span>设备 / 单元</span><span>高危</span><span>中危</span><span>最近告警</span><span>主要事件</span>
              </div>
              <div v-for="item in safety.topDevices" :key="item.name" class="rpt-mini-table__row">
                <span class="rpt-mini-table__name">{{ item.name }}<em>{{ item.unit }}</em></span>
                <span class="rpt-mini-table__danger">{{ item.high }}</span>
                <span class="rpt-mini-table__warning">{{ item.mid }}</span>
                <span>{{ item.lastAt }}</span>
                <span class="rpt-mini-table__ellipsis" :title="item.mainEvents">{{ item.mainEvents }}</span>
              </div>
            </div>
            <p v-else class="rpt-empty-inline">当前范围暂无隐患设备</p>
          </div>
        </section>

        <section class="energy-report-section">
          <h4 class="rpt-section__title">4 电气安全参数分析</h4>
          <div class="rpt-table-wrap">
            <table class="rpt-param-table">
              <thead>
                <tr>
                  <th>参数</th><th>期间极值</th><th>平均值</th><th>参考阈值</th><th>超限设备</th><th>数据可用性</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in safety.parameters" :key="item.name">
                  <td>{{ item.name }}</td>
                  <td>{{ item.extreme }}</td>
                  <td>{{ item.average }}</td>
                  <td>{{ item.threshold }}</td>
                  <td>{{ item.overDevices }}</td>
                  <td :class="{ 'rpt-param-table__muted': item.availability.includes('支持') && !item.availability.startsWith('5/5') }">
                    {{ item.availability }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="rpt-hint">
            参考阈值优先取设备告警阈值；无阈值时只展示实测值、不判定超限；设备不支持该参数时标注「暂无数据依据」，不按 0 计。
          </p>
        </section>

        <section class="energy-report-section">
          <h4 class="rpt-section__title">5 设备安全状态</h4>
          <div class="rpt-meta">
            <div class="rpt-meta__row">
              <span class="rpt-meta__label">期末在线（期末快照）</span>
              <span class="rpt-meta__value">{{ safety.deviceStatus.onlineSnapshot }} 台</span>
            </div>
            <div class="rpt-meta__row">
              <span class="rpt-meta__label">期末离线（期末快照）</span>
              <span class="rpt-meta__value">{{ safety.deviceStatus.offlineSnapshot }} 台</span>
            </div>
            <div class="rpt-meta__row">
              <span class="rpt-meta__label">期间发生过离线的设备数</span>
              <span class="rpt-meta__value">{{ safety.deviceStatus.offlineEverCount }} 台（按设备去重）</span>
            </div>
            <div class="rpt-meta__row">
              <span class="rpt-meta__label">有告警设备数</span>
              <span class="rpt-meta__value">{{ safety.deviceStatus.alarmDeviceCount }} 台（按设备去重）</span>
            </div>
            <div class="rpt-meta__row">
              <span class="rpt-meta__label">高风险设备数</span>
              <span class="rpt-meta__value">{{ safety.deviceStatus.highRiskDevices }} 台（期间 ≥1 个高危事件）</span>
            </div>
            <div class="rpt-meta__row">
              <span class="rpt-meta__label">数据缺失设备数</span>
              <span class="rpt-meta__value">{{ safety.deviceStatus.missingDevices }} 台</span>
            </div>
            <div class="rpt-meta__row">
              <span class="rpt-meta__label">运行时长 / 正常设备数</span>
              <span class="rpt-meta__value">暂无数据依据</span>
            </div>
          </div>
          <p class="rpt-hint">
            「期末在线 / 离线」为期末快照；无运行信号与告警恢复状态时，运行时长与正常设备数标注「暂无数据依据」。
          </p>
        </section>

        <section class="energy-report-section">
          <h4 class="rpt-section__title">6 重点隐患与整改建议</h4>
          <div v-if="safety.recommendations.length" class="rpt-recommend">
            <div v-for="(item, index) in safety.recommendations" :key="index" class="rpt-recommend__item">
              <div class="rpt-recommend__head">
                <span class="rpt-level-tag" :class="item.level === '高' ? 'rpt-level-tag--danger' : 'rpt-level-tag--warning'">
                  {{ item.level }}优先级
                </span>
                <span class="rpt-recommend__title">{{ item.hazard }}</span>
                <span class="rpt-recommend__recheck">建议复查：{{ item.recheck }}</span>
              </div>
              <p class="rpt-recommend__line"><b>证据：</b>{{ item.evidence }}</p>
              <p class="rpt-recommend__line"><b>涉及：</b>{{ item.scope }}</p>
              <p class="rpt-recommend__line"><b>建议：</b>{{ item.action }}</p>
            </div>
          </div>
          <p v-else class="rpt-empty-inline">当前范围暂无重点隐患建议</p>
          <p class="rpt-hint">建议由平台规则输出，不生成工单、不跟踪整改状态，不替代现场检查。</p>
        </section>

        <section class="energy-report-section">
          <h4 class="rpt-section__title">7 上期对比</h4>
          <div v-if="safety.comparison" class="rpt-meta">
            <div class="rpt-meta__row">
              <span class="rpt-meta__label">安全评分变化</span>
              <span class="rpt-meta__value">{{ safety.previousScore }} → {{ safety.score }}（{{ safety.comparison.scoreDelta > 0 ? '+' : '' }}{{ safety.comparison.scoreDelta }}）</span>
            </div>
            <div class="rpt-meta__row">
              <span class="rpt-meta__label">高危计分事件变化</span>
              <span class="rpt-meta__value">+{{ safety.comparison.highDelta }} 条</span>
            </div>
            <div class="rpt-meta__row">
              <span class="rpt-meta__label">中危计分事件变化</span>
              <span class="rpt-meta__value">+{{ safety.comparison.midDelta }} 条</span>
            </div>
            <div class="rpt-meta__row">
              <span class="rpt-meta__label">高风险设备数变化</span>
              <span class="rpt-meta__value">{{ safety.comparison.highRiskDevicesPrevious }} → {{ safety.comparison.highRiskDevicesCurrent }} 台</span>
            </div>
            <div class="rpt-meta__row">
              <span class="rpt-meta__label">上期高风险设备本期仍有高危事件</span>
              <span class="rpt-meta__value">{{ safety.comparison.repeatedDevices.join('、') }}</span>
            </div>
          </div>
          <p v-else class="rpt-empty-inline">无上期同范围报告，暂不对比</p>
          <p class="rpt-hint">「仍有高危事件」只表示告警复现，不代表整改完成。</p>
        </section>
      </template>

      <!-- ==================== 用能报告（7 部分） ==================== -->
      <template v-else-if="previewReport.type === 'energy'">
        <section class="energy-report-section">
          <h4 class="rpt-section__title">1 报告说明与数据完整性</h4>
          <div class="rpt-meta">
            <div class="rpt-meta__row">
              <span class="rpt-meta__label">数据完整率</span>
              <span class="rpt-meta__value">{{ completenessText }}</span>
            </div>
            <div class="rpt-meta__row">
              <span class="rpt-meta__label">有效天数</span>
              <span class="rpt-meta__value">{{ validDays }} / {{ totalDays }} 天</span>
            </div>
            <div class="rpt-meta__row">
              <span class="rpt-meta__label">统计口径</span>
              <span class="rpt-meta__value">{{ statConfirmed }}</span>
            </div>
          </div>
          <p class="rpt-hint">
            完整率 = 有效真实采集点数 ÷ 应采集点数（网关不计入分母）；缺失数据不按 0 计入。
          </p>
        </section>

        <section class="energy-report-section">
          <h4 class="rpt-section__title">2 用能概况</h4>
          <div class="rpt-metric-row">
            <div class="rpt-metric">
              <span class="rpt-metric__label">期间总用电</span>
              <span class="rpt-metric__value">{{ periodTotal.toLocaleString() }}<em>kWh</em></span>
            </div>
            <div class="rpt-metric">
              <span class="rpt-metric__label">日均用电</span>
              <span class="rpt-metric__value">{{ dailyAverage.toLocaleString() }}<em>kWh</em></span>
            </div>
          </div>
          <p class="rpt-hint">
            峰值时段「{{ peakItem.name }}」，谷值时段「{{ valleyItem.name }}」；日均 = 期间总用电 ÷ 有效天数。
          </p>
          <EnergyBarChart :items="touScaled" unit="kWh" :height="180" />
        </section>

        <section class="energy-report-section">
          <h4 class="rpt-section__title">3 同比环比</h4>
          <div class="rpt-metric-row rpt-metric-row--four">
            <div class="rpt-metric">
              <span class="rpt-metric__label">本期</span>
              <span class="rpt-metric__value">{{ periodTotal.toLocaleString() }}<em>kWh</em></span>
            </div>
            <div class="rpt-metric">
              <span class="rpt-metric__label">对比期</span>
              <span class="rpt-metric__value">{{ previousTotal.toLocaleString() }}<em>kWh</em></span>
            </div>
            <div class="rpt-metric">
              <span class="rpt-metric__label">变化量</span>
              <span class="rpt-metric__value">{{ deltaText }}<em>kWh</em></span>
            </div>
            <div class="rpt-metric">
              <span class="rpt-metric__label">变化率</span>
              <span class="rpt-metric__value">{{ deltaRateText }}<em v-if="deltaRatePct !== null">%</em></span>
            </div>
          </div>
          <p class="rpt-hint">
            {{
              deltaRatePct === null
                ? '基期缺数或为 0，变化率留空并说明原因，不输出无穷大。'
                : '对比期为对齐的上一周期（相同已过时长口径）。'
            }}
          </p>
        </section>

        <section class="energy-report-section">
          <h4 class="rpt-section__title">4 用能趋势</h4>
          <EnergyLineChart :series="[scopedDailySeries]" unit="kWh" :height="260" legend-position="bottom" />
          <p class="rpt-hint">缺数显式为「缺失」，估算·展示补齐单列，不按 0 计入。</p>
        </section>

        <section class="energy-report-section">
          <h4 class="rpt-section__title">5 用能结构与排名</h4>
          <div class="rpt-subblock">
            <p class="rpt-subblock__title">分时结构（尖峰平谷）</p>
            <EnergyBarChart :items="touScaled" unit="kWh" :height="180" />
            <p class="rpt-hint">分时数据就绪时输出；未就绪时标注「未支持」，不补成 100%。</p>
          </div>
          <div class="rpt-subblock">
            <p class="rpt-subblock__title">
              {{ isUnitScope ? '按电表 / 回路排名' : '按下级组织 / 用能单元排名' }}（Top {{ rankTopN }}）
            </p>
            <div v-if="focusRows.length" class="rpt-rank">
              <div v-for="(row, index) in focusRows" :key="row.id" class="rpt-rank__row">
                <span class="rpt-rank__no" :class="{ 'rpt-rank__no--top': index < 3 }">{{ index + 1 }}</span>
                <span class="rpt-rank__name" :title="row.name">{{ row.name }}</span>
                <span class="rpt-rank__value">{{ row.current.toLocaleString() }} kWh</span>
              </div>
            </div>
            <p v-else class="rpt-empty-inline">当前范围暂无可排名电表</p>
            <p class="rpt-hint">按去重口径统计；排名默认展示前 {{ rankTopN }} 名，可查看全部。</p>
          </div>
        </section>

        <section class="energy-report-section">
          <h4 class="rpt-section__title">6 用能诊断与建议</h4>
          <div class="rpt-recommend">
            <div v-for="(item, index) in diagnosisList" :key="index" class="rpt-recommend__item">
              <div class="rpt-recommend__head">
                <span class="rpt-level-tag" :class="item.level === '高' ? 'rpt-level-tag--danger' : 'rpt-level-tag--warning'">
                  {{ item.level }}优先级
                </span>
                <span class="rpt-recommend__title">{{ item.conclusion }}</span>
              </div>
              <p class="rpt-recommend__line"><b>依据：</b>{{ item.evidence }}</p>
              <p class="rpt-recommend__line"><b>涉及：</b>{{ item.scope }}</p>
              <p class="rpt-recommend__line"><b>建议：</b>{{ item.action }}</p>
            </div>
          </div>
          <p class="rpt-hint">建议由平台规则输出，不构成能源审计或节能诊断结论。</p>
        </section>

        <section class="energy-report-section">
          <h4 class="rpt-section__title">7 设备状态与告警摘要</h4>
          <div class="rpt-meta">
            <div class="rpt-meta__row">
              <span class="rpt-meta__label">期末在线（期末快照）</span>
              <span class="rpt-meta__value">{{ onlineSnapshot }} 台</span>
            </div>
            <div class="rpt-meta__row">
              <span class="rpt-meta__label">期末离线（期末快照）</span>
              <span class="rpt-meta__value">{{ offlineSnapshot }} 台</span>
            </div>
            <div class="rpt-meta__row">
              <span class="rpt-meta__label">期间发生过离线的设备数</span>
              <span class="rpt-meta__value">{{ offlineEverCount }} 台（按设备去重）</span>
            </div>
            <div class="rpt-meta__row">
              <span class="rpt-meta__label">告警记录数</span>
              <span class="rpt-meta__value">{{ alarmRecordCount }} 条（按期间记录数）</span>
            </div>
            <div class="rpt-meta__row">
              <span class="rpt-meta__label">有告警设备数</span>
              <span class="rpt-meta__value">{{ alarmDeviceCount }} 台（按设备去重）</span>
            </div>
            <div class="rpt-meta__row">
              <span class="rpt-meta__label">运行时长 / 正常设备数</span>
              <span class="rpt-meta__value">暂无数据依据</span>
            </div>
          </div>
          <p class="rpt-hint">
            「期末在线 / 离线」为期末快照；无运行信号与告警恢复状态时，运行时长与正常设备数标注「暂无数据依据」。
          </p>
        </section>
      </template>

      <!-- ==================== 系统运行报告（8 部分） ==================== -->
      <template v-else>
        <section class="energy-report-section">
          <h4 class="rpt-section__title">1 报告说明与数据完整性</h4>
          <div class="rpt-tag-row">
            <span class="rpt-source-tag">上下线记录（30 天）</span>
            <span class="rpt-source-tag">MQTT 通讯日志（30 天）</span>
            <span class="rpt-source-tag">历史采集数据</span>
            <span class="rpt-source-tag">告警记录</span>
          </div>
          <p class="rpt-hint">
            系统运行报告只描述企业能源数据采集与监测系统运行，不含平台机房、服务器、云资源等 IT 基础设施。
            在线率、离线时长与通信成功率依赖 30 天记录；超出保留期时只展示期末快照与可算指标。
          </p>
        </section>

        <section class="energy-report-section">
          <h4 class="rpt-section__title">2 运行总览与状态判定</h4>
          <div class="rpt-runtime-card" :class="`rpt-runtime-card--${runtimeTone}`">
            <div class="rpt-runtime-card__main">
              <span class="rpt-runtime-card__label">运行状态</span>
              <span class="rpt-runtime-card__status">{{ runtime.status }}</span>
              <span class="rpt-runtime-card__desc">
                {{ runtime.statusAvailable ? `基于 ${runtime.availableComponents} 个可用组件判定` : `样本不足（${runtime.deviceTotal} 台，少于 5 台），暂不判定` }}
              </span>
            </div>
            <div class="rpt-runtime-card__side">
              <div class="rpt-score-item">
                <span class="rpt-score-item__label">期间在线率</span>
                <span class="rpt-score-item__value">{{ runtime.onlineRate }}%</span>
              </div>
              <div class="rpt-score-item">
                <span class="rpt-score-item__label">数据完整率</span>
                <span class="rpt-score-item__value">{{ runtime.completeness }}%</span>
              </div>
              <div class="rpt-score-item">
                <span class="rpt-score-item__label">通信成功率</span>
                <span class="rpt-score-item__value">{{ runtime.commSuccess }}%</span>
              </div>
            </div>
          </div>
          <div class="rpt-meta">
            <div class="rpt-meta__row">
              <span class="rpt-meta__label">设备总数</span>
              <span class="rpt-meta__value">{{ runtime.deviceTotal }} 台</span>
            </div>
            <div class="rpt-meta__row">
              <span class="rpt-meta__label">期末在线 / 离线</span>
              <span class="rpt-meta__value">{{ runtime.onlineSnapshot }} 台 / {{ runtime.offlineSnapshot }} 台（期末快照）</span>
            </div>
          </div>
          <p v-if="runtime.sampleSmall" class="rpt-sample-tip">
            样本较小（{{ runtime.deviceTotal }} 台），状态波动较大，建议结合设备清单判断。
          </p>
          <p class="rpt-hint">运行状态为平台内判定，不代表设备厂商或网络运营商 SLA；可用组件少于 2 个或设备数少于 5 台时不判定。</p>
        </section>

        <section class="energy-report-section">
          <h4 class="rpt-section__title">3 设备在线与离线</h4>
          <div class="rpt-metric-row rpt-metric-row--four">
            <div class="rpt-metric">
              <span class="rpt-metric__label">期间离线设备数</span>
              <span class="rpt-metric__value">{{ runtime.offlineEverCount }}<em>台（去重）</em></span>
            </div>
            <div class="rpt-metric">
              <span class="rpt-metric__label">离线次数</span>
              <span class="rpt-metric__value">{{ runtime.offlineCount }}<em>次</em></span>
            </div>
            <div class="rpt-metric">
              <span class="rpt-metric__label">离线时长</span>
              <span class="rpt-metric__value">{{ runtime.offlineDuration }}</span>
            </div>
            <div class="rpt-metric">
              <span class="rpt-metric__label">新增 / 移除设备</span>
              <span class="rpt-metric__value">+{{ runtime.addedDevices }} / -{{ runtime.removedDevices }}<em>台</em></span>
            </div>
          </div>
          <div class="rpt-subblock">
            <p class="rpt-subblock__title">Top 离线设备</p>
            <div v-if="runtime.topOffline.length" class="rpt-mini-table rpt-mini-table--offline">
              <div class="rpt-mini-table__head">
                <span>设备 / 单元</span><span>离线次数</span><span>离线时长</span><span>最近离线</span>
              </div>
              <div v-for="item in runtime.topOffline" :key="item.name" class="rpt-mini-table__row">
                <span class="rpt-mini-table__name">{{ item.name }}<em>{{ item.unit }}</em></span>
                <span>{{ item.count }} 次</span>
                <span>{{ item.duration }}</span>
                <span>{{ item.lastAt }}</span>
              </div>
            </div>
            <p v-else class="rpt-empty-inline">当前范围暂无离线设备</p>
          </div>
          <p class="rpt-hint">
            无在线事实设备 {{ runtime.noOnlineFact }} 台；「期末在线 / 离线」为期末快照，期间在线率另列。
          </p>
        </section>

        <section class="energy-report-section">
          <h4 class="rpt-section__title">4 数据采集质量</h4>
          <div class="rpt-metric-row rpt-metric-row--four">
            <div class="rpt-metric">
              <span class="rpt-metric__label">应采集点数</span>
              <span class="rpt-metric__value">{{ runtime.dataQuality.shouldPoints.toLocaleString() }}</span>
            </div>
            <div class="rpt-metric">
              <span class="rpt-metric__label">有效 / 缺失</span>
              <span class="rpt-metric__value">{{ runtime.dataQuality.validPoints.toLocaleString() }}<em>/ {{ runtime.dataQuality.missingPoints }} 缺失</em></span>
            </div>
            <div class="rpt-metric">
              <span class="rpt-metric__label">估算 / 异常</span>
              <span class="rpt-metric__value">{{ runtime.dataQuality.estimatedPoints }}<em>/ {{ runtime.dataQuality.abnormalPoints }} 异常</em></span>
            </div>
            <div class="rpt-metric">
              <span class="rpt-metric__label">数据延迟（平均 / P95）</span>
              <span class="rpt-metric__value rpt-metric__value--text">{{ runtime.dataQuality.delayAverage }} / {{ runtime.dataQuality.delayP95 }}</span>
            </div>
          </div>
          <div class="rpt-subblock">
            <p class="rpt-subblock__title">数据完整率趋势</p>
            <EnergyLineChart :series="runtimeTrendSeriesList" unit="%" :height="220" legend-position="bottom" />
          </div>
          <div class="rpt-subblock">
            <p class="rpt-subblock__title">Top 缺数设备</p>
            <div v-if="runtime.dataQuality.topMissing.length" class="rpt-mini-table rpt-mini-table--offline">
              <div class="rpt-mini-table__head"><span>设备 / 单元</span><span>缺失点数</span></div>
              <div v-for="item in runtime.dataQuality.topMissing" :key="item.name" class="rpt-mini-table__row">
                <span class="rpt-mini-table__name">{{ item.name }}<em>{{ item.unit }}</em></span>
                <span>{{ item.missing }} 点</span>
              </div>
            </div>
            <p v-else class="rpt-empty-inline">当前范围暂无缺数设备</p>
          </div>
          <p class="rpt-hint">补传 / 重算 {{ runtime.dataQuality.resendCount }} 次；缺失不当作 0，网关不计入分母。</p>
        </section>

        <section class="energy-report-section">
          <h4 class="rpt-section__title">5 通信链路运行</h4>
          <div class="rpt-metric-row rpt-metric-row--four">
            <div class="rpt-metric">
              <span class="rpt-metric__label">MQTT 消息数</span>
              <span class="rpt-metric__value">{{ runtime.communication.messages.toLocaleString() }}</span>
            </div>
            <div class="rpt-metric">
              <span class="rpt-metric__label">失败数 / 成功率</span>
              <span class="rpt-metric__value">{{ runtime.communication.failed.toLocaleString() }}<em>/ {{ runtime.communication.successRate }}%</em></span>
            </div>
            <div class="rpt-metric">
              <span class="rpt-metric__label">重连次数</span>
              <span class="rpt-metric__value">{{ runtime.communication.reconnects }}<em>次</em></span>
            </div>
            <div class="rpt-metric">
              <span class="rpt-metric__label">数据保留期</span>
              <span class="rpt-metric__value rpt-metric__value--text">最近 30 天</span>
            </div>
          </div>
          <div class="rpt-mini-table rpt-mini-table--offline">
            <div class="rpt-mini-table__head"><span>失败原因</span><span>占比</span></div>
            <div v-for="item in runtime.communication.topFailures" :key="item.name" class="rpt-mini-table__row">
              <span>{{ item.name }}</span><span>{{ item.ratio }}</span>
            </div>
          </div>
          <div class="rpt-subblock">
            <p class="rpt-subblock__title">Top 通信异常设备</p>
            <div v-if="runtime.communication.topDevices.length" class="rpt-mini-table rpt-mini-table--offline">
              <div class="rpt-mini-table__head"><span>设备 / 单元</span><span>失败 / 重连</span></div>
              <div v-for="item in runtime.communication.topDevices" :key="item.name" class="rpt-mini-table__row">
                <span class="rpt-mini-table__name">{{ item.name }}<em>{{ item.unit }}</em></span>
                <span>{{ item.failed }} / {{ item.reconnects }}</span>
              </div>
            </div>
            <p v-else class="rpt-empty-inline">当前范围暂无通信异常设备</p>
          </div>
          <p class="rpt-hint">远程指令执行结果本期不纳入系统运行报告。</p>
        </section>

        <section class="energy-report-section">
          <h4 class="rpt-section__title">6 告警与事件摘要</h4>
          <div class="rpt-metric-row">
            <div class="rpt-metric">
              <span class="rpt-metric__label">告警记录数</span>
              <span class="rpt-metric__value">{{ runtime.alarmSummary.records }}<em>条</em></span>
            </div>
            <div class="rpt-metric">
              <span class="rpt-metric__label">有告警设备数</span>
              <span class="rpt-metric__value">{{ runtime.alarmSummary.devices }}<em>台（去重）</em></span>
            </div>
          </div>
          <div class="rpt-subblock">
            <p class="rpt-subblock__title">Top 事件类型</p>
            <div v-if="runtime.alarmSummary.topTypes.length" class="rpt-mini-table rpt-mini-table--offline">
              <div class="rpt-mini-table__head"><span>事件类型</span><span>记录数</span></div>
              <div v-for="item in runtime.alarmSummary.topTypes" :key="item.name" class="rpt-mini-table__row">
                <span>{{ item.name }}</span><span>{{ item.count }} 条</span>
              </div>
            </div>
            <p v-else class="rpt-empty-inline">当前范围暂无告警事件</p>
          </div>
          <div class="rpt-subblock">
            <p class="rpt-subblock__title">Top 告警设备</p>
            <div v-if="runtime.alarmSummary.topDevices.length" class="rpt-mini-table rpt-mini-table--offline">
              <div class="rpt-mini-table__head"><span>设备</span><span>告警记录数</span></div>
              <div v-for="item in runtime.alarmSummary.topDevices" :key="item.name" class="rpt-mini-table__row">
                <span>{{ item.name }}</span><span>{{ item.count }} 条</span>
              </div>
            </div>
            <p v-else class="rpt-empty-inline">当前范围暂无告警设备</p>
          </div>
          <p class="rpt-hint">系统运行报告只做告警摘要，安全结论与整改建议见安全报告。</p>
        </section>

        <section class="energy-report-section">
          <h4 class="rpt-section__title">7 运行问题与建议</h4>
          <div v-if="runtime.recommendations.length" class="rpt-recommend">
            <div v-for="(item, index) in runtime.recommendations" :key="index" class="rpt-recommend__item">
              <div class="rpt-recommend__head">
                <span class="rpt-level-tag" :class="item.level === '高' ? 'rpt-level-tag--danger' : 'rpt-level-tag--warning'">
                  {{ item.level }}优先级
                </span>
                <span class="rpt-recommend__title">{{ item.issue }}</span>
                <span class="rpt-recommend__recheck">建议复查：{{ item.recheck }}</span>
              </div>
              <p class="rpt-recommend__line"><b>证据：</b>{{ item.evidence }}</p>
              <p class="rpt-recommend__line"><b>影响：</b>{{ item.impact }}</p>
              <p class="rpt-recommend__line"><b>建议：</b>{{ item.action }}</p>
            </div>
          </div>
          <p v-else class="rpt-empty-inline">当前范围暂无运行问题建议</p>
          <p class="rpt-hint">建议由平台规则输出，不生成工单，不替代现场运维判断。</p>
        </section>

        <section class="energy-report-section">
          <h4 class="rpt-section__title">8 上期对比</h4>
          <div v-if="runtime.comparison" class="rpt-meta">
            <div class="rpt-meta__row">
              <span class="rpt-meta__label">期间在线率</span>
              <span class="rpt-meta__value">{{ runtime.comparison.onlineRatePrevious }}% → {{ runtime.onlineRate }}%</span>
            </div>
            <div class="rpt-meta__row">
              <span class="rpt-meta__label">数据完整率</span>
              <span class="rpt-meta__value">{{ runtime.comparison.completenessPrevious }}% → {{ runtime.completeness }}%</span>
            </div>
            <div class="rpt-meta__row">
              <span class="rpt-meta__label">通信成功率</span>
              <span class="rpt-meta__value">{{ runtime.comparison.commSuccessPrevious }}% → {{ runtime.commSuccess }}%</span>
            </div>
            <div class="rpt-meta__row">
              <span class="rpt-meta__label">告警记录数</span>
              <span class="rpt-meta__value">{{ runtime.comparison.alarmRecordsPrevious }} → {{ runtime.alarmSummary.records }} 条</span>
            </div>
          </div>
          <p v-else class="rpt-empty-inline">无上期同范围报告，暂不对比</p>
        </section>
      </template>
    </div>

    <template #footer>
      <a-button @click="closePreview">关闭</a-button>
      <a-button v-if="canExport" type="primary" :loading="exportingPdf" @click="handleExport">
        导出 PDF
      </a-button>
    </template>
  </a-modal>
</template>

<script setup lang="ts">
/**
 * PAGE-RPT-01 统计报表
 * 【原型说明】承载三类报告：安全报告 / 用能报告 / 系统运行报告。
 * ①报告类型页签 + 条件区（周期/期间/范围 + 生成报告）；
 * ②列表按类型隔离（一行 = 一个版本）；
 * ③预览浮层按类型呈现不同章节；④生成/重新生成新增版本，旧版本不变。
 * 入口按权限渲染：无 energy:report 整页无权限态；生成/重试/重新生成按 energy:report:generate、
 * 导出 PDF 按 energy:report:export，无权限时不渲染。
 */
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { message, TabPane, Tabs, TreeSelect } from 'antdv-next'
import type { TableColumnsType, TablePaginationConfig } from 'antdv-next'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import {
  CloudServerOutlined,
  DownloadOutlined,
  EyeOutlined,
  FileTextOutlined,
  LockOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  RedoOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
} from '@antdv-next/icons'
import EnergyBarChart from '../components/EnergyBarChart.vue'
import EnergyLineChart from '../components/EnergyLineChart.vue'
import { alarms } from '@/modules/alarm/store/storage'
import { ENERGY_DATA_VERSION, PERM, RANK_TOP_N, REPORT_TYPE_LABELS } from '../store/constants'
import {
  dailySeries,
  generateReport,
  hasPermission,
  meterStats,
  meters,
  persistReports,
  rankRows,
  reports,
  touItems,
  units,
} from '../store'
import type { ReportPeriod, ReportStatus, ReportType, ReportVersion, Series } from '../store/types'
import { ENERGY_DIAGNOSIS, RUNTIME_REPORT, SAFETY_REPORT } from '../mock/seed'

const router = useRouter()

/* ---------- 权限：页面级 + 按钮级 ---------- */
const canView = computed(() => hasPermission(PERM.report))
const canGenerate = computed(() => hasPermission(PERM.reportGenerate))
const canExport = computed(() => hasPermission(PERM.reportExport))

function goHome() {
  router.push('/dashboard')
}

/* ---------- 报告类型页签 ---------- */
const reportTypes = [
  { value: 'safety' as ReportType, label: REPORT_TYPE_LABELS.safety },
  { value: 'energy' as ReportType, label: REPORT_TYPE_LABELS.energy },
  { value: 'runtime' as ReportType, label: REPORT_TYPE_LABELS.runtime },
]
const activeType = ref<ReportType>('safety')

/** 企业根节点名称：默认报告范围，也是历史演示报告的范围快照 */
const ENTERPRISE_NAME = '南京伊米特电子科技技术有限公司'

/** 每类报告在本次会话内记住周期/期间；报告范围跨报告类型共享 */
type ConditionState = { period: ReportPeriod; periodValue: Dayjs }
const lastMonth = dayjs().subtract(1, 'month').startOf('month')
const conditionCache: Record<ReportType, ConditionState> = {
  safety: { period: 'monthly', periodValue: lastMonth.clone() },
  energy: { period: 'monthly', periodValue: lastMonth.clone() },
  runtime: { period: 'monthly', periodValue: lastMonth.clone() },
}

const period = ref<ReportPeriod>(conditionCache.safety.period)
const periodValue = ref<Dayjs>(conditionCache.safety.periodValue.clone())
const rangeUnitId = ref<string | null>('U-ENTERPRISE')

const annualDisabled = computed(() => activeType.value === 'runtime')
const ANNUAL_HINT = '年报将在上下线与通讯长期汇总就绪后开放'

const typeHint = computed(() => {
  if (activeType.value === 'safety') {
    return '安全报告基于告警事件与电表侧电气参数生成；评分口径见报告附录，不替代法定安全检测。'
  }
  if (activeType.value === 'runtime') {
    return '系统运行报告按月生成；在线率与通信指标受上下线/通讯日志 30 天保留期限制。'
  }
  return '用能报告沿用统一用电统计口径；统计范围未确认时，仅展示所选电表读数合计。'
})

function saveCondition(type: ReportType) {
  conditionCache[type] = {
    period: period.value,
    periodValue: periodValue.value.clone(),
  }
}

function loadCondition(type: ReportType) {
  const next = conditionCache[type]
  period.value = next.period
  periodValue.value = next.periodValue.clone()
}

function handleTypeChange(key: string | number) {
  const next = key as ReportType
  if (next === activeType.value) return
  saveCondition(activeType.value)
  activeType.value = next
  loadCondition(next)
  page.value = 1
}

/** 切换周期时把期间对齐到月/年起点；系统运行报告不允许年报 */
watch(period, (value) => {
  if (value === 'annual') {
    periodValue.value = periodValue.value.startOf('year')
  } else {
    periodValue.value = periodValue.value.startOf('month')
  }
})

watch(annualDisabled, (disabled) => {
  if (disabled && period.value === 'annual') period.value = 'monthly'
})

/** 统计期间文本 */
const periodText = computed(() =>
  period.value === 'monthly' ? periodValue.value.format('YYYY年M月') : periodValue.value.format('YYYY年'),
)

/** 范围：当前成员可见的用能单元（原型取演示用能单元树），默认选中可见范围顶层节点 */
function unitPath(id: string): string {
  const names: string[] = []
  let cursor: string | null = id
  while (cursor) {
    const node = units.find((unit) => unit.id === cursor)
    if (!node) break
    names.unshift(node.name)
    cursor = node.parentId
  }
  return names.join(' / ')
}

/** 组织树：企业 → 组织单元 → 用能单元；任意节点可选 */
type ScopeTreeNode = {
  value: string
  key: string
  title: string
  children?: ScopeTreeNode[]
}

const SCOPE_KIND_LABEL: Record<'root' | 'org' | 'unit', string> = {
  root: '企业',
  org: '组织单元',
  unit: '用能单元',
}

function buildScopeTree(parentId: string | null): ScopeTreeNode[] {
  return units
    .filter((unit) => unit.parentId === parentId)
    .map((unit) => {
      const children = buildScopeTree(unit.id)
      return {
        value: unit.id,
        key: unit.id,
        title: unit.name,
        children: children.length ? children : undefined,
      }
    })
}

const scopeTreeData = computed(() => buildScopeTree(null))
const rangePath = computed(() => (rangeUnitId.value ? unitPath(rangeUnitId.value) : '—'))
const scopeNode = computed(() => units.find((unit) => unit.id === rangeUnitId.value) ?? null)
const scopeLevel = computed(() => scopeNode.value?.kind ?? 'root')
const isUnitScope = computed(() => scopeLevel.value === 'unit')
const scopeKindLabel = computed(() => SCOPE_KIND_LABEL[scopeLevel.value])

/** 选中节点及其全部下级节点（含组织节点上挂的设备）；企业/组织单元汇总子树，用能单元只统计自身 */
function collectScopeNodeIds(nodeId: string, acc: Set<string>) {
  const node = units.find((unit) => unit.id === nodeId)
  if (!node) return
  acc.add(node.id)
  units
    .filter((unit) => unit.parentId === nodeId)
    .forEach((child) => collectScopeNodeIds(child.id, acc))
}

const scopeUnitIds = computed(() => {
  const ids = new Set<string>()
  if (rangeUnitId.value) collectScopeNodeIds(rangeUnitId.value, ids)
  return ids
})

/** 当前范围内的设备/电表；用于设备数、告警、用能汇总与安全/运行报告取数 */
const scopedMeters = computed(() => meters.filter((meter) => scopeUnitIds.value.has(meter.unitId)))
const scopedMeterLicenses = computed(() => new Set(scopedMeters.value.map((meter) => meter.license)))
const scopeDeviceCount = computed(() => scopedMeters.value.length)
const scopeHasDevices = computed(() => scopeDeviceCount.value > 0)

/** 列表「范围」列：优先取报告生成时的快照，缺失时按企业级历史报告处理 */
function scopeOf(record: ReportVersion) {
  return record.scope || ENTERPRISE_NAME
}

/** 生成报告需具备权限、期间与范围；范围无设备在点击时提示 */
const canSubmit = computed(() => canGenerate.value && Boolean(periodText.value) && Boolean(rangeUnitId.value))

/* ---------- 报告列表 ---------- */
const loading = ref(true)
const page = ref(1)
const pageSize = ref(20)

onMounted(() => {
  loading.value = true
  // 【原型说明】模拟列表加载耗时，无真实接口调用
  window.setTimeout(() => {
    loading.value = false
  }, 420)
})

/** 当前类型报告：按生成时间倒序，最新版本在最上方 */
const currentReports = computed(() =>
  reports
    .filter((item) => item.type === activeType.value)
    .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt)),
)

/** 同一「类型 + 周期 + 期间 + 范围」下的最高版本号，用于最新版本加粗 */
const latestVersionIds = computed(() => {
  const maxByGroup = new Map<string, number>()
  reports.forEach((item) => {
    const key = `${item.type}-${item.period}-${item.periodText}-${item.scope || ENTERPRISE_NAME}`
    maxByGroup.set(key, Math.max(maxByGroup.get(key) ?? 0, item.version))
  })
  return new Set(
    reports
      .filter(
        (item) =>
          item.version ===
          maxByGroup.get(`${item.type}-${item.period}-${item.periodText}-${item.scope || ENTERPRISE_NAME}`),
      )
      .map((item) => item.id),
  )
})

const generatingCount = computed(
  () => reports.filter((item) => item.type === activeType.value && item.status === 'generating').length,
)

/** 生成中行内进度：随 store 的异步完成同步推进 */
const progressMap = reactive<Record<string, number>>({})
let progressTimer: number | null = null

function stopProgress() {
  if (progressTimer !== null) {
    window.clearInterval(progressTimer)
    progressTimer = null
  }
}

function syncProgress() {
  const generatingIds = reports.filter((item) => item.status === 'generating').map((item) => item.id)
  generatingIds.forEach((id) => {
    if (progressMap[id] === undefined) progressMap[id] = 0
  })
  Object.keys(progressMap).forEach((id) => {
    if (!generatingIds.includes(id)) delete progressMap[id]
  })
  if (generatingIds.length && progressTimer === null) {
    progressTimer = window.setInterval(() => {
      if (!Object.keys(progressMap).length) {
        stopProgress()
        return
      }
      Object.keys(progressMap).forEach((id) => {
        progressMap[id] = Math.min(96, progressMap[id] + 5)
      })
    }, 120)
  }
  if (!generatingIds.length) stopProgress()
}

watch(() => reports.map((item) => `${item.id}:${item.status}`).join(','), syncProgress, { immediate: true })
onUnmounted(stopProgress)

/** 列：7 列全定宽，合计 1190px（scroll.x 同值） */
const columns: TableColumnsType<ReportVersion> = [
  { title: '报告名称', key: 'name', dataIndex: 'name', width: 330, ellipsis: true },
  { title: '范围', key: 'scope', width: 240, ellipsis: true },
  { title: '统计期间', key: 'periodText', dataIndex: 'periodText', width: 120 },
  { title: '版本', key: 'version', width: 80 },
  { title: '生成时间', key: 'generatedAt', dataIndex: 'generatedAt', width: 150 },
  { title: '状态', key: 'status', width: 110 },
  { title: '操作', key: 'action', width: 160 },
]

const paginationConfig = computed<TablePaginationConfig>(() => ({
  current: page.value,
  pageSize: pageSize.value,
  size: 'small' as const,
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50', '100'],
  showTotal: (total: number) => `共 ${total} 条`,
  hideOnSinglePage: false,
}))

function handleTableChange(pagination: TablePaginationConfig) {
  page.value = pagination.current ?? 1
  pageSize.value = pagination.pageSize ?? 20
}

function statusText(status: ReportStatus) {
  if (status === 'generating') return '生成中'
  if (status === 'failed') return '生成失败'
  return '已生成'
}

function statusColor(status: ReportStatus) {
  if (status === 'generating') return 'processing'
  if (status === 'failed') return 'error'
  return 'success'
}

function reportTypeLabel(type: ReportType) {
  return REPORT_TYPE_LABELS[type]
}

const emptyIcon = computed(() => {
  if (activeType.value === 'safety') return SafetyCertificateOutlined
  if (activeType.value === 'runtime') return CloudServerOutlined
  return FileTextOutlined
})

const emptyTitle = computed(() => {
  if (activeType.value === 'safety') return '暂无安全报告'
  if (activeType.value === 'runtime') return '暂无系统运行报告'
  return '暂无用能报告'
})

/* ---------- 生成 / 重新生成 / 重试（均不二次确认） ---------- */
const generatingBusy = ref(false)

function handleGenerate() {
  if (!canSubmit.value) {
    if (!rangeUnitId.value) message.warning('请选择范围')
    else if (!periodText.value) message.warning('请选择报告期间')
    return
  }
  if (!scopeHasDevices.value) {
    message.warning('当前范围暂无设备，无法生成报告')
    return
  }
  generatingBusy.value = true
  generateReport(activeType.value, period.value, periodText.value, rangePath.value, rangeUnitId.value || '')
  window.setTimeout(() => {
    generatingBusy.value = false
  }, 600)
  window.setTimeout(() => {
    message.success('报告已生成')
  }, 1800)
}

function handleRegenerate(record: ReportVersion) {
  if (!canGenerate.value) return
  const report = generateReport(
    record.type,
    record.period,
    record.periodText,
    record.scope || ENTERPRISE_NAME,
    record.scopeId || 'U-ENTERPRISE',
  )
  window.setTimeout(() => {
    message.success(`已生成新版本 v${report.version}`)
  }, 1800)
}

/** 生成失败行「重试」：将该版本重新触发生成（不新增版本） */
function handleRetry(record: ReportVersion) {
  if (!canGenerate.value) return
  record.status = 'generating'
  record.sizeText = '—'
  persistReports()
  window.setTimeout(() => {
    record.status = 'generated'
    record.sizeText = record.type === 'safety' ? '2.1 MB' : record.type === 'runtime' ? '1.4 MB' : '1.9 MB'
    persistReports()
    message.success('报告已生成')
  }, 1800)
}

/* ---------- 导出 PDF ---------- */
const exportingPdf = ref(false)

function handleExport() {
  if (!canExport.value) return
  exportingPdf.value = true
  // 【原型说明】模拟 PDF 生成耗时，无真实导出接口
  window.setTimeout(() => {
    exportingPdf.value = false
    message.success('已开始导出 PDF')
  }, 400)
}

/* ---------- OVERLAY-RPT-PREVIEW 报告预览浮层 ---------- */
const previewOpen = ref(false)
const previewId = ref<string | null>(null)
const previewReport = computed(() => reports.find((item) => item.id === previewId.value) ?? null)
const previewRange = computed(() => (previewReport.value ? scopeOf(previewReport.value) : rangePath.value))
const previewScopeKindLabel = computed(() => {
  const scope = previewReport.value?.scope || ENTERPRISE_NAME
  if (scope === ENTERPRISE_NAME) return '企业'
  const node = units.find((unit) => unitPath(unit.id) === scope)
  return node ? SCOPE_KIND_LABEL[node.kind] : '—'
})
/** 内容区最大高 calc(100vh - 200px)；超长时内容区滚动、操作区固定 */
const modalStyles = { body: { maxHeight: 'calc(100vh - 200px)', overflow: 'auto' } }
const dataVersion = ENERGY_DATA_VERSION
const rankTopN = RANK_TOP_N

/** 预览时临时还原报告快照范围，关闭后恢复用户当前选择 */
const scopeBeforePreview = ref<string | null>(null)

function scopeIdFromPath(scope?: string) {
  if (!scope || scope === ENTERPRISE_NAME) return 'U-ENTERPRISE'
  return units.find((unit) => unitPath(unit.id) === scope)?.id ?? 'U-ENTERPRISE'
}

function handlePreview(record: ReportVersion) {
  scopeBeforePreview.value = rangeUnitId.value
  rangeUnitId.value = record.scopeId || scopeIdFromPath(record.scope)
  previewId.value = record.id
  previewOpen.value = true
}

function closePreview() {
  previewOpen.value = false
}

watch(previewOpen, (open) => {
  if (!open && scopeBeforePreview.value !== null) {
    rangeUnitId.value = scopeBeforePreview.value
    scopeBeforePreview.value = null
  }
})

/* ---------- 三类报告内容（按范围子树重算；演示数据为只读快照口径） ---------- */
const isEnterpriseScope = computed(() => scopeLevel.value === 'root')

/** 安全报告：按范围过滤隐患设备/建议，并按小样本规则决定是否输出评分 */
const scopedSafetyTopDevices = computed(() =>
  SAFETY_REPORT.topDevices.filter((item) => scopeUnitIds.value.has(item.unitId)),
)
const scopedSafetyRecommendations = computed(() =>
  SAFETY_REPORT.recommendations.filter((item) => scopeUnitIds.value.has(item.unitId)),
)
const safetyHighEvents = computed(() => scopedSafetyTopDevices.value.reduce((sum, item) => sum + item.high, 0))
const safetyMidEvents = computed(() => scopedSafetyTopDevices.value.reduce((sum, item) => sum + item.mid, 0))
const safetyCoverage = computed(() => SAFETY_REPORT.dataCoverage)
const safetySampleSmall = computed(() => scopeDeviceCount.value >= 5 && scopeDeviceCount.value <= 9)
const safetyScoreAvailable = computed(() => scopeDeviceCount.value >= 5 && safetyCoverage.value >= 70)

const computedSafetyScore = computed(() => {
  const highDeduction = Math.min(50, safetyHighEvents.value * 6)
  const midDeduction = Math.min(30, safetyMidEvents.value * 2)
  const dataDeduction =
    safetyCoverage.value < 95 ? Math.min(10, (95 - safetyCoverage.value) * 100 * 0.005) : 0
  return Math.max(0, Number((100 - highDeduction - midDeduction - dataDeduction).toFixed(1)))
})

function levelFromScore(score: number) {
  if (score >= 90) return '良好'
  if (score >= 75) return '需关注'
  if (score >= 60) return '预警'
  return '高风险'
}

const safetyDistribution = computed(() => {
  if (isUnitScope.value) {
    return scopedSafetyTopDevices.value.map((item) => ({
      name: item.name,
      value: item.high + item.mid,
      color: item.high > 0 ? '#ff4d4f' : '#faad14',
    }))
  }
  const grouped = new Map<string, number>()
  scopedSafetyTopDevices.value.forEach((item) => {
    grouped.set(item.unit, (grouped.get(item.unit) ?? 0) + item.high + item.mid)
  })
  return [...grouped.entries()].map(([name, value]) => ({ name, value, color: '#0f7b6c' }))
})

const safety = computed(() => ({
  ...SAFETY_REPORT,
  score: safetyScoreAvailable.value ? computedSafetyScore.value : null,
  level: safetyScoreAvailable.value ? levelFromScore(computedSafetyScore.value) : '样本不足',
  previousScore: isEnterpriseScope.value ? SAFETY_REPORT.previousScore : null,
  highRiskEvents: safetyHighEvents.value,
  midRiskEvents: safetyMidEvents.value,
  involvedDevices: scopedSafetyTopDevices.value.length,
  involvedUnits: isUnitScope.value ? 1 : new Set(scopedSafetyTopDevices.value.map((item) => item.unitId)).size,
  shouldCollectDevices: scopeDeviceCount.value,
  alarmRecordCount: scopedAlarms.value.length,
  alarmDeviceCount: new Set(scopedAlarms.value.map((item) => item.meterLicense)).size,
  topDevices: scopedSafetyTopDevices.value,
  recommendations: scopedSafetyRecommendations.value,
  parameters: SAFETY_REPORT.parameters,
  eventCategories: SAFETY_REPORT.eventCategories,
  trend: SAFETY_REPORT.trend,
  deviceStatus: {
    onlineSnapshot: onlineSnapshot.value,
    offlineSnapshot: offlineSnapshot.value,
    offlineEverCount: offlineEverCount.value,
    alarmDeviceCount: new Set(scopedAlarms.value.map((item) => item.meterLicense)).size,
    highRiskDevices: scopedSafetyTopDevices.value.filter((item) => item.high > 0).length,
    missingDevices: scopedMeters.value.filter((meter) => meter.isGateway).length,
  },
  comparison: isEnterpriseScope.value ? SAFETY_REPORT.comparison : null,
  sampleSmall: safetySampleSmall.value,
  scoreAvailable: safetyScoreAvailable.value,
}))

const safetyLevelTone = computed(() => {
  const map: Record<string, string> = { 良好: 'success', 需关注: 'warning', 预警: 'info', 高风险: 'danger', 样本不足: 'muted' }
  return map[safety.value.level] ?? 'warning'
})

/** 系统运行报告：按范围过滤设备/通信/告警，并按小样本规则决定是否输出运行状态 */
const runtimeSampleSmall = computed(() => scopeDeviceCount.value >= 5 && scopeDeviceCount.value <= 9)
const runtimeStatusAvailable = computed(() => scopeDeviceCount.value >= 5)
const scopedRuntimeTopOffline = computed(() =>
  RUNTIME_REPORT.topOffline.filter((item) => scopeUnitIds.value.has(item.unitId)),
)
const scopedRuntimeTopMissing = computed(() =>
  RUNTIME_REPORT.dataQuality.topMissing.filter((item) => scopeUnitIds.value.has(item.unitId)),
)
const scopedRuntimeCommDevices = computed(() =>
  RUNTIME_REPORT.communication.topDevices.filter((item) => scopeUnitIds.value.has(item.unitId)),
)
const scopedRuntimeRecommendations = computed(() =>
  RUNTIME_REPORT.recommendations.filter((item) => scopeUnitIds.value.has(item.unitId)),
)
const runtimeAlarmTopTypes = computed(() => {
  const grouped = new Map<string, number>()
  scopedAlarms.value.forEach((item) => grouped.set(item.eventType, (grouped.get(item.eventType) ?? 0) + 1))
  return [...grouped.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
})
const runtimeAlarmTopDevices = computed(() => {
  const grouped = new Map<string, { name: string; unitId: string; count: number }>()
  scopedAlarms.value.forEach((item) => {
    const current = grouped.get(item.meterName)
    if (current) current.count += 1
    else grouped.set(item.meterName, { name: item.meterName, unitId: item.unitId, count: 1 })
  })
  return [...grouped.values()].sort((a, b) => b.count - a.count).slice(0, 3)
})
const runtimeScale = computed(() => scopeDeviceCount.value / (RUNTIME_REPORT.deviceTotal || 1))

const runtime = computed(() => ({
  ...RUNTIME_REPORT,
  status: runtimeStatusAvailable.value ? RUNTIME_REPORT.status : '样本不足',
  deviceTotal: scopeDeviceCount.value,
  onlineSnapshot: onlineSnapshot.value,
  offlineSnapshot: offlineSnapshot.value,
  offlineEverCount: offlineEverCount.value,
  offlineCount: scopedRuntimeTopOffline.value.reduce((sum, item) => sum + item.count, 0),
  offlineDuration: scopedRuntimeTopOffline.value.map((item) => item.duration).join(' + ') || '—',
  addedDevices: isEnterpriseScope.value ? RUNTIME_REPORT.addedDevices : 0,
  removedDevices: 0,
  noOnlineFact: 0,
  topOffline: scopedRuntimeTopOffline.value,
  dataQuality: {
    ...RUNTIME_REPORT.dataQuality,
    shouldPoints: Math.round(RUNTIME_REPORT.dataQuality.shouldPoints * runtimeScale.value),
    validPoints: Math.round(RUNTIME_REPORT.dataQuality.validPoints * runtimeScale.value),
    missingPoints: Math.round(RUNTIME_REPORT.dataQuality.missingPoints * runtimeScale.value),
    estimatedPoints: Math.round(RUNTIME_REPORT.dataQuality.estimatedPoints * runtimeScale.value),
    abnormalPoints: Math.round(RUNTIME_REPORT.dataQuality.abnormalPoints * runtimeScale.value),
    topMissing: scopedRuntimeTopMissing.value,
  },
  communication: {
    ...RUNTIME_REPORT.communication,
    messages: Math.round(RUNTIME_REPORT.communication.messages * runtimeScale.value),
    failed: Math.round(RUNTIME_REPORT.communication.failed * runtimeScale.value),
    topDevices: scopedRuntimeCommDevices.value,
  },
  alarmSummary: {
    records: scopedAlarms.value.length,
    devices: new Set(scopedAlarms.value.map((item) => item.meterLicense)).size,
    topTypes: runtimeAlarmTopTypes.value,
    topDevices: runtimeAlarmTopDevices.value,
  },
  recommendations: scopedRuntimeRecommendations.value,
  comparison: isEnterpriseScope.value ? RUNTIME_REPORT.comparison : null,
  sampleSmall: runtimeSampleSmall.value,
  statusAvailable: runtimeStatusAvailable.value,
}))

const runtimeTone = computed(() => {
  const map: Record<string, string> = { 正常: 'success', 关注: 'warning', 异常: 'danger', 暂不判定: 'muted', 样本不足: 'muted' }
  return map[runtime.value.status] ?? 'muted'
})

const safetyCategoryItems = computed(() =>
  safety.value.eventCategories.map((item) => ({
    name: item.name,
    value: item.high + item.mid,
    color: item.high > 0 ? '#ff4d4f' : '#faad14',
  })),
)

const safetyTrendSeries = computed<Series>(() => ({
  name: '告警记录数',
  color: '#0f7b6c',
  points: safety.value.trend.map((item) => ({ label: item.label, value: item.value, quality: 'valid' as const })),
}))
const safetyTrendSeriesList = computed(() => [safetyTrendSeries.value])

const runtimeTrendSeries = computed<Series>(() => ({
  name: '数据完整率',
  color: '#0f7b6c',
  points: runtime.value.dataQuality.trend.map((item) => ({ label: item.label, value: item.value, quality: 'valid' as const })),
}))
const runtimeTrendSeriesList = computed(() => [runtimeTrendSeries.value])

const diagnosisList = computed(() => {
  if (isUnitScope.value) {
    return ENERGY_DIAGNOSIS.slice(0, 2).map((item) => ({ ...item, scope: rangePath.value }))
  }
  return ENERGY_DIAGNOSIS
})

/* ---------- 用能报告内容（按范围子树重算） ---------- */
const scopedRankRows = computed(() => rankRows.value.filter((row) => scopeUnitIds.value.has(row.unitId)))
const scopeCurrentTotal = computed(() => rankRows.value.reduce((sum, row) => sum + row.current, 0) || 1)
const scopeRatio = computed(() => periodTotal.value / scopeCurrentTotal.value)

/** 按范围等比折算趋势，仅用于原型演示「范围切换后趋势随之变化」 */
const scopedDailySeries = computed<Series>(() => ({
  ...dailySeries,
  name: `${dailySeries.name}（${scopeKindLabel.value}）`,
  points: dailySeries.points.map((point) => ({
    ...point,
    value: point.value === null ? null : Math.round(point.value * scopeRatio.value),
  })),
}))

const validDays = computed(() => scopedDailySeries.value.points.filter((point) => point.quality === 'valid').length)
const totalDays = computed(() => scopedDailySeries.value.points.length)

const completenessText = computed(() => {
  const total = scopedDailySeries.value.points.length || 1
  const valid = scopedDailySeries.value.points.filter((point) => point.quality === 'valid').length
  return `${((valid / total) * 100).toFixed(1)}%`
})

const statConfirmed = computed(() => {
  const scopeUnits = units.filter((unit) => unit.kind === 'unit' && scopeUnitIds.value.has(unit.id))
  if (isUnitScope.value) {
    const config = rangeUnitId.value ? meterStats[rangeUnitId.value] : undefined
    if (!config) return '未设置用电统计口径（仅展示所选电表读数合计）'
    return config.confirmed ? '用电统计口径已确认' : '用电统计口径未确认'
  }
  const confirmed = scopeUnits.filter((unit) => meterStats[unit.id]?.confirmed).length
  return `按下级用能单元口径汇总（${confirmed}/${scopeUnits.length} 个单元已确认）`
})

/** 期间总用电与「重点对象」同一口径（范围子树本期合计），保证报告内部数值一致 */
const periodTotal = computed(() => scopedRankRows.value.reduce((sum, row) => sum + row.current, 0))
/** 分时构成按同一期间总量等比折算，避免与总量口径不一致 */
const touScaled = computed(() => {
  const base = touItems.reduce((sum, item) => sum + item.value, 0) || 1
  return touItems.map((item) => ({ ...item, value: Math.round((item.value / base) * periodTotal.value) }))
})
/** 日均用电：按有效天数（与完整率同口径） */
const dailyAverage = computed(() => Math.round(periodTotal.value / (validDays.value || 1)))

/** 报告内同比环比：与「本期合计」同一去重口径 */
const previousTotal = computed(() => scopedRankRows.value.reduce((sum, row) => sum + row.previous, 0))
const deltaValue = computed(() => periodTotal.value - previousTotal.value)
const deltaRatePct = computed<number | null>(() =>
  previousTotal.value === 0 ? null : Number(((deltaValue.value / previousTotal.value) * 100).toFixed(1)),
)
const deltaText = computed(() => `${deltaValue.value > 0 ? '+' : ''}${deltaValue.value.toLocaleString('en-US')}`)
const deltaRateText = computed(() =>
  deltaRatePct.value === null ? '—' : `${deltaRatePct.value > 0 ? '+' : ''}${deltaRatePct.value.toFixed(1)}`,
)
const peakItem = computed(() =>
  touScaled.value.reduce((max, item) => (item.value > max.value ? item : max), touScaled.value[0]),
)
const valleyItem = computed(() =>
  touScaled.value.reduce((min, item) => (item.value < min.value ? item : min), touScaled.value[0]),
)

/** 期末在线 / 离线快照（演示口径：按范围内设备统计） */
const onlineSnapshot = computed(() => scopedMeters.value.filter((meter) => !meter.isGateway).length)
const offlineSnapshot = computed(() => scopedMeters.value.filter((meter) => meter.isGateway).length)
/** 【原型说明】演示数据未提供期间离线事件历史；按范围内设备数收敛，正式实现按期间内离线事件去重统计 */
const offlineEverCount = computed(() => Math.min(2, scopedMeters.value.length))

const focusRows = computed(() => scopedRankRows.value.slice(0, RANK_TOP_N))

/** 告警摘要：按范围子树过滤，按期间记录数与按设备去重 */
const scopedAlarms = computed(() => alarms.filter((item) => scopedMeterLicenses.value.has(item.meterLicense)))
const alarmRecordCount = computed(() => scopedAlarms.value.length)
const alarmDeviceCount = computed(() => new Set(scopedAlarms.value.map((item) => item.meterLicense)).size)

/* ---------- 条件变化时回到第 1 页 ---------- */
watch([period, rangeUnitId, periodText], () => {
  page.value = 1
})
</script>

<style scoped>
/* ---------- 报告类型页签 ---------- */
.rpt-tabs {
  padding: 0 20px;
  margin-bottom: 12px;
}

.rpt-tabs__inner :deep(.ant-tabs-nav) {
  margin-bottom: 0;
}

.rpt-tabs__inner :deep(.ant-tabs-tab) {
  padding: 14px 0;
  font-size: 14px;
  color: rgba(0, 0, 0, 0.65);
}

.rpt-tabs__inner :deep(.ant-tabs-tab-active .ant-tabs-tab-btn) {
  color: #0f7b6c;
  font-weight: 600;
}

.rpt-tabs__inner :deep(.ant-tabs-ink-bar) {
  background: #0f7b6c;
}

.rpt-tabs__inner :deep(.ant-tabs-tab + .ant-tabs-tab) {
  margin-left: 28px;
}

/* ---------- 条件区 ---------- */
.rpt-control {
  width: 100%;
}

.energy-toolbar__item {
  flex: 1 1 0;
}

.rpt-label-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.rpt-label-row__icon {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
  cursor: help;
}

.rpt-type-hint {
  flex: 1 0 100%;
  margin: 2px 0 0;
  font-size: 12px;
  line-height: 1.7;
  color: rgba(0, 0, 0, 0.45);
}

/* ---------- 列表容器 ---------- */
.rpt-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1 1 auto;
  min-height: 320px;
}

.rpt-list__skeleton {
  padding: 8px 0;
}

.rpt-cell__name {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: rgba(0, 0, 0, 0.88);
}

.rpt-cell__version--latest {
  font-weight: 600;
  color: #0f7b6c;
}

.rpt-cell__time {
  font-variant-numeric: tabular-nums;
  color: rgba(0, 0, 0, 0.65);
}

.rpt-progress {
  width: 90px;
  margin-top: 4px;
}

/* 操作列：图标按钮 + tooltip，颜色区分操作类型；文字只用于 tooltip 与读屏 */
.rpt-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.rpt-action-btn {
  width: 32px;
  height: 32px;
  padding: 0;
  border-radius: 8px;
  font-size: 16px;
}

.rpt-action-btn--preview {
  color: #0f7b6c;
}

.rpt-action-btn--preview:hover {
  color: #0b5f54;
  background: #ecf4f3;
}

.rpt-action-btn--export {
  color: #1677ff;
}

.rpt-action-btn--export:hover {
  color: #0958d9;
  background: #e6f4ff;
}

.rpt-action-btn--regenerate {
  color: #d48806;
}

.rpt-action-btn--regenerate:hover {
  color: #ad6800;
  background: #fffbe6;
}

.rpt-action-btn--retry {
  color: #ff4d4f;
}

.rpt-action-btn--retry:hover {
  color: #cf1322;
  background: #fff1f0;
}

/* 表格：表头浅底、行悬停底色、单元格内边距按视觉 token */
.rpt-table :deep(.ant-table) {
  font-size: 14px;
}

.rpt-table :deep(.ant-table-thead > tr > th) {
  padding: 11px 14px;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  color: rgba(0, 0, 0, 0.65);
  background: #f7faf9;
  border-bottom: 1px solid #eaf0ef;
}

.rpt-table :deep(.ant-table-thead > tr > th::before) {
  display: none;
}

.rpt-table :deep(.ant-table-tbody > tr > td) {
  padding: 13px 14px;
  vertical-align: middle;
  border-bottom: 1px solid #f4f7f6;
}

.rpt-table :deep(.ant-table-tbody > tr:last-child > td) {
  border-bottom: none;
}

.rpt-table :deep(.ant-table-tbody > tr:hover > td) {
  background: #f8fbfa;
}

.rpt-table :deep(.ant-table-tbody > tr > td .ant-btn-variant-link) {
  padding-inline: 0;
}

.rpt-table :deep(.ant-table-pagination.ant-pagination) {
  margin: 16px 0 0;
}

/* ---------- 预览浮层 ---------- */
.rpt-modal-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rpt-modal-title__name {
  font-size: 14px;
  color: rgba(0, 0, 0, 0.88);
}

.rpt-modal-title__ver {
  padding: 1px 6px;
  font-size: 12px;
  color: #0f7b6c;
  background: #ecf4f3;
  border-radius: 8px;
}

.rpt-modal-body {
  display: flex;
  flex-direction: column;
}

.rpt-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 24px;
  width: 100%;
}

.rpt-meta__row {
  display: flex;
  gap: 8px;
  font-size: 13px;
  line-height: 22px;
}

.rpt-meta__label {
  flex: none;
  width: 150px;
  color: rgba(0, 0, 0, 0.65);
}

.rpt-meta__value {
  flex: 1 1 auto;
  min-width: 0;
  color: rgba(0, 0, 0, 0.88);
  word-break: break-all;
}

.rpt-type-tag {
  display: inline-block;
  padding: 0 6px;
  font-size: 12px;
  line-height: 20px;
  color: #0f7b6c;
  background: #ecf4f3;
  border-radius: 6px;
}

.rpt-section__title {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.88);
}

.rpt-cell__scope {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
}

.rpt-hint {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.7;
  color: rgba(0, 0, 0, 0.45);
}

.rpt-scope-warning {
  flex: 1 0 100%;
  margin: 2px 0 0;
  font-size: 12px;
  line-height: 1.7;
  color: #d48806;
}

/* 范围无设备时按钮置灰，明确不可生成 */
.rpt-generate-btn:disabled,
.rpt-generate-btn.ant-btn-disabled {
  background: rgba(0, 0, 0, 0.04);
  border-color: #d9d9d9;
  color: rgba(0, 0, 0, 0.25);
  box-shadow: none;
}

.rpt-content-state {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 16px;
  border-radius: 8px;
}

.rpt-content-state--muted {
  background: #fafafa;
  border: 1px solid #f0f0f0;
}

.rpt-content-state__title {
  font-size: 14px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.88);
}

.rpt-content-state__desc {
  font-size: 12px;
  line-height: 1.7;
  color: rgba(0, 0, 0, 0.45);
}

.rpt-sample-tip {
  margin: 8px 0 0;
  padding: 6px 10px;
  font-size: 12px;
  line-height: 1.7;
  color: #d48806;
  background: #fffbe6;
  border: 1px solid #ffe58f;
  border-radius: 6px;
}

.rpt-empty-inline {
  margin: 8px 0 0;
  padding: 12px;
  font-size: 12px;
  line-height: 1.7;
  text-align: center;
  color: rgba(0, 0, 0, 0.45);
  background: #fafafa;
  border: 1px dashed #e8e8e8;
  border-radius: 8px;
}

.rpt-metric-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 4px;
}

.rpt-metric-row--four {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.rpt-metric__label {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.65);
}

.rpt-metric__value {
  display: block;
  margin-top: 4px;
  font-size: 20px;
  font-weight: 600;
  line-height: 1.2;
  color: rgba(0, 0, 0, 0.88);
}

.rpt-metric__value--text {
  font-size: 13px;
  font-weight: 500;
  line-height: 1.8;
}

.rpt-metric__value em {
  margin-left: 4px;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  color: rgba(0, 0, 0, 0.45);
}

.rpt-subblock {
  margin-top: 14px;
}

.rpt-subblock__title {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.65);
}

/* 安全评分卡 */
.rpt-score-card {
  display: flex;
  align-items: stretch;
  gap: 24px;
  padding: 16px 20px;
  background: #ecf4f3;
  border-radius: 10px;
}

.rpt-score-card__main {
  flex: 0 0 250px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rpt-score-card__label {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.65);
}

.rpt-score-card__score {
  font-size: 42px;
  font-weight: 700;
  line-height: 1.1;
  color: #0f7b6c;
}

.rpt-score-card__score em {
  margin-left: 4px;
  font-size: 14px;
  font-style: normal;
  font-weight: 400;
  color: rgba(0, 0, 0, 0.45);
}

.rpt-score-card__side {
  flex: 1 1 auto;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  padding-left: 24px;
  border-left: 1px solid #d8e7e4;
}

.rpt-score-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rpt-score-item__label {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.65);
}

.rpt-score-item__value {
  font-size: 18px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.88);
}

.rpt-score-item__value--danger {
  color: #ff4d4f;
}

.rpt-score-item__value--warning {
  color: #faad14;
}

.rpt-level-tag {
  display: inline-block;
  align-self: flex-start;
  padding: 0 8px;
  font-size: 12px;
  line-height: 22px;
  border-radius: 6px;
}

.rpt-level-tag--success {
  color: #389e0d;
  background: #f6ffed;
}

.rpt-level-tag--warning {
  color: #d48806;
  background: #fffbe6;
}

.rpt-level-tag--info {
  color: #0958d9;
  background: #e6f4ff;
}

.rpt-level-tag--danger {
  color: #cf1322;
  background: #fff1f0;
}

/* 运行状态卡 */
.rpt-runtime-card {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 16px 20px;
  border-radius: 10px;
}

.rpt-runtime-card--success {
  background: #f6ffed;
  border: 1px solid #b7eb8f;
}

.rpt-runtime-card--warning {
  background: #fffbe6;
  border: 1px solid #ffe58f;
}

.rpt-runtime-card--danger {
  background: #fff1f0;
  border: 1px solid #ffa39e;
}

.rpt-runtime-card--muted {
  background: #fafafa;
  border: 1px solid #e8e8e8;
}

.rpt-runtime-card__main {
  flex: 0 0 250px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rpt-runtime-card__label {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.65);
}

.rpt-runtime-card__status {
  font-size: 30px;
  font-weight: 700;
  line-height: 1.2;
  color: rgba(0, 0, 0, 0.88);
}

.rpt-runtime-card__desc {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
}

.rpt-runtime-card__side {
  flex: 1 1 auto;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  padding-left: 24px;
  border-left: 1px solid rgba(0, 0, 0, 0.08);
}

/* 紧凑表格 */
.rpt-table-wrap {
  overflow-x: auto;
}

.rpt-param-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.rpt-param-table th,
.rpt-param-table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid #f4f7f6;
}

.rpt-param-table th {
  font-size: 12px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.65);
  background: #f7faf9;
}

.rpt-param-table tr:last-child td {
  border-bottom: none;
}

.rpt-param-table__muted {
  color: rgba(0, 0, 0, 0.45);
}

.rpt-mini-table {
  display: flex;
  flex-direction: column;
  font-size: 13px;
}

.rpt-mini-table__head,
.rpt-mini-table__row {
  display: grid;
  grid-template-columns: 1.6fr 0.4fr 0.4fr 1fr 1.2fr;
  gap: 12px;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f4f7f6;
}

.rpt-mini-table--offline .rpt-mini-table__head,
.rpt-mini-table--offline .rpt-mini-table__row {
  grid-template-columns: 1.8fr 0.7fr 0.7fr 1fr;
}

.rpt-mini-table__head {
  font-size: 12px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.65);
}

.rpt-mini-table__row:last-child {
  border-bottom: none;
}

.rpt-mini-table__name {
  display: flex;
  flex-direction: column;
  min-width: 0;
  color: rgba(0, 0, 0, 0.88);
}

.rpt-mini-table__name em {
  font-size: 12px;
  font-style: normal;
  color: rgba(0, 0, 0, 0.45);
}

.rpt-mini-table__danger {
  color: #ff4d4f;
  font-weight: 600;
}

.rpt-mini-table__warning {
  color: #faad14;
  font-weight: 600;
}

.rpt-mini-table__ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: rgba(0, 0, 0, 0.65);
}

/* 建议列表 */
.rpt-recommend {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.rpt-recommend__item {
  padding: 12px 14px;
  background: #fbfdfc;
  border: 1px solid #eef2f1;
  border-radius: 8px;
}

.rpt-recommend__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.rpt-recommend__title {
  flex: 1 1 auto;
  font-size: 13px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.88);
}

.rpt-recommend__recheck {
  flex: none;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
}

.rpt-recommend__line {
  margin: 2px 0;
  font-size: 12px;
  line-height: 1.8;
  color: rgba(0, 0, 0, 0.65);
}

.rpt-recommend__line b {
  color: rgba(0, 0, 0, 0.88);
  font-weight: 600;
}

.rpt-tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.rpt-source-tag {
  display: inline-block;
  padding: 1px 8px;
  font-size: 12px;
  line-height: 20px;
  color: rgba(0, 0, 0, 0.65);
  background: #f4f7f6;
  border-radius: 6px;
}

.rpt-rank {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rpt-rank__row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
}

.rpt-rank__no {
  flex: none;
  width: 20px;
  height: 20px;
  font-size: 12px;
  line-height: 20px;
  text-align: center;
  color: rgba(0, 0, 0, 0.65);
  background: #f4f7f6;
  border-radius: 50%;
}

.rpt-rank__no--top {
  color: #fff;
  background: #0f7b6c;
}

.rpt-rank__name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: rgba(0, 0, 0, 0.88);
}

.rpt-rank__value {
  flex: none;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.88);
}
</style>
