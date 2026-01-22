# AI Agent/Chat Code Refactoring Plan

## Overview

Full restructure of the AI agent/chat code to improve code organization, maintainability, performance, and testability through better separation of concerns.

---

## Phase 1: AI Core Package Restructure (`/ai`)

### 1.1 Create Core Interfaces and Types

Create `/ai/src/core/` with:
- `interfaces/provider.interface.ts` - IProvider, IProviderFactory
- `interfaces/stream.interface.ts` - IStreamHandler, IStreamAdapter
- `interfaces/prompt-strategy.interface.ts` - IPromptStrategy, IPromptBuilder
- `interfaces/tool-executor.interface.ts` - IToolRegistry, IToolConverter
- `types/` - Reorganize types by concern (messages, requests, responses, providers, tools)

### 1.2 Refactor Providers with Factory Pattern

**Current:** Single `AIProvider` class with switch statement for all providers (lines 79-119 in `/ai/src/providers/index.ts`)

**New Structure:**
```
/ai/src/providers/
  base-provider.ts         # Abstract base class
  anthropic/index.ts       # Anthropic implementation
  openai/index.ts          # OpenAI implementation
  bedrock/index.ts         # AWS Bedrock implementation
  openrouter/index.ts      # OpenRouter implementation
  factory.ts               # ProviderFactory with DI support
```

### 1.3 Implement Prompt Strategy Pattern

**Current:** Single `PromptBuilder` with hardcoded mode logic

**New Structure:**
```
/ai/src/prompts/
  prompt-builder.ts        # Composable builder
  strategies/
    base-strategy.ts       # Abstract strategy
    chat-strategy.ts       # Chat mode prompts
    edit-strategy.ts       # Edit mode prompts
    diff-format-strategy.ts # Aider diff instructions (extracted)
  templates/
    system-templates.ts    # Template strings
    context-formatters.ts  # Context formatting utilities
```

### 1.4 Refactor Diff Utilities into Pure Functions

**Current:** `/ai/src/utils/aider-diff-merger.ts` (409 lines, mixed concerns)

**New Structure:**
```
/ai/src/diff/
  diff-parser.ts           # Pure function: parseAiderDiff()
  diff-merger.ts           # Pure function: mergeAiderDiff()
  block-finder.ts          # Pure function: findBlockInCode()
  indentation-handler.ts   # Pure function: preserveIndentation()
```

### 1.5 Simplify AIClient with DI

**Current:** `/ai/src/client/index.ts` directly instantiates dependencies

**Changes:**
- Accept interfaces through constructor (provider, promptBuilder, streamAdapter)
- Create `client-factory.ts` for default wiring
- Add mock implementations in `__mocks__/` for testing

---

## Phase 2: Frontend Chat Component Restructure (`/web/components/project/chat/`)

### 2.1 Extract Hooks from ChatProvider

**Current:** `chat-provider.tsx` (357 lines) handles everything

**Extract into `/hooks/`:**

| Hook | Extracted From | Lines |
|------|----------------|-------|
| `useStreaming.ts` | Streaming logic | 165-265 |
| `useContextTabs.ts` | Context tab management | 120-163 |
| `useMessageActions.ts` | File action status tracking | 289-302 |
| `useMergePrecompute.ts` | From `generated-files-preview.tsx` | 118-273 |

### 2.2 Simplified ChatStateProvider

After extraction, `chat-provider.tsx` becomes ~100 lines:
- Compose hooks
- Coordinate thread initialization
- Provide unified context

### 2.3 Container/Presentational Split

**Create containers in `/containers/`:**
- `ChatContentContainer.tsx` - Connects messages, loading states
- `ChatInputContainer.tsx` - Handles submission, context tabs
- `GeneratedFilesContainer.tsx` - Merge orchestration

**Move presentational components to `/components/`:**
```
/components/
  /message/
    Message.tsx
    MessageContent.tsx
    MessageActions.tsx
  /input/
    ChatInput.tsx
    ChatInputTextarea.tsx
    ChatInputActionBar.tsx
  /context/
    ContextTab.tsx
    ContextTabList.tsx
  /files-preview/
    GeneratedFilesPreview.tsx  # Simplified presentational
    GeneratedFileItem.tsx      # New: single file row
```

### 2.4 Performance Optimizations

1. **Replace manual throttling** (lines 166-175, 238-244) with React 18 patterns:
   - Use `useTransition` for streaming updates
   - Use `useDeferredValue` for markdown rendering

2. **Add proper memoization:**
   - `Message` with custom comparison
   - `MessageContent` (expensive markdown)
   - `GeneratedFileItem`

3. **Consider virtualization** for long chats (if needed):
   - Use `@tanstack/react-virtual`

---

## Phase 3: State Management & Service Layer

### 3.1 Split Server Actions

