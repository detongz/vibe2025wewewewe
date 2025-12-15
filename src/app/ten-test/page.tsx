'use client'

import { useState, useEffect } from 'react'
import { getTenClient } from '@/lib/ten-client'

export default function TenTest() {
  const [isConnected, setIsConnected] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [testText, setTestText] = useState('你好，这是测试语音合成的功能。')
  const [selectedVoice, setSelectedVoice] = useState('male-qn-jingying')
  const [isConnecting, setIsConnecting] = useState(false)

  useEffect(() => {
    const client = getTenClient()

    // 监听连接状态
    const checkConnection = setInterval(() => {
      setIsConnected(client['isConnected'])
    }, 1000)

    return () => {
      clearInterval(checkConnection)
      client.disconnect()
    }
  }, [])

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`])
  }

  const handleStartRecording = async () => {
    try {
      addLog('开始录音...')
      const client = getTenClient()
      await client.startRecording()
      setIsRecording(true)
      addLog('录音成功')
    } catch (error) {
      addLog(`录音失败: ${error.message}`)
    }
  }

  const handleStopRecording = async () => {
    try {
      addLog('停止录音...')
      const client = getTenClient()
      await client.stopRecording()
      setIsRecording(false)
      addLog('录音已停止')
    } catch (error) {
      addLog(`停止录音失败: ${error.message}`)
    }
  }

  const handleTestTTS = async () => {
    try {
      addLog(`测试TTS: ${testText}`)
      const client = getTenClient()
      await client.textToSpeech(testText, selectedVoice)
      addLog('TTS播放成功')
    } catch (error) {
      addLog(`TTS失败: ${error.message}`)
    }
  }

  const handleInterrupt = () => {
    const client = getTenClient()
    client.interrupt()
    addLog('发送打断信号')
  }

  const handleConnect = async () => {
    try {
      setIsConnecting(true)
      addLog('正在连接到Ten服务器...')
      const client = getTenClient()
      await client.connect()
      setIsConnected(true)
      addLog('✅ 已连接到Ten服务器')
    } catch (error) {
      addLog(`❌ 连接失败: ${error.message}`)
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    try {
      addLog('正在断开连接...')
      const client = getTenClient()
      await client.disconnect()
      setIsConnected(false)
      addLog('已断开连接')
    } catch (error) {
      addLog(`断开连接失败: ${error.message}`)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold mb-8">Ten框架测试页面</h1>

        {/* 连接状态 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">连接状态</h2>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span>{isConnected ? '已连接到Ten服务器' : '未连接到Ten服务器'}</span>
            <span className="text-gray-500 text-sm">(ws://124.220.31.71:3001)</span>
          </div>
          <div className="flex gap-4">
            <button
              onClick={handleConnect}
              disabled={isConnected || isConnecting}
              className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400"
            >
              {isConnecting ? '连接中...' : '连接'}
            </button>
            <button
              onClick={handleDisconnect}
              disabled={!isConnected}
              className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:bg-gray-400"
            >
              断开连接
            </button>
          </div>
        </div>

        {/* 录音测试 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">录音测试</h2>
          <div className="flex gap-4">
            <button
              onClick={handleStartRecording}
              disabled={!isConnected || isRecording}
              className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-gray-400"
            >
              开始录音
            </button>
            <button
              onClick={handleStopRecording}
              disabled={!isRecording}
              className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:bg-gray-400"
            >
              停止录音
            </button>
          </div>
          {isRecording && (
            <div className="mt-4 flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <span>正在录音...</span>
            </div>
          )}
        </div>

        {/* TTS测试 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">TTS测试</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">测试文本</label>
              <input
                type="text"
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">音色选择</label>
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
            <div className="flex gap-4">
              <button
                onClick={handleTestTTS}
                disabled={!isConnected}
                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400"
              >
                测试TTS
              </button>
              <button
                onClick={handleInterrupt}
                className="px-6 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
              >
                打断播放
              </button>
            </div>
          </div>
        </div>

        {/* 日志输出 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">日志输出</h2>
          <div className="bg-gray-900 text-green-400 p-4 rounded-md h-64 overflow-y-auto font-mono text-sm">
            {logs.length === 0 ? (
              <span className="text-gray-500">等待日志...</span>
            ) : (
              logs.map((log, index) => (
                <div key={index}>{log}</div>
              ))
            )}
          </div>
          <button
            onClick={() => setLogs([])}
            className="mt-4 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            清空日志
          </button>
        </div>

        {/* 说明 */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <h3 className="font-semibold text-blue-800 mb-2">说明：</h3>
          <ul className="text-blue-700 text-sm space-y-1">
            <li>• 确保Ten服务器已经启动 (端口3001)</li>
            <li>• 配置好Minimax API密钥</li>
            <li>• 允许浏览器访问麦克风</li>
            <li>• 可以同时测试录音和TTS功能</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
