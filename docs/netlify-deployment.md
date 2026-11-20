# Netlify 部署

站点：clevertap-clone。站点 ID：367e8179-1590-4400-9d98-374201248610。

## 构建与运行

- Node.js 22.22.2，构建命令 npm run build，发布目录 .next。
- Netlify 自动安装 Next.js Runtime，将 SSR 和 /api 路由部署到 Node.js Functions。
- @netlify/database 自动提供托管 PostgreSQL；迁移文件在 netlify/database/migrations。
- 云函数环境自动启用云端存储，也可显式传入 WORKSPACE_STORAGE=netlify。NETLIFY_DB_URL 由平台提供，不写入源码。
- .netlify 已加入 .gitignore；本地 SQLite 数据也从 Git 和服务端输出追踪中排除。

使用已经关联站点的官方 CLI：

```bash
netlify deploy --remote --context deploy-preview
netlify deploy --remote --prod --context production
```

首次部署先创建预览并验证，之后部署生产。当前使用 CLI 发布，未配置 Git 自动部署。

## 持久化机制

本地继续用原生 SQLite。云端的权威数据为 PostgreSQL 中压缩的完整工作区快照。每个 API 请求创建独立的临时 SQLite，临时目录在完成后清理。

1. 开启 PostgreSQL 事务，SELECT FOR UPDATE 锁定工作区快照行。
2. 解压快照；首次访问无快照时建立初始演示数据。
3. 在请求专属 SQLite 中执行现有业务服务。
4. 成功写操作在 WAL checkpoint 和关闭 SQLite 后读取快照，压缩并更新 PostgreSQL。
5. COMMIT 成功后返回响应；异常回滚，存储不可用返回 503。

所有请求通过数据库锁串行处理，避免跨实例丢失更新；此兼容层适合当前演示数据量。扩大访问量时，应将业务表及查询直接迁移到 PostgreSQL，避免每次请求恢复整个快照。

本地运行时创建的分群、模板等不会自动导入线上。线上使用独立演示数据，模拟投递仍不调用外部消息供应商。

## 访问

新站最初继承 Netlify 团队的默认登录保护。用户已于 2026-11-20 明确选择开放公开演示访问，站点现已关闭密码和团队登录要求。

生产运行状态和云端验收结果在实际完成后记录于验证文档。
