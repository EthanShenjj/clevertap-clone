# SMS 配置与验证

本次补齐的是公开演示站的 SMS 配置与交互流程，并提供受保护的真实测试短信接口。Campaign 和 Journey 仍通过手动模拟运行，不会向真实受众批量发送短信。

## 页面

入口：`Settings → Channels → SMS`，地址 `/settings/channels/sms`。

- **SMS Direct**：Twilio、Nexmo/Vonage 的独立表单。Twilio 配置 Account SID、From Number、Messaging Service SID；Nexmo 配置 Sender ID。凭据使用服务端管理的 profile，浏览器不能读取或保存真实 token。
- **SMS Connect**：Other (Generic)，支持 GET/POST、JSON/form、Headers、无鉴权/Basic/OAuth 2.0 Client Credentials、动态变量和单记录测试批次。批次配置保存 1–1,000 上限；本项目没有批量投递任务引擎。
- **Provider Groups**：最多 10 个已校验服务商，按钮调整顺序，支持默认路由。确定的请求拒绝会切换下一个服务商；超时或 5xx 等结果不明确时停止切换，以免重复发送。
- **Delivery logs**：按服务商、演示/真实模式、日期、状态、关键字筛选，分页、导出前 100 条，查看尝试记录和回执。统计展示发送、送达、点击、回复、错误、送达率与 UTC 每日活动。发生切换时，将送达和点击归属到实际发送服务商。
- **Send test SMS**：演示发送不联系外部服务商；发送后可手动生成送达、失败、点击、回复回执。真实发送必须启用并输入发送权限 token。

配置保存与校验分开记录：`Connected / Demo ready` 仅代表字段通过校验；不会冒充真实鉴权或送达成功。首次请求成功进入 `Sent`，只有收到回执才进入 `Delivered`。

服务商支持编辑、默认、归档、删除。归档前展示受影响活动，确认后停止相关 Campaign/Journey，保留历史数据；归档不可恢复。删除前必须移除分组和活动引用，并确认永久删除。

Campaign 的 Start here 和 Journey 的 SMS 节点可选择服务商或服务商组，选择结果保存到后端。手动模拟执行同一优先级路由，并产生 SMS 发送日志；不调用真实服务商。

## 接口

所有接口以 `/api` 为前缀，使用 `?projectId=shopwise` 或 `streamly`，跨项目 ID 不可引用。

| 方法             | 路径                          | 用途                                                  |
| ---------------- | ----------------------------- | ----------------------------------------------------- |
| GET              | `/sms`                        | 服务商、分组、可用凭据 profile 名称和真实发送是否启用 |
| GET/POST         | `/sms/providers`              | 读取/新建服务商                                       |
| GET/PATCH/DELETE | `/sms/providers/:id`          | 查看、更新、删除服务商                                |
| POST             | `/sms/providers/:id/validate` | 字段校验并标记为演示可用                              |
| POST             | `/sms/providers/:id/default`  | 设为默认路由                                          |
| GET              | `/sms/providers/:id/impact`   | 查看归档影响                                          |
| POST             | `/sms/providers/:id/archive`  | `{"confirm":true}` 确认归档                           |
| GET/POST         | `/sms/groups`                 | 读取/新建优先级组                                     |
| GET/PATCH/DELETE | `/sms/groups/:id`             | 查看、更新、删除分组                                  |
| POST             | `/sms/groups/:id/default`     | 将组设为默认路由                                      |
| POST             | `/sms/test`                   | 测试发送                                              |
| GET              | `/sms/messages`               | 筛选、分页读取日志                                    |
| GET              | `/sms/stats`                  | 同条件统计                                            |
| POST             | `/sms/messages/:id/receipt`   | 演示消息回执；真实消息禁止手动改状态                  |
| POST             | `/sms/callbacks/:providerId`  | 已验签的真实服务商回执                                |
| GET              | `/sms/callbacks/:providerId`  | Nexmo 签名回执兼容入口                                |

测试发送 body：

```json
{
  "target": "sms-provider-id 或 group:smsg-group-id；空字符串使用默认路由",
  "to": "+12025550123",
  "body": "Hello from Shopwise",
  "mode": "demo",
  "idempotencyKey": "调用方生成并在重试时复用的唯一请求标识"
}
```

同一 key、相同内容返回原记录；更改号码、内容、模式或路由返回 409。并发请求在 HTTP 投递前先占用同一记录；重复/乱序回执不会重复增加统计或倒退终态。回执早于 HTTP 响应时，按自有 messageId 关联并合并。

## 真实测试发送

