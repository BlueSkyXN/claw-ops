export type PresetLayer = 'L0' | 'L1' | 'L2' | 'L3'
export type PresetCategory = 'governance' | 'strategy' | 'coordination' | 'execution'
export type ModelTier = 'fast' | 'strong' | 'reasoning'

export interface PresetSandbox {
  mode: 'off' | 'non-main' | 'all'
  scope?: 'agent'
}

export interface PresetRoleManifest {
  id: string
  version: string
  name: string
  nameEn: string
  emoji: string
  description: string
  layer: PresetLayer
  layerName: string
  category: PresetCategory
  organizationalUnit: string
  modelTier: ModelTier
  costTier: 'low' | 'medium' | 'high'
  defaultTimeoutSeconds: number
  defaultMaxConcurrent: number
  recommendedSkills: string[]
  allowAgents: string[]
  files: {
    soul: string
    workflow: string
    authority: string
    capabilities: string
  }
}

export interface PresetRoleCapabilities {
  modelTier: ModelTier
  sandbox: PresetSandbox
  costTier: 'low' | 'medium' | 'high'
  timeoutSeconds: number
  requiredSkills: string[]
  optionalSkills: string[]
  toolingProfile: string[]
  oneClickDefaults: {
    emoji: string
    workspaceSuffix: string
  }
}

export interface PresetRoleAuthority {
  allowAgents: string[]
  forbiddenAgents: string[]
  maxConcurrent: number
  escalateTo: string[]
  mustNotify: string[]
  coordinationMode: string
}

export interface PresetRoleWorkflow {
  tier: PresetLayer
  ownedStages: string[]
  acceptsFrom: string[]
  handoffTo: string[]
  mandatoryChecks: string[]
  requiredArtifacts: string[]
  successExit: string
  blockedExit: string
}

export interface PresetTeamWorkflowStep {
  from: string
  to: string
  condition: string
  mandatory: boolean
}

export interface PresetTeamTemplate {
  id: string
  name: string
  nameEn: string
  description: string
  roles: string[]
  workflow: PresetTeamWorkflowStep[]
}

export interface PresetSkillDescriptor {
  id: string
  name: string
  version: string
  path: string
}

export interface PresetLibraryManifest {
  id: string
  name: string
  nameEn: string
  version: string
  description: string
  designPrinciples: string[]
  organization: {
    model: string
    layers: Array<{ id: PresetLayer; name: string; nameEn: string; organizationalUnit: string }>
  }
  requiresGatewayMethods: string[]
  roles: Array<{ id: string; name: string; nameEn: string; layer: PresetLayer; category: PresetCategory; path: string }>
  skills: PresetSkillDescriptor[]
  teamTemplates: Array<{ id: string; name: string; nameEn: string; path: string }>
}


export interface PresetLibraryIndexEntry {
  id: string
  name: string
  nameEn: string
  description: string
  version: string
  path: string
}

export interface PresetLibraryIndex {
  version: string
  packs: PresetLibraryIndexEntry[]
}
