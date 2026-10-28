<template>
  <!-- 无 `system:branding` 权限点：整页无权限空态（STATE-BRD-09） -->
  <div v-if="!canView" class="page-container brand-page">
    <div class="brand-page__denied">
      <a-empty description="当前账号无权限访问品牌设置" />
      <a-button type="primary" @click="router.push('/dashboard')">返回</a-button>
    </div>
  </div>

  <div v-else class="page-container brand-page">
    <!-- 页面标题区 -->
    <header class="brand-page__head">
      <div class="brand-page__head-main">
        <span class="brand-page__icon"><BgColorsOutlined /></span>
        <div class="brand-page__titles">
          <h1 class="brand-page__title">品牌设置</h1>
          <p class="brand-page__desc">自定义浏览器标签、登录页品牌与主界面框架，未配置项自动继承平台默认</p>
        </div>
      </div>
      <div class="brand-page__meta">
        <span class="brand-page__meta-label">最近更新</span>
        <span class="brand-page__meta-value">{{ lastUpdatedText }}</span>
      </div>
    </header>

    <div class="brand-page__hint">
      <InfoCircleOutlined />
      <span>品牌按分组独立生效；保存后立即全站发布，无需重新登录</span>
    </div>

    <!-- 保存 / 恢复结果：页面内联提示 -->
    <a-alert
      v-if="feedback"
      class="brand-page__feedback"
      :type="feedback.type"
      :message="feedback.text"
      show-icon
      closable
      @close="feedback = null"
    />

    <!-- STATE-BRD-08 加载失败 -->
    <section v-if="failed" class="brand-page__state">
      <span class="brand-page__state-icon"><DisconnectOutlined /></span>
      <p class="brand-page__state-title">品牌设置加载失败</p>
      <p class="brand-page__state-desc">网络异常或服务暂时不可用，请稍后重试</p>
      <a-button type="primary" @click="loadData">
        <template #icon><ReloadOutlined /></template>
        重新加载
      </a-button>
    </section>

    <!-- STATE-BRD-01 加载中 -->
    <div v-else-if="loading" class="brand-modules">
      <section v-for="index in 3" :key="index" class="brand-module">
        <a-skeleton active :title="{ width: '180px' }" :paragraph="{ rows: 3 }" />
      </section>
    </div>

    <div v-else class="brand-modules">
      <!-- 01 浏览器标签 -->
      <section class="brand-module" :class="{ 'brand-module--editing': isEditing('tab') }">
        <header class="brand-module__head">
          <span class="brand-module__index">01</span>
          <span class="brand-module__icon"><GlobalOutlined /></span>
          <span class="brand-module__titles">
            <strong>浏览器标签</strong>
            <em>浏览器标签标题与图标</em>
          </span>
          <span class="brand-source" :class="sourceClass('tab')">{{ sourceText('tab') }}</span>
          <a-button v-if="canEditTab" class="brand-module__edit" @click="startEdit('tab')">
            <template #icon><EditOutlined /></template>
            编辑
          </a-button>
        </header>

        <div class="brand-module__body">
          <div class="brand-module__config">
            <div v-if="!isEditing('tab')" class="brand-info brand-info--2">
              <div class="brand-info__item">
                <span class="brand-info__label">标签标题</span>
                <span class="brand-info__value">{{ savedConfig.tabTitle }}</span>
              </div>
              <div class="brand-info__item">
                <span class="brand-info__label">标签图标</span>
                <span class="brand-info__value brand-info__value--media">
                  <span class="brand-info__icon">
                    <img :src="brandImageSrc(savedConfig.tabIcon)" alt="" />
                  </span>
                  <span class="brand-info__sub">{{ savedConfig.tabIcon ? '企业自定义' : '平台默认' }}</span>
                </span>
              </div>
              <div class="brand-info__item brand-info__item--full">
                <span class="brand-info__label">标签示例</span>
                <span class="brand-info__value">工作台 — {{ savedConfig.tabTitle }}</span>
              </div>
            </div>

            <div v-else class="brand-fields">
              <div class="brand-grid brand-grid--2">
                <div class="brand-field">
                  <label class="brand-field__label">标签标题 <em>*</em></label>
                  <a-input
                    v-model:value="draft.tab.tabTitle"
                    show-count
                    :maxlength="TAB_TITLE_MAX"
                    placeholder="请输入浏览器标签标题"
                    :disabled="saving"
                  />
                  <p v-if="errors.tabTitle" class="brand-field__error">{{ errors.tabTitle }}</p>
                  <p v-else class="brand-field__hint">建议 12 个字符以内</p>
                </div>
                <div class="brand-field">
                  <label class="brand-field__label">标签图标</label>
                  <BrandImageField
                    kind="tabIcon"
                    :value="draft.tab.tabIcon"
                    :uploading="uploading === 'tabIcon'"
                    :disabled="saving"
                    :error="imageErrors.tabIcon"
                    @pick="(file) => handlePick('tabIcon', file)"
                    @delete="deleteImage('tabIcon')"
                  />
                </div>
              </div>
            </div>

            <div v-if="isEditing('tab')" class="brand-module__footer">
              <a-button v-if="sourceOf('tab') === 'custom'" type="text" danger @click="openReset('tab')">
                恢复平台默认
              </a-button>
              <span class="brand-card__spacer" />
              <a-button :disabled="saving" @click="cancelEdit">取消</a-button>
              <a-button type="primary" :loading="saving" :disabled="uploading !== ''" @click="submit('tab')">保存</a-button>
            </div>
          </div>

          <div class="brand-module__preview">
            <div class="brand-module__preview-head">
              <span>标签页效果</span>
              <span class="brand-preview-tag" :class="{ 'brand-preview-tag--draft': isEditing('tab') && dirty }">
                {{ isEditing('tab') && dirty ? '未保存预览' : '已发布' }}
              </span>
            </div>
            <TabPreviewCard :config="previewConfig" />
          </div>
        </div>
      </section>

      <!-- 02 登录页品牌 -->
      <section class="brand-module" :class="{ 'brand-module--editing': isEditing('login') }">
        <header class="brand-module__head">
          <span class="brand-module__index">02</span>
          <span class="brand-module__icon"><PictureOutlined /></span>
          <span class="brand-module__titles">
            <strong>登录页品牌</strong>
            <em>认证类页面共用的品牌区</em>
          </span>
          <span class="brand-source" :class="sourceClass('login')">{{ sourceText('login') }}</span>
          <a-button v-if="canEditLogin" class="brand-module__edit" @click="startEdit('login')">
            <template #icon><EditOutlined /></template>
            编辑
          </a-button>
        </header>

        <div class="brand-module__body">
          <div class="brand-module__config">
            <div v-if="!isEditing('login')" class="brand-info brand-info--2">
              <div class="brand-info__item">
                <span class="brand-info__label">登录页 Logo</span>
                <span class="brand-info__value brand-info__value--media">
                  <img :src="brandImageSrc(savedConfig.loginLogo)" alt="" class="brand-info__logo" />
                  <span class="brand-info__sub">{{ savedConfig.loginLogo ? '企业自定义' : '平台默认' }}</span>
                </span>
              </div>
              <div class="brand-info__item">
                <span class="brand-info__label">品牌名称</span>
                <span class="brand-info__value">{{ savedConfig.loginBrandName }}</span>
              </div>
              <div class="brand-info__item brand-info__item--full">
                <span class="brand-info__label">主标题</span>
                <span class="brand-info__value">{{ savedConfig.loginTitle }}</span>
              </div>
              <div class="brand-info__item brand-info__item--full">
                <span class="brand-info__label">副标题</span>
                <span
                  class="brand-info__value brand-info__value--clamp"
                  :title="savedConfig.loginSubtitle"
                >{{ savedConfig.loginSubtitle || '未配置（不展示）' }}</span>
              </div>
              <div class="brand-info__item">
                <span class="brand-info__label">背景图</span>
                <span class="brand-info__value brand-info__value--media">
                  <span v-if="savedConfig.loginBackground" class="brand-info__bg">
                    <img :src="savedConfig.loginBackground" alt="" />
                  </span>
                  <span v-else class="brand-info__bg brand-info__bg--default">平台默认渐变</span>
                  <span class="brand-info__sub">{{ savedConfig.loginBackground ? '企业自定义' : '平台默认' }}</span>
                </span>
              </div>
              <div class="brand-info__item brand-info__item--full">
                <span class="brand-info__label">品牌区价值点</span>
                <ul v-if="savedPoints.length" class="brand-point-list">
                  <li v-for="point in savedPoints" :key="point"><CheckCircleFilled />{{ point }}</li>
                </ul>
                <span v-else class="brand-info__value brand-info__sub">未配置（不展示）</span>
              </div>
            </div>

            <div v-else class="brand-fields">
              <div class="brand-grid brand-grid--2">
                <div class="brand-field">
                  <label class="brand-field__label">登录页 Logo</label>
                  <BrandImageField
                    kind="loginLogo"
                    :value="draft.login.loginLogo"
                    :uploading="uploading === 'loginLogo'"
                    :disabled="saving"
                    :error="imageErrors.loginLogo"
                    @pick="(file) => handlePick('loginLogo', file)"
                    @delete="deleteImage('loginLogo')"
                  />
                </div>
                <div class="brand-field">
                  <label class="brand-field__label">背景图</label>
                  <BrandImageField
                    kind="loginBackground"
                    :value="draft.login.loginBackground"
                    :uploading="uploading === 'loginBackground'"
                    :disabled="saving"
                    :error="imageErrors.loginBackground"
                    @pick="(file) => handlePick('loginBackground', file)"
                    @delete="deleteImage('loginBackground')"
                  />
                </div>
              </div>

              <div class="brand-grid brand-grid--2">
                <div class="brand-field">
                  <label class="brand-field__label">品牌名称 <em>*</em></label>
                  <a-input
                    v-model:value="draft.login.loginBrandName"
                    show-count
                    :maxlength="LOGIN_BRAND_NAME_MAX"
                    placeholder="Logo 右侧展示的名称"
                    :disabled="saving"
                  />
                  <p v-if="errors.loginBrandName" class="brand-field__error">{{ errors.loginBrandName }}</p>
                </div>
                <div class="brand-field">
                  <label class="brand-field__label">主标题 <em>*</em></label>
                  <a-input
                    v-model:value="draft.login.loginTitle"
                    show-count
                    :maxlength="LOGIN_TITLE_MAX"
                    placeholder="品牌区大标题"
                    :disabled="saving"
                  />
                  <p v-if="errors.loginTitle" class="brand-field__error">{{ errors.loginTitle }}</p>
                </div>
              </div>

              <div class="brand-field">
                <label class="brand-field__label">副标题</label>
                <a-textarea
                  v-model:value="draft.login.loginSubtitle"
                  :rows="2"
                  show-count
                  :maxlength="LOGIN_SUBTITLE_MAX"
                  placeholder="展示在主标题下方，留空则不展示"
                  :disabled="saving"
                />
                <p v-if="errors.loginSubtitle" class="brand-field__error">{{ errors.loginSubtitle }}</p>
              </div>

              <div class="brand-field">
                <label class="brand-field__label">品牌区价值点</label>
                <div class="brand-points-edit">
                  <a-input
                    v-model:value="draft.login.loginPoint1"
                    show-count
                    :maxlength="LOGIN_POINT_MAX"
                    placeholder="价值点 1（留空不展示）"
                    :disabled="saving"
                  />
                  <a-input
                    v-model:value="draft.login.loginPoint2"
                    show-count
                    :maxlength="LOGIN_POINT_MAX"
                    placeholder="价值点 2（留空不展示）"
                    :disabled="saving"
                  />
                  <a-input
                    v-model:value="draft.login.loginPoint3"
                    show-count
                    :maxlength="LOGIN_POINT_MAX"
                    placeholder="价值点 3（留空不展示）"
                    :disabled="saving"
                  />
                </div>
                <p v-if="errors.loginPoint1 || errors.loginPoint2 || errors.loginPoint3" class="brand-field__error">
                  {{ errors.loginPoint1 || errors.loginPoint2 || errors.loginPoint3 }}
                </p>
                <p v-else class="brand-field__hint">最多三条，每条 40 字以内；三条均留空时不展示价值点区域</p>
              </div>
            </div>

            <div v-if="isEditing('login')" class="brand-module__footer">
              <a-button v-if="sourceOf('login') === 'custom'" type="text" danger @click="openReset('login')">
                恢复平台默认
              </a-button>
              <span class="brand-card__spacer" />
              <a-button :disabled="saving" @click="cancelEdit">取消</a-button>
              <a-button type="primary" :loading="saving" :disabled="uploading !== ''" @click="submit('login')">保存</a-button>
            </div>
          </div>

          <div class="brand-module__preview">
            <div class="brand-module__preview-head">
              <span>品牌区效果</span>
              <span class="brand-preview-tag" :class="{ 'brand-preview-tag--draft': isEditing('login') && dirty }">
                {{ isEditing('login') && dirty ? '未保存预览' : '已发布' }}
              </span>
            </div>
            <LoginPreview :config="previewConfig" />
            <p class="brand-module__preview-note">预览为登录页品牌区；表单与页脚由登录模块统一维护，不在此配置。</p>
          </div>
        </div>
      </section>

      <!-- 03 主界面框架 -->
      <section class="brand-module" :class="{ 'brand-module--editing': isEditing('frame') }">
        <header class="brand-module__head">
          <span class="brand-module__index">03</span>
          <span class="brand-module__icon"><LayoutOutlined /></span>
          <span class="brand-module__titles">
            <strong>主界面框架</strong>
            <em>企业端顶栏 Logo 与主标题</em>
          </span>
          <span class="brand-source" :class="sourceClass('frame')">{{ sourceText('frame') }}</span>
          <a-button v-if="canEditFrame" class="brand-module__edit" @click="startEdit('frame')">
            <template #icon><EditOutlined /></template>
            编辑
          </a-button>
        </header>

        <div class="brand-module__body">
          <div class="brand-module__config">
            <div v-if="!isEditing('frame')" class="brand-info brand-info--2">
              <div class="brand-info__item">
                <span class="brand-info__label">Header Logo</span>
                <span class="brand-info__value brand-info__value--media">
                  <span class="brand-info__icon">
                    <img :src="brandImageSrc(savedConfig.headerLogo)" alt="" />
                  </span>
                  <span class="brand-info__sub">{{ savedConfig.headerLogo ? '企业自定义' : '平台默认' }}</span>
                </span>
              </div>
              <div class="brand-info__item">
                <span class="brand-info__label">主界面标题</span>
                <span class="brand-info__value">{{ savedConfig.headerTitle }}</span>
              </div>
              <div class="brand-info__item brand-info__item--full">
                <span class="brand-info__label">影响范围</span>
                <span class="brand-info__value">当前企业全部页面顶栏</span>
              </div>
            </div>

            <div v-else class="brand-fields">
              <div class="brand-grid brand-grid--2">
                <div class="brand-field">
                  <label class="brand-field__label">Header Logo</label>
                  <BrandImageField
                    kind="headerLogo"
                    :value="draft.frame.headerLogo"
                    :uploading="uploading === 'headerLogo'"
                    :disabled="saving"
                    :error="imageErrors.headerLogo"
                    @pick="(file) => handlePick('headerLogo', file)"
                    @delete="deleteImage('headerLogo')"
                  />
                </div>
                <div class="brand-field">
                  <label class="brand-field__label">主界面标题 <em>*</em></label>
                  <a-input
                    v-model:value="draft.frame.headerTitle"
                    show-count
                    :maxlength="HEADER_TITLE_MAX"
                    placeholder="顶栏主标题"
                    :disabled="saving"
                  />
                  <p v-if="errors.headerTitle" class="brand-field__error">{{ errors.headerTitle }}</p>
                  <p v-else class="brand-field__hint">顶栏单行展示，超长省略</p>
                </div>
              </div>
            </div>

            <div v-if="isEditing('frame')" class="brand-module__footer">
              <a-button v-if="sourceOf('frame') === 'custom'" type="text" danger @click="openReset('frame')">
                恢复平台默认
              </a-button>
              <span class="brand-card__spacer" />
              <a-button :disabled="saving" @click="cancelEdit">取消</a-button>
              <a-button type="primary" :loading="saving" :disabled="uploading !== ''" @click="submit('frame')">保存</a-button>
            </div>
          </div>

          <div class="brand-module__preview">
            <div class="brand-module__preview-head">
              <span>顶栏效果</span>
              <span class="brand-preview-tag" :class="{ 'brand-preview-tag--draft': isEditing('frame') && dirty }">
                {{ isEditing('frame') && dirty ? '未保存预览' : '已发布' }}
              </span>
            </div>
            <FramePreviewCard :config="previewConfig" />
          </div>
        </div>
      </section>
    </div>

    <!-- OVERLAY-BRD-01 恢复平台默认 -->
    <a-modal
      v-model:open="resetOpen"
      title="确认恢复平台默认"
      :width="420"
      :mask-closable="!saving"
      :closable="!saving"
      :ok-button-props="{ danger: true, loading: saving }"
      ok-text="确认恢复"
      cancel-text="取消"
      @ok="confirmReset"
    >
      <p class="brand-modal__text">
        「{{ sectionLabel(resetSection) }}」将恢复为平台默认品牌，已保存的自定义内容不可撤销。恢复后该分组立即全站生效。
      </p>
    </a-modal>

    <!-- OVERLAY-BRD-02 未保存修改 -->
    <a-modal
      v-model:open="discardOpen"
      title="有未保存的修改"
      :width="420"
      :closable="false"
      :mask-closable="false"
      ok-text="放弃修改"
      cancel-text="继续编辑"
      :ok-button-props="{ danger: true }"
      @ok="confirmDiscard"
      @cancel="discardOpen = false"
    >
      <p class="brand-modal__text">有未保存的修改，确定放弃吗？</p>
    </a-modal>

    <!-- 未保存时离开页面 -->
    <a-modal
      v-model:open="leaveOpen"
      title="有未保存的修改"
      :width="420"
      :closable="false"
      :mask-closable="false"
      ok-text="放弃修改并离开"
      cancel-text="留在此页"
      :ok-button-props="{ danger: true }"
      @ok="confirmLeave"
      @cancel="cancelLeave"
    >
      <p class="brand-modal__text">有未保存的修改，确定放弃吗？</p>
    </a-modal>

    <!-- OVERLAY-BRD-03 方形图片裁剪（复用企业中心裁剪浮层） -->
    <LogoCropper
      :open="cropOpen"
      :file="cropFile"
      :title="cropTitle"
      :suggest-size="cropSuggestSize"
      @cancel="cancelCrop"
      @confirm="confirmCrop"
    />

    <ProtoTip :lines="tipLines" @reset="handleReset">
      <template #extra>
        <a-button size="small" @click="simulateFail">模拟加载失败</a-button>
      </template>
    </ProtoTip>
  </div>
