// DB Types

import { KNOWN_PLATFORMS } from "@gitwit/db/constants"
import * as monaco from "monaco-editor"

export type User = {
  id: string
  name: string
  email: string
  username: string
  avatarUrl: string | null
  createdAt: string
  generations: number
  bio: string | null
  personalWebsite: string | null
  links: UserLink[]
  tier: "FREE" | "PRO" | "ENTERPRISE"
  tierExpiresAt: string
  lastResetDate: string
  sandbox: Sandbox[]
  usersToSandboxes: UsersToSandboxes[]
}

export type KnownPlatform = (typeof KNOWN_PLATFORMS)[number]
export type UserLink = {
  url: string
  platform: KnownPlatform
}

export type Sandbox = {
  id: string
  name: string
  type: string
  visibility: "public" | "private"
  createdAt: string
  userId: string
  likeCount: number
  viewCount: number
  // usersToSandboxes: UsersToSandboxes[]
}
export type SandboxWithLiked = Sandbox & {
  liked: boolean
}
export type UsersToSandboxes = {
  userId: string
  sandboxId: string
  sharedOn: string
}

export type R2Files = {
  objects: R2FileData[]
  truncated: boolean
  delimitedPrefixes: any[]
}

export type R2FileData = {
  storageClass: string
  uploaded: string
  checksums: any
  httpEtag: string
  etag: string
  size: number
  version: string
  key: string
}

export type TFolder = {
  id: string
  type: "folder"
  name: string
  children: (TFile | TFolder)[]
}

export type TFile = {
  id: string
  type: "file"
  name: string
}

export type TTab = TFile & {
  saved: boolean
}

export type TFileData = {
  id: string
  data: string
}

interface ConflictFile {
  path: string
  localContent: string
  incomingContent: string
}

export interface FileResolution {
  path: string
  resolutions: Array<{
    conflictIndex: number
    resolution: "local" | "incoming"
    localContent: string
    incomingContent: string
  }>
}

export interface ConflictResolutionProps {
  conflictFiles: ConflictFile[]
  fileResolutions: FileResolution[]
  onFileResolutionChange: (
    fileIdx: number,
    resolution: "local" | "incoming"
  ) => void
  onResolve: () => void
  onCancel: () => void
  open: boolean
  pendingPull: boolean
}

// Represents a granular block of changes in the diff view

export interface DiffBlock {
  type: "added" | "removed"
  start: number
  end: number
}

/**
 * Represents a range of lines in the editor
 */
export interface LineRange {
  start: number
  end: number
}

// Configuration for diff calculation

export interface DiffConfig {
  ignoreWhitespace: boolean
}

// Result of diff calculation containing the combined view

export interface DiffResult {
  combinedLines: string[]
  decorations: monaco.editor.IModelDeltaDecoration[]
  granularBlocks: DiffBlock[]
}

// Persisted unresolved diff session for a file
export interface DiffSession {
  fileId: string
  originalCode: string
  mergedCode: string
  combinedText: string
  eol: "LF" | "CRLF"
  unresolvedBlocks: { type: "added" | "removed"; start: number; end: number }[]
}

// Widget creation options

export interface WidgetOptions {
  kind: "accept" | "reject"
  color: string
  title: string
  onClick: () => void
}
