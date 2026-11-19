# API 文档

基础地址：http://127.0.0.1:3000/api。所有业务读写 SQLite。

通过 projectId 选择 shopwise 或 streamly，省略默认为 shopwise。读取、更新、删除及关联引用均检查项目范围。当前为本地演示工作区，不包含生产账号认证。

写请求使用 Content-Type: application/json，浏览器 Origin 必须同源。

## 通用 CRUD

适用资源：segments、campaigns、templates、channels、journeys、boards。

| 方法   | 路径                     | 用途                 |
| ------ | ------------------------ | -------------------- |
| GET    | /:resource               | 列表                 |
| POST   | /:resource               | 新建                 |
| GET    | /:resource/:id           | 详情                 |
| PATCH  | /:resource/:id           | 更新                 |
| DELETE | /:resource/:id           | 删除，检查引用与状态 |
| POST   | /:resource/:id/duplicate | 复制为新对象         |
| GET    | /:resource/summary       | 总数、状态和渠道分布 |
| GET    | /exports/:resource       | 按筛选结果导出 CSV   |

列表参数：projectId、page、pageSize（最多 100）、search、status、channel、sort、direction（asc / desc）。

```bash
curl 'http://127.0.0.1:3000/api/campaigns?projectId=shopwise&page=1&pageSize=10&channel=Email&sort=name&direction=asc'
```

```json
{ "data": [], "meta": { "total": 12, "page": 1, "pageSize": 10, "pages": 2 } }
```

## 业务接口

| 方法        | 路径                    | 用途                                              |
| ----------- | ----------------------- | ------------------------------------------------- |
| POST        | /segments/evaluate      | 计算人数、样本、ID、渠道可达性                    |
| GET         | /people                 | 搜索、分页、排序、segmentId / platform / ids 过滤 |
| GET         | /people/:id             | 用户画像                                          |
| GET         | /people/:id/events      | 用户事件和模拟事件                                |
| GET         | /exports/people         | 用户导出                                          |
| POST        | /channels/:id/test      | 校验并保存连接状态                                |
| POST        | /campaigns/:id/publish  | 发布校验                                          |
| POST        | /campaigns/:id/status   | 暂停或恢复                                        |
| POST        | /campaigns/:id/simulate | 保存演示结果、配置快照、用户事件                  |
| GET         | /campaigns/:id/runs     | 历史运行                                          |
| POST        | /journeys/:id/publish   | 图结构和内容校验后发布                            |
| POST        | /journeys/:id/status    | 暂停或恢复                                        |
| POST        | /journeys/:id/simulate  | 节点、分支、等待和超时模拟                        |
| GET         | /journeys/:id/runs      | 原版本快照、人数和用户轨迹                        |
| GET         | /analytics              | 总览指标、日期序列、平台、事件和地区              |
| POST        | /analytics/query        | trends / funnel 分析                              |
| GET         | /schema                 | 事件和属性字典                                    |
| GET         | /projects               | 项目列表                                          |
| GET / PATCH | /projects/:id           | 项目配置                                          |
| POST        | /projects/:id/reset     | confirm: 项目ID，重置该项目演示数据               |
| GET         | /health                 | 状态和数据表数量                                  |

## 请求示例

创建分群或计算接口的 query：

```json
{
  "name": "Premium customers",
  "query": {
    "combinator": "and",
    "rules": [
      {
        "id": "rule-1",
        "kind": "property",
        "field": "plan",
        "operator": "equals",
        "value": "Premium",
        "days": 30
      }
    ]
  }
}
```

属性：name、email、country、city、platform、plan、value。事件规则使用 kind: event、did / did_not、事件名、次数和天数。目前为一级 AND/OR。漏斗人群在 query.funnel 中保留原查询定义。

新建模板：

```json
{ "name": "A personal welcome", "channel": "Email", "category": "Welcome" }
```

消息 content 包含 title、subject、preheader、body、cta、url、image、background、position、blocks。Email blocks 为 id、type、value，支持 text / image / button。变量支持 {{name}}、{{first_name}}、{{email}}、{{city}}、{{plan}}。

更新渠道：

```json
{
  "provider": "Amazon SES",
  "config": {
    "sender": "hello@shopwise.example.com",
    "domain": "shopwise.example.com",
    "appId": "app_shopwise"
  }
}
```

配置检查不联系外部供应商，也不需要供应商密钥。修改实际配置后需要重新验证。

漏斗查询：

```json
{
  "type": "funnel",
  "steps": ["App Launched", "Product Viewed", "Added to Cart", "Charged"],
  "windowDays": 7,
  "from": "2026-10-21",
  "to": "2026-11-19"
}
```

趋势使用 events 数组及 metric: users / events / revenue。分析支持 from、to（包含界面结束日）和 segmentId；内部按项目时区形成左闭右开区间。

运行中活动先暂停再编辑；运行中 Journey 编辑产生新草稿版本，历史运行保留原快照。A/B 使用稳定哈希分组。

## 错误

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Enter a name with at least 2 characters.",
    "fields": { "name": "Required" }
  },
  "requestId": "..."
}
```

400 参数错误，403 非同源写入，404 对象或项目不存在，409 状态/引用冲突，415 非 JSON，422 字段或发布校验失败。
