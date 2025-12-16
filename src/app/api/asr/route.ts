import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { audio } = await request.json()

    if (!audio) {
      return NextResponse.json(
        { error: '缺少音频数据' },
        { status: 400 }
      )
    }

    // 从环境变量获取配置
    const apiKey = process.env.MINIMAX_API_KEY
    const groupId = process.env.MINIMAX_GROUP_ID

    if (!apiKey || !groupId) {
      return NextResponse.json(
        { error: 'Minimax API配置不完整' },
        { status: 500 }
      )
    }

    // 调用Minimax API
    const response = await fetch('https://api.minimax.chat/v1/asr', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-GroupId': groupId
      },
      body: JSON.stringify({
        audio: audio,
        model: 'whisper-1'
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { error: `Minimax ASR请求失败: ${response.statusText} - ${errorText}` },
        { status: response.status }
      )
    }

    const result = await response.json()
    
    return NextResponse.json(result)

  } catch (error) {
    console.error('ASR API错误:', error)
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    )
  }
}
