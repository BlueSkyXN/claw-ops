# OpenClaw Agent System Analysis for Preset Agent Import Feature

## EXECUTIVE SUMMARY

A **"preset agent import" feature with skill/prompt templates is HIGHLY FEASIBLE** for the claw-ops dashboard. The OpenClaw agent system is already designed with file-based storage and metadata management that perfectly supports this pattern.

**Key Findings:**
- Agents are **lightweight JSON configurations** (name, model, identity metadata)
- Skills are **completely separate** and managed via `skills.status` API
- System prompts/instructions are **NOT built-in** to the API—stored externally by agents
- Agent files (`agents.files.*`) support **arbitrary file storage** per agent (perfect for templates)
- Current UI only allows basic creation (name + workspace); ready for enhancement

---

## 1. AGENT ARCHITECTURE & FIELDS

### 1.1 Agent Core Definition

**Agent types from `src/types/openclaw.ts`:**

```typescript
// Complete agent representation
interface AgentSummary {
  id: string                           // Unique identifier (kebab-case)
  name?: string                        // Display name
  identity?: AgentIdentityInfo        // Visual/behavioral metadata
}

// Identity metadata
interface AgentIdentityInfo {
  name?: string                        // Display name (optional, sometimes in identity)
  theme?: string                       // Theme/color (from cleanroom specs)
  emoji?: string                       // Avatar emoji
  avatar?: string                      // Avatar data/base64
  avatarUrl?: string                   // Avatar URL
}

// Create/Update API
interface AgentsCreateParams {
  name: string                         // Required: agent name
  workspace?: string                   // Optional: workspace path (e.g., ~/.openclaw/workspaces/myagent)
}

interface AgentsUpdateParams {
  agentId: string                      // Which agent to update
  name?: string                        // Update name
  model?: string                       // Update model reference
  avatar?: string                      // Update avatar
  emoji?: string                       // Update emoji
}
```

### 1.2 What's NOT in the Core Agent Definition

**❌ NOT built into agent API:**
- System prompts / instructions
- Skill assignments
- Model configuration (only stored as string reference)
- Temperature, max_tokens, or other LLM parameters
- Workspace behavior/permissions

**Key insight:** OpenClaw agents are **metadata-light** by design. Heavy configuration is handled **elsewhere** (files, environment, external agent files).

---

## 2. FILE STORAGE & EXTERNAL CONFIGURATION

### 2.1 Agent Files API (`agents.files.*`)

OpenClaw provides **file-based storage per agent** via three methods:

```typescript
// List files stored for an agent
agents.files.list(params: AgentsFilesListParams)
  → AgentsFilesListResult
  
// Get a specific file content
agents.files.get(params: AgentsFilesGetParams)
  → AgentsFilesGetResult
  
// Set/upload a file for an agent
agents.files.set(params: AgentsFilesSetParams)
  → AgentsFilesSetResult
```

**File entry structure:**
```typescript
interface AgentsFileEntry {
  path: string                         // File path (e.g., "prompts/system.md")
  size?: number                        // File size in bytes
  updatedAt?: number                   // Unix timestamp
}
```

**💡 Perfect for:** Storing per-agent templates like:
- `prompts/system.md` — system instructions
- `prompts/few-shot.md` — few-shot examples
- `skills.json` — skill manifest
- `config.yaml` — agent-specific configuration

---

## 3. SKILLS & MODEL MANAGEMENT

### 3.1 Skills System

**Skills are completely separate from agents:**

```typescript
// List available skills
interface SkillEntry {
  name: string                         // Skill identifier
  version?: string                     // Version number
  status: 'installed' | 'available' | 'updating' | 'error'
  description?: string
}

// Install a skill (system-wide, not per-agent)
skills.install(params: SkillsInstallParams)
  → { installed: boolean }
```

**Key fact:** Skills are **not scoped to agents**. The API doesn't expose per-agent skill assignment at the gateway level. Assignment happens via:
1. Agent's internal configuration (stored via `agents.files.*`)
2. Agent's runtime logic (interprets file-based configuration)
3. Cleanroom specs suggest via `allowAgents` and `skills` fields

