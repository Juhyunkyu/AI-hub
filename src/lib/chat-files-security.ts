/**
 * Chat Files Security Implementation
 * Provides secure file upload utilities for chat system
 */

import { createClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'

// Security configuration
export const SECURITY_CONFIG = {
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  ALLOWED_MIME_TYPES: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'video/mp4',
    'video/webm',
    'audio/mpeg',
    'audio/wav',
    'audio/ogg'
  ],
  DANGEROUS_EXTENSIONS: ['.exe', '.bat', '.cmd', '.scr', '.pif', '.js', '.vbs', '.jar', '.msi', '.dll'],
  BUCKET_NAME: 'chat-files'
} as const

export interface FileSecurityCheck {
  isValid: boolean
  errors: string[]
  sanitizedName: string
}

export interface UploadResult {
  success: boolean
  filePath?: string
  error?: string
  metadata?: {
    id: string
    sanitizedName: string
    mimeType: string
    fileSize: number
  }
}

/**
 * Validates file against security policies
 */
export function validateFile(file: File): FileSecurityCheck {
  const errors: string[] = []

  // File size check
  if (file.size > SECURITY_CONFIG.MAX_FILE_SIZE) {
    errors.push(`File size exceeds ${SECURITY_CONFIG.MAX_FILE_SIZE / 1024 / 1024}MB limit`)
  }

  // MIME type check
  if (!SECURITY_CONFIG.ALLOWED_MIME_TYPES.includes(file.type)) {
    errors.push(`File type ${file.type} is not allowed`)
  }

  // Dangerous extension check
  const fileName = file.name.toLowerCase()
  const hasDangerousExtension = SECURITY_CONFIG.DANGEROUS_EXTENSIONS.some(ext =>
    fileName.endsWith(ext)
  )

  if (hasDangerousExtension) {
    errors.push('File extension is not allowed for security reasons')
  }

  // Additional executable check
  if (/\.(exe|bat|cmd|scr|pif|js|vbs|jar|msi|dll)$/i.test(fileName)) {
    errors.push('Executable files are not allowed')
  }

  // Sanitize filename
  const sanitizedName = sanitizeFilename(file.name)

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedName
  }
}

/**
 * Sanitizes filename by removing dangerous characters
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^\w\-_.]/g, '_') // Replace non-word chars with underscore
    .replace(/\.+/g, '.') // Replace multiple dots with single dot
    .replace(/^\.+|\.+$/g, '') // Remove leading/trailing dots
    .substring(0, 255) // Limit length
}

/**
 * Checks user storage quota before upload
 */
export async function checkStorageQuota(
  supabase: SupabaseClient,
  userId: string,
  fileSize: number
): Promise<{ allowed: boolean; currentUsage?: number; quota?: number }> {
  try {
    const { data, error } = await supabase.rpc('check_user_storage_quota', {
      p_user_id: userId,
      p_file_size: fileSize
    })

    if (error) {
      console.error('Storage quota check failed:', error)
      return { allowed: false }
    }

    return { allowed: data === true }
  } catch (error) {
    console.error('Storage quota check error:', error)
    return { allowed: false }
  }
}

/**
 * Uploads file to chat-files bucket with security validation
 */
export async function uploadChatFile(
  roomId: string,
  file: File,
  userId: string
): Promise<UploadResult> {
  const supabase = createClient()

  try {
    // 1. Validate file
    const validation = validateFile(file)
    if (!validation.isValid) {
      return {
        success: false,
        error: `File validation failed: ${validation.errors.join(', ')}`
      }
    }

    // 2. Check storage quota
    const quotaCheck = await checkStorageQuota(supabase, userId, file.size)
    if (!quotaCheck.allowed) {
      return {
        success: false,
        error: 'Storage quota exceeded'
      }
    }

    // 3. Verify user is participant in room
    const { data: participant, error: participantError } = await supabase
      .from('chat_room_participants')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .single()

    if (participantError || !participant) {
      return {
        success: false,
        error: 'User not authorized for this chat room'
      }
    }

    // 4. Generate secure file path
    const timestamp = Date.now()
    const fileExtension = file.name.split('.').pop() || ''
    const secureFileName = `${timestamp}_${validation.sanitizedName}`
    const filePath = `${roomId}/${secureFileName}`

    // 5. Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(SECURITY_CONFIG.BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      return {
        success: false,
        error: `Upload failed: ${uploadError.message}`
      }
    }

    // 6. Update user storage usage
    await supabase.rpc('update_user_storage_usage', {
      p_user_id: userId,
      p_size_delta: file.size
    })

    return {
      success: true,
      filePath: uploadData.path,
      metadata: {
        id: uploadData.path,
        sanitizedName: validation.sanitizedName,
        mimeType: file.type,
        fileSize: file.size
      }
    }

  } catch (error) {
    console.error('File upload error:', error)
    return {
      success: false,
      error: 'Upload failed due to unexpected error'
    }
  }
}

/**
 * Creates file metadata record after successful upload
 */
export async function createFileMetadata(
  messageId: string,
  filePath: string,
  originalName: string,
  sanitizedName: string,
  mimeType: string,
  fileSize: number,
  uploadIp?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()

  try {
    const { error } = await supabase
      .from('chat_file_metadata')
      .insert({
        message_id: messageId,
        file_path: filePath,
        original_name: originalName,
        sanitized_name: sanitizedName,
        mime_type: mimeType,
        file_size: fileSize,
        upload_ip: uploadIp,
        virus_scan_status: 'pending'
      })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('File metadata creation error:', error)
    return { success: false, error: 'Failed to create file metadata' }
  }
}

/**
 * Gets signed URL for secure file access
 */
export async function getSecureFileUrl(
  filePath: string,
  expiresIn: number = 3600
): Promise<{ url?: string; error?: string }> {
  const supabase = createClient()

  try {
    const { data, error } = await supabase.storage
      .from(SECURITY_CONFIG.BUCKET_NAME)
      .createSignedUrl(filePath, expiresIn)

    if (error) {
      return { error: error.message }
    }

    return { url: data.signedUrl }
  } catch (error) {
    console.error('Signed URL generation error:', error)
    return { error: 'Failed to generate secure URL' }
  }
}

/**
 * Deletes file and updates storage usage
 */
export async function deleteChatFile(
  filePath: string,
  userId: string,
  fileSize: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()

  try {
    // Delete from storage
    const { error: deleteError } = await supabase.storage
      .from(SECURITY_CONFIG.BUCKET_NAME)
      .remove([filePath])

    if (deleteError) {
      return { success: false, error: deleteError.message }
    }

    // Update storage usage
    await supabase.rpc('update_user_storage_usage', {
      p_user_id: userId,
      p_size_delta: -fileSize
    })

    return { success: true }
  } catch (error) {
    console.error('File deletion error:', error)
    return { success: false, error: 'Failed to delete file' }
  }
}

/**
 * Gets user storage statistics
 */
export async function getUserStorageStats(
  userId: string
): Promise<{ used: number; quota: number; percentage: number } | null> {
  const supabase = createClient()

  try {
    const { data, error } = await supabase
      .from('user_storage_quotas')
      .select('used_bytes, quota_bytes')
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      return null
    }

    return {
      used: data.used_bytes,
      quota: data.quota_bytes,
      percentage: Math.round((data.used_bytes / data.quota_bytes) * 100)
    }
  } catch (error) {
    console.error('Storage stats error:', error)
    return null
  }
}