**Current:** `/web/app/actions/ai/index.ts` (130 lines, all actions)

**New Structure:**
```
/web/app/actions/ai/
  index.ts        # Re-exports only
  chat.ts         # streamChat action
  edit.ts         # processEdit action
  merge.ts        # mergeCode action
  types.ts        # Shared types
  helpers.ts      # getUserProviderConfig (existing)
```

### 3.2 Create Tool Registry

**Current:** `/web/lib/ai/tools.ts` (catch-all location)

**New Structure:**
```
/web/server/ai/tools/
  registry.ts     # ToolRegistry class
  web-search.ts   # Web search tool
  index.ts        # Registration & exports
```

### 3.3 Streaming Optimization

Create `/web/services/chat/streaming/`:
- `stream-buffer.ts` - Buffered streaming with configurable flush interval
- `stream-consumer.ts` - `consumeStream()` utility with `requestAnimationFrame`

### 3.4 State Slice Optimization

**Changes to `/web/store/slices/chat.ts`:**
- Add transient `streamingContent` state (not persisted)
- Add `updateStreamingContent()` for fast streaming updates
- Add `finalizeMessage()` called once when streaming completes
- Keep localStorage sync only for finalized messages

### 3.5 Create Chat Service

Create `/web/services/chat/chat-service.ts`:
- Abstracts server action calls
- Manages streaming lifecycle
- Provides `useChatService()` hook

---

## Critical Files to Modify

### AI Package (`/ai/src/`)
| File | Action |
|------|--------|
| `providers/index.ts` | Split into per-provider files |
| `client/index.ts` | Simplify with DI |
| `utils/prompt-builder.ts` | Extract into strategy pattern |
| `utils/aider-diff-merger.ts` | Split into pure functions |
| `types/index.ts` | Reorganize by concern |

### Web (`/web/`)
| File | Action |
|------|--------|
| `components/project/chat/providers/chat-provider.tsx` | Extract hooks, simplify |
| `components/project/chat/components/generated-files-preview.tsx` | Split container/presentational |
| `components/project/chat/index.tsx` | Use new containers |
| `app/actions/ai/index.ts` | Split into separate files |
| `store/slices/chat.ts` | Add streaming optimizations |
| `lib/ai/tools.ts` | Move to server/ai/tools/ |

---

## Migration Strategy

### Step 1: Foundation (Non-breaking)
- Create new directory structures
- Add interfaces and types
- Create mock implementations for testing

### Step 2: AI Package (Incremental)
- Implement new provider structure alongside old
- Add deprecation warnings to existing exports
- Migrate prompt builder to strategy pattern
- Split diff utilities

### Step 3: Frontend Hooks (Low risk)
- Extract hooks from ChatProvider
- Update ChatProvider to use hooks internally
- No breaking changes to `useChat()` API

### Step 4: Server Actions & Service Layer
- Split server actions
- Create tool registry
- Implement ChatService
- Gradually migrate ChatProvider to use service

### Step 5: Container/Presentational Split
- Create containers
- Move presentational components
- Update imports

### Step 6: Performance & Testing
- Add streaming optimizations
- Write unit tests for hooks
- Write integration tests for containers

---

## Verification Plan

### Unit Tests
- All extracted hooks (`useStreaming`, `useContextTabs`, `useMergePrecompute`)
- Diff utilities (pure functions)
- Provider factory
- Prompt strategies

### Integration Tests
- ChatContentContainer rendering
- ChatInputContainer submission flow
- GeneratedFilesContainer merge workflow

### Manual Testing
1. Start dev server: `pnpm dev`
2. Open a project and test chat:
   - Send messages and verify streaming works
   - Add context tabs (files, code snippets)
   - Generate code and verify merge preview
   - Apply/reject generated files
3. Test thread management:
   - Create new threads
   - Switch between threads
   - Verify localStorage persistence
4. Test abort functionality:
   - Click stop while streaming
   - Verify clean abort

### Performance Testing
- Profile re-renders during streaming
- Verify throttling/batching is working
- Compare before/after render counts

---

## New Directory Structure Summary

```
/ai/src/
  core/
    interfaces/
    types/
  providers/
    anthropic/
    openai/
    bedrock/
    openrouter/
    base-provider.ts
    factory.ts
  prompts/
    strategies/
    templates/
  diff/
  streaming/
  client/
  tools/
  errors/
  logging/
  __mocks__/
  __tests__/

/web/
  server/ai/
    tools/
    client-factory.ts
  services/chat/
    streaming/
    chat-service.ts
  components/project/chat/
    hooks/
    providers/
    containers/
    components/
      message/
      input/
      context/
      files-preview/
    __tests__/
  app/actions/ai/
    chat.ts
    edit.ts
    merge.ts
    types.ts
  store/slices/
    chat.ts (optimized)
```
