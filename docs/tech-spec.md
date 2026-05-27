# 技术规范文档

## 技术栈选型

| 层面 | 技术 | 版本 | 选择理由 |
|------|------|------|---------|
| 框架 | React | 18.x | 生态最大，组件化开发，适合单页应用 |
| 构建工具 | Vite | 5.x | 快速冷启动，HMR 热更新 |
| 语言 | TypeScript | 5.x | 类型安全，减少低级 bug |
| 样式 | Tailwind CSS | 3.x | 原子化 CSS，配合 CSS 变量实现主题切换 |
| 路由 | React Router | 6.x | 标准 SPA 路由方案 |
| 本地数据库 | Dexie.js | 4.x | IndexedDB 封装，Promise API，支持复杂查询 |
| 图表 | Recharts | 2.x | React 原生图表库，支持热力图/折线图/柱状图 |
| 日期处理 | date-fns | 3.x | 轻量日期工具库 |
| 模糊搜索 | fuse.js | 7.x | 客户端模糊搜索，支持中文分词 |
| 图标 | Lucide React | latest | 轻量图标集，按需引入 |
| 日历组件 | react-calendar | 5.x | 月历视图基础组件 |
| Google API | @react-oauth/google | latest | Google OAuth 登录 + Calendar API |
| 状态管理 | Zustand | 4.x | 轻量状态管理，无 boilerplate |

---

## 项目目录结构

```
/
├── docs/                        # 项目文档（本文件夹）
│   ├── requirements.md          # 需求规格
│   ├── tech-spec.md             # 技术规范（本文件）
│   ├── design-spec.md           # 设计规范
│   └── development-plan.md      # 开发计划
├── devlog/                      # 开发日志（每日自动更新）
├── public/                      # 静态资源
│   └── favicon.svg
├── src/
│   ├── components/              # 可复用组件
│   │   ├── layout/              # 布局组件（Sidebar, Header）
│   │   ├── task/                # 任务相关组件
│   │   ├── goal/                # 目标相关组件
│   │   ├── chart/               # 图表组件（Heatmap, LineChart）
│   │   ├── ui/                  # 基础 UI 组件（Button, Modal, Card）
│   │   └── search/              # 搜索组件
│   ├── pages/                   # 页面组件（对应路由）
│   │   ├── Dashboard.tsx        # 今日看板
│   │   ├── Goals.tsx            # 目标规划
│   │   ├── Analytics.tsx        # 分析统计
│   │   ├── Journal.tsx          # 反思日记
│   │   ├── Search.tsx           # 全局搜索
│   │   └── Settings.tsx         # 设置
│   ├── hooks/                   # 自定义 Hooks
│   │   ├── useTasks.ts          # 任务 CRUD
│   │   ├── useGoals.ts          # 目标 CRUD
│   │   ├── useJournal.ts        # 日记 CRUD
│   │   ├── useTheme.ts          # 主题切换
│   │   └── useReminder.ts       # 提醒逻辑
│   ├── db/                      # IndexedDB 数据库层
│   │   ├── index.ts             # 数据库实例
│   │   ├── schema.ts            # 数据表结构定义
│   │   └── seeds.ts             # 预设模板数据
│   ├── stores/                  # Zustand 状态管理
│   │   ├── taskStore.ts
│   │   ├── goalStore.ts
│   │   ├── journalStore.ts
│   │   └── uiStore.ts
│   ├── utils/                   # 工具函数
│   │   ├── date.ts              # 日期工具
│   │   ├── calendar.ts          # Google Calendar 同步
│   │   ├── search.ts            # 模糊搜索
│   │   ├── motivation.ts        # 激励语生成
│   │   └── export.ts            # 数据导入导出
│   ├── styles/                  # 全局样式
│   │   ├── index.css            # Tailwind + CSS 变量
│   │   └── themes.ts            # 主题定义
│   ├── assets/                  # 图片/图标等静态资源
│   ├── App.tsx                  # 根组件（路由配置）
│   ├── main.tsx                 # 入口文件
│   └── vite-env.d.ts           # Vite 类型声明
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
└── CLAUDE.md                    # 项目 AI 指引
```

---

## 数据库设计（IndexedDB）

### 表结构

```typescript
// goals - 目标表
interface Goal {
  id: string;            // UUID
  name: string;          // 目标名称
  description: string;   // 描述
  deadline: Date;        // 截止日期
  createdAt: Date;
  updatedAt: Date;
  status: 'active' | 'completed' | 'archived';
  color: string;         // 标签颜色
}

// tags - 自定义标签表
interface Tag {
  id: string;
  name: string;          // 标签名（如 "学习", "工作", "健康"）
  color: string;         // 标签颜色
  createdAt: Date;
}

// tasks - 任务表（可不关联目标，独立存在）
interface Task {
  id: string;
  goalId: string | null; // 关联目标（可为 null，表示独立任务）
  title: string;
  description: string;
  estimatedMinutes: number;  // 预估时长（分钟）
  actualMinutes: number;     // 实际时长
  dueDate: string;           // 'YYYY-MM-DD'
  dueTime: string | null;    // 'HH:mm' 到期时间
  reminderEnabled: boolean;  // 是否开启单任务提醒
  reminderTime: string | null; // 'HH:mm' 单任务提醒时间
  priority: 'urgent-important' | 'urgent-not-important'
           | 'not-urgent-important' | 'not-urgent-not-important';
  tags: string[];            // 关联的标签 ID 数组
  status: 'pending' | 'completed' | 'skipped';
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// task_records - 任务完成记录表
interface TaskRecord {
  id: string;
  taskId: string;
  date: string;           // 'YYYY-MM-DD'
  completed: boolean;
  score: number | null;   // 1-5 评分
  reflection: string;     // 反思文字
  images: Blob[];         // 上传的图片
  createdAt: Date;
}

// journal_entries - 日记条目
interface JournalEntry {
  id: string;
  date: string;           // 'YYYY-MM-DD'
  mood: 'great' | 'good' | 'okay' | 'bad' | 'terrible';
  content: string;        // 日记正文
  suggestions: string[];  // 优化建议
  createdAt: Date;
  updatedAt: Date;
}

// daily_summaries - 每日小结
interface DailySummary {
  id: string;
  date: string;
  totalTasks: number;
  completedTasks: number;
  totalEstimatedMinutes: number;
  totalActualMinutes: number;
  summary: string;
  createdAt: Date;
}
```

### IndexedDB 索引设计

| 表 | 主键 | 索引字段 | 说明 |
|----|------|---------|------|
| goals | id | status | 按状态筛选 |
| tags | id | name | 按名称查询 |
| tasks | id | goalId, dueDate, status, priority, \*tags | \*tags 为多值索引，支持按标签筛选 |
| taskRecords | id | taskId, date | 按任务和日期查询 |
| journalEntries | id | date | 按日期查询 |
| dailySummaries | id | date | 按日期查询 |

---

## Google Calendar 集成方案

1. 使用 Google OAuth 2.0 授权
2. 获取 `calendar.events` 读写权限
3. 任务创建/修改时同步到 Google Calendar
4. 存储 refresh_token 在本地，自动续期

---

## 安全要求

- 所有数据存储在浏览器本地
- Google OAuth token 仅存本地，不发送到第三方
- 导出数据不包含 OAuth token
- 不使用 eval / innerHTML 等不安全 API
