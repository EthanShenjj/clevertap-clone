# CleverTap Clone

基于 Next.js 16、React 19、SQLite 的全栈客户互动工作台。列表、模板、渠道、分群、活动、旅程及看板都通过 REST API 读写数据库。

[在线演示：clevertap-clone.netlify.app](https://clevertap-clone.netlify.app) · GitHub main 分支推送后由 Netlify 自动构建和发布。

## 本地运行

要求 Node.js 22.13+，已使用 22.22.2 验证。

```bash
npm ci
npm run dev
```

访问 [http://127.0.0.1:3000](http://127.0.0.1:3000)。首次请求自动建表并填充两个项目的数据。默认数据库为 data/clevertap.sqlite，服务重启后保留。DATABASE_PATH 可以指定另一个 SQLite 文件。

```bash
npm run build
npm run start
```

## 已实现

- Overview、Trends、严格顺序 Funnels，统计由后端计算。
- 表格服务端搜索、分页、排序、状态/渠道筛选及 CSV 导出。
- Segments 属性和事件条件、AND/OR、人数与可达性、保存、编辑、用户画像及时间线。
- Templates 新建、编辑、复制和删除；邮件内容块增删排序及四种渠道预览。
- Channels 配置编辑、后端校验、连接状态保存，8 种渠道配置入口。
- Campaigns 受众、模板调用、个性化预览、A/B、排期、草稿、发布、暂停与模拟结果。
- Journeys 节点添加/拖放、连线、配置、撤销重做、校验、草稿、版本和模拟路径。
- Boards 卡片添加、调整尺寸、拖动排序和持久化。
- Schema、项目设置、时区、项目隔离及单项目演示数据重置。

配置和查询是真实后端调用。消息发送、供应商连接检查与用户响应采用演示模拟；不联系外部供应商。

## Netlify 部署

已配置 Next.js 服务端运行时和 Netlify Database。云端通过 PostgreSQL 事务保存压缩的工作区快照，SQLite 只在每次请求的临时目录中计算；函数重启或重新部署不会依赖临时文件恢复数据。本地仍使用 data/clevertap.sqlite。

部署设置、存储边界和运行方式见 [Netlify 部署说明](docs/netlify-deployment.md)。本地工作区数据库不会上传，线上首次访问会建立独立的初始演示数据。

## 演示与验证

工作区保留了浏览器验收创建的 Returning premium shoppers 分群、Personal welcome note 模板、A little weekend inspiration 活动。

建议从分群选择 plan = Premium 开始：250 名用户，Email 可达 200 名；保存后创建 Email 活动、选择模板、启用 A/B、发布并 Run simulation，再查看运行和用户事件。

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:api
```

test:api 需要先构建。测试在 3101 端口使用临时数据库验证接口与重启持久化，结束后清理自己的测试数据，不操作当前工作区数据库。

## 文档和源码

- [API 文档](docs/api.md)
- [实际架构与边界](docs/architecture.md)
- [验证记录](docs/verification.md)
- 前端：src/features、src/components。
- 后端：src/server/database.ts、src/server/services.ts、src/server/api.ts。
- API 入口：src/app/api/[...path]/route.ts。

- [建设方案](docs/implementation-plan.md)：范围、页面、交互、架构、排期与验收。
- [官方资料目录](docs/reference-catalog.md)：专题视频、产品手册与参考版本说明。
- [实施任务清单](docs/implementation-backlog.md)：按依赖排序的开发任务和完成条件。

最初方案及参考资料保留在上述文档中；实际执行已按新增要求改为前后端与 SQLite 持久化。
