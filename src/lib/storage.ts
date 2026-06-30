// ============================================================
// Supabase Storage 图片上传/删除工具
// 替代原来的 base64 图片存储方案
// ============================================================

import { supabase } from '@/lib/supabase';

const BUCKET = 'task-images';

/**
 * 上传图片到 Supabase Storage。
 * 返回公开 URL，失败返回 null。
 */
export async function uploadImage(file: File): Promise<string | null> {
  const ext = file.name.split('.').pop() || 'png';
  const filename = `${crypto.randomUUID()}.${ext}`;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(filename, file, {
      cacheControl: '31536000',
      upsert: false,
    });

  if (error) {
    console.error('uploadImage:', error.message);
    return null;
  }

  const { data: publicUrlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(data.path);

  return publicUrlData.publicUrl;
}

/**
 * 从 Supabase Storage 删除图片。
 * 通过 URL 提取文件路径。
 */
export async function deleteImage(url: string): Promise<void> {
  try {
    // URL 格式: https://xxx.supabase.co/storage/v1/object/public/task-images/filename.ext
    const urlObj = new URL(url);
    const pathMatch = urlObj.pathname.match(/\/public\/task-images\/(.+)$/);
    if (!pathMatch) return;

    const { error } = await supabase.storage
      .from(BUCKET)
      .remove([decodeURIComponent(pathMatch[1])]);

    if (error) {
      console.error('deleteImage:', error.message);
    }
  } catch (e) {
    console.error('deleteImage parse error:', e);
  }
}

/**
 * 批量删除图片。
 */
export async function deleteImages(urls: string[]): Promise<void> {
  await Promise.all(urls.map((u) => deleteImage(u)));
}