### 3.2 Models

**Models are available globally:**

```typescript
interface ModelChoice {
  id: string                           // Model identifier (e.g., "claude-sonnet-4-20250514")
  name?: string                        // Display name
  provider?: string                    // Provider (anthropic, openai, google)
  contextWindow?: number               // Max tokens
  maxOutput?: number                   // Max output tokens
}

// List available models
models.list() → ModelChoice[]
```

**For agents:** Model choice is stored as a string reference in `AgentsUpdateParams.model`, but there's no API-level enforcement of which models an agent can use.

---

## 4. PROMPT/SYSTEM INSTRUCTIONS

### 4.1 Pattern from Cleanroom Specs

Both `danghuangshang` and `edict` functional specs reveal the **intended architecture:**

```typescript
// From danghuangshang-functional-spec-cleanroom.md (line 116)
AgentConfig {
  agentId: string                      // Unique ID
  name: string                         // Display name
  model.primary: string                // Model reference
  identity.theme: string               // System persona (LONG TEXT)
  sandbox: { mode, scope }             // Sandboxing policy
  allowAgents?: string[]               // Child agent list
  maxConcurrent?: number               // Concurrency limit
  timeout?: number                     // Agent timeout (seconds)
  skills?: string[]                    // Available skill names
}
```

**`identity.theme` is the system prompt!**
- Stores long-form persona/instructions
- Currently accessible via API (visible in `GatewayAgentIdentity`)
- **NOT limited by the API type definition** — can hold large text

### 4.2 How Prompts Are Actually Stored

**Real-world pattern (from cleanroom specs):**

1. **Cleanroom specs describe agents WITH prompts:**
   - 14 agents in danghuangshang, each with detailed role descriptions
   - 12 agents in edict, each with role responsibilities

2. **But the API is minimal:**
   - Only `name` + optional `workspace` at creation
   - Only `name`, `model`, `avatar`, `emoji` at update

3. **Conclusion:** 
   - Prompts are stored **outside** the OpenClaw gateway API
   - Likely in agent's workspace files (`~/.openclaw/workspaces/{agentId}/`)
   - Or in agent's own persistent configuration
   - **Can be imported via `agents.files.set()`!**

---

## 5. CURRENT UI CAPABILITIES

### 5.1 What the Agents.tsx Dashboard Supports

**File:** `src/pages/Agents.tsx` (168 lines)

**Current features:**
- ✅ List all agents (grid view with emoji + name)
- ✅ Create agent (modal with **name** and **workspace** fields)
- ✅ Delete agent
- ✅ Display agent identity (emoji, theme if present)

**What's MISSING:**
- ❌ Edit agent (no modal to update existing agents)
- ❌ Configure skills per agent
- ❌ Set system prompts
- ❌ Manage model assignment
- ❌ Upload/manage agent files
- ❌ No templates or presets

### 5.2 Mock Data Structure

**From `src/data/mock.ts`:**

```typescript
const mockAgents: AgentSummary[] = [
  { id: 'default', name: 'Default Agent', identity: { name: 'Default Agent', emoji: '🤖' } },
  { id: 'coder', name: 'Coder', identity: { name: 'Coder', emoji: '💻' } },
  { id: 'writer', name: 'Writer', identity: { name: 'Writer', emoji: '✍️' } },
  { id: 'analyst', name: 'Data Analyst', identity: { name: 'Data Analyst', emoji: '📊' } },
  { id: 'ops', name: 'DevOps Agent', identity: { name: 'DevOps Agent', emoji: '⚙️' } },
  { id: 'translator', name: 'Translator', identity: { name: 'Translator', emoji: '🌐' } },
]
```

**Interpretation:** Mock data shows **role-based agents** (exactly like cleanroom specs), with minimal identity info.

---

## 6. API IMPLEMENTATION DETAILS

### 6.1 Agent Methods in `src/lib/api.ts`

