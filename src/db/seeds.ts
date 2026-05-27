import type { Goal, Task, Tag } from './schema';

interface GoalTemplate {
  goal: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>;
  tags: Omit<Tag, 'id' | 'createdAt'>[];
  tasks: Omit<Task, 'id' | 'goalId' | 'createdAt' | 'updatedAt'>[];
}

const today = new Date().toISOString().split('T')[0];

export const templates: { name: string; description: string; data: GoalTemplate }[] = [
  {
    name: '3个月学会编程',
    description: '系统学习前端开发，从零基础到能独立做项目',
    data: {
      goal: { name: '学会编程', description: '3个月内掌握前端开发基础', deadline: new Date(Date.now() + 90 * 86400000), status: 'active', color: '#6366F1' },
      tags: [
        { name: '学习', color: '#6366F1', parentId: null },
        { name: '练习', color: '#10B981', parentId: null },
      ],
      tasks: [
        { title: 'HTML & CSS 基础学习', description: '完成 FreeCodeCamp 前两个模块', estimatedMinutes: 60, actualMinutes: 0, actualStartTime: null, actualEndTime: null, dueDate: today, dueTime: '09:00', reminderEnabled: true, reminderTime: '09:00', priority: 'urgent-important' as const, tags: [], recurrenceType: 'daily' as const, recurrenceInterval: 1, recurrenceEndDate: null, sourceTaskId: null, score: null, reflection: '', notes: '', images: [], status: 'pending' as const, completedAt: null },
        { title: 'JavaScript 基础语法', description: '变量、函数、循环、条件判断', estimatedMinutes: 90, actualMinutes: 0, actualStartTime: null, actualEndTime: null, dueDate: today, dueTime: null, reminderEnabled: false, reminderTime: null, priority: 'not-urgent-important' as const, tags: [], recurrenceType: 'daily' as const, recurrenceInterval: 1, recurrenceEndDate: null, sourceTaskId: null, score: null, reflection: '', notes: '', images: [], status: 'pending' as const, completedAt: null },
        { title: '动手写一个 Todo App', description: '用 HTML/CSS/JS 做一个简单的待办列表', estimatedMinutes: 120, actualMinutes: 0, actualStartTime: null, actualEndTime: null, dueDate: today, dueTime: null, reminderEnabled: false, reminderTime: null, priority: 'not-urgent-important' as const, tags: [], recurrenceType: 'weekly' as const, recurrenceInterval: 1, recurrenceEndDate: null, sourceTaskId: null, score: null, reflection: '', notes: '', images: [], status: 'pending' as const, completedAt: null },
      ],
    },
  },
  {
    name: '30天健身打卡',
    description: '每天运动30分钟，养成健身习惯',
    data: {
      goal: { name: '30天健身挑战', description: '坚持每天运动，提升体能', deadline: new Date(Date.now() + 30 * 86400000), status: 'active', color: '#10B981' },
      tags: [
        { name: '健康', color: '#10B981', parentId: null },
        { name: '晨间', color: '#F59E0B', parentId: null },
      ],
      tasks: [
        { title: '晨间拉伸（10分钟）', description: '起床后做全身拉伸', estimatedMinutes: 10, actualMinutes: 0, actualStartTime: null, actualEndTime: null, dueDate: today, dueTime: '07:30', reminderEnabled: true, reminderTime: '07:30', priority: 'urgent-important' as const, tags: [], recurrenceType: 'daily' as const, recurrenceInterval: 1, recurrenceEndDate: null, sourceTaskId: null, score: null, reflection: '', notes: '', images: [], status: 'pending' as const, completedAt: null },
        { title: '有氧运动（20分钟）', description: '跑步或跳绳或跟练视频', estimatedMinutes: 20, actualMinutes: 0, actualStartTime: null, actualEndTime: null, dueDate: today, dueTime: null, reminderEnabled: false, reminderTime: null, priority: 'urgent-important' as const, tags: [], recurrenceType: 'daily' as const, recurrenceInterval: 1, recurrenceEndDate: null, sourceTaskId: null, score: null, reflection: '', notes: '', images: [], status: 'pending' as const, completedAt: null },
        { title: '记录体重和饮食', description: '在日记中记录今日数据', estimatedMinutes: 5, actualMinutes: 0, actualStartTime: null, actualEndTime: null, dueDate: today, dueTime: '21:00', reminderEnabled: true, reminderTime: '21:00', priority: 'not-urgent-important' as const, tags: [], recurrenceType: 'daily' as const, recurrenceInterval: 1, recurrenceEndDate: null, sourceTaskId: null, score: null, reflection: '', notes: '', images: [], status: 'pending' as const, completedAt: null },
      ],
    },
  },
  {
    name: '21天阅读习惯',
    description: '每天阅读30分钟，培养阅读习惯',
    data: {
      goal: { name: '21天阅读计划', description: '每天阅读，完成后写简短笔记', deadline: new Date(Date.now() + 21 * 86400000), status: 'active', color: '#F59E0B' },
      tags: [
        { name: '成长', color: '#F59E0B', parentId: null },
        { name: '睡前', color: '#8B5CF6', parentId: null },
      ],
      tasks: [
        { title: '阅读30分钟', description: '选择一本想读的书，专注阅读', estimatedMinutes: 30, actualMinutes: 0, actualStartTime: null, actualEndTime: null, dueDate: today, dueTime: '22:00', reminderEnabled: true, reminderTime: '22:00', priority: 'not-urgent-important' as const, tags: [], recurrenceType: 'daily' as const, recurrenceInterval: 1, recurrenceEndDate: null, sourceTaskId: null, score: null, reflection: '', notes: '', images: [], status: 'pending' as const, completedAt: null },
        { title: '写阅读笔记', description: '用3句话总结今天读到的重要内容', estimatedMinutes: 10, actualMinutes: 0, actualStartTime: null, actualEndTime: null, dueDate: today, dueTime: null, reminderEnabled: false, reminderTime: null, priority: 'not-urgent-important' as const, tags: [], recurrenceType: 'daily' as const, recurrenceInterval: 1, recurrenceEndDate: null, sourceTaskId: null, score: null, reflection: '', notes: '', images: [], status: 'pending' as const, completedAt: null },
      ],
    },
  },
];
