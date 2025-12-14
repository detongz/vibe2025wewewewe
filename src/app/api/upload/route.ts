import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = 'http://124.220.31.71:5000/api'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const sessionId = formData.get('session_id') as string
    const audioFile = formData.get('audio') as File

    if (!sessionId || !audioFile) {
      return NextResponse.json(
        { error: 'Missing session_id or audio file' },
        { status: 400 }
      )
    }

    // 转发到后端API
    const backendFormData = new FormData()
    backendFormData.append('session_id', sessionId)
    backendFormData.append('audio', audioFile)

    const response = await fetch(`${API_BASE_URL}/audio/upload`, {
      method: 'POST',
      body: backendFormData,
    })

    if (!response.ok) {
      throw new Error('Failed to upload audio')
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error uploading audio:', error)
    return NextResponse.json(
      { error: 'Failed to upload audio' },
      { status: 500 }
    )
  }
}