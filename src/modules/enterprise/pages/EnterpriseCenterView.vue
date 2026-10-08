<template>
  <!-- 无 `system:enterprise` 权限点：整页无权限空态（STATE-ENT-11 / CMP-ENT-29） -->
  <div v-if="!canView" class="page-container ent-page">
    <div class="ent-page__denied">
      <a-empty description="当前账号无权限访问企业中心" />
      <a-button type="primary" @click="router.push('/dashboard')">返回</a-button>
    </div>
  </div>

  <div v-else class="page-container ent-page">
    <!-- AREA-ENT-01 页面标题区（CMP-ENT-01 / CMP-ENT-02） -->
    <header class="ent-page__head">
      <h1 class="ent-page__title">企业中心</h1>
      <p class="ent-page__desc">查看并维护本企业的档案信息、联系人与资质信息</p>
    </header>

    <!-- STATE-ENT-10 加载失败（CMP-ENT-28） -->
    <section v-if="failed" class="ent-card ent-card--state">
      <div class="ent-state">
        <span class="ent-state__icon"><DisconnectOutlined /></span>
        <p class="ent-state__title">企业信息加载失败</p>
        <p class="ent-state__desc">网络异常或服务暂时不可用，请稍后重试</p>
        <a-button type="primary" class="ent-state__action" @click="loadData">
          <template #icon><ReloadOutlined /></template>
          重新加载
        </a-button>
      </div>
    </section>

    <!-- STATE-ENT-01 加载中：按新卡片结构展示骨架 -->
    <template v-else-if="loading">
      <section class="ent-card ent-card--hero">
        <div class="ent-hero">
          <div class="ent-logo ent-logo--skeleton" />
          <div class="ent-hero__main">
            <a-skeleton active :title="{ width: '280px' }" :paragraph="{ rows: 1 }" />
          </div>
        </div>
      </section>
      <section v-for="index in 2" :key="index" class="ent-card">
        <a-skeleton active :title="{ width: '120px' }" :paragraph="{ rows: 2 }" />
      </section>
    </template>

    <template v-else>
      <!-- AREA-ENT-02 企业档案（CMP-ENT-03）：以企业标识区承载 Logo 与企业身份信息 -->
      <section class="ent-card ent-card--hero" :class="{ 'ent-card--editing': isEditing('profile') }">
        <div class="ent-card__head">
          <span class="ent-card__icon"><ShopOutlined /></span>
          <span class="ent-card__titles">
            <span class="ent-card__title">企业档案</span>
            <span class="ent-card__note">企业信息由企业自行维护</span>
          </span>
          <span v-if="isEditing('profile')" class="ent-card__badge">编辑中</span>
          <a-button v-else-if="canEditProfile" class="ent-card__edit" @click="startEdit('profile')">
            <template #icon><EditOutlined /></template>
            编辑
          </a-button>
        </div>

        <!-- 只读态：企业 Logo + 企业名称 + 行业 / 地区 -->
        <div v-if="!isEditing('profile')" class="ent-hero">
          <div class="ent-logo">
            <img
              v-if="profile.logo && !logoFailed"
              :src="profile.logo"
              alt=""
              class="ent-logo__img"
              @error="logoFailed = true"
            />
            <span v-else class="ent-logo__empty">
              <PictureOutlined class="ent-logo__empty-icon" />
              <span>未上传 Logo</span>
            </span>
          </div>

          <div class="ent-hero__main">
            <p class="ent-hero__name">{{ profile.name || '—' }}</p>
            <div class="ent-hero__meta">
              <span class="ent-chip">
                <span class="ent-chip__label">所属行业</span>
                {{ profile.industry || '—' }}
              </span>
              <span class="ent-chip">
                <span class="ent-chip__label">所在地区</span>
                {{ profile.region || '—' }}
              </span>
            </div>
          </div>
        </div>

        <!-- 编辑态：Logo 上传 + 三个字段 -->
        <div v-else class="ent-hero ent-hero--editing">
          <div class="ent-logo ent-logo--edit">
            <ImageUploadField
              kind="logo"
              :value="profileForm.logo"
              :uploading="uploading === 'logo'"
              :disabled="saving"
              :error="logoError"
              @pick="handleLogoPick"
              @delete="logoDeleteOpen = true"
              @error="(text: string) => (logoError = text)"
            />
          </div>

          <div class="ent-hero__main">
            <div class="ent-item">
              <label class="ent-item__label">企业名称</label>
              <a-input
                v-model:value="profileForm.name"
                show-count
                :maxlength="NAME_MAX"
                placeholder="请输入企业名称"
              />
              <p v-if="fieldError('name')" class="ent-item__error">{{ fieldError('name') }}</p>
            </div>
            <div class="ent-grid ent-grid--2">
              <div class="ent-item">
                <label class="ent-item__label">所属行业</label>
                <a-select
                  v-model:value="profileForm.industry"
                  show-search
                  option-filter-prop="label"
                  placeholder="请选择企业所属行业"
                  :options="INDUSTRY_OPTIONS"
                />
                <p v-if="fieldError('industry')" class="ent-item__error">{{ fieldError('industry') }}</p>
              </div>
              <div class="ent-item">
                <label class="ent-item__label">企业所在地区</label>
                <a-cascader
                  v-model:value="profileForm.region"
                  placeholder="请选择企业所在地区"
                  :options="REGION_OPTIONS"
                />
                <p v-if="fieldError('region')" class="ent-item__error">{{ fieldError('region') }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- AREA-ENT-08 编辑态操作区（CMP-ENT-24 / CMP-ENT-25） -->
        <div v-if="isEditing('profile')" class="ent-card__footer">
          <a-button :disabled="saving" @click="cancelEdit">取消</a-button>
          <a-button type="primary" :loading="saving" :disabled="uploading === 'logo'" @click="submitProfile">
            保存
          </a-button>
        </div>
      </section>

      <!-- AREA-ENT-03 企业联系人卡片（CMP-ENT-04） -->
      <section class="ent-card" :class="{ 'ent-card--editing': isEditing('contact') }">
        <div class="ent-card__head">
          <span class="ent-card__icon"><ContactsOutlined /></span>
          <span class="ent-card__titles">
            <span class="ent-card__title">企业联系人</span>
            <span class="ent-card__note">联系人信息按账号在当前企业下登记，修改不影响登录账号</span>
          </span>
          <span v-if="isEditing('contact')" class="ent-card__badge">编辑中</span>
          <a-button v-else-if="canEditContact" class="ent-card__edit" @click="startEdit('contact')">
            <template #icon><EditOutlined /></template>
            编辑
          </a-button>
        </div>

        <div class="ent-grid ent-grid--3">
          <div class="ent-item">
            <label class="ent-item__label">联系人姓名</label>
            <span v-if="!isEditing('contact')" class="ent-item__value">{{ contact.name || '—' }}</span>
            <a-input
              v-else
              v-model:value="contactForm.name"
              :maxlength="CONTACT_NAME_MAX"
              placeholder="请输入联系人姓名"
            />
            <p v-if="fieldError('contactName')" class="ent-item__error">{{ fieldError('contactName') }}</p>
          </div>

          <div class="ent-item">
            <label class="ent-item__label">联系人职务</label>
            <span v-if="!isEditing('contact')" class="ent-item__value">{{ contact.title || '—' }}</span>
            <a-input
              v-else
              v-model:value="contactForm.title"
              :maxlength="CONTACT_TITLE_MAX"
              placeholder="请输入联系人职务（选填）"
            />
            <p v-if="fieldError('contactTitle')" class="ent-item__error">{{ fieldError('contactTitle') }}</p>
          </div>

          <div class="ent-item">
            <label class="ent-item__label">联系人电话</label>
            <span v-if="!isEditing('contact')" class="ent-item__value">{{ formatPhone(contact.phone) }}</span>
            <AccountField
              v-else
              v-model:value="contactForm.phone"
              phone-only
              placeholder="请输入联系人电话"
              @blur="validateContactField('phone')"
            />
            <p v-if="fieldError('contactPhone')" class="ent-item__error">{{ fieldError('contactPhone') }}</p>
          </div>
        </div>

        <div v-if="isEditing('contact')" class="ent-card__footer">
          <a-button :disabled="saving" @click="cancelEdit">取消</a-button>
          <a-button type="primary" :loading="saving" @click="submitContact">保存</a-button>
        </div>
      </section>

      <!-- AREA-ENT-04 企业资质信息卡片（CMP-ENT-05） -->
      <section class="ent-card" :class="{ 'ent-card--editing': isEditing('qualification') }">
        <div class="ent-card__head">
          <span class="ent-card__icon"><SafetyCertificateOutlined /></span>
          <span class="ent-card__titles">
            <span class="ent-card__title">企业资质信息</span>
            <span class="ent-card__note">完善企业资质信息有助于平台运营方核验企业主体</span>
          </span>
          <span v-if="isEditing('qualification')" class="ent-card__badge">编辑中</span>
          <a-button v-else-if="canEditQualification" class="ent-card__edit" @click="startEdit('qualification')">
            <template #icon><EditOutlined /></template>
            编辑
          </a-button>
        </div>

        <div class="ent-grid ent-grid--2">
          <div class="ent-item">
            <label class="ent-item__label">统一社会信用代码</label>
            <span v-if="!isEditing('qualification')" class="ent-item__value ent-item__value--mono">
              {{ profile.creditCode || '—' }}
            </span>
            <a-input
              v-else
              :value="qualificationForm.creditCode"
              class="ent-item__input--mono"
              placeholder="18 位统一社会信用代码（选填）"
              :maxlength="CREDIT_CODE_LENGTH"
              @update:value="handleCreditCodeInput"
            />
            <p v-if="fieldError('creditCode')" class="ent-item__error">{{ fieldError('creditCode') }}</p>
          </div>

          <div class="ent-item">
            <label class="ent-item__label">注册地址</label>
            <span v-if="!isEditing('qualification')" class="ent-item__value">
              {{ profile.registeredAddress || '—' }}
            </span>
            <a-textarea
              v-else
              v-model:value="qualificationForm.registeredAddress"
              :rows="2"
              show-count
              :maxlength="ADDRESS_MAX"
              placeholder="请输入注册地址（选填）"
            />
            <p v-if="fieldError('address')" class="ent-item__error">{{ fieldError('address') }}</p>
          </div>

          <!-- 营业执照（CMP-ENT-19 ~ CMP-ENT-22）：整行，图片与操作并排 -->
          <div class="ent-item ent-item--full">
            <label class="ent-item__label">营业执照</label>

            <template v-if="isEditing('qualification')">
              <div class="ent-license ent-license--editing">
                <ImageUploadField
                  kind="license"
                  :value="qualificationForm.businessLicense"
                  :uploading="uploading === 'license'"
                  :disabled="saving"
                  :error="licenseError"
                  @pick="handleLicensePick"
                  @delete="licenseDeleteOpen = true"
                  @error="(text: string) => (licenseError = text)"
                />
                <div v-if="qualificationForm.businessLicense" class="ent-license__side">
                  <a-button @click="openPreview">
                    <template #icon><EyeOutlined /></template>
                    查看大图
                  </a-button>
                  <span class="ent-license__name">{{ qualificationForm.licenseFileName }}</span>
                </div>
              </div>
            </template>

            <div v-else-if="profile.businessLicense" class="ent-license">
              <button type="button" class="ent-license__thumb" @click="openPreview">
                <img :src="profile.businessLicense" alt="营业执照" />
                <span class="ent-license__thumb-mask"><EyeOutlined /> 查看大图</span>
              </button>
              <div class="ent-license__side">
                <span class="ent-license__name">{{ profile.licenseFileName }}</span>
                <span class="ent-license__hint">点击图片可查看大图并缩放、旋转核对细节</span>
              </div>
            </div>

            <span v-else class="ent-item__value ent-item__value--muted">
              <PictureOutlined class="ent-item__value-icon" />
              未上传
            </span>
          </div>
        </div>

        <div v-if="isEditing('qualification')" class="ent-card__footer">
          <a-button :disabled="saving" @click="cancelEdit">取消</a-button>
          <a-button
            type="primary"
            :loading="saving"
            :disabled="uploading === 'license'"
            @click="submitQualification"
          >
            保存
          </a-button>
        </div>
      </section>
    </template>

    <!-- OVERLAY-01 企业名称变更确认（480px） -->
    <a-modal
      v-model:open="nameConfirmOpen"
      title="确认修改企业名称"
      :width="480"
      :mask-closable="!saving"
      :ok-button-props="{ loading: saving }"
      ok-text="确认修改"
      cancel-text="取消"
      @ok="confirmNameChange"
    >
      <div class="ent-name-diff">
        <p class="ent-name-diff__row">
          <span class="ent-name-diff__label">原名称</span>
          <span class="ent-name-diff__value">{{ profile.name }}</span>
        </p>
        <p class="ent-name-diff__row">
          <span class="ent-name-diff__label">新名称</span>
          <span class="ent-name-diff__value ent-name-diff__value--next">{{ profileForm.name.trim() }}</span>
        </p>
      </div>
      <p class="ent-name-diff__note">
        企业名称变更后，平台内的企业名称将同步更新，包括组织架构中的企业名称、顶栏企业名称与登录时的企业选择列表。
      </p>
    </a-modal>

    <!-- OVERLAY-03 删除企业 Logo 确认（420px） -->
    <a-modal
      v-model:open="logoDeleteOpen"
      title="确认删除企业 Logo"
      :width="420"
      :ok-button-props="{ danger: true }"
      ok-text="确认删除"
      cancel-text="取消"
      @ok="confirmLogoDelete"
    >
      <div class="ent-warn">
        <ExclamationCircleOutlined class="ent-warn__icon" />
        <span>删除后本页将回到未上传状态，确定删除吗？</span>
      </div>
    </a-modal>

    <!-- OVERLAY-04 删除营业执照确认（420px） -->
    <a-modal
      v-model:open="licenseDeleteOpen"
      title="确认删除营业执照"
      :width="420"
      :ok-button-props="{ danger: true }"
      ok-text="确认删除"
      cancel-text="取消"
      @ok="confirmLicenseDelete"
    >
      <div class="ent-warn">
        <ExclamationCircleOutlined class="ent-warn__icon" />
        <span>删除后需重新上传，确定删除吗？</span>
      </div>
    </a-modal>

    <!-- OVERLAY-02 营业执照大图查看 -->
    <LicensePreview
      :open="previewOpen"
      :src="previewSrc"
      :file-name="previewFileName"
      @close="previewOpen = false"
    />

    <!-- OVERLAY-05 企业 Logo 裁剪（560px） -->
    <LogoCropper :open="cropOpen" :file="cropFile" @cancel="cancelCrop" @confirm="confirmCrop" />

    <!-- STATE-ENT-09 未保存修改提示（切换卡片编辑态时） -->
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
      <p class="ent-warn__text">有未保存的修改，确定放弃吗？</p>
    </a-modal>

    <!-- 未保存修改时离开页面的确认（EX-ENT-20） -->
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
      <p class="ent-warn__text">有未保存的修改，确定放弃吗？</p>
    </a-modal>

    <ProtoTip :lines="tipLines" @reset="handleReset">
      <template #extra>
        <a-button size="small" @click="simulateFail">模拟加载失败</a-button>
      </template>
    </ProtoTip>
  </div>
</template>

<script setup lang="ts">
/**
 * PAGE-01 企业中心
 * 【原型说明】对齐《产品交互设计文档-企业中心》v1.0 4.1（PAGE-01）与第 5 章
 * （OVERLAY-01~OVERLAY-05、COMP-ENT-01~COMP-ENT-03）。
 * 覆盖单页三卡片的只读 / 编辑 / 提交中状态、按卡片独立编辑与保存、
 * 企业名称变更二次确认与全局同步、Logo 上传前裁剪、营业执照上传与大图查看（缩放 / 旋转）、
 * 图片格式与大小拦截、删除二次确认、未保存保护与各异常分支（EX-ENT-01~EX-ENT-29）。
 *
 * 【本页 Logo 展示口径】企业中心是企业 Logo 的维护入口，**未上传时展示「未上传 Logo」空态**，
 * 不回退企业名称首字徽标；首字徽标仅用于「选择登录企业」页与顶栏「企业切换」组件。
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import { message } from 'antdv-next'
import {
  ContactsOutlined,
  DisconnectOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  PictureOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  ShopOutlined,
} from '@antdv-next/icons'
import ProtoTip from '@/shared/components/ProtoTip.vue'
import AccountField from '@/modules/auth/components/AccountField.vue'
import { splitPhoneIdentifier } from '@/shared/mock/countryCode'
import { INDUSTRY_OPTIONS, REGION_OPTIONS } from '@/shared/mock/dict'
import { currentPermissions } from '@/modules/role/store'
import ImageUploadField from '../components/ImageUploadField.vue'
import LogoCropper from '../components/LogoCropper.vue'
import LicensePreview from '../components/LicensePreview.vue'
import {
  ADDRESS_MAX,
  CONTACT_NAME_MAX,
  CONTACT_TITLE_MAX,
  CREDIT_CODE_LENGTH,
  NAME_MAX,
  compressLicenseImage,
  currentContact,
  currentProfile,
  loadImageFile,
  normalizeCreditCode,
  normalizeText,
  resetEnterpriseData,
  saveContact,
  saveProfile,
  saveQualification,
  validateAddress,
  validateContactName,
  validateContactPhone,
  validateContactTitle,
  validateCreditCode,
  validateIndustry,
  validateName,
  validateRegion,
} from '../store'
import type { EnterpriseCardKey } from '../store'

const router = useRouter()

/* ---------- 权限点：卡片的编辑入口按权限点显隐（STATE-ENT-03 / UI-ENT-07） ---------- */
const canView = computed(() => has('system:enterprise'))
const canEditProfile = computed(() => has('system:enterprise:profile:edit'))
const canEditContact = computed(() => has('system:enterprise:contact:edit'))
const canEditQualification = computed(() => has('system:enterprise:qualification:edit'))

function has(key: string) {
  return currentPermissions().includes(key)
}

/* ---------- 加载与数据 ---------- */
const loading = ref(true)
const failed = ref(false)
/** 只读展示用的档案快照：与演示数据容器解耦，页面内只更新草稿，不直接改动已保存值 */
const profile = reactive({ ...currentProfile() })
const contact = reactive(currentContact())
/** 只读态企业 Logo 图片加载失败标记（失败时回到「未上传 Logo」空态，不回退首字徽标） */
const logoFailed = ref(false)

/** 把档案中的「省 / 市」展示文本还原为级联选择器的两级值 */
function regionToArray(region: string): string[] {
  return region ? region.split(' / ').filter(Boolean) : []
}

const profileForm = reactive({
  name: profile.name,
  industry: profile.industry,
  region: regionToArray(profile.region),
  logo: profile.logo,
})
const contactForm = reactive({ name: contact.name, title: contact.title, phone: contact.phone })
const qualificationForm = reactive({
  creditCode: profile.creditCode,
  registeredAddress: profile.registeredAddress,
  businessLicense: profile.businessLicense,
  licenseFileName: profile.licenseFileName,
})

/** 【原型说明】模拟页面加载耗时，无真实接口调用 */
function loadData() {
  loading.value = true
  failed.value = false
  window.setTimeout(() => {
    loading.value = false
    syncFromStore()
  }, 420)
}

/** 从演示数据容器重新读取当前企业档案与会话中的联系人条目 */
function syncFromStore() {
  const next = currentProfile()
  profile.name = next.name
  profile.industry = next.industry
  profile.region = next.region
  profile.logo = next.logo
  profile.creditCode = next.creditCode
  profile.registeredAddress = next.registeredAddress
  profile.businessLicense = next.businessLicense
  profile.licenseFileName = next.licenseFileName
  logoFailed.value = false
  const nextContact = currentContact()
  contact.name = nextContact.name
  contact.title = nextContact.title
  contact.phone = nextContact.phone
  resetForms()
}

onMounted(loadData)

/** 当前处于编辑态的卡片；一个时刻最多一张（3.3 通用交互规则） */
const editing = ref<EnterpriseCardKey | null>(null)
const saving = ref(false)
const uploading = ref<'logo' | 'license' | ''>('')
const fieldErrors = reactive<Record<string, string>>({})
const logoError = ref('')
const licenseError = ref('')

const isEditing = (key: EnterpriseCardKey) => editing.value === key

/** 是否存在未保存修改：以各卡片草稿与当前值比对 */
const dirty = computed(() => {
  if (!editing.value) return false
  if (editing.value === 'profile') {
    return (
      normalizeText(profileForm.name) !== profile.name ||
      profileForm.industry !== profile.industry ||
      profileForm.region.join(' / ') !== profile.region ||
      profileForm.logo !== profile.logo
    )
  }
  if (editing.value === 'contact') {
    return (
      normalizeText(contactForm.name) !== contact.name ||
      normalizeText(contactForm.title) !== contact.title ||
      contactForm.phone !== contact.phone
    )
  }
  return (
    normalizeCreditCode(qualificationForm.creditCode) !== profile.creditCode ||
    qualificationForm.registeredAddress.trim() !== profile.registeredAddress ||
    qualificationForm.businessLicense !== profile.businessLicense
  )
})

function resetForms() {
  profileForm.name = profile.name
  profileForm.industry = profile.industry
  profileForm.region = regionToArray(profile.region)
  profileForm.logo = profile.logo
  contactForm.name = contact.name
  contactForm.title = contact.title
  contactForm.phone = contact.phone
  qualificationForm.creditCode = profile.creditCode
  qualificationForm.registeredAddress = profile.registeredAddress
  qualificationForm.businessLicense = profile.businessLicense
  qualificationForm.licenseFileName = profile.licenseFileName
  clearErrors()
}

function clearErrors() {
  Object.keys(fieldErrors).forEach((key) => delete fieldErrors[key])
  logoError.value = ''
  licenseError.value = ''
}

const fieldError = (key: string) => fieldErrors[key] ?? ''

/* ---------- 卡片编辑态切换（ACT-ENT-01 / ACT-ENT-02、EX-ENT-19） ---------- */
function startEdit(key: EnterpriseCardKey) {
  if (editing.value === key || saving.value) return
  // 切换卡片时若有未保存修改，先弹未保存提示，选择「放弃修改」后才切换
  if (dirty.value) {
    pendingCard.value = key
    discardOpen.value = true
    return
  }
  applyEdit(key)
}

function applyEdit(key: EnterpriseCardKey) {
  resetForms()
  editing.value = key
}

const pendingCard = ref<EnterpriseCardKey | null>(null)
const discardOpen = ref(false)

function confirmDiscard() {
  discardOpen.value = false
  const target = pendingCard.value
  pendingCard.value = null
  if (target) applyEdit(target)
}

function cancelEdit() {
  editing.value = null
  resetForms()
}

/* ---------- 企业档案保存（ACT-ENT-03、OVERLAY-01） ---------- */
const nameConfirmOpen = ref(false)

function validateProfile(): boolean {
  clearErrors()
  const nameError = validateName(profileForm.name)
  if (nameError) fieldErrors.name = nameError
  const industryError = validateIndustry(profileForm.industry)
  if (industryError) fieldErrors.industry = industryError
  const regionError = validateRegion(profileForm.region)
  if (regionError) fieldErrors.region = regionError
  return !nameError && !industryError && !regionError
}

function submitProfile() {
  if (saving.value || uploading.value) return
  if (!validateProfile()) return
  // 企业名称有变更时先弹出变更确认，确认后才提交（EX-ENT-07）
  if (normalizeText(profileForm.name) !== profile.name) {
    nameConfirmOpen.value = true
    return
  }
  void doSaveProfile()
}

function confirmNameChange() {
  void doSaveProfile()
}

async function doSaveProfile() {
  nameConfirmOpen.value = false
  if (saving.value) return
  const nameChanged = normalizeText(profileForm.name) !== profile.name
  const hasChange = dirty.value
  saving.value = true
  try {
    await saveProfile({
      name: profileForm.name,
      industry: profileForm.industry,
      region: profileForm.region.join(' / '),
      logo: profileForm.logo,
    })
    syncFromStore()
    editing.value = null
    // 四项均未变化时直接回到只读态，不产生保存请求、不提示（PRD F-ENT-02 业务规则）
    if (hasChange) message.success(nameChanged ? '保存成功，企业名称已同步' : '保存成功')
  } catch {
    message.error('保存失败，请重试')
  } finally {
    saving.value = false
  }
}

/* ---------- 企业联系人保存（ACT-ENT-04） ---------- */
function validateContactField(field: 'name' | 'title' | 'phone') {
  if (field === 'name') {
    const error = validateContactName(contactForm.name)
    if (error) fieldErrors.contactName = error
    else delete fieldErrors.contactName
  }
  if (field === 'title') {
    const error = validateContactTitle(contactForm.title)
    if (error) fieldErrors.contactTitle = error
    else delete fieldErrors.contactTitle
  }
  if (field === 'phone') {
    const error = validateContactPhone(contactForm.phone)
    if (error) fieldErrors.contactPhone = error
    else delete fieldErrors.contactPhone
  }
}

function validateContact(): boolean {
  clearErrors()
  validateContactField('name')
  validateContactField('title')
  validateContactField('phone')
  return !fieldErrors.contactName && !fieldErrors.contactTitle && !fieldErrors.contactPhone
}

async function submitContact() {
  if (saving.value) return
  if (!validateContact()) return
  if (!dirty.value) {
    cancelEdit()
    return
  }
  saving.value = true
  try {
    await saveContact({
      name: contactForm.name,
      title: contactForm.title,
      phone: contactForm.phone,
    })
    syncFromStore()
    editing.value = null
    message.success('保存成功')
  } catch {
    message.error('保存失败，请重试')
  } finally {
    saving.value = false
  }
}

/* ---------- 企业资质信息保存（ACT-ENT-05） ---------- */
function handleCreditCodeInput(value: string) {
  qualificationForm.creditCode = normalizeCreditCode(value)
}

function validateQualification(): boolean {
  clearErrors()
  const creditError = validateCreditCode(qualificationForm.creditCode, profile.orgId)
  if (creditError) fieldErrors.creditCode = creditError
  const addressError = validateAddress(qualificationForm.registeredAddress)
  if (addressError) fieldErrors.address = addressError
  return !creditError && !addressError
}

async function submitQualification() {
  if (saving.value || uploading.value) return
  if (!validateQualification()) return
  if (!dirty.value) {
    cancelEdit()
    return
  }
  saving.value = true
  try {
    await saveQualification({
      creditCode: qualificationForm.creditCode,
      registeredAddress: qualificationForm.registeredAddress,
      businessLicense: qualificationForm.businessLicense,
      licenseFileName: qualificationForm.licenseFileName,
    })
    syncFromStore()
    editing.value = null
    message.success('保存成功')
  } catch {
    message.error('保存失败，请重试')
  } finally {
    saving.value = false
  }
}

/* ---------- 企业 Logo 上传与裁剪（ACT-ENT-06 / ACT-ENT-07、OVERLAY-05） ---------- */
const cropOpen = ref(false)
const cropFile = ref<File | null>(null)
const logoDeleteOpen = ref(false)

function handleLogoPick(file: File) {
  logoError.value = ''
  // 通过类型与大小校验后进入裁剪浮层，裁剪结果按正方形保存（COMP-ENT-03）
  cropFile.value = file
  cropOpen.value = true
}

/** 裁剪确认：回填裁剪结果并模拟上传（待保存态，仍需点卡片「保存」） */
async function confirmCrop(dataUrl: string) {
  cropOpen.value = false
  cropFile.value = null
  uploading.value = 'logo'
  await new Promise((resolve) => window.setTimeout(resolve, 520))
  profileForm.logo = dataUrl
  uploading.value = ''
}

/** 裁剪取消：放弃本次裁剪、保留原 Logo，不产生任何变更（EX-ENT-26） */
function cancelCrop() {
  cropOpen.value = false
  cropFile.value = null
}

function confirmLogoDelete() {
  logoDeleteOpen.value = false
  profileForm.logo = ''
}

/* ---------- 营业执照上传与大图查看（ACT-ENT-09 ~ ACT-ENT-12、OVERLAY-02） ---------- */
const licenseDeleteOpen = ref(false)
const previewOpen = ref(false)
const previewSrc = ref('')
const previewFileName = ref('')

async function handleLicensePick(file: File) {
  licenseError.value = ''
  try {
    const image = await loadImageFile(file)
    uploading.value = 'license'
    await new Promise((resolve) => window.setTimeout(resolve, 520))
    qualificationForm.businessLicense = compressLicenseImage(image)
    qualificationForm.licenseFileName = file.name
  } catch {
    licenseError.value = '图片上传失败，请重试'
  } finally {
    uploading.value = ''
  }
}

function confirmLicenseDelete() {
  licenseDeleteOpen.value = false
  qualificationForm.businessLicense = ''
  qualificationForm.licenseFileName = ''
}

/** 查看大图：编辑态读草稿值、只读态读已保存值（ACT-ENT-10 / ACT-ENT-12） */
function openPreview() {
  const inEdit = isEditing('qualification')
  previewSrc.value = inEdit ? qualificationForm.businessLicense : profile.businessLicense
  previewFileName.value = inEdit ? qualificationForm.licenseFileName : profile.licenseFileName
  if (!previewSrc.value) return
  previewOpen.value = true
}

/* ---------- 联系电话展示 ---------- */
function formatPhone(canonical: string): string {
  if (!canonical) return '—'
  const { countryCode, local } = splitPhoneIdentifier(canonical)
  return `${countryCode} ${local}`
}

/* ---------- 离开页面保护（EX-ENT-20） ---------- */
const leaveOpen = ref(false)
let resolvingLeave: ((value: boolean) => void) | null = null

function handleBeforeUnload(event: BeforeUnloadEvent) {
  if (!dirty.value && !saving.value) return
  event.preventDefault()
  event.returnValue = ''
}

onMounted(() => window.addEventListener('beforeunload', handleBeforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', handleBeforeUnload))

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
  resetForms()
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
  resetEnterpriseData()
  editing.value = null
  loadData()
}

const tipLines = [
  '企业档案与企业 Logo 共用同一权限点（system:enterprise:profile:edit）与同一次保存；企业联系人、企业资质信息各自独立。',
  '本页是企业 Logo 的维护入口：未上传时展示「未上传 Logo」空态，不回退企业名称首字徽标（首字徽标仅用于「选择登录企业」页与顶栏企业切换）。',
  '企业名称变更会弹出确认弹窗，确认后同步组织架构企业根节点名称、顶栏当前企业名称与「选择登录企业」列表。',
  '企业 Logo 上传 / 更换需先经裁剪浮层（固定 1:1、可拖动与缩放、不留白、不支持旋转），裁剪结果按正方形保存。',
  '营业执照不做裁剪，大图查看提供缩放与旋转，支持滚轮缩放与拖拽平移，不提供下载与打印。',
  '图片仅支持 JPG / PNG 且不超过 5MB，校验在裁剪前执行；演示数据存于浏览器 localStorage。',
]
</script>
