"""
Code Extractor and Pre-execution Analyzer
Extracts code blocks, detects placeholders/stubs, and validates completeness before execution.
"""

import re
from typing import Dict, Any, Optional, List

PLACEHOLDER_PATTERNS = [
    r"#\s*TODO\b",
    r"//\s*TODO\b",
    r"#\s*write your logic here",
    r"//\s*write your logic here",
    r"#\s*implement here",
    r"//\s*implement here",
    r"#\s*your code goes here",
    r"//\s*your code goes here",
    r"\.\.\.\s*#\s*rest of",
    r"\.\.\.\s*//\s*rest of",
    r"raise NotImplementedError",
    r"\bpass\s*$"
]

def extract_code_blocks(text: str) -> List[Dict[str, str]]:
    """
    Extracts all fenced code blocks from markdown text with language annotations.
    """
    pattern = r"```([a-zA-Z0-9_\-+]*)\r?\n([\s\S]*?)```"
    matches = re.findall(pattern, text)
    blocks = []
    for lang, code in matches:
        blocks.append({
            "lang": lang.strip().lower(),
            "code": code.strip()
        })
    return blocks

def get_executable_code(text: str, preferred_lang: Optional[str] = None) -> Dict[str, Any]:
    """
    Extracts the most relevant code block and analyzes completeness.
    """
    blocks = extract_code_blocks(text)
    if not blocks:
        # Check if the entire text looks like raw code
        if "def " in text or "function " in text or "class " in text:
            code = text.strip()
            lang = "python" if ("def " in text or "import " in text) else "javascript"
            return {
                "has_code": True,
                "code": code,
                "lang": lang,
                "is_incomplete": has_placeholders(code),
                "placeholder_warning": detect_placeholder_reason(code)
            }
        return {
            "has_code": False,
            "code": "",
            "lang": "",
            "is_incomplete": True,
            "placeholder_warning": "No code block found in response"
        }

    # Filter by preferred language if provided
    selected_block = None
    if preferred_lang:
        pref = preferred_lang.lower()
        for b in blocks:
            if pref in b["lang"] or (pref == "python" and b["lang"] in ["py", "python"]) or (pref in ["javascript", "js"] and b["lang"] in ["js", "javascript", "typescript", "ts"]):
                selected_block = b
                break

    if not selected_block:
        # Prefer python or js block over others (like json or bash)
        for b in blocks:
            if b["lang"] in ["python", "py", "javascript", "js", "typescript", "ts"]:
                selected_block = b
                break

    if not selected_block:
        selected_block = blocks[0]

    code = selected_block["code"]
    lang = selected_block["lang"] or ("python" if ("def " in code or "import " in code) else "javascript")
    incomplete = has_placeholders(code)

    return {
        "has_code": True,
        "code": code,
        "lang": lang,
        "is_incomplete": incomplete,
        "placeholder_warning": detect_placeholder_reason(code) if incomplete else None
    }

def has_placeholders(code: str) -> bool:
    """
    Returns True if the code contains obvious placeholder comments or unhandled stubs.
    """
    for pat in PLACEHOLDER_PATTERNS:
        if re.search(pat, code, re.IGNORECASE | re.MULTILINE):
            return True
    
    # Check if a function is just 'pass' or '...'
    if re.search(r"def\s+[a-zA-Z0-9_]+\s*\([^)]*\)\s*:\s*(?:pass|\.\.\.)\s*(?:\n|$)", code):
        return True

    return False

def detect_placeholder_reason(code: str) -> str:
    for pat in PLACEHOLDER_PATTERNS:
        m = re.search(pat, code, re.IGNORECASE | re.MULTILINE)
        if m:
            return f"Found incomplete placeholder pattern: '{m.group(0).strip()}'"
    if re.search(r"def\s+[a-zA-Z0-9_]+\s*\([^)]*\)\s*:\s*(?:pass|\.\.\.)\s*(?:\n|$)", code):
        return "Found stub function with pass or ellipsis"
    return "Incomplete code detected"
