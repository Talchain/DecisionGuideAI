/**
 * S5-STORAGE: Migration Registry
 *
 * Central registry of all storage migrations.
 * Migrations are applied in order to bring old data to current schema.
 *
 * Migration naming convention:
 * - File: `migrate_{from}_to_{to}.ts`
 * - Version format: `{schema}@{version}`
 * - Example: `canvas.v0@0.1.0` → `canvas.v1@1.0.0`
 */

import type { Migration } from '../types'

/**
 * All registered migrations in order
 * Add new migrations to the end of this array
 */
export const migrations: Migration[] = [
  // Future migrations will be added here
  // Example:
  // {
  //   fromVersion: 'canvas.v0@0.1.0',
  //   toVersion: 'canvas.v1@1.0.0',
  //   migrate: migrateV0ToV1,
  //   description: 'Migrate from legacy storage to versioned storage'
  // }
]

/**
 * Get migration path from version A to version B
 */
export function getMigrationPath(
  fromSchema: string,
  fromVersion: string,
  toSchema: string,
  toVersion: string
): Migration[] {
  const path: Migration[] = []
  let currentSchema = fromSchema
  let currentVersion = fromVersion

  for (const migration of migrations) {
    const [migFromSchema, migFromVer] = migration.fromVersion.split('@')
    const [migToSchema, migToVer] = migration.toVersion.split('@')

    if (migFromSchema === currentSchema && migFromVer === currentVersion) {
      path.push(migration)
      currentSchema = migToSchema
      currentVersion = migToVer

      if (currentSchema === toSchema && currentVersion === toVersion) {
        break
      }
    }
  }

  return path
}

/**
 * Check if migration path exists
 */
export function hasMigrationPath(
  fromSchema: string,
  fromVersion: string,
  toSchema: string,
  toVersion: string
): boolean {
  const path = getMigrationPath(fromSchema, fromVersion, toSchema, toVersion)
  return path.length > 0
}
