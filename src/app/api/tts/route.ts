import { NextRequest, NextResponse } from 'next/server'

const MINIMAX_TTS_URL = 'https://api.minimax.chat/v1/text_to_speech'

export async function POST(request: NextRequest) {
  try {
    const { text, voice = 'male-qn-jingying', emotion = 'happy', speed = 1.0 } = await request.json()
    
    const apiKey = process.env.MINIMAX_API_KEY
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Minimax API key not configured' },
        { status: 400 }
      )
    }
    
    const response = await fetch(MINIMAX_TTS_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        voice_id: voice,
        emotion,
        speed,
        model: 'speech-01',
        audio_format: 'mp3',
        sample_rate: 24000,
      })
    })
    
    if (!response.ok) {
      throw new Error(`Minimax TTS API error: ${response.status}`)
    }
    
    const data = await response.json()
    
    // 返回音频数据
    return NextResponse.json({
      audio_base64: data.audio,
      request_id: data.request_id
    })
  } catch (error) {
    console.error('Minimax TTS API error:', error)
    return NextResponse.json(
        { error: '语音合成服务暂时不可用' },
        { status: 500 }
      )
    }
}