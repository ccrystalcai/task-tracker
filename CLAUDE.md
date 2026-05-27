# CLAUDE.md — TaskTracker 项目 AI 工作指引

## 项目简介

一个纯网页端的任务打卡追踪器，帮助用户拆解目标、管理每日任务、记录反思、可视化执行力。

## 标准文件路径

开发前请先阅读以下文件以了解项目全貌：

| 文件 | 内容 | 何时查阅 |
|------|------|---------|
| [docs/requirements.md](docs/requirements.md) | 完整需求规格，含优先级 P0/P1/P2 | 实现任何功能前确认需求边界 |
| [docs/tech-spec.md](docs/tech-spec.md) | 技术栈、目录结构、数据库 Schema | 新增依赖、修改数据结构时 |
| [docs/design-spec.md](docs/design-spec.md) | 色彩、排版、组件风格、动效规范 | 编写 UI 和样式代码时 |
| [docs/development-plan.md](docs/development-plan.md) | 分阶段开发计划，共 8 个 Phase | 规划开发顺序和追踪进度时 |

## 开发日志

每日开发结束后，在 [devlog/](devlog/) 中创建 `YYYY-MM-DD.md` 文件，记录：
- 今日完成了什么
- 下一步待办
- 遇到的问题和解决方案
- 备注/决策记录

## 工作约定

1. **按 Phase 顺序推进**：必须完成当前 Phase 验收标准后再进入下一阶段
2. **每 Phase 结束后验收**：确认功能可用、数据持久化正常、无明显 bug
3. **先实现后美化**：每个功能先跑通核心逻辑，再按设计规范调整 UI
4. **数据安全第一**：任何数据结构的改动都要确保向后兼容，及时更新导出逻辑
5. **保持简洁**：组件不超过 200 行，函数不超过 30 行，避免过度抽象
6. **TypeScript 严格模式**：不允许 `any` 类型（除非确实无法推断）

## 技术栈速查

```
前端框架：React 18 + TypeScript
构建工具：Vite 5
样式方案：Tailwind CSS 3 + CSS 变量（主题）
路由管理：React Router 6
本地数据库：Dexie.js (IndexedDB)
状态管理：Zustand
图表库：Recharts
日期处理：date-fns
模糊搜索：fuse.js
图标库：Lucide React
```

## 启动命令

```bash
npm install          # 安装依赖
npm run dev          # 开发服务器启动
npm run build        # 生产构建
npm run preview      # 预览生产构建
```

## 当前状态

- [x] 需求文档完成
- [x] 技术方案确定
- [x] 设计规范完成
- [ ] Phase 1：项目骨架搭建（下一步）
- [ ] Phase 2：目标与任务 CRUD
- [ ] Phase 3：今日看板
- [ ] Phase 4：每日小结
- [ ] Phase 5：分析统计
- [ ] Phase 6：反思日记
- [ ] Phase 7：全局搜索
- [ ] Phase 8：Google 日历 + 收尾
