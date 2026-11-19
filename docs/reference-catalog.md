# CleverTap 官方资料目录

核对日期：2026-11-19。当前任务为 Next.js 高保真交互演示版的方案规划。

## 1. 核对状态

- 已通过网页文本和浏览器核对 [Demo Center](https://clevertap.com/demo-center/) 的专题名称及 Vimeo 入口，共 18 个专题视频和 1 个总览视频。
- 已抽查 Journey 产品画布与 Segmentation 中可达性、保存分群等画面；没有完整观看或逐帧拆解全部视频。
- 产品手册已用于核对核心对象及工作流。相关页面可能为传统版、NextGen 或 2.0/Beta，实施前须保留版本信息。
- 已补充目视检查部分功能页原图及浏览器中的 Lottie 视觉内容；其余功能页图片和关键帧仍需按模块补齐，见第 4 节。
- 未登录真实 CleverTap 工作台，不能据公开资料保证覆盖全部账号、套餐或权限下的行为。
- 下表中的优先级是本项目建议；“入口已核对”不表示已完整观看。

## 2. 官方视频清单

| 编号 | 官方主题 | 视频 | 建议用途 | 当前状态 |
| --- | --- | --- | --- | --- |
| V00 | 平台总览 | [All-In-One Engagement Platform](https://vimeo.com/895726441) | 理解整体产品定位与跨模块流程 | 入口及播放器已核对 |
| V01 | CleverAI | [Analytics Agent](https://vimeo.com/1109324275) | P1 自然语言分析 | 入口已核对 |
| V02 | CleverAI | [Segment Builder Agent](https://vimeo.com/1126102080) | P1 自然语言分群 | 入口已核对 |
| V03 | Customer Data & Analytics | [Customer Data Management](https://vimeo.com/893216814) | P0 数据对象；P1 集成目录 | 入口已核对 |
| V04 | Customer Data & Analytics | [Analytics](https://vimeo.com/893217179) | P0 分析页面和联动 | 入口已核对 |
| V05 | Customer Data & Analytics | [Segmentation](https://vimeo.com/891369347) | P0 分群与可达性 | 抽查部分产品画面 |
| V06 | Customer Data & Analytics | [Predictive Segmentation](https://vimeo.com/944347365) | P1 预测分群展示 | 入口已核对 |
| V07 | Experimentation & Optimization | [Product Experiences](https://vimeo.com/1015574779) | P1 产品实验 | 入口已核对 |
| V08 | Experimentation & Optimization | [A/B Testing](https://vimeo.com/893214512) | P0 版本编辑；P1 实验管理 | 入口已核对 |
| V09 | Experimentation & Optimization | [IntelliNODE](https://vimeo.com/893217390) | P1 Journey 多路径实验 | 入口已核对 |
| V10 | Experimentation & Optimization | [Lifecycle Optimizer](https://vimeo.com/893217539) | P1 生命周期优化 | 入口已核对 |
| V11 | Personalization | [Personalized Experiences](https://vimeo.com/893217760) | P0 内容个性化；P1 个性化页面 | 入口已核对 |
| V12 | Personalization | [Product Recommendations](https://vimeo.com/1007593505) | P1 商品目录与推荐预览 | 入口已核对 |
| V13 | Personalization | [Reminders](https://vimeo.com/1083787239) | P1 提醒配置 | 入口已核对 |
| V14 | Personalization | [Scribe](https://vimeo.com/943986716) | P1 文案助手 | 入口已核对 |
| V15 | Campaign Orchestration | [RCS](https://vimeo.com/1084523593) | P1 富消息渠道 | 入口已核对 |
| V16 | Campaign Orchestration | [Journeys](https://vimeo.com/901120370) | P0 画布、节点与操作流程 | 抽查部分画布和文字稿 |
| V17 | Campaign Orchestration | [Email Automation](https://vimeo.com/896870764) | P0 活动与邮件编辑器 | 播放器出现注册表加载失败，画面核对待补，先参考手册 |
| V18 | Campaign Orchestration | [Web Messaging](https://vimeo.com/960224546) | P0 Web Pop-up 与预览 | 入口已核对 |

M0 优先拆解 V04、V05、V08、V11、V16、V17、V18。其他视频先完成能力编目，再随扩展模块深入核对。

## 3. 产品手册

下列均为官方资料。本次已读取核心概览、分群、画像、分析、看板、渠道创建及 Journey 相关正文；并非每个页面的每个字段都已整理成开发规格。

| 编号 | 手册 | 主要参考内容 |
| --- | --- | --- |
| D01 | [User Documentation Overview](https://docs.clevertap.com/docs/getting-started) | 文档入口与产品概览 |
| D02 | [NextGen Segment Builder](https://docs.clevertap.com/docs/segmentation) | 新版分群对象与入口 |
| D03 | [Segments](https://docs.clevertap.com/docs/segments) | 分群列表、引用关系与详情 |
| D04 | [Segmentation Rules](https://docs.clevertap.com/docs/segmentation-rules) | 属性、行为、AND/OR 和边界 |
| D05 | [User Profiles](https://docs.clevertap.com/docs/user-profiles) | 标识、属性、事件与用户详情 |
| D06 | [Trends 2.0](https://docs.clevertap.com/docs/trends-v2) | 事件、分群、属性分析与看板联动 |
| D07 | [Funnels 2.0](https://docs.clevertap.com/docs/funnels-v2) | 查询配置、流失步骤、分群和触达 |
| D08 | [Cohorts 2.0](https://docs.clevertap.com/docs/cohorts-v2) | 起始与返回事件、留存分析 |
| D09 | [Boards 2.0](https://docs.clevertap.com/docs/boards-v2) | 分析卡片、布局和筛选；文档标为 Public Beta |
| D10 | [Custom Dashboards](https://docs.clevertap.com/docs/custom-dashboards) | 传统看板参考，不能与 2.0 默认混用 |
| D11 | [Campaign Overview](https://docs.clevertap.com/docs/intro-to-campaigns) | 渠道和活动创建入口 |
| D12 | [Create Email Message](https://docs.clevertap.com/docs/create-message-email) | Email 设置、受众、内容及排期 |
| D13 | [Create Web Pop-up Message](https://docs.clevertap.com/docs/create-message-web-popup) | Web Pop-up 创建结构 |
| D14 | [Journey Overview](https://docs.clevertap.com/docs/journeys) | 全渠道旅程与编辑版本 |
| D15 | [Create a Journey](https://docs.clevertap.com/docs/create-a-journey) | Setup、Goals、Entry、Path、发布与监控 |
| D16 | [Journey Concepts](https://docs.clevertap.com/docs/journey-concepts) | 节点类别、渠道动作、连接与等待 |
| D17 | [Define Journey Path](https://docs.clevertap.com/docs/construct-a-journey) | 连接、等待、超时与后续路径 |
| D18 | [Journey States](https://docs.clevertap.com/docs/journey-states) | 官方状态对照，实施时细化映射 |
| D19 | [Schema](https://docs.clevertap.com/docs/schema) | 事件、属性及对象依赖 |
| D20 | [Release Notes](https://docs.clevertap.com/docs/whats-new) | 核对功能代际和新增能力 |

官方提供 [产品文档索引](https://docs.clevertap.com/llms.txt) 和 [开发者文档](https://developer.clevertap.com/docs)。真实 SDK/API 接入属于后续阶段。

## 4. 功能页面

| 页面 | 本次核对的能力概述 | 本项目安排 |
| --- | --- | --- |
| [Customer Data & Analytics](https://clevertap.com/customer-data-and-analytics/) | 数据接入、分析、自动分群与预测 | P0 分析和分群；P1 集成与预测展示 |
| [Experimentation & Optimization](https://clevertap.com/experiment-optimization/) | 活动测试、产品体验实验、旅程与生命周期优化 | P0 基础 A/B；P1 专题优化页面 |
| [Personalization](https://clevertap.com/personalization/) | 属性和实时行为个性化、提醒及推荐 | P0 内容预览；P1 提醒与推荐 |
| [Campaign Orchestration](https://clevertap.com/orchestration/) | 跨渠道触达、拖拽式 Journey 和持续优化 | P0 四渠道与 Journey；P1 其他渠道 |

这些功能页的文案用于范围划分，图片和动画是视觉复刻的必查资料；具体后台行为与手册、视频交叉核对。

### 4.1 本次已目视核对的图像

| 编号 | 来源与位置 | 观察到的内容 | 用途与当前状态 |
| --- | --- | --- | --- |
| I01 | [Customer Data & Analytics](https://clevertap.com/customer-data-and-analytics/) 的 Unleash the Power of Rich Analytics 版块 | Lottie 中的 Trends、Funnels、Pivots、Flows 卡片与图表视觉 | 已目视核对部分动态画面；用于卡片、图表和信息层级参考，关键帧文件待归档 |
| I02 | [同一功能页](https://clevertap.com/customer-data-and-analytics/) 的 Build Automated Segments with Ease 版块 | RFM 人群分块示意，包含 Champions、Loyal Customers、At Risk 等标签 | 已目视核对；用于分群可视化和场景参考，不据此推断完整后台布局 |
| I03 | [Customer Data 功能页原图](https://clevertap.com/wp-content/uploads/2023/07/Data-2.png) | 人物、Activities、Reachable on、响应渠道及时间信息卡 | 已打开原图检查；属于营销组合图，信息卡可作局部视觉参考 |
| I04 | [Campaign Orchestration 功能页原图](https://clevertap.com/wp-content/uploads/2023/07/Group-427323719.png) | 人物、渠道消息、循环箭头和 Revenue 小图 | 已打开原图检查；用于跨渠道场景表达，不能代替 Journey 编辑器截图 |

图片没有附带交互规则时，规则须由手册或视频补足。当前清单记录观察结果，尚未建立完整本地原图与关键帧素材库。

### 4.2 M0 图像核对任务

- 覆盖四个主功能页，并延伸到 Segmentation、Product Experiences、IntelliNODE、Email、In-App、Web Messaging 等相关子功能页。
- 检查静态图、背景图、GIF、Lottie 和嵌入视频；动画在浏览器中渲染后核对，避免文本抓取遗漏。
- 每项记录来源页、原始资源 URL（能够取得时）、所在版块、尺寸、版本线索、内容类型和对应开发页面。
- 对完整产品截图建立布局依据；局部界面图和动画提取控件、图表与状态；营销插画记录场景用途。
- 形成可逐页对照的素材库，归档路径为 `docs/reference-assets/`，清单中明确已查看、已归档与待核对的状态。

## 5. 技术参考

- [Next.js App Router Installation](https://nextjs.org/docs/app/getting-started/installation)：已查阅，实施时重新锁定依赖版本。
- [React Flow Learn](https://reactflow.dev/learn)：已查阅，用于 Journey 画布基础。
- [Dexie React](https://dexie.org/docs/Tutorial/React)：已查阅，用于浏览器持久化。
- [Tailwind CSS with Next.js](https://tailwindcss.com/docs/installation/framework-guides/nextjs)：已访问，实施时核对当前安装方式。
- [TanStack Table Overview](https://tanstack.com/table/latest/docs/overview)：已查阅，用于自定义表格行为。
- [Apache ECharts](https://echarts.apache.org/en/index.html)：已查阅，用于统一分析图表。

## 6. 开发前的页面规格记录方式

每个 P0 页面补齐以下信息即可进入开发，不需要先完整观看全部专题视频：

| 字段 | 记录要求 |
| --- | --- |
| 页面与入口 | 业务名称、所在菜单、项目内部路由 |
| 资料 | 对应 D/V/I 编号、来源页与原图 URL、动画关键帧、视频时间点或手册截图 |
| 图像类型与用途 | 完整产品截图 / 局部界面示意 / 营销插画；主要视觉依据或补充依据 |
| 参考版本 | 传统版 / NextGen / 2.0 / Beta，冲突时采用哪一版 |
| 画面 | 布局、控件、字段、主要操作和截图 |
| 行为 | 前提、动作、结果、保存与联动 |
| 状态 | 加载、空、错误、草稿、发布、无权限等实际相关状态 |
| 依据等级 | 直接观察 / 文档明确 / 本项目推断 |
| 演示边界 | 本地真实工作 / 模拟运行 / 后续扩展 |

目前未记录逐帧时间点，不应把本清单当作已完成的逐帧审阅记录。
