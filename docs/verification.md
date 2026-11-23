# 验证记录

验收日期：2026-11-19。环境：Node.js 22.22.2、Next.js 16.4.6、React 19.3.1。应用运行于 http://127.0.0.1:3000。

## 自动验证

| 检查             | 结果           | 覆盖内容                                                                  |
| ---------------- | -------------- | ------------------------------------------------------------------------- |
| npm run build    | 通过           | 生产编译、TypeScript、路由构建                                            |
| npm run lint     | 通过           | ESLint、React 与 Next.js 规则                                             |
| npm test         | 10/10 通过     | 条件组合、事件时间边界、严格顺序漏斗、稳定分组、变量替换和 Journey 图校验 |
| npm run test:api | 122 项检查通过 | 在 3101 端口使用独立临时 SQLite，验收后自动清理；见下方说明               |

API 验收包含六类资源的服务端分页、搜索、输入校验、同源写入检查、跨项目访问保护、CRUD、引用删除保护、模板内容与渠道状态保存、活动发布和 A/B 模拟、Journey 发布及版本、不可变运行快照、看板布局、漏斗和 Overview 统计、CSV 导出、18 条页面路由，以及完整停止并重启服务后的数据持久化。单项目重置也验证了输入确认、恢复初始数据和保留另一项目数据。

脚本：[scripts/verify-api.mjs](../scripts/verify-api.mjs)。测试不使用当前工作区数据库，也不联系消息供应商。

## 浏览器验收

使用真实页面控件完成以下操作，结果保存在工作区 SQLite 中，可直接继续查看。

| 操作                                         | 可核对结果                                                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 新建 Returning premium shoppers 分群         | plan = Premium；250 名用户、Email 可达 200 名；保存和刷新后一致                                  |
| 由分群创建 A little weekend inspiration 活动 | Email、调用模板、A/B 50/50、发布和模拟；发送 200、点击 38、转化 11；运行记录的 A/B 人数为 104/96 |
| 新建 Personal welcome note 模板              | 主题和正文含 first_name 变量；Alex 个性化预览；保存、重开后一致                                  |
| 修改 Email 渠道                              | sender 为 team@shopwise.example.com；服务端校验后 Connected；刷新后配置保留                      |
| 修改 New customer welcome Journey            | 节点改名为 A warm welcome back；保存为第 2 版、发布并模拟；1,000 名进入用户，不同分支有各自人数  |
| 保存漏斗人群 Completed purchase path         | App Launched → Product Viewed → Added to Cart → Charged；551 人，保存到分群后仍为 551 人         |
| 从分群详情切换到 Streamly                    | 回到分群列表；仅有该项目的 10 个初始分群，All users 为 160 人；切回 Shopwise 后新增数据仍在      |
| 活动表格翻页                                 | 第 2 页展示第 11–13 条；页码写入 URL                                                             |
| 390 × 844 窄屏检查                           | 侧栏收为图标；表格在容器内横向滚动，主要按钮可见                                                 |

以上数值是验收时的演示数据快照，再次运行模拟会新增事件并改变统计。

## 页面截图

| 页面             | 截图                                                   |
| ---------------- | ------------------------------------------------------ |
| Overview         | [overview.png](screenshots/overview.png)               |
| 活动表格         | [campaign-table.png](screenshots/campaign-table.png)   |
| 模板编辑         | [template-editor.png](screenshots/template-editor.png) |
| 渠道管理         | [channels.png](screenshots/channels.png)               |
| Journey 执行画布 | [journey.png](screenshots/journey.png)                 |
| 窄屏活动表格     | [mobile-table.png](screenshots/mobile-table.png)       |

当前为全栈演示版。真实供应商投递、生产账号认证、自动定时任务及其余高级分析模块不属于本次已验证交付范围，详细边界见 [实际架构](architecture.md)。

## 2026-11-20 Netlify 上线验收

生产地址：[clevertap-clone.netlify.app](https://clevertap-clone.netlify.app)。已按用户明确选择开放公开演示访问；GitHub main 分支已连接自动部署。

| 检查             | 结果                                                                        |
| ---------------- | --------------------------------------------------------------------------- |
| 生产发布         | 通过，Netlify 确认已应用 workspace_snapshots 迁移                           |
| 本地回归         | Lint、TypeScript、生产构建通过；11 个单元测试和 122 项隔离 API 检查通过     |
| 线上接口         | scripts/verify-deployment.mjs 的 73 项检查通过                              |
| 云端持久化       | 接口返回 storage=netlify-postgres，响应带 X-Workspace-Storage               |
| 并发写入         | 两个并发创建的模板均保留，编辑内容在后续独立请求中一致                      |
| 渠道与查询       | 配置校验状态保存，分群人数 250，漏斗、统计、Schema 及用户接口可用           |
| 项目与同源保护   | 跨项目对象返回 404，外部 Origin 写请求返回 403                              |
| 浏览器保存与刷新 | 新建 Welcome from the cloud 模板，保存 Welcome 类别、主题和正文；刷新后保留 |
| 重新部署后恢复   | 从 a12fe43 发布到 5ffa9f0 后，模板 tem-6d94fb65-48b 的内容仍一致            |

最终核对的生产部署 ID：6b00535d0788e9920f1f8691。线上脚本只清理自己的临时模板和渠道，保留浏览器创建的欢迎模板。云端存储适配与当前限制见 [部署说明](netlify-deployment.md)。

线上截图：[首页](screenshots/netlify-overview.png)、[欢迎模板](screenshots/netlify-template.png)。

## 2026-11-23 SMS 补齐

- `npm run build`、ESLint 与 TypeScript 检查通过。
- `npm test`：15 项通过，包含 4 项短信协议、长度与回执测试。
- `npm run test:api`：122 项原有全栈回归通过。
- `npm run test:sms`：85 项通过。独立临时数据库；覆盖服务商配置、跨项目隔离、优先级切换、幂等及并发重复提交、Twilio/Nexmo/Generic OAuth 请求、回调验签、提前到达的回执、Campaign/Journey 联动、归档和重启持久化。服务商 HTTP 传输为模拟，不发送真实短信。
- 浏览器实际创建 Twilio/Nexmo 演示配置、优先级组，发送演示短信并记录 Delivered/Clicked；日志与统计对应更新。
- 390px 窄屏检查修复顶部按钮溢出后，页面宽度与 viewport 均为 390px；恢复默认窗口尺寸。
- 服务商操作菜单使用独立浮层，避免被表格滚动区域裁切。
- 交互与 React 检查：组件按功能拆分、数据请求独立并行、effect 清理、表单标签与反馈、弹窗键盘关闭；复用项目已有组件和样式。

界面证据：[服务商表单](screenshots/sms-provider-settings.png)、[优先级组](screenshots/sms-provider-groups.png)、[演示回执](screenshots/sms-test-receipt.png)、[窄屏](screenshots/sms-mobile.png)。实际接入方式和剩余生产边界见 [SMS 文档](sms.md)。