</template>

<script setup lang="ts">
/**
 * PAGE-BRD-01 品牌设置
 * 【原型说明】对齐《产品交互设计文档-品牌设置》v1.0 第 4 章与第 5 章：
 * 三张模块卡片一一对应三组配置与预览（浏览器标签 / 登录页品牌 / 主界面框架），
 * 左侧配置、右侧实时预览；未配置分组继承平台默认，可恢复默认；保存即全站发布。
 * 覆盖加载、继承、企业自定义、编辑、上传、保存、失败、无权限与预览回退状态。
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import { message } from 'antdv-next'
import {
  BgColorsOutlined,
  CheckCircleFilled,
  DisconnectOutlined,
  EditOutlined,
  GlobalOutlined,
  InfoCircleOutlined,
  LayoutOutlined,
  PictureOutlined,
  ReloadOutlined,
} from '@antdv-next/icons'
import ProtoTip from '@/shared/components/ProtoTip.vue'
import LogoCropper from '@/modules/enterprise/components/LogoCropper.vue'
import { currentPermissions } from '@/modules/role/store'
import { session } from '@/modules/auth/store'
import {
  applyDocumentBranding,
  brandingSource,
  brandingVersion,
  brandImageSrc,
  compressBackground,
  currentBranding,
  imageSizeHint,
  loadImageFile,
  resetBrandingSection,
  resetCurrentOrgBranding,
  saveBrandingSection,
  sectionValues,
  updatedAtOf,
  updatedByOf,
  validateBrandImage,
  validateHeaderTitle,
  validateLoginBrandName,
  validateLoginPoint,
  validateLoginSubtitle,
  validateLoginTitle,
  validateTabTitle,
  HEADER_TITLE_MAX,
  LOGIN_BRAND_NAME_MAX,
  LOGIN_POINT_MAX,
  LOGIN_SUBTITLE_MAX,
  LOGIN_TITLE_MAX,
  TAB_TITLE_MAX,
  type BrandImageKind,
  type BrandingConfig,
  type BrandingSection,
  type BrandingSource,
  type FrameBrandValues,
  type LoginBrandValues,
  type TabBrandValues,
} from '@/modules/branding/store'
import BrandImageField from '../components/BrandImageField.vue'
import FramePreviewCard from '../components/FramePreviewCard.vue'
import LoginPreview from '../components/LoginPreview.vue'
import TabPreviewCard from '../components/TabPreviewCard.vue'

const router = useRouter()

/* ---------- 权限点：三组配置独立授权（PRD F-BRD-07） ---------- */
const canView = computed(() => has('system:branding'))
const canEditTab = computed(() => has('system:branding:tab:edit'))
const canEditLogin = computed(() => has('system:branding:login:edit'))
const canEditFrame = computed(() => has('system:branding:frame:edit'))
const canEdit = { tab: canEditTab, login: canEditLogin, frame: canEditFrame }

