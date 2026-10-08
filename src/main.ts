import { createApp } from 'vue'
import {
  Alert,
  App as AntdApp,
  Breadcrumb,
  Button,
  Card,
  Cascader,
  Checkbox,
  Col,
  ConfigProvider,
  DatePicker,
  Descriptions,
  Drawer,
  Dropdown,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Pagination,
  Popconfirm,
  Popover,
  Progress,
  Radio,
  Result,
  Row,
  Segmented,
  Select,
  Skeleton,
  Slider,
  Space,
  Statistic,
  Steps,
  Switch,
  Table,
  Tag,
  TimePicker,
  Tooltip,
  Tree,
  TreeSelect,
  Typography,
  Upload,
} from 'antdv-next'
import 'antdv-next/dist/reset.css'
import 'antdv-next/dist/antd.css'
import router from './router'
import App from './App.vue'
import './styles/base.css'
import './styles/components.css'
import './styles/auth.css'
import './styles/admin.css'
import './styles/org.css'
import './styles/role.css'
import './styles/member.css'
import './styles/enterprise.css'
import './styles/log.css'
import './styles/alarm.css'
import './styles/device.css'
import './styles/ota.css'
import './styles/location.css'
import './styles/load-strategy.css'

/**
 * 【原型说明】antdv-next 按需注册：只引入原型实际使用的组件。
 * 不用 app.use(Antd) 是因为其内部会遍历全部组件，导致打包体积无法 tree-shaking。
 * 组件自带 install 时会一并注册子组件（如 Input.Password、Descriptions.Item）。
 */
const components = [
  AntdApp,
  Alert,
  Breadcrumb,
  Button,
  Card,
  Cascader,
  Checkbox,
  Col,
  ConfigProvider,
  DatePicker,
  Descriptions,
  Drawer,
  Dropdown,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Pagination,
  Popconfirm,
  Popover,
  Progress,
  Radio,
  Result,
  Row,
  Segmented,
  Select,
  Skeleton,
  Slider,
  Space,
  Statistic,
  Steps,
  Switch,
  Table,
  Tag,
  TimePicker,
  Tooltip,
  Tree,
  TreeSelect,
  Typography,
  Upload,
]

const app = createApp(App)

components.forEach((component) => {
  const c = component as { install?: (a: unknown) => void; name?: string }
  if (typeof c.install === 'function') app.use(component as never)
  else if (c.name) app.component(c.name, component as never)
})

app.use(router)
app.mount('#app')
