export interface DevtoolsDatabaseEligibilityInput {
  databaseProvider?: string | null
  databaseSource?: string | null
  fallbackModuleProvider?: string | null
}

export function isDevtoolsDatabaseEligible(input: DevtoolsDatabaseEligibilityInput): boolean {
  const { databaseProvider, databaseSource, fallbackModuleProvider } = input

  if (typeof databaseProvider === 'string')
    return databaseProvider === 'nuxthub' && databaseSource === 'module'

  return fallbackModuleProvider === 'nuxthub'
}
