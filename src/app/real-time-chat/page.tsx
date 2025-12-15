'use client'

import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Volume2, Settings, Trash2 } from 'lucide-react'

export default function RealTimeChat() {
  const [isConnected, setIsConnected] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [conversation, setConversation] = useState<Array<{role: 'user' | 'assistant', content: string}>>([])
  const [audioUrl, setAudioUrl] = useState<string>('')
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  // 从 localStorage 加载对话历史
  useEffect(() => {
    const savedConversation = localStorage.getItem('minimax-conversation')
    if (savedConversation) {
      setConversation(JSON.parse(savedConversation))
    }
  }, [])

  // 保存对话历史到 localStorage
  useEffect(() => {
    localStorage.setItem('minimax-conversation', JSON.stringify(conversation))
  }, [conversation])

  const handleConnect = async () => {
    try {
      console.log('正在连接到语音服务...')
      
      // 模拟连接过程
      setTimeout(() => {
        setIsConnected(true)
        console.log('✅ 已连接到语音服务')
    } catch (error) {
      console.error('连接失败:', error)
    }
  }

  const startRecording = async () => {
    try {
      console.log('🎤 开始录音...')
      
      // 获取麦克风权限并开始录音
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }))
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
      }
      
      mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
      
      // 模拟语音识别
      const simulatedTranscript = '这是一段真实的语音识别结果。在实际项目中，这里会调用Minimax API进行语音识别。')
      setTranscript(simulatedTranscript)
      
      // 调用 Minimax Chat API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: simulatedTranscript,
          conversation: conversation
        })
      }
      
      mediaRecorder.start()
      setIsRecording(true)
    } catch (error) {
      console.error('录音失败:', error)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      
      // 停止所有音频轨道
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
    }

  const clearConversation = () => {
    setConversation([])
    localStorage.removeItem('minimax-conversation')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">实时语音对话
          </h1>
          <p className="text-xl text-gray-300">基于TEN框架 + Minimax大模型的实时语音交互
        </header>

        <div className="bg-slate-800/50 rounded-2xl p-6 backdrop-blur-sm border border-slate-700">
          <div className="flex flex-col gap-4">
            {/* 连接状态 */}
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">连接状态</h2>
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500' }">
                {isConnected ? '✅ 已连接' : '❌ 未连接'}
              </div>
            </div>

            {/* 录音控制 */}
            <div className="flex justify-center">
              <button
                onClick={handleConnect}
                disabled={isConnected}
                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all transform hover:scale-105 ${
                isConnected 
                  ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg border-4 border-green-400' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
              >
                {isConnected ? (
                  <Volume2 className="w-10 h-10" />
                ) : (
                  <Settings className="w-10 h-10" />
                )}
              </button>
            </div>

            {/* 录音按钮 */}
            {isConnected && (
              <div className="flex justify-center mt-8">
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`w-24 h-24 rounded-full flex items-center justify-center transition-all transform hover:scale-105 border-4 ${
                  isRecording 
                    ? 'bg-red-500 border-red-300 animate-pulse shadow-2xl shadow-red-500/50' : 'bg-gray-800 border-gray-600 text-white'
                }`}
              >
                {isRecording ? (
                  <MicOff className="w-12 h-12" />
                ) : (
                  <Mic className="w-12 h-12" />
                )}
              </button>
            )}

            {/* 转录显示 */}
            {transcript && (
              <div className="mt-6 p-4 bg-slate-700/80 rounded-lg border border-slate-600">
                  <p className="text-sm">{transcript}</p>
                </div>
            )}

            {/* 对话历史 */}
            <div className="mt-6 space-y-4">
              {conversation.map((message, index) => (
                <div key={index} className={`p-4 rounded-lg ${
                message.role === 'user' ? 'bg-blue-600/50' : 'bg-green-600/50' }
                }`}
              >
                <p className="text-sm">{message.content}</p>
            </div>
            ))}

            {/* 清空对话按钮 */}
            {conversation.length > 0 && (
              <div className="flex justify-center mt-4">
                <button
                  onClick={clearConversation}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600/50 hover:bg-red-700/50 rounded-lg transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                  清空对话
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}