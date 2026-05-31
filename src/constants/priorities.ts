import type { Priority } from '@/db/schema';
import { Flame, Lightning, Target, PushPin } from '@phosphor-icons/react';
import type { AppIcon } from '@/constants/moods';

export const PRIORITY_LABEL: Record<Priority, string> = {
  'urgent-important': '重要且紧急',
  'urgent-not-important': '紧急不重要',
  'not-urgent-important': '重要不紧急',
  'not-urgent-not-important': '非重要紧急',
};

export const PRIORITY_COLOR: Record<Priority, string> = {
  'urgent-important': '#EF4444',
  'urgent-not-important': '#F59E0B',
  'not-urgent-important': '#6366F1',
  'not-urgent-not-important': '#10B981',
};

export const PRIORITY_BAR_COLOR: Record<Priority, string> = {
  'urgent-important': '#F87171',
  'urgent-not-important': '#FBBF24',
  'not-urgent-important': '#818CF8',
  'not-urgent-not-important': '#34D399',
};

export const PRIORITY_ICON: Record<Priority, AppIcon> = {
  'urgent-important': Flame,
  'urgent-not-important': Lightning,
  'not-urgent-important': Target,
  'not-urgent-not-important': PushPin,
};

export const PRIORITY_BADGE_BG = (color: string) => `${color}12`;
