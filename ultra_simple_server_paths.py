#!/usr/bin/env python3
"""
极简播客制作服务器 - 端口3000
核心：session_id验证 + 强制skill + SKILL.md知识库
使用Claude Agent SDK Python实现
"""

import sys
import os

# 添加虚拟环境路径
venv_path = os.path.join(
    os.path.dirname(__file__), "venv", "lib", "python3.11", "site-packages"
)
if os.path.exists(venv_path):
    sys.path.insert(0, venv_path)

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Union, AsyncGenerator
import json
import uuid
from datetime import datetime
from pathlib import Path
import subprocess
import asyncio
from fastapi.responses import JSONResponse, StreamingResponse
from .claude_agent_sdk import claude_agent_sdk

app = FastAPI(title="Podcast Server", version="1.0.0")

# 系统提示词 - 强制使用skill
SYSTEM_PROMPT = """你使用skill完成工作"""

# 会话管理
SESSIONS_DIR = Path("/tmp")


def get_session_path(session_id: str) -> Path:
    return SESSIONS_DIR / f"{session_id}"


def create_session_context(session_id: str, username: str = "anonymous"):
    session_path = get_session_path(session_id)
    session_path.mkdir(exist_ok=True)

    # 保存会话信息
    session_info = {
        "session_id": session_id,
        "username": username,  # 添加用户名字段
        "created_at": datetime.now().isoformat(),
        "messages": [],
        "claude_session_id": None,  # 添加Claude会话ID字段
    }

    with open(session_path / "context.json", "w", encoding="utf-8") as f:
        json.dump(session_info, f, ensure_ascii=False, indent=2)
    with open(session_path / "CLAUDE.md", "w", encoding="utf-8") as f:
        json.dump(session_info, f, ensure_ascii=False, indent=2)

    return session_path


def save_message(
    session_id: str, role: str, content: str, tool_calls=None, sequence_id=None
):
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
        "timestamp": datetime.now().isoformat(),
    }

    if tool_calls:
        message["tool_calls"] = tool_calls
    if sequence_id:
        message["sequence_id"] = sequence_id

    context["messages"].append(message)

    with open(context_file, "w", encoding="utf-8") as f:
        json.dump(context, f, ensure_ascii=False, indent=2)


def update_claude_session_in_context(our_session_id: str, claude_session_id: str):
    """更新会话上下文中的Claude会话ID"""
    try:
        session_path = get_session_path(our_session_id)
        session_path.mkdir(parents=True, exist_ok=True)  # Ensure directory exists
        context_file = session_path / "context.json"

        if context_file.exists():
            with open(context_file, "r", encoding="utf-8") as f:
                context = json.load(f)
        else:
            # Create initial context if it doesn't exist
            context = {
                "session_id": our_session_id,
                "created_at": datetime.now().isoformat(),
                "messages": [],
                "claude_session_id": claude_session_id,
            }

        context["claude_session_id"] = claude_session_id

        with open(context_file, "w", encoding="utf-8") as f:
            json.dump(context, f, ensure_ascii=False, indent=2)

        print(f"📝 更新会话上下文中的Claude会话ID: {claude_session_id}")
        return True
    except Exception as e:
        print(f"❌ 更新会话上下文失败: {str(e)}")
        return False


def load_claude_session_id(our_session_id: str) -> Optional[str]:
    """从持久化存储加载Claude会话ID"""
    try:
        # Use the same path approach as other functions
        session_path = get_session_path(our_session_id)
        session_path.mkdir(parents=True, exist_ok=True)  # Ensure directory exists
        context_file = session_path / "context.json"

        if context_file.exists():
            with open(context_file, "r", encoding="utf-8") as f:
                context = json.load(f)
                if "claude_session_id" in context:
                    return context["claude_session_id"]
        return None
    except Exception as e:
        print(f"❌ 加载Claude会话ID失败: {str(e)}")
        return None


def load_chat_history(our_session_id: str) -> Optional[str]:
    """从持久化存储加载Claude会话ID"""
    try:
        # Use the same path approach as other functions
        session_path = get_session_path(our_session_id)
        session_path.mkdir(parents=True, exist_ok=True)  # Ensure directory exists
        context_file = session_path / "context.json"

        context_msgs = []
        if context_file.exists():
            with open(context_file, "r", encoding="utf-8") as f:
                context = json.load(f)
                for msg in context.get("messages"):
                    context_msgs.append(f"{msg.get('role')}: {msg.get('content')}")
                return "\n".join(context_msgs) + "\n"
        return None
    except Exception as e:
        print(f"❌ 加载Claude会话ID失败: {str(e)}")
        return None
