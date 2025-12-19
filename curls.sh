curl -X POST "http://localhost:3001/v1/sessions/create" -H "Content-Type: application/json" -d '{"username": "张"}' 





 curl -X POST "http://localhost:3001/v1/chat/completions"   -H "session-id: 0f479c2e-fcfd-4d68-b0d7-8d5f9c52fc0f"      -H "Content-Type: application/json"       -d '{"stream":true,
         "model": "claude-3-sonnet", 
         "messages": [{"role": "user",  "sequence_id":"2","content": "嗯嗯"}]
      }'

curl -X POST "http://localhost:3001/api/podcast/generate" \
      -H "Content-Type: application/json" \
      -d '{"session_id": "0f479c2e-fcfd-4d68-b0d7-8d5f9c52fc0f"}'

