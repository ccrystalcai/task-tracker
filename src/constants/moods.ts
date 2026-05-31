import type { ComponentType } from 'react';
import { Smiley, SmileyWink, SmileyMeh, SmileySad, SmileyAngry, Sun, Cloud, CloudRain, CloudLightning, CloudSnow, Wind } from '@phosphor-icons/react';
import type { IconProps } from '@phosphor-icons/react';
import type { Mood } from '@/db/schema';

export type Weather = 'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'snowy' | 'windy';

export type AppIcon = ComponentType<IconProps>;

export const MOOD_ICON: Record<Mood, AppIcon> = {
  great: Smiley,
  good: SmileyWink,
  okay: SmileyMeh,
  bad: SmileySad,
  terrible: SmileyAngry,
};

export const MOOD_LABEL: Record<Mood, string> = {
  great: '很棒',
  good: '不错',
  okay: '一般',
  bad: '不太好',
  terrible: '很差',
};

export const WEATHER_ICON: Record<Weather, AppIcon> = {
  sunny: Sun,
  cloudy: Cloud,
  rainy: CloudRain,
  stormy: CloudLightning,
  snowy: CloudSnow,
  windy: Wind,
};

export const WEATHER_LABEL: Record<Weather, string> = {
  sunny: '晴',
  cloudy: '多云',
  rainy: '雨',
  stormy: '暴风雨',
  snowy: '雪',
  windy: '风',
};
