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

当前为本地全栈演示版。真实供应商投递、生产账号认证、自动定时任务及其余高级分析模块不属于本次已验证交付范围，详细边界见 [实际架构](architecture.md)。
