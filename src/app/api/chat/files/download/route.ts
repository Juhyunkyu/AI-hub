/**
 * Secure Chat File Download API Route
 * Provides secure file access with authorization checks
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SECURITY_CONFIG } from '@/lib/chat-files-security'

export async function GET(request: NextRequest) {
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

    // Get file path from query
    const url = new URL(request.url)
    const filePath = url.searchParams.get('path')

    if (!filePath) {
      return NextResponse.json(
        { error: 'File path is required' },
        { status: 400 }
      )
    }

    // Extract room ID from file path
    const pathParts = filePath.split('/')
    if (pathParts.length < 2) {
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 400 }
      )
    }

    const roomId = pathParts[0]

    // Verify user is participant in the room
    const { data: participant, error: participantError } = await supabase
      .from('chat_room_participants')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .single()

    if (participantError || !participant) {
      return NextResponse.json(
        { error: 'Not authorized to access this file' },
        { status: 403 }
      )
    }

    // Get file metadata to verify it exists and get original name
    const { data: metadata, error: metadataError } = await supabase
      .from('chat_file_metadata')
      .select('original_name, mime_type, virus_scan_status')
      .eq('file_path', filePath)
      .single()

    if (metadataError || !metadata) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }

    // Check virus scan status
    if (metadata.virus_scan_status === 'infected') {
      return NextResponse.json(
        { error: 'File is infected and cannot be downloaded' },
        { status: 403 }
      )
    }

    // Create signed URL for secure download
    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from(SECURITY_CONFIG.BUCKET_NAME)
      .createSignedUrl(filePath, 300) // 5 minute expiry

    if (urlError || !signedUrlData) {
      return NextResponse.json(
        { error: 'Failed to generate download URL' },
        { status: 500 }
      )
    }

    // Fetch the file from storage
    const fileResponse = await fetch(signedUrlData.signedUrl)
    if (!fileResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch file' },
        { status: 500 }
      )
    }

    // Stream the file back to the client
    const fileBuffer = await fileResponse.arrayBuffer()

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': metadata.mime_type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${metadata.original_name}"`,
        'Cache-Control': 'private, no-cache',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY'
      }
    })

  } catch (error) {
    console.error('File download error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'