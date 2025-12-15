import { NextRequest, NextResponse } from 'next/server'

const MINIMAX_API_URL = 'https://api.minimax.chat/v1/text/chatcompletion_v2'

export async function POST(request: NextRequest) {
  try {
    const { message, conversation } = await request.json()

    const apiKey = process.env.MINIMAX_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Minimax API key not configured' },
        { status: 400 }
      )
    }

    // 构建对话历史
    const messages = [
      {
        sender_type: 'USER',
        text: message
      }
    ]

    // 如果有之前的对话，添加到历史中
    if (conversation && conversation.length > 0) {
      conversation.forEach((msg: any) => {
        messages.push({
          sender_type: msg.role === 'user' ? 'USER' : 'BOT',
          text: msg.content
        })
      })
    }

    const response = await fetch(MINIMAX_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'abab5.5-chat',
        messages,
        reply_constraints: {
          sender_type: 'BOT',
          sender_name: 'AI助手',
        },
        temperature: 0.7,
        top_p: 0.95,
        stream: false,
      })
    })

    if (!response.ok) {
      throw new Error(`Minimax API error: ${response.status}`)
    }

    const data = await response.json()

    // 提取AI回复
    const aiReply = data.choices?.[0]?.message?.text || '抱歉，我没有理解你的意思。'

    return NextResponse.json({
      reply: aiReply,
      conversation_id: data.id
    })
  } catch (error) {
    console.error('Minimax Chat API error:', error)
    return NextResponse.json(
        { error: '对话服务暂时不可用' },
        { status: 500 }
      )
    }
}