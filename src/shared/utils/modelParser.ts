/**
 * Claude model string parser utility.
 * Parses model identifiers into friendly display names and metadata.
 */

export interface ModelInfo {
  /** Friendly name like "sonnet4.5" */
  name: string
  /** Model family: sonnet, opus, haiku */
  family: 'sonnet' | 'opus' | 'haiku' | 'unknown'
  /** Major version like 4 or 3 */
  majorVersion: number
  /** Minor version like 5 or 1 (null if not present) */
  minorVersion: number | null
}

type ModelFamily = ModelInfo['family']

/**
 * Parses a Claude model string into friendly display info.
 * Returns null if model string is invalid, synthetic, or empty.
 *
 * Supported formats:
 * - New format: claude-{family}-{major}-{minor}-{date} (e.g., "claude-sonnet-4-5-20250929")
 * - Old format: claude-{major}-{family}-{date} (e.g., "claude-3-opus-20240229")
 * - Old format with minor: claude-{major}-{minor}-{family}-{date} (e.g., "claude-3-5-sonnet-20241022")
 */
export function parseModelString(model: string | undefined): ModelInfo | null {
  // Handle null, undefined, empty, or synthetic models
  if (!model || model.trim() === '' || model === '<synthetic>') {
    return null
  }

  const normalized = model.toLowerCase().trim()

  // Must start with "claude"
  if (!normalized.startsWith('claude')) {
    return null
  }

  // Split into parts (e.g., ["claude", "sonnet", "4", "5", "20250929"])
  const parts = normalized.split('-')

  if (parts.length < 3) {
    return null
  }

  // Detect model family
  const families: ModelFamily[] = ['sonnet', 'opus', 'haiku']
  let family: ModelFamily = 'unknown'
  let familyIndex = -1

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]
    if (families.includes(part as ModelFamily)) {
      family = part as ModelFamily
      familyIndex = i
      break
    }
  }

  if (family === 'unknown' || familyIndex === -1) {
    return null
  }

  let majorVersion: number
  let minorVersion: number | null = null

  // Determine format based on family position
  if (familyIndex === 1) {
    // New format: claude-{family}-{major}-{minor}-{date}
    // e.g., claude-sonnet-4-5-20250929 -> ["claude", "sonnet", "4", "5", "20250929"]
    if (parts.length < 4) {
      return null
    }

    majorVersion = parseInt(parts[2], 10)
    if (isNaN(majorVersion)) {
      return null
    }

    // Check if there's a minor version (next part is a number and not a date)
    if (parts.length >= 5 && parts[3].length <= 2) {
      const potentialMinor = parseInt(parts[3], 10)
      if (!isNaN(potentialMinor)) {
        minorVersion = potentialMinor
      }
    }
  } else {
    // Old format: claude-{major}[-{minor}]-{family}-{date}
    // e.g., claude-3-opus-20240229 -> ["claude", "3", "opus", "20240229"]
    // e.g., claude-3-5-sonnet-20241022 -> ["claude", "3", "5", "sonnet", "20241022"]

    majorVersion = parseInt(parts[1], 10)
    if (isNaN(majorVersion)) {
      return null
    }

    // Check if there's a minor version between major and family
    if (familyIndex > 2) {
      const potentialMinor = parseInt(parts[2], 10)
      if (!isNaN(potentialMinor)) {
        minorVersion = potentialMinor
      }
    }
  }

  // Build friendly name
  const versionString = minorVersion !== null ? `${majorVersion}.${minorVersion}` : `${majorVersion}`
  const name = `${family}${versionString}`

  return {
    name,
    family,
    majorVersion,
    minorVersion
  }
}

/**
 * Gets just the display name from a model string.
 * Returns null if invalid.
 */
export function getModelDisplayName(model: string | undefined): string | null {
  const info = parseModelString(model)
  return info?.name ?? null
}

/**
 * Gets the color class for a model family (for Tailwind).
 * Returns subtle, elegant colors.
 */
export function getModelColorClass(family: ModelInfo['family']): string {
  switch (family) {
    case 'opus':
      return 'text-purple-400'
    case 'sonnet':
      return 'text-blue-400'
    case 'haiku':
      return 'text-emerald-400'
    case 'unknown':
    default:
      return 'text-gray-400'
  }
}

/**
 * Gets color class directly from a model string.
 * Returns gray for invalid models.
 */
export function getModelColorClassFromString(model: string | undefined): string {
  const info = parseModelString(model)
  return getModelColorClass(info?.family ?? 'unknown')
}
