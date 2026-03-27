import { IDKit, type ConstraintNode, type IDKitRequest, type IDKitResult, type IDKitSessionConfig, type RpContext } from '@worldcoin/idkit-core'

export const WORLD_ID_CREDENTIALS = ['proof_of_human', 'passport', 'mnc', 'face'] as const

export type WorldIdEnvironment = 'production' | 'staging'

export type WorldIdRpContextResponse = {
  appId: `app_${string}`
  action: string
  environment: WorldIdEnvironment
  rpContext: RpContext
}

type RuntimeSessionBuilderConfig = {
  type: 'request' | 'session' | 'proveSession'
  app_id: `app_${string}`
  action?: string
  session_id?: string
  rp_context: RpContext
  action_description?: string
  bridge_url?: string
  return_to?: string
  allow_legacy_proofs?: boolean
  override_connect_base_url?: string
  environment?: WorldIdEnvironment
}

type RuntimeSessionBuilder = {
  config: RuntimeSessionBuilderConfig
  constraints: (constraints: ConstraintNode) => Promise<IDKitRequest>
}

export const WORLD_ID_CONSTRAINTS: ConstraintNode = {
  enumerate: WORLD_ID_CREDENTIALS.map((type) => ({ type })),
}

export const createWorldIdSessionRequest = (
  config: IDKitSessionConfig,
  bootstrapAction: string,
  sessionId?: string
) => {
  const builder = IDKit.request({
    app_id: config.app_id,
    action: bootstrapAction,
    rp_context: config.rp_context,
    allow_legacy_proofs: false,
    action_description: config.action_description,
    bridge_url: config.bridge_url,
    return_to: config.return_to,
    override_connect_base_url: config.override_connect_base_url,
    environment: config.environment,
  }) as unknown as RuntimeSessionBuilder

  builder.config = {
    type: sessionId ? 'proveSession' : 'session',
    app_id: config.app_id,
    session_id: sessionId,
    rp_context: config.rp_context,
    action_description: config.action_description,
    bridge_url: config.bridge_url,
    return_to: config.return_to,
    override_connect_base_url: config.override_connect_base_url,
    environment: config.environment,
  }

  return builder.constraints(WORLD_ID_CONSTRAINTS)
}

export const getWorldIdIdentifiers = (identifiers: string[]) => [...new Set(identifiers.filter(Boolean))]

export const isWorldIdSessionResult = (result: IDKitResult): result is IDKitResult & { session_id: string } => {
  return 'session_id' in result && typeof result.session_id === 'string' && result.session_id.length > 0
}

export const isOrbVerifiedIdentifier = (identifier: string) => identifier === 'proof_of_human' || identifier === 'orb'
