# CodeNav MCP Server

> **Zero-Noise AST Code Navigation MCP Server for AI Coding Agents**  
> GitHub: [https://github.com/djoo-lgcns/code-nav](https://github.com/djoo-lgcns/code-nav)

AI 에이전트(Claude Code, Antigravity, Kiro CLI, Cursor 등)가 `grep`으로 코드를 탐색할 때 겪는 **주석 노이즈, 변수명 충돌, 수만 토큰의 파일 열람 낭비를 제거**하는 초경량(13KB) Model Context Protocol(MCP) 서버입니다.

Language Server(LSP) 데몬 없이, 내장된 AST 엔진(`ast-grep`)을 통해 **Java, TypeScript, JavaScript, Python** 4개 언어의 심볼 선언과 구조를 즉시 파악합니다.

---

## 1. 전제 조건

* **Node.js** (v18 이상)
* **ast-grep** (글로벌 설치)
  * **Windows**:
    ```powershell
    # winget (추천)
    winget install ast-grep.ast-grep
    # 또는 npm
    npm install -g @ast-grep/cli
    # 또는 Scoop / Cargo
    scoop install ast-grep
    cargo install ast-grep --locked
    ```
  * **macOS / Linux**:
    ```bash
    # Homebrew (macOS)
    brew install ast-grep
    # 또는 npm
    npm install -g @ast-grep/cli
    # 또는 Cargo
    cargo install ast-grep --locked
    ```

---

## 2. AI 에이전트 하네스별 등록 (MCP)

`code-nav`는 기본적으로 표준 Stdio MCP 서버로 동작하므로, 사용 중인 하네스에 등록만 하면 즉시 도구로 로드됩니다.

### A. Claude Code
```bash
claude mcp add code-nav -- npx -y github:djoo-lgcns/code-nav
```

### B. Kiro CLI
```bash
kiro-cli mcp add code-nav -- npx -y github:djoo-lgcns/code-nav
```

### C. Antigravity / Cursor / Windsurf
각 도구의 MCP 설정 파일(`mcp_config.json` 또는 `mcp.json`)의 `mcpServers`에 등록:
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
*(로컬 클론 사용 시 `command`: `node`, `args`: `["/path/to/code-nav/index.js"]`로 지정하셔도 됩니다.)*

---

## 3. 기본 작동 및 (선택 사항) 프로젝트 헌법 강제

### 기본 작동: Zero Config (별도 설정 불필요)
**MCP 등록만 완료하면 끝납니다.** 각 도구의 내부 Description에 이미 최우선 탐색 지침이 내장되어 있으므로, 프로젝트 설정 파일을 전혀 수정하지 않아도 에이전트는 심볼 정의를 찾을 때 `grep` 대신 `code_nav_def`를 스스로 우선 호출합니다.

### 선택 사항: 팀 표준 워크플로우 강제 (Optional)
만약 팀 차원에서 **"300줄 넘는 대형 파일은 outline 없이 열지 말 것"** 등 엄격한 3단계 파이프라인을 프로젝트 전체 에이전트에게 강제하고 싶다면 아래 설정을 추가하세요.

#### Case A. 일반 프로젝트 (`AGENTS.md`)
프로젝트 루트의 `AGENTS.md`에 추가:
```markdown
## Code Navigation Guidelines
When searching for code declarations and structure, prefer the `code-nav` MCP tools:
- **`code_nav_def(symbol)`**: Use FIRST when locating class, interface, function, or method definitions to avoid comment/variable noise.
- **`code_nav_outline(filePath)`**: Use before opening files >300 lines to inspect structure and line numbers.
- **`code_nav_refs(symbol)`**: Use to find call sites and instantiations.
```

#### Case B. AI-DLC 프로젝트 (`team.md`)
`aidlc/spaces/default/memory/team.md`에 추가:
```markdown
## Code Navigation Standards
All specialized agents must use `code-nav` MCP tools for code structure queries:
1. Discovery: Call `code_nav_def` to locate declarations during reverse engineering and coding.
2. Inspection: Call `code_nav_outline` before reading large files to target exact line ranges.
3. Call Sites: Call `code_nav_refs` to trace cross-layer impacts and references.
```

---

## 4. 제공되는 MCP 도구 목록

| MCP 도구명 | 파라미터 | 설명 |
| :--- | :--- | :--- |
| **`code_nav_def`** | `symbol` (필수), `path` (선택) | 클래스, 인터페이스, 함수, 메서드의 **정의 선언부만 추출** |
| **`code_nav_outline`** | `filePath` (필수) | 파일 전체를 읽지 않고 **심볼 목록과 라인 번호만 요약** |
| **`code_nav_refs`** | `symbol` (필수), `path` (선택) | 심볼의 **호출부(Call sites) 및 `new` 인스턴스화 위치 추출** |
| **`code_nav_repomap`** | `path` (선택) | 디렉터리 내 핵심 선언부의 **고수준 요약 맵 생성** |

---

## 5. 터미널 CLI 직접 테스트 (선택)

터미널에서 직접 실행해 보고 싶다면 뒤에 명령어를 붙여 호출할 수 있습니다:
```bash
node index.js def MemberContext backend/   # 정의 탐색
node index.js outline src/App.tsx          # 아웃라인 확인
node index.js refs cancel backend/         # 호출처 확인
```