```typescript
// Current DataAPI implementation
async createAgent(params: AgentsCreateParams): Promise<{ agentId: string }>
async updateAgent(params: AgentsUpdateParams): Promise<void>
async deleteAgent(params: AgentsDeleteParams): Promise<void>
async getAgents(): Promise<AgentSummary[]>
```

**All mapped to OpenClaw gateway methods:**
- `agents.create` (ADMIN scope)
- `agents.update` (ADMIN scope)
- `agents.delete` (ADMIN scope)
- `agents.list` (READ scope)

### 6.2 File Management NOT YET EXPOSED

**Available in API types but NOT in DataAPI interface:**

```typescript
// These are typed but not wrapped in src/lib/api.ts
agents.files.list()   // READ
agents.files.get()    // READ
agents.files.set()    // ADMIN
```

**Action item:** Expose file methods in DataAPI wrapper to support preset templates.

---

## 7. PRESET AGENT IMPORT FEATURE FEASIBILITY

### 7.1 Architecture

**A "preset agent" would consist of:**

```json
{
  "id": "coder-preset",
  "name": "Coder Agent",
  "description": "Full-stack code development agent",
  "identity": {
    "emoji": "💻",
    "theme": "blue",
    "avatar": "data:image/..."
  },
  "model": "claude-sonnet-4-20250514",
  "workspace": "~/.openclaw/workspaces/coder",
  "files": {
    "prompts/system.md": "You are an expert full-stack developer...",
    "skills.json": ["web-search", "code-interpreter", "file-manager"],
    "config.yaml": "temperature: 0.7\nmax_tokens: 4096"
  }
}
```

### 7.2 Import Flow (Proposed UI)

```
1. Dashboard → "Preset Library" tab
   ├── Browse presets (bundled + community)
   └── Search/filter by category

2. Select preset → "Import Agent"
   ├── Review template details
   ├── Customize: name, workspace, model
   └── Click "Import"

3. Backend executes:
   ├── agents.create({ name, workspace })
   ├── agents.files.set(agentId, "prompts/system.md", content)
   ├── agents.files.set(agentId, "skills.json", content)
   ├── agents.files.set(agentId, "config.yaml", content)
   ├── agents.update(agentId, { model, emoji, avatar })
   └── Show success + link to agent detail page

4. Agent is ready to use with full configuration
```

### 7.3 What Makes It Feasible

✅ **Minimal API changes required:**
- Expose `agents.files.*` in DataAPI wrapper
- All methods already exist in OpenClaw gateway

✅ **File format flexibility:**
- JSON, YAML, Markdown, raw text all supported
- Agent interprets based on its own logic

✅ **No new backend work:**
- OpenClaw gateway already handles file storage
- claw-ops dashboard just orchestrates existing APIs

✅ **UI is straightforward:**
- Reuse existing agent create modal
- Add file upload/template selection
- Show preview before import

✅ **Extensible:**
- Community can contribute presets
- GitHub repository for preset library
- Version management via semantic versioning

---

## 8. WHAT'S NEEDED TO IMPLEMENT

### 8.1 Code Changes Required

**Phase 1: Enable File Management**
1. Expose file APIs in `src/lib/api.ts`:
   ```typescript
   listAgentFiles(agentId: string): Promise<AgentsFileEntry[]>
   getAgentFile(agentId: string, path: string): Promise<string>
   setAgentFile(agentId: string, path: string, content: string): Promise<void>
   ```

2. Add type definitions for preset format (e.g., `PresetAgentTemplate`)

**Phase 2: UI Components**
1. Create `PresetBrowser.tsx` component
2. Create `PresetImportModal.tsx` with:
   - Preset preview
   - Customization fields (name, workspace, model)
   - Progress indicator during import
3. Enhance `Agents.tsx` with "Import Preset" button

**Phase 3: Preset Library**
1. Create `/public/presets/` directory with bundled templates
2. Each preset is a JSON file with schema matching `PresetAgentTemplate`
3. Optional: GitHub-based preset registry

### 8.2 Preset Template Schema