function has(key: string) {
  return currentPermissions().includes(key)
}

/* ---------- 数据 ---------- */
const loading = ref(true)
const failed = ref(false)
const saving = ref(false)
const orgId = computed(() => session.current?.orgId ?? '')

/** 保存 / 恢复结果的内联提示（5 秒后自动关闭，也可手动关闭） */
const feedback = ref<{ type: 'success' | 'error'; text: string } | null>(null)
let feedbackTimer: number | undefined

function notify(type: 'success' | 'error', text: string) {
  feedback.value = { type, text }
  window.clearTimeout(feedbackTimer)
  feedbackTimer = window.setTimeout(() => {
    feedback.value = null
  }, 5000)
}

/** 已保存的生效品牌：与草稿解耦，页面只更新草稿，保存成功后才回写 */
const savedConfig = ref<BrandingConfig>(currentBranding())
const lastUpdated = ref(0)
const lastOperator = ref('')

const draft = reactive<{ tab: TabBrandValues; login: LoginBrandValues; frame: FrameBrandValues }>({
  tab: { tabTitle: '', tabIcon: '' },
  login: {
    loginLogo: '',
    loginBrandName: '',
    loginTitle: '',
    loginSubtitle: '',
    loginBackground: '',
    loginPoint1: '',
    loginPoint2: '',
    loginPoint3: '',
  },
  frame: { headerLogo: '', headerTitle: '' },
})

