#!/usr/bin/env python3
"""
极简播客制作服务器 - 端口3000
核心：session_id验证 + 强制skill + SKILL.md知识库
使用Claude Agent SDK Python实现
"""

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Union
import json
import os
import uuid
from datetime import datetime
from pathlib import Path
import subprocess
import asyncio
from fastapi.responses import JSONResponse

app = FastAPI(title="Podcast Server", version="1.0.0")

# 自定义JSON响应，强制UTF-8编码
class UTF8JSONResponse(JSONResponse):
    def render(self, content: Any) -> bytes:
        return json.dumps(
            content,
            ensure_ascii=False,  # 禁用ASCII编码，允许中文
            allow_nan=False,
            indent=None,
            separators=(",", ":"),
        ).encode("utf-8")

# 覆盖默认的JSON响应
app.default_response_class = UTF8JSONResponse

# CORS - 修复middleware配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[],
    max_age=3600
)

# 数据模型
class ChatMessage(BaseModel):
    role: str
    content: Union[str, List[Dict[str, Any]]]

class ChatRequest(BaseModel):
    model: str = "claude-3-sonnet"
    messages: List[ChatMessage]
    max_tokens: Optional[int] = 1024
    temperature: Optional[float] = 0.7

class ChatResponse(BaseModel):
    id: str
    object: str = "chat.completion"
    created: int
    model: str
    choices: List[Dict[str, Any]]
    usage: Dict[str, int]
    session_id: str

# 系统提示词 - 强制使用skill
SYSTEM_PROMPT = """你使用skill完成工作"""

# 会话管理
SESSIONS_DIR = Path("/tmp")

def get_session_path(session_id: str) -> Path:
    return SESSIONS_DIR / f"session_{session_id}"

def create_session_context(session_id: str):
    session_path = get_session_path(session_id)
    session_path.mkdir(exist_ok=True)

    # 保存会话信息
    session_info = {
        "session_id": session_id,
        "created_at": datetime.now().isoformat(),
        "messages": []
    }

    with open(session_path / "context.json", "w", encoding="utf-8") as f:
        json.dump(session_info, f, ensure_ascii=False, indent=2)

    return session_path

def save_message(session_id: str, role: str, content: str, tool_calls=None):
    session_path = get_session_path(session_id)
    context_file = session_path / "context.json"

    if context_file.exists():
        with open(context_file, "r", encoding="utf-8") as f:
            context = json.load(f)
    else:
        context = {"messages": []}

    message = {
        "role": role,
        "content": content,
        "timestamp": datetime.now().isoformat()
    }

    if tool_calls:
        message["tool_calls"] = tool_calls

    context["messages"].append(message)

    with open(context_file, "w", encoding="utf-8") as f:
        json.dump(context, f, ensure_ascii=False, indent=2)

