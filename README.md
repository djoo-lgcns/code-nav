# CodeNav 배포 및 환경별 적용 가이드

> **Zero-Noise AST Code Navigator & MCP Server for AI Coding Agents**  
> GitHub Repository: [https://github.com/djoo-lgcns/code-nav](https://github.com/djoo-lgcns/code-nav)

AI 에이전트(Claude Code, Antigravity, Kiro CLI, Cursor 등)가 `grep`이나 `read_file`로 코드베이스를 탐색할 때 발생하는 **주석 노이즈, 토큰 낭비, 다형성 동음이의어 혼란을 제거**하기 위한 단일 실행 바이너리 및 MCP 서버입니다.

---

## 1. 1-Liner 원클릭 설치

터미널 환경에 맞춰 아래 한 줄을 실행합니다.

### Linux / macOS (Bash)
```bash
curl -fsSL https://raw.githubusercontent.com/djoo-lgcns/code-nav/main/install.sh | bash
```

### macOS (Zsh)
```bash
curl -fsSL https://raw.githubusercontent.com/djoo-lgcns/code-nav/main/install.sh | zsh
```

### Windows (PowerShell)
PowerShell을 열고 아래 명령어를 실행합니다:
```powershell
irm https://raw.githubusercontent.com/djoo-lgcns/code-nav/main/install.ps1 | iex
```

* **설치 위치**: 
  * Linux/macOS: `~/.local/bin/code-nav`
  * Windows: `%USERPROFILE%\.local\bin\code-nav.exe` (자동으로 사용자 PATH 등록)
* **설치 검증**:
  ```bash
  code-nav --version
  # 출력: code-nav 1.0.0 (AST Navigator + MCP Server)
  ```

---

## 2. AI 에이전트 하네스별 MCP 등록 (택 1)

`code-nav`는 단일 바이너리 안에 **CLI 모드**와 **MCP Stdio Server 모드(`--mcp`)**를 모두 내장하고 있습니다. 사용 중인 에이전트에 한 줄로 등록할 수 있습니다.

### Claude Code
```bash
claude mcp add code-nav -- ~/.local/bin/code-nav --mcp
```

### Kiro CLI
```bash
kiro-cli mcp add code-nav -- ~/.local/bin/code-nav --mcp
```

### Antigravity / Cursor / Windsurf
각 도구의 MCP 설정 파일(`mcp_config.json` 또는 `mcp.json`)의 `mcpServers` 블록에 아래 내용을 추가합니다:
```json
{
  "mcpServers": {
    "code-nav": {
      "command": "~/.local/bin/code-nav",
      "args": ["--mcp"]
    }
  }
}
```

---

## 3. 환경별 프로젝트 적용 가이드

에이전트가 실제로 작업을 시작할 때 `code-nav`를 최우선 도구로 사용하도록 규칙을 주입하는 방법입니다. 프로젝트 유형에 따라 **Case A** 또는 **Case B**를 선택하세요.

---

### Case A. 일반 프로젝트 (`AGENTS.md` 기반)

Claude Code, Kiro CLI, Cursor, Antigravity 등 대부분의 최신 에이전트는 프로젝트 루트의 `AGENTS.md`를 표준 지침으로 자동 로드합니다.

#### 적용 방법
프로젝트 루트의 `AGENTS.md` 파일에 아래 블록을 복사하여 추가합니다:

```markdown
# Agent Code Navigation Guidelines

This project enforces a **3-Step High-Precision Code Navigation Workflow** to eliminate hallucinations and token waste. Any AI agent working in this workspace must adhere to the following rules:

## 📌 Step 1: Definition Search (Where is it defined?)
When locating where a class, interface, function, or method is declared:
* **Primary Tool**: Use `code-nav def <SymbolName> [path]` (or MCP tool `code_nav_def`).
  * Runs AST-level syntax matching.
  * Strips all comment, variable, and import noise.
  * *Example*: `code-nav def MemberContext backend/`
* **Do NOT use raw regex or plain grep** for common words (like `cancel`, `id`, `login`) to avoid dumping comment noise.

## 📌 Step 2: Bounded Reading (Do NOT read entire files)
Do NOT consume tens of thousands of tokens by reading large files from line 1 to the end.
* **Outline first**: Use `code-nav outline <filePath>` (or MCP tool `code_nav_outline`) to inspect symbol line numbers in seconds.
* **Bounded read**: Read only the target line range using line-bounded file reading (e.g. ±20 lines around target).

## 📌 Step 3: Reference & Caller Tracking
* Use `code-nav refs <SymbolName> [path]` (or MCP tool `code_nav_refs`) to find all call sites, method invocations, and instantiations.
```

---

### Case B. AI-DLC 프로젝트 (`team.md` 메모리 계층)

AI-DLC(AI-Driven Development Lifecycle)를 적용한 프로젝트는 하네스에 종속되지 않는 계층형 메모리 구조(`aidlc/spaces/<space>/memory/`)를 가지고 있습니다.

#### 적용 방법
프로젝트 내 `aidlc/spaces/default/memory/team.md` 파일에 아래 내용을 추가합니다:

```markdown
## Code Navigation Standards (CodeNav v1)

All AI-DLC specialized agents (developer, architect, quality, etc.) must follow the 3-step navigation pipeline when inspecting or modifying the codebase:

1. **Step 1 (Definition Discovery)**:
   - Always run `code-nav def <Symbol> [path]` to locate class/method declarations.
   - Do NOT use plain `grep` on broad terms to prevent context pollution during analysis.
2. **Step 2 (Structural Inspection)**:
   - For files exceeding 300 lines, run `code-nav outline <file>` first before opening the file.
   - Restrict reading to target line numbers identified in outline.
3. **Step 3 (Impact & Reference Analysis)**:
   - Run `code-nav refs <Symbol> [path]` to discover all caller sites across layers.
```

#### AI-DLC 스테이지별 권장 활용 포인트
* **Stage 1.4 Reverse Engineering**:
  * 브라운필드 분석 시 `code-nav repomap`과 `code-nav outline`을 활용해 수백 개 파일을 무차별 열람하지 않고도 프로젝트 전체 컴포넌트 구조를 수 초 만에 파악합니다.
* **Stage 3.1 Code Generation**:
  * 구현 중 기존 도메인 엔티티나 인터페이스 시그니처가 필요할 때, `code-nav def <인터페이스명>`을 호출하여 1턴 만에 파라미터 구조를 획득합니다.
* **Stage 3.3 Build & Test**:
  * 변경된 비즈니스 로직의 단위 테스트를 작성할 때, `code-nav refs <메서드명>`을 통해 컨트롤러·서비스 간의 호출 흐름을 전수 파악하고 테스트 누락을 방지합니다.

---

## 4. CLI 핵심 명령어 치트시트

터미널이나 에이전트의 Bash 도구에서 직접 호출할 때 사용하는 명령어 모음입니다:

| 명령어 | 설명 | 예시 |
| :--- | :--- | :--- |
| `code-nav def <심볼> [경로]` | 클래스, 인터페이스, 함수, 메서드의 **순수 선언부만 추출** | `code-nav def OrderService src/` |
| `code-nav refs <심볼> [경로]` | 심볼의 **호출부(Call sites) 및 `new` 생성 위치 추출** | `code-nav refs getCompanyGrade backend/` |
| `code-nav outline <파일>` | 파일 전체를 열지 않고 **심볼 목록과 라인 번호만 요약** | `code-nav outline src/service.ts` |
| `code-nav repomap [디렉터리]` | 디렉터리 내 핵심 클래스/인터페이스의 **고수준 요약 맵 생성** | `code-nav repomap .` |
| `code-nav --mcp` | Model Context Protocol Stdio 서버로 구동 | `code-nav --mcp` |