const editing = ref<BrandingSection | null>(null)

function syncMeta() {
  lastUpdated.value = updatedAtOf(orgId.value)
  lastOperator.value = updatedByOf(orgId.value)
}

function syncDrafts() {
  draft.tab = { ...(sectionValues(savedConfig.value, 'tab') as TabBrandValues) }
  draft.login = { ...(sectionValues(savedConfig.value, 'login') as LoginBrandValues) }
  draft.frame = { ...(sectionValues(savedConfig.value, 'frame') as FrameBrandValues) }
}

/** 【原型说明】模拟加载耗时，无真实接口调用 */
function loadData() {
  loading.value = true
  failed.value = false
  window.setTimeout(() => {
    savedConfig.value = currentBranding()
    syncMeta()
    syncDrafts()
    clearErrors()
    loading.value = false
  }, 420)
}

onMounted(loadData)

/* ---------- 来源与更新时间 ---------- */
function sourceOf(section: BrandingSection): BrandingSource {
  void brandingVersion.value
  return brandingSource(orgId.value, section)
}

function sourceText(section: BrandingSection) {
  return sourceOf(section) === 'custom' ? '企业自定义' : '继承平台默认'
}

function sourceClass(section: BrandingSection) {
  return sourceOf(section) === 'custom' ? 'brand-source--custom' : 'brand-source--inherit'
}