当前 Netlify 站点保持演示模式，没有配置服务商凭据或发送真实短信。要启用真实测试，由部署所有者私下配置环境变量；不要把凭据放进 Git、页面表单或 `NEXT_PUBLIC_*`：

- `SMS_LIVE_ENABLED=true`
- `SMS_ADMIN_TOKEN`：真实测试 API 的 Bearer token。
- `SMS_TEST_RECIPIENTS`：允许测试的 E.164 号码，逗号分隔。
- `SMS_PUBLIC_URL`：正式站点来源地址，用于生成和验证回调 URL。
- `SMS_ALLOWED_HOSTS`：Generic Endpoint / OAuth Token Endpoint 的精确主机白名单。仅允许 HTTPS 公网地址，拒绝本机、私网和重定向。
- `SMS_CREDENTIALS_JSON`：服务商 profile 映射，页面只显示 profile 名称。

profile 字段：Twilio 使用 `authToken`；Nexmo 使用 `apiKey`、`apiSecret`、`signatureSecret` 和 `signatureMethod`（默认 sha256，可配置官方支持的算法）；Generic 根据认证方式使用 `username/password` 或 `clientId/clientSecret`，以及 `callbackSecret`。

Generic 请求中的敏感 Header 使用 `$$Secret_apiKey` 这样的引用；实际值在服务端替换。Parameters 支持 `$$To`、`$$Body`、`$$TemplateID`、`$$TemplateVariables`、`$$MessageID`、`$$CampaignID`、`$$CallbackURL`、`$$Sender`。JSON 先解析后替换，短信中的引号和换行不会破坏请求结构。

真实测试上限为每项目每小时 20 条。公开日志隐藏真实号码和内容，只有带所有者 token 的 API 请求能读取完整内容；真实内容搜索也要求权限。演示与真实统计分开。

### 回执验证

- **Twilio**：验证 `X-Twilio-Signature`（原始 URL 和排序后的表单参数）；接受状态回执。将配置页 URL 用作 Twilio 入站 webhook 时，可按最近一次匹配的发送号码记录回复，返回空 TwiML。
- **Nexmo/Vonage**：需要在服务商端启用签名回执；校验 `sig`、时间戳和 signature secret。兼容 GET、form POST、JSON POST。
- **Generic**：JSON 为 `{"messageId":"发送时的 $$MessageID","event":"delivered","errorCode":"可选"}`。事件可为 sent/delivered/failed/clicked/replied。Headers：`X-SMS-Timestamp` 为 Unix 秒；`X-SMS-Signature` 为 `HMAC-SHA256(callbackSecret, timestamp + "." + 原始body)` 的十六进制串，允许 5 分钟时差。

Twilio/Nexmo 原生接口、Generic OAuth/Basic/HTTP 请求已实现，自动测试使用模拟服务商传输验证格式和回执，不等于真实账号端到端验收。

## 数据与边界

服务商复用 `channels` 表并增加 `sms` 配置；新增 `sms_groups` 和 `sms_messages`。数据库启动时向现有库添加表；原有 SMS 数据保留并兼容显示。Netlify 继续使用现有 PostgreSQL 工作区快照持久化。项目重置会清理对应 SMS 数据。

当前方案适合交互演示和少量人工测试。它没有生产投递队列、自动调度、运营商模板审核、全套服务商适配、发送审批或完整用户权限体系。工作区快照和外部短信 API 之间没有分布式事务，不能承诺存储故障/进程崩溃下的 exactly-once；正式批量发送需改为独立投递任务、持久化 outbox 和回执重试机制。

## 验证

- `npm test`：包含短信长度、JSON 动态替换、重复和乱序回执。
- `npm run test:sms`：临时独立数据库，模拟 Twilio/Nexmo/Generic HTTP；检查分组切换、鉴权、签名、项目隔离、幂等、Campaign/Journey 路由、归档及重启持久化。
- `npm run test:api`：保留原有全栈接口回归。

## 官方参考

- [SMS Setup](https://docs.clevertap.com/docs/setup-sms)
- [Twilio 配置](https://docs.clevertap.com/docs/twilio)
- [Generic SMS](https://docs.clevertap.com/docs/generic-sms)
- [服务商管理](https://docs.clevertap.com/docs/sms-provider-operations)
- [Twilio Message API](https://www.twilio.com/docs/messaging/api/message-resource)
- [Twilio 回调验签](https://www.twilio.com/docs/usage/security)
- [Vonage 签名规则](https://developer.vonage.com/en/getting-started/concepts/signing-messages)
