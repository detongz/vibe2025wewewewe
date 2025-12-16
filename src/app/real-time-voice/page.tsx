'use client'

import { useState, useRef, useEffect } from 'react'

export default function RealTimeVoice() {
  const [isRecording, setIsRecording] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [conversation, setConversation] = useState<{ type: 'user' | 'ai', text: string, audio?: string }[]>([])
  const [currentText, setCurrentText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // 初始化音频上下文
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  // 连接Python后端
  const connectBackend = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      // 测试后端连接
      const healthResponse = await fetch('http://localhost:3000/health')
      if (healthResponse.ok) {
        setIsConnected(true)
        setConversation([{ type: 'ai', text: '你好！我是你的AI助手，有什么可以帮助你的吗？' }])
      } else {
        throw new Error('后端服务连接失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '连接失败')
    } finally {
      setIsLoading(false)
    }
  }

  // 开始录音
  const startRecording = async () => {
    if (!isConnected) {
      setError('请先连接到后端服务')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      // 设置音频分析器
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      audioSourceRef.current = audioContextRef.current.createMediaStreamSource(stream)
      analyserRef.current = audioContextRef.current.createAnalyser()
      audioSourceRef.current.connect(analyserRef.current)
      
      // 设置分析器参数
      if (analyserRef.current) {
        analyserRef.current.fftSize = 256
      }
      
      audioChunksRef.current = []
      mediaRecorderRef.current = new MediaRecorder(stream)
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }
      
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        await processAudio(audioBlob)
      }
      
      mediaRecorderRef.current.start()
      setIsRecording(true)
      
      // 开始绘制音频波形
      drawAudioWave()
      
    } catch (err) {
      setError(err instanceof Error ? err.message : '无法访问麦克风')
    }
  }

  // 停止录音
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
      setIsRecording(false)
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }

  // 绘制音频波形
  const drawAudioWave = () => {
    if (!analyserRef.current) return
    
    const canvas = document.getElementById('audio-wave') as HTMLCanvasElement
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    const bufferLength = analyserRef.current.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    
    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw)
      
      analyserRef.current!.getByteTimeDomainData(dataArray)
      
      ctx.fillStyle = 'rgb(240, 240, 240)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      ctx.lineWidth = 2
      ctx.strokeStyle = 'rgb(59, 130, 246)'
      ctx.beginPath()
      
      const sliceWidth = canvas.width / bufferLength
      let x = 0
      
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0
        const y = v * canvas.height / 2
        
        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
        
        x += sliceWidth
      }
      
      ctx.lineTo(canvas.width, canvas.height / 2)
      ctx.stroke()
    }
    
    draw()
  }

  // 处理音频
  const processAudio = async (audioBlob: Blob) => {
    if (!isConnected) {
      setError('请先连接到后端服务')
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      
      // 将音频转换为base64
      const audioBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.readAsDataURL(audioBlob)
      })
      
      // 调用Python后端ASR API
      const response = await fetch('http://localhost:3000/api/asr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audio: audioBase64.split(',')[1], // 移除data:audio/webm;base64,前缀
        })
      })
      
      if (!response.ok) {
        throw new Error('语音识别失败')
      }
      
      const result = await response.json()
      const recognizedText = result.text || ''
      
      // 添加用户语音到对话
      setConversation(prev => [...prev, { type: 'user', text: recognizedText }])
      
      // 调用Python后端TTS API生成AI回复
      const ttsResponse = await fetch('http://localhost:3000/api/tts/websocket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: recognizedText,
          voice: 'female-qn-jingying',
          model: 'speech-02-turbo',
          speed: 1.0,
          volume: 1.0,
          pitch: 0,
          emotion: 'neutral'
        })
      })
      
      if (!ttsResponse.ok) {
        throw new Error('语音合成失败')
      }
      
      const audioBlobResponse = await ttsResponse.blob()
      const audioUrl = URL.createObjectURL(audioBlobResponse)
      
      // 添加AI回复到对话
      setConversation(prev => [...prev, { type: 'ai', text: '我理解了你的话：' + recognizedText, audio: audioUrl }])
      
      // 播放AI回复
      if (audioRef.current) {
        audioRef.current.src = audioUrl
        audioRef.current.play()
        setIsPlaying(true)
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : '处理音频失败')
    } finally {
      setIsLoading(false)
    }
  }

  // 播放音频
  const playAudio = (audioUrl: string) => {
    if (audioRef.current) {
      audioRef.current.src = audioUrl
      audioRef.current.play()
      setIsPlaying(true)
    }
  }

  // 停止播放
  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setIsPlaying(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold mb-8">实时语音通话</h1>
        
        {!isConnected ? (
          <div className="bg-white rounded-lg shadow p-6">
            <button
              onClick={connectBackend}
              disabled={isLoading}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? '连接中...' : '连接Python后端'}
            </button>
            
            {error && (
              <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md">
                <strong>错误:</strong> {error}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* 音频波形显示 */}
            <div className="bg-white rounded-lg shadow p-6">
              <canvas
                id="audio-wave"
                width="600"
                height="100"
                className="w-full h-24 bg-gray-100 rounded"
              />
            </div>
            
            {/* 控制按钮 */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex space-x-4">
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isLoading || !isConnected}
                  className={`flex-1 py-3 px-4 rounded-md transition-colors ${
                    isRecording
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  } disabled:bg-gray-400 disabled:cursor-not-allowed`}
                >
                  {isRecording ? '停止录音' : '开始录音'}
                </button>
                
                <button
                  onClick={stopPlayback}
                  disabled={!isPlaying}
                  className="flex-1 bg-gray-600 text-white py-3 px-4 rounded-md hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  停止播放
                </button>
              </div>
              
              {isLoading && (
                <div className="mt-4 text-center text-gray-600">
                  处理中...
                </div>
              )}
              
              {error && (
                <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md">
                  <strong>错误:</strong> {error}
                </div>
              )}
            </div>
            
            {/* 对话历史 */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">对话历史</h2>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {conversation.map((msg, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg ${
                      msg.type === 'user'
                        ? 'bg-blue-50 ml-8'
                        : 'bg-gray-50 mr-8'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          msg.type === 'user'
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-500 text-white'
                        }`}
                      >
                        {msg.type === 'user' ? '你' : 'AI'}
                      </div>
                      <div className="flex-1">
                        <p className="text-gray-800">{msg.text}</p>
                        {msg.audio && (
                          <div className="mt-2">
                            <audio
                              controls
                              className="w-full"
                              onPlay={() => setIsPlaying(true)}
                              onPause={() => setIsPlaying(false)}
                              onEnded={() => setIsPlaying(false)}
                            >
                              <source src={msg.audio} type="audio/mpeg" />
                              您的浏览器不支持音频播放
                            </audio>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* 隐藏的音频元素 */}
        <audio ref={audioRef} onEnded={() => setIsPlaying(false)} />
        
        {/* 配置说明 */}
        <div className="mt-8 p-6 bg-yellow-50 border border-yellow-200 rounded-md">
          <h2 className="text-lg font-semibold text-yellow-800 mb-2">配置说明</h2>
          <p className="text-yellow-700 mb-2">
            要使用这个实时语音通话功能，请确保：
          </p>
          <ul className="text-yellow-700 text-sm space-y-1">
            <li>• Python后端服务运行在 localhost:3000</li>
            <li>• 在服务器环境变量中配置 Minimax API 密钥和 Group ID</li>
            <li>• 允许浏览器访问麦克风</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