# Claude Agent SDK集成
class ClaudeAgentSDK:
    """Claude Agent SDK Python实现"""

    def __init__(self):
        self.work_dir = None

    async def process_message(self, user_message: str, session_id: str) -> Dict[str, Any]:
        """使用Claude Agent SDK处理消息"""
        try:
            # 设置工作目录为 /tmp/{session_id}
            work_dir = Path(f"/tmp/{session_id}")
            work_dir.mkdir(parents=True, exist_ok=True)

            # 使用claude-agent-sdk处理消息
            result = await self._query_claude_agent(user_message, str(work_dir))

            return {
                "content": result["content"],
                "tool_calls": result["tool_calls"],
                "success": True
            }

        except Exception as e:
            return {
                "content": f"处理消息时出错: {str(e)}",
                "tool_calls": [self._create_default_tool_call(user_message)],
                "success": False
            }

    async def _query_claude_agent(self, user_message: str, work_dir: str) -> Dict[str, Any]:
        """使用Claude Agent SDK查询"""
        if True:
            # 导入claude-agent-sdk
            from claude_agent_sdk import query, ClaudeAgentOptions
            from claude_agent_sdk.types import AssistantMessage, TextBlock, ToolUseBlock
            import anyio

            # 创建claude-agent-sdk选项
            options = ClaudeAgentOptions(
                system_prompt="你在和用户做播客访谈，使用podcast-editor skill",  # 系统提示：使用播客skill
                setting_sources=["user", "project"],
                allowed_tools=["Skill", "Read", "Write", "Bash", "Grep", "Glob"],
                cwd=work_dir  # 设置cwd=/tmp/{session_id}
            )

            # 使用claude-agent-sdk处理消息
            response_text = ""
            tool_calls = []

            async for message in query(prompt='你用podcast-editor skill帮助用户做自己的播客，用户：'+user_message, options=options):
                if isinstance(message, AssistantMessage):
                    for block in message.content:
                        if isinstance(block, TextBlock):
                            response_text += block.text + "\n"
                        elif isinstance(block, ToolUseBlock):
                            tool_calls.append({
                                "id": f"tool_{len(tool_calls)}_{int(datetime.now().timestamp())}",
                                "type": "function",
                                "function": {
                                    "name": block.name,
                                    "arguments": json.dumps(block.input) if hasattr(block, 'input') else "{}"
                                }
                            })

            # 如果没有工具调用，创建默认的skill调用
            if not tool_calls:
                tool_calls = [self._create_default_tool_call(user_message)]

            return {
                "content": response_text.strip() if response_text else "处理完成",
                "tool_calls": tool_calls
            }

                
    
    def _extract_tool_calls(self, result_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """提取工具调用信息"""
        tool_calls = []
        
        # 从结果中提取工具调用
        if "tool_calls" in result_data.get("result", {}):
            for tool_call in result_data["result"]["tool_calls"]:
                tool_calls.append({
                    "id": tool_call.get("id", f"tool_{int(datetime.now().timestamp())}"),
                    "type": "function",
                    "function": {
                        "name": tool_call.get("name", "skill_documentation"),
                        "arguments": json.dumps(tool_call.get("arguments", {}))
                    }
                })
        
        return tool_calls if tool_calls else [self._create_default_tool_call("")]
    
    def _create_default_tool_call(self, user_message: str) -> Dict[str, Any]:
        """创建默认的工具调用"""
        return {
            "id": f"skill_{int(datetime.now().timestamp())}",
            "type": "function", 
            "function": {
                "name": "skill_documentation",
                "arguments": json.dumps({
                    "query": user_message,
                    "user_message": user_message
                })
            }
        }

# 初始化Claude Agent SDK
claude_agent_sdk = ClaudeAgentSDK()

# API端点
@app.post("/v1/sessions/create")
async def create_session():
    """创建新会话"""
    try:
        print(f"🚀 创建会话请求到达")
        session_id = str(uuid.uuid4())
        print(f"📋 生成session_id: {session_id}")

        session_path = create_session_context(session_id)
        print(f"📁 创建会话目录: {session_path}")

        response = {
            "session_id": session_id,
            "created_at": datetime.now().isoformat()
        }
        print(f"✅ 返回响应: {response}")
        return response

    except Exception as e:
        print(f"❌ 创建会话错误: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"创建会话失败: {str(e)}")

@app.post("/v1/chat/completions", response_model=ChatResponse)
async def chat_completions(request: ChatRequest, session_id: str = Header(..., description="会话ID", alias="session-id")):
    """聊天完成 - 前端通过header传递session_id"""

    # 1. 验证session_id存在性
    session_path = get_session_path(session_id)
    if not session_path.exists():
        raise HTTPException(status_code=404, detail="Session not found")

    # 2. 提取用户消息内容
    user_content = ""
    if request.messages:
        last_msg = request.messages[-1]
        content = last_msg.content

        if isinstance(content, str):
            user_content = content
        elif isinstance(content, list):
            # 处理复杂的content结构
            for item in content:
                if isinstance(item, dict) and item.get("type") == "text":
                    user_content = item.get("text", "")
                    break

    if not user_content:
        raise HTTPException(status_code=400, detail="No user message found")

    # 3. 调用process_text_with_skills()使用claude-agent-sdk
    result = await claude_agent_sdk.process_message(user_content, session_id)

    # 4. 保存消息
    save_message(session_id, "user", user_content)
    save_message(session_id, "assistant", result["content"], result.get("tool_calls", []))

    # 5. 构建响应
    return ChatResponse(
        id=f"chatcmpl-{int(datetime.now().timestamp())}",
        created=int(datetime.now().timestamp()),
        model=request.model,
        choices=[{
            "index": 0,
            "message": {
                "role": "assistant",
                "content": result["content"],
                "tool_calls": result.get("tool_calls", [])
            },
            "finish_reason": "stop"
        }],
        usage={
            "prompt_tokens": len(user_content),
            "completion_tokens": len(result["content"]),
            "total_tokens": len(user_content) + len(result["content"])
        },
        session_id=session_id
    )


@app.get("/v1/sessions/{session_id}")
async def get_session(session_id: str):
    """获取会话信息"""
    session_path = get_session_path(session_id)
    if not session_path.exists():
        raise HTTPException(status_code=404, detail="Session not found")

    context_file = session_path / "context.json"
    if context_file.exists():
        with open(context_file, "r", encoding="utf-8") as f:
            context = json.load(f)
        return context

    return {"session_id": session_id, "messages": []}

@app.get("/")
async def root():
    return {"message": "Podcast Server - Port 3001", "version": "1.0.0"}

@app.get("/health")
async def health():
    return {"status": "healthy", "port": 3001}

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting Podcast Server on port 3001...")
    uvicorn.run(app, host="0.0.0.0", port=3001, log_level="info")
