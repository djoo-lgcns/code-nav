# CodeNav MCP Server

> **Zero-Noise AST Code Navigation MCP Server for AI Coding Agents**  
> GitHub: [https://github.com/djoo-lgcns/code-nav](https://github.com/djoo-lgcns/code-nav)

AI 코딩 에이전트(Claude Code, Antigravity, Kiro CLI, Cursor 등)가 대규모 코드베이스를 탐색할 때 발생하는 **주석 노이즈, 변수명 충돌, 수만 토큰의 파일 열람 낭비를 제거**하는 초경량(14KB) Model Context Protocol(MCP) 서버입니다.

무거운 Language Server(LSP) 데몬 없이, Rust 기반 AST 엔진(`ast-grep`)의 표준 Tree-sitter 심볼 추출기를 통해 **Java, TypeScript, Python, Go, Rust, C++** 등 다양한 언어의 선언부와 구조를 밀리초 단위로 파악합니다.

---

## 1. 왜 필요한가? (문제 해결)

* **Naive Grep의 한계**: `grep cancel`을 실행하면 주석, 로그 메시지, 변수명 등 수십 줄의 노이즈가 컨텍스트 윈도우를 오염시킵니다.
* **대형 파일 열람 낭비**: 단순 메서드 시그니처 하나를 확인하기 위해 500~1,000줄의 파일 전체를 읽으면서 비싼 토큰과 추론 시간을 소모합니다.
* **실측 편익**: Kiro CLI 실제 벤치마크 결과, `code-nav` 도입 시 **도구 왕복 횟수 25% 단축, 응답 지연 시간 33% 단축, API 소비 크레딧 33% 절감**이 검증되었습니다.

---

## 2. 전제 조건

* **Node.js** (v18 이상)
* **ast-grep** (글로벌 설치)
  ```bash
  # Windows (winget 또는 npm)
  winget install ast-grep.ast-grep
  # 또는
  npm install -g @ast-grep/cli

  # macOS (Homebrew 또는 npm)
  brew install ast-grep
  # 또는
  npm install -g @ast-grep/cli

  # Linux (npm 또는 Cargo)
  npm install -g @ast-grep/cli
  ```

---

## 3. 에이전트 등록 (Quick Start)

`code-nav`는 기본적으로 표준 Stdio MCP 서버로 동작합니다. 사용 중인 AI 도구에 한 줄로 등록할 수 있습니다.

### A. Claude Code
```bash
claude mcp add code-nav -- npx -y github:djoo-lgcns/code-nav
```

### B. Kiro CLI
```bash
kiro-cli mcp add code-nav -- npx -y github:djoo-lgcns/code-nav
```

### C. Antigravity / Cursor / Windsurf
설정 파일(`mcp_config.json` 또는 `mcp.json`)의 `mcpServers` 항목에 추가:
```json
{
  "mcpServers": {
    "code-nav": {
      "command": "npx",
      "args": ["-y", "github:djoo-lgcns/code-nav"]
    }
  }
}
```

---

## 4. 제공되는 도구 (Tools)

| MCP 도구명 | 파라미터 | 설명 |
| :--- | :--- | :--- |
| **`code_nav_def`** | `symbol` (필수), `path` (선택) | 클래스, 인터페이스, 함수, 메서드의 **정의 선언부만 추출** (단일 심볼 및 `OrderService.cancel` 형식 지원) |
| **`code_nav_outline`** | `filePath` (필수) | 파일 전체를 열지 않고 **클래스/메서드/필드 계층 구조와 라인 번호 요약** |
| **`code_nav_refs`** | `symbol` (필수), `path` (선택) | 심볼의 **호출부(Call sites) 및 `new` 인스턴스화 위치만 AST 패턴으로 추출** |
| **`code_nav_repomap`** | `path` (선택) | 디렉터리 내 핵심 선언부(Class, Interface)의 **고수준 요약 맵 생성** |

---

## 5. 권장 워크플로우 (AGENTS.md 연동)

별도의 프롬프트를 주지 않아도 도구 Description에 의해 자동 호출되지만, 팀 단위에서 토큰 절약 원칙을 에이전트에게 강제하고 싶다면 프로젝트의 `AGENTS.md` 또는 AI-DLC의 `team.md`에 다음 지침을 추가하세요.

```markdown
## Code Navigation Guidelines
1. **Entrypoint Search**: Use `code_nav_def(symbol)` FIRST instead of grep when finding class/method declarations.
2. **Bounded Reading**: Use `code_nav_outline(filePath)` before opening large files, and read only targeted line ranges (±20 lines).
3. **Call Sites**: Use `code_nav_refs(symbol)` to trace invocations without regex noise.
```

---

## 6. CLI 직접 사용 (선택 사항)

터미널에서 직접 도구를 테스트하거나 스크립트에서 호출할 수도 있습니다:

```bash
# 심볼 정의 탐색 (단일 심볼 및 클래스.메서드)
npx -y github:djoo-lgcns/code-nav def cancel backend/
npx -y github:djoo-lgcns/code-nav def OrderService.cancel backend/

# 파일 아웃라인 확인 (라인 번호 확인 후 필요한 범위만 열람)
npx -y github:djoo-lgcns/code-nav outline src/OrderController.java

# 호출처 및 new 인스턴스화 위치 탐색
npx -y github:djoo-lgcns/code-nav refs cancel backend/
```

---

## 라이선스
MIT License.
