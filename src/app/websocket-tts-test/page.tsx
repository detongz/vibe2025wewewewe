'use client'

import { useState, useEffect, useRef } from 'react'

export default function WebSocketTTSTest() {
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [testText, setTestText] = useState('你好，这是测试WebSocket语音合成的功能。')
  const [selectedVoice, setSelectedVoice] = useState('male-qn-jingying')
  const [selectedModel, setSelectedModel] = useState('speech-02-turbo')
  const [speed, setSpeed] = useState(1.0)
  const [volume, setVolume] = useState(1.0)
  const [pitch, setPitch] = useState(0)
  const [emotion, setEmotion] = useState('neutral')
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null)
  const [ws, setWs] = useState<WebSocket | null>(null)
  const [clientId, setClientId] = useState<string>('')

  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    // 初始化音频上下文
    const initAudio = async () => {
      try {
        const context = new (window.AudioContext || (window as any).webkitAudioContext)()
        setAudioContext(context)
      } catch (error) {
        addLog(`音频上下文初始化失败: ${error}`)
      }
    }

    initAudio()

    return () => {
      if (ws) {
        ws.close()
      }
      if (audioContext) {
        audioContext.close()
      }
    }
  }, [])

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`])
  }

  const connectWebSocket = async () => {
    if (isConnected) return

    setIsConnecting(true)
    try {
      addLog('正在连接到WebSocket服务器...')
      
      // 生成客户端ID
      const newClientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      setClientId(newClientId)

      // 连接WebSocket
      const websocket = new WebSocket(`ws://localhost:3000/ws/tts/${newClientId}`)
      
      websocket.onopen = () => {
        setIsConnected(true)
        setIsConnecting(false)
        addLog('✅ WebSocket连接成功')
        setWs(websocket)
      }

      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          addLog(`收到服务器消息: ${JSON.stringify(data)}`)
          
          if (data.success && data.audio_data) {
            // 处理音频数据
            const audioBlob = new Blob([data.audio_data], { type: 'audio/mpeg' })
            const audioUrl = URL.createObjectURL(audioBlob)
            setAudioUrl(audioUrl)
            addLog('音频生成成功')
            
            // 自动播放音频
            playAudio(audioUrl)
          } else if (data.error) {
            addLog(`❌ 错误: ${data.error}`)
          }
        } catch (error) {
          addLog(`❌ 解析消息失败: ${error}`)
        }
      }

      websocket.onclose = () => {
        setIsConnected(false)
        addLog('❌ WebSocket连接已关闭')
        setWs(null)
      }

      websocket.onerror = (error) => {
        addLog(`❌ WebSocket错误: ${error}`)
        setIsConnecting(false)
      }

    } catch (error) {
      addLog(`❌ 连接失败: ${error}`)
      setIsConnecting(false)
    }
  }

  const disconnectWebSocket = () => {
    if (ws) {
      ws.close()
      setWs(null)
      setIsConnected(false)
      addLog('手动断开连接')
    }
  }

  const sendTTSRequest = () => {
    if (!ws || !isConnected) {
      addLog('❌ WebSocket未连接')
      return
    }

    const request = {
      text: testText,
      voice: selectedVoice,
      model: selectedModel,
      speed: speed,
      volume: volume,
      pitch: pitch,
      emotion: emotion
    }

    addLog(`发送TTS请求: ${JSON.stringify(request)}`)
    ws.send(JSON.stringify(request))
  }

  const playAudio = (url: string) => {
    if (!audioContext) {
      addLog('❌ 音频上下文未初始化')
      return
    }

    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }

    const audio = new Audio(url)
    audioRef.current = audio

    audio.onplay = () => {
      setIsPlaying(true)
      addLog('🔊 开始播放音频')
    }

    audio.onended = () => {
      setIsPlaying(false)
      addLog('⏹️ 音频播放结束')
    }

    audio.onerror = (error) => {
      setIsPlaying(false)
      addLog(`❌ 音频播放错误: ${error}`)
    }

    audio.play().catch(error => {
      addLog(`❌ 播放失败: ${error}`)
    })
  }

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
      setIsPlaying(false)
      addLog('⏹️ 停止播放音频')
    }
  }

  const clearLogs = () => {
    setLogs([])
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold mb-8">WebSocket TTS 测试</h1>

        {/* 连接状态 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">连接状态</h2>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span>{isConnected ? '已连接到WebSocket服务器' : '未连接到WebSocket服务器'}</span>
          </div>
          <div className="flex gap-4">
            <button
              onClick={connectWebSocket}
              disabled={isConnected || isConnecting}
              className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400"
            >
              {isConnecting ? '连接中...' : '连接'}
            </button>
            <button
              onClick={disconnectWebSocket}
              disabled={!isConnected}
              className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:bg-gray-400"
            >
              断开连接
            </button>
          </div>
        </div>

        {/* TTS设置 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">TTS设置</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">测试文本</label>
              <textarea
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md"
                rows={3}
                placeholder="输入要转换的文本..."
              />
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">选择模型</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md"
                >
                  <option value="speech-02-turbo">Speech 02 Turbo</option>
                  <option value="speech-02-hd">Speech 02 HD</option>
                  <option value="speech-2.6-turbo">Speech 2.6 Turbo</option>
                  <option value="speech-2.6-hd">Speech 2.6 HD</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">选择音色</label>
                <select
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md"
                >
                  <option value="male-qn-jingying">精英男声</option>
                  <option value="male-qn-qingse">青涩男声</option>
                  <option value="male-qn-badao">霸道男声</option>
                  <option value="female-qn-jingying">精英女声</option>
                  <option value="female-qn-mane">暖心女声</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">语速: {speed.toFixed(1)}</label>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">音量: {volume.toFixed(1)}</label>
                <input
                  type="range"
                  min="0.0"
                  max="2.0"
                  step="0.1"
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">音调: {pitch}</label>
                <input
                  type="range"
                  min="-20"
                  max="20"
                  step="1"
                  value={pitch}
                  onChange={(e) => setPitch(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">情感</label>
                <select
                  value={emotion}
                  onChange={(e) => setEmotion(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md"
                >
                  <option value="neutral">中性</option>
                  <option value="happy">开心</option>
                  <option value="sad">悲伤</option>
                  <option value="angry">愤怒</option>
                  <option value="fearful">恐惧</option>
                  <option value="surprised">惊讶</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mt-6 flex gap-4">
            <button
              onClick={sendTTSRequest}
              disabled={!isConnected || !testText.trim()}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400"
            >
              生成语音
            </button>
            {audioUrl && (
              <>
                <button
                  onClick={() => playAudio(audioUrl)}
                  disabled={isPlaying}
                  className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400"
                >
                  播放
                </button>
                <button
                  onClick={stopAudio}
                  disabled={!isPlaying}
                  className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-gray-400"
                >
                  停止
                </button>
              </>
            )}
          </div>
        </div>

        {/* 音频播放器 */}
        {audioUrl && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">音频播放</h2>
            <audio
              controls
              src={audioUrl}
              onPlay={() => setIsPlaying(true)}
              onEnded={() => setIsPlaying(false)}
              onError={(e) => addLog(`音频播放错误: ${e}`)}
            />
          </div>
        )}

        {/* 日志输出 */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">日志输出</h2>
            <button
              onClick={clearLogs}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              清空日志
            </button>
          </div>
          <div className="bg-gray-900 text-green-400 p-4 rounded-md h-64 overflow-y-auto font-mono text-sm">
            {logs.length === 0 ? (
              <span className="text-gray-500">等待日志...</span>
            ) : (
              logs.map((log, index) => (
                <div key={index}>{log}</div>
              ))
            )}
          </div>
        </div>

        {/* 说明 */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <h3 className="font-semibold text-blue-800 mb-2">说明：</h3>
          <ul className="text-blue-700 text-sm space-y-1">
            <li>• 使用WebSocket实时传输音频数据</li>
            <li>• 支持多种TTS模型和音色</li>
            <li>• 可以调节语速、音调、音量和情感</li>
            <li>• 音频生成后自动播放</li>
            <li>• 确保WebSocket服务器运行在localhost:3000</li>
          </ul>
        </div>

        {/* 隐藏的音频元素 */}
        <audio ref={audioRef} />
      </div>
    </div>
  )
}