```typescript
interface PresetAgentTemplate {
  id: string                           // Unique preset ID
  name: string                         // Display name
  description: string                  // What this agent does
  category: string                     // 'developer' | 'content' | 'ops' | 'research'
  version: string                      // Preset version
  
  // Default configuration
  defaults: {
    model?: string                     // Recommended model
    emoji?: string                     // Avatar emoji
    theme?: string                     // Color theme
  }
  
  // Files to create
  files: {
    [path: string]: string             // path → file content
  }
  
  // Recommended skills (informational)
  recommendedSkills?: string[]
  
  // Keywords for search
  tags?: string[]
}
```

### 8.3 Example Presets

**Coder Agent Preset:**
```json
{
  "id": "coder-agent",
  "name": "Coder",
  "description": "Full-stack code development",
  "category": "developer",
  "version": "1.0.0",
  "defaults": {
    "model": "claude-sonnet-4-20250514",
    "emoji": "💻",
    "theme": "blue"
  },
  "files": {
    "prompts/system.md": "You are an expert full-stack developer...",
    "skills.json": "[\"code-interpreter\", \"web-search\"]"
  },
  "recommendedSkills": ["code-interpreter", "shell"],
  "tags": ["development", "coding", "python", "javascript"]
}
```

---

## 9. CLEANROOM SPEC ALIGNMENT

### 9.1 How This Fits the Product Vision

**DangHuangShang (When The Emperor Reigns) Spec:**
- **14 specialized agents** for a multi-Agent team system
- Each with distinct role, model, skills, sandbox mode
- Preset import would allow **one-click deployment** of entire agent teams
- Matches their "一键部署" (one-click deployment) value proposition

**Edict Spec:**
- **12 role-based agents** with role directories and configurations
- Preset import fits perfectly with their "role directory & runtime state" model
- Supports their "本地扩展创建" (local extension creation) pattern

### 9.2 Competitive Differentiation

With preset imports, claw-ops becomes:
- **"Preset agent marketplace"** for OpenClaw community
- Users can share **battle-tested agent configurations**
- Reduces onboarding friction (no manual config needed)
- Enables rapid **team scaling** (import 5 agents in 1 minute)

---

## 10. RECOMMENDATIONS

### 10.1 GO / NO-GO RECOMMENDATION

**✅ RECOMMENDATION: PROCEED WITH IMPLEMENTATION**

**Rationale:**
1. **Zero architectural conflicts** — OpenClaw already supports this pattern
2. **Minimal API surface** — Uses existing methods only
3. **High user value** — Dramatically reduces onboarding friction
4. **Extensible** — Community can contribute presets
5. **Aligned with specs** — Both cleanroom projects use preset-like patterns

### 10.2 Implementation Priority

**High:**
1. Expose file APIs in DataAPI (quick, high impact)
2. Create PresetBrowser component
3. Bundle 5-7 starter presets (Coder, Writer, Analyst, DevOps, Researcher, etc.)

**Medium:**
1. Preset import UI with customization
2. Preset validation schema
3. Test coverage for import flow

**Low:**
1. Community preset registry (future)
2. Preset versioning/updates (future)
3. Advanced preset authoring tools (future)

### 10.3 Design Considerations

**File storage:**
- Keep files organized: `prompts/`, `skills/`, `config/`
- Use consistent formats (JSON for structured data, Markdown for prose)
- Document file format expectations in preset schema

**User experience:**
- Show preset preview before import (description, emoji, skills)
- Allow partial customization (override model, name, emoji)
- Provide "rollback" (delete agent if import fails)

**Validation:**
- Validate preset schema before presenting to user
- Test file creation during import (fail fast)
- Show detailed errors if import fails

---

## CONCLUSION

**The preset agent import feature is not just feasible—it's a natural fit** for the OpenClaw ecosystem. The gateway API and claw-ops dashboard are already designed to support this pattern. Implementation requires no architectural changes, only UI/UX work and preset library curation.

**Next steps:**
1. ✅ Design preset schema and example presets
2. ✅ Expose file management APIs in DataAPI
3. ✅ Build preset browser UI
4. ✅ Test import/export workflows
5. ✅ Gather community feedback on preset library
