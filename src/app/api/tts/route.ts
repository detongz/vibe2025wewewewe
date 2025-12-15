import { NextRequest, NextResponse } from 'next/server'

// Minimax TTS API 端点（根据最新文档）
const MINIMAX_TTS_URL = 'https://api.minimax.chat/v1/tts'

// 正确的音色ID（根据Minimax官方文档）
const VOICE_MAPPING: { [key: string]: string } = {
  'male-qn-qingse': 'voice-0105b311d88e4b3d96c8bc4225d76721',
  'male-qn-jingying': 'voice-0187c082e25b4f72a7df4a32875b2645',
  'male-qn-badao': 'voice-01c36724562d4820a617c9c3dd97b804',
  'female-qn-jingying': 'voice-01900c1a81c9457a8a913261342c61a5',
  'female-qn-mane': 'voice-01d4375e96644167819e111055ea4378'
}

export async function POST(request: NextRequest) {
  try {
    const { text, voice = 'male-qn-jingying', emotion = 'neutral', speed = 1.0 } = await request.json()

    // 从环境变量获取API密钥
    const apiKey = process.env.MINIMAX_API_KEY

    if (!apiKey) {
      console.error('Minimax API key not configured')
      return NextResponse.json(
        { error: 'Minimax API key not configured', details: 'Please add MINIMAX_API_KEY to environment variables' },
        { status: 500 }
      )
    }

    // 映射音色
    const voiceId = VOICE_MAPPING[voice] || VOICE_MAPPING['male-qn-jingying']

    // 构建请求体
    const requestBody = {
      model: 'speech-01',
      text: text,
      voice_id: voiceId,
      speed: speed,
      audio_setting: {
        sample_rate: 32000,
        bitrate: 128000,
        format: 'mp3'
      }
    }

    console.log('Calling Minimax TTS API:', JSON.stringify(requestBody, null, 2))

    const response = await fetch(MINIMAX_TTS_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    // 获取响应文本，可能是JSON也可能是base64音频
    const responseText = await response.text()
    console.log('Minimax TTS response status:', response.status)

    if (!response.ok) {
      console.error('Minimax TTS API error:', response.status, responseText)
      throw new Error(`Minimax TTS API error: ${response.status} - ${responseText}`)
    }

    // 解析响应
    let data
    try {
      data = JSON.parse(responseText)
    } catch (e) {
      // 如果不是JSON，可能是直接的base64音频
      if (responseText.startsWith('data:audio')) {
        return NextResponse.json({
          audio_base64: responseText.split(',')[1],
          request_id: Date.now().toString()
        })
      }
      throw new Error('Invalid response format from Minimax API')
    }

    // 返回音频数据
    if (data.audio) {
      return NextResponse.json({
        audio_base64: data.audio,
        request_id: data.request_id || Date.now().toString()
      })
    } else if (data.data && data.data.audio) {
      return NextResponse.json({
        audio_base64: data.data.audio,
        request_id: data.request_id || Date.now().toString()
      })
    } else {
      console.error('No audio data in response:', data)
      throw new Error('No audio data in Minimax API response')
    }

  } catch (error) {
    console.error('Minimax TTS API error:', error)
    return NextResponse.json(
      {
        error: '语音合成服务暂时不可用',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// GET请求返回支持的音色列表
export async function GET() {
  const voices = Object.entries(VOICE_MAPPING).map(([key, value]) => ({
    id: key,
    minimax_id: value,
    name: key.includes('female') ? '女声' : '男声',
    description: key
  }))

  return NextResponse.json({ voices })
}