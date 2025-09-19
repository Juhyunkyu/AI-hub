/**
 * Secure Chat File Upload API Route
 * Handles server-side file upload with comprehensive security validation
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  validateFile,
  checkStorageQuota,
  createFileMetadata,
  SECURITY_CONFIG
} from '@/lib/chat-files-security'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const roomId = formData.get('roomId') as string
    const messageId = formData.get('messageId') as string

    if (!file || !roomId || !messageId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate file security
    const validation = validateFile(file)
    if (!validation.isValid) {
      return NextResponse.json(
        { error: `File validation failed: ${validation.errors.join(', ')}` },
        { status: 400 }
      )
    }

    // Check user is participant in room
    const { data: participant, error: participantError } = await supabase
      .from('chat_room_participants')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .single()

    if (participantError || !participant) {
      return NextResponse.json(
        { error: 'Not authorized for this chat room' },
        { status: 403 }
      )
    }

    // Check storage quota
    const quotaCheck = await checkStorageQuota(supabase, user.id, file.size)
    if (!quotaCheck.allowed) {
      return NextResponse.json(
        { error: 'Storage quota exceeded' },
        { status: 413 }
      )
    }

    // Generate secure file path
    const timestamp = Date.now()
    // const fileExtension = file.name.split('.').pop() || '' // Currently unused
    const secureFileName = `${timestamp}_${validation.sanitizedName}`
    const filePath = `${roomId}/${secureFileName}`

    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(SECURITY_CONFIG.BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      )
    }

    // Update storage usage
    const { error: quotaUpdateError } = await supabase.rpc('update_user_storage_usage', {
      p_user_id: user.id,
      p_size_delta: file.size
    })

    if (quotaUpdateError) {
      console.error('Failed to update storage quota:', quotaUpdateError)
    }

    // Create file metadata
    const clientIp = request.ip || request.headers.get('x-forwarded-for') || 'unknown'
    const metadataResult = await createFileMetadata(
      messageId,
      uploadData.path,
      file.name,
      validation.sanitizedName,
      file.type,
      file.size,
      clientIp
    )

    if (!metadataResult.success) {
      console.error('Failed to create file metadata:', metadataResult.error)
    }

    return NextResponse.json({
      success: true,
      data: {
        filePath: uploadData.path,
        fileName: validation.sanitizedName,
        fileSize: file.size,
        mimeType: file.type
      }
    })

  } catch (error) {
    console.error('File upload error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Configure API route for file uploads
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'