const lastUpdatedText = computed(() => {
  if (!lastUpdated.value) return '—'
  const date = new Date(lastUpdated.value)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}${lastOperator.value ? ` · ${lastOperator.value}` : ''}`
})

const sectionLabels: Record<BrandingSection, string> = {
  tab: '浏览器标签',
  login: '登录页品牌',
  frame: '主界面框架',
}

function sectionLabel(section: BrandingSection | null) {
  return section ? sectionLabels[section] : ''
}

/* ---------- 编辑态 ---------- */
const isEditing = (section: BrandingSection) => editing.value === section
const errors = reactive<Record<string, string>>({})
const imageErrors = reactive<Record<BrandImageKind, string>>({
  tabIcon: '',
  loginLogo: '',
  loginBackground: '',
  headerLogo: '',
})

function clearErrors() {
  Object.keys(errors).forEach((key) => delete errors[key])
  ;(Object.keys(imageErrors) as BrandImageKind[]).forEach((key) => {
    imageErrors[key] = ''
  })
}

/** 草稿是否有修改：与已保存值逐字段比对（文本按去除首尾空格后的值） */
const dirty = computed(() => {
  if (!editing.value) return false
  const section = editing.value
  const saved = sectionValues(savedConfig.value, section) as unknown as Record<string, string>
  const current = draft[section] as unknown as Record<string, string>
  return Object.keys(saved).some((key) => (current[key] ?? '').trim() !== (saved[key] ?? '').trim())
})

/** 预览配置：编辑中实时叠加草稿，未编辑时展示已保存值 */
const previewConfig = computed<BrandingConfig>(() => {
  if (!editing.value) return savedConfig.value
  return { ...savedConfig.value, ...draft[editing.value] } as BrandingConfig
})

/** 已保存的三条价值点（只读展示） */
const savedPoints = computed(() =>
  [savedConfig.value.loginPoint1, savedConfig.value.loginPoint2, savedConfig.value.loginPoint3]
    .map((item) => item.trim())
    .filter(Boolean),
)

function startEdit(section: BrandingSection) {
  if (saving.value || editing.value === section) return
  if (!canEdit[section].value) return
  if (editing.value && dirty.value) {
    pendingSection.value = section
    discardOpen.value = true
    return
  }
  applyEdit(section)
}

function applyEdit(section: BrandingSection) {
  clearErrors()
  syncDrafts()
  editing.value = section
}

function cancelEdit() {
  editing.value = null
  clearErrors()
  syncDrafts()
}

const pendingSection = ref<BrandingSection | null>(null)
const discardOpen = ref(false)

function confirmDiscard() {
  discardOpen.value = false
  const target = pendingSection.value
  pendingSection.value = null
  if (target) applyEdit(target)
}

/* ---------- 校验与保存 ---------- */
function validateSection(section: BrandingSection): boolean {
  clearErrors()
  if (section === 'tab') {
    const error = validateTabTitle(draft.tab.tabTitle)
    if (error) errors.tabTitle = error
    return !error
  }
  if (section === 'login') {
    const nameError = validateLoginBrandName(draft.login.loginBrandName)
    const titleError = validateLoginTitle(draft.login.loginTitle)
    const subtitleError = validateLoginSubtitle(draft.login.loginSubtitle)
    const pointErrors = [
      validateLoginPoint(draft.login.loginPoint1),
      validateLoginPoint(draft.login.loginPoint2),
      validateLoginPoint(draft.login.loginPoint3),
    ]
    if (nameError) errors.loginBrandName = nameError
    if (titleError) errors.loginTitle = titleError
    if (subtitleError) errors.loginSubtitle = subtitleError
    if (pointErrors[0]) errors.loginPoint1 = pointErrors[0]
    if (pointErrors[1]) errors.loginPoint2 = pointErrors[1]
    if (pointErrors[2]) errors.loginPoint3 = pointErrors[2]
    return !nameError && !titleError && !subtitleError && !pointErrors.some(Boolean)
  }
  const error = validateHeaderTitle(draft.frame.headerTitle)
  if (error) errors.headerTitle = error
  return !error
}

async function submit(section: BrandingSection) {
  if (saving.value || uploading.value) return
  if (!validateSection(section)) return
  // 内容与已保存值一致：不发请求，直接退出编辑态（PRD F-BRD-06）
  if (!dirty.value) {
    cancelEdit()
    return
  }
  saving.value = true
  try {
    await saveBrandingSection(section, draft[section])
    savedConfig.value = currentBranding()
    syncMeta()
    syncDrafts()
    editing.value = null
    applyDocumentBranding('品牌设置')
    notify('success', '保存成功，品牌已生效')
  } catch {
    notify('error', '保存失败，请重试')
  } finally {
    saving.value = false
  }
}

/* ---------- 恢复平台默认 ---------- */
const resetOpen = ref(false)
const resetSection = ref<BrandingSection | null>(null)

function openReset(section: BrandingSection) {
  resetSection.value = section
  resetOpen.value = true
}

async function confirmReset() {
  const section = resetSection.value
  if (!section || saving.value) return
  saving.value = true
  try {
    await resetBrandingSection(section)
    savedConfig.value = currentBranding()
    syncMeta()
    syncDrafts()
    editing.value = null
    resetOpen.value = false
    applyDocumentBranding('品牌设置')
    notify('success', '已恢复平台默认品牌')
  } catch {
    notify('error', '恢复失败，请重试')
  } finally {
    saving.value = false
  }
}

/* ---------- 图片上传 ---------- */
const uploading = ref<BrandImageKind | ''>('')
const cropOpen = ref(false)
const cropFile = ref<File | null>(null)
const cropKind = ref<BrandImageKind>('tabIcon')

const cropTitle = computed(() => {
  if (cropKind.value === 'tabIcon') return '裁剪标签图标'
  if (cropKind.value === 'loginLogo') return '裁剪登录页 Logo'
  return '裁剪 Header Logo'
})

const cropSuggestSize = computed(() => {
  if (cropKind.value === 'tabIcon') return 64
  if (cropKind.value === 'loginLogo') return 256
  return 128
})

function delay(ms = 420) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function handlePick(kind: BrandImageKind, file: File) {
  if (saving.value || uploading.value) return
  imageErrors[kind] = ''
  const error = validateBrandImage(file, kind)
  if (error) {
    imageErrors[kind] = error
    return
  }
  if (kind === 'loginBackground') {
    void uploadBackground(file)
    return
  }
  cropKind.value = kind
  cropFile.value = file
  cropOpen.value = true
}

async function uploadBackground(file: File) {
  uploading.value = 'loginBackground'
  try {
    const image = await loadImageFile(file)
    const hint = imageSizeHint(image, 'loginBackground')
    await delay()
    draft.login.loginBackground = compressBackground(image)
    if (hint) message.info(hint)
  } catch {
    imageErrors.loginBackground = '图片读取失败，请重新选择'
  } finally {
    uploading.value = ''
  }
}

function cancelCrop() {
  cropOpen.value = false
  cropFile.value = null
}

/** 裁剪确认：回填草稿并同步预览，仍需点击分组「保存」 */
async function confirmCrop(dataUrl: string) {
  const kind = cropKind.value
  cropOpen.value = false
  cropFile.value = null
  uploading.value = kind
  await delay()
  if (kind === 'tabIcon') draft.tab.tabIcon = dataUrl
  if (kind === 'loginLogo') draft.login.loginLogo = dataUrl
  if (kind === 'headerLogo') draft.frame.headerLogo = dataUrl
  uploading.value = ''
}

function deleteImage(kind: BrandImageKind) {
  imageErrors[kind] = ''
  if (kind === 'tabIcon') draft.tab.tabIcon = ''
  if (kind === 'loginLogo') draft.login.loginLogo = ''
  if (kind === 'loginBackground') draft.login.loginBackground = ''
  if (kind === 'headerLogo') draft.frame.headerLogo = ''
}

/* ---------- 未保存离开保护 ---------- */
const leaveOpen = ref(false)
let resolvingLeave: ((value: boolean) => void) | null = null

function handleBeforeUnload(event: BeforeUnloadEvent) {
  if (!dirty.value && !saving.value) return
  event.preventDefault()
  event.returnValue = ''
}

onMounted(() => window.addEventListener('beforeunload', handleBeforeUnload))
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
  window.clearTimeout(feedbackTimer)
})

onBeforeRouteLeave(async () => {
  if (!dirty.value || saving.value) return true
  leaveOpen.value = true
  return new Promise<boolean>((resolve) => {
    resolvingLeave = resolve
  })
})

function confirmLeave() {
  leaveOpen.value = false
  editing.value = null
  syncDrafts()
  resolvingLeave?.(true)
  resolvingLeave = null
}

function cancelLeave() {
  leaveOpen.value = false
  resolvingLeave?.(false)
  resolvingLeave = null
}

/* ---------- 演示入口 ---------- */
function simulateFail() {
  loading.value = false
  failed.value = true
}

function handleReset() {
  resetCurrentOrgBranding()
  editing.value = null
  loadData()
}

const tipLines = [
  '三张模块卡片一一对应三组配置与预览；未配置的分组继承平台默认品牌，保存后立即全站生效。',
  '浏览器标签标题格式为「页面名称 — 标签标题」；图标未上传时使用平台默认 Logo。',
  '登录页品牌作用于登录、注册、忘记密码、选择登录企业等认证类页面；表单与页脚为平台统一内容，不开放自定义。',
  '品牌区价值点最多三条，每条 40 字以内；留空则不展示该条。',
  '主界面框架仅影响企业端顶栏，不影响平台管理端；顶栏标题超长时以省略号截断。',
  '方形图片按 1:1 裁剪，背景图不裁剪并铺满展示；图片仅支持 JPG / PNG。',
  '登录页默认展示平台默认品牌；在「选择登录企业」中选中企业后，页面品牌自动切换为该企业品牌。',
]
</script>
