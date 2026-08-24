/**
 * Temporary strict UI overlay for the C8-A mutation receipt.
 *
 * Remove this mirror when @talchain/schemas publishes the receipt under a new
 * package version. The vendored 0.48.0 archive must not be replaced with
 * different bytes under the same package identity.
 */
import { z } from 'zod'
import { AuthoredBySchema, GraphV3Schema } from '@talchain/schemas/boundary'

const UuidSchema = z.string().uuid()
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/)
const NonEmptyStringSchema = z.string().min(1)

const ModelVersionActorSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('known'), authored_by: AuthoredBySchema }).strict(),
  z.object({ kind: z.literal('system') }).strict(),
  z.object({ kind: z.literal('unknown') }).strict(),
])

const ModelVersionCreationSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('initial') }).strict(),
  z.object({ kind: z.literal('committed_mutation') }).strict(),
  z
    .object({
      kind: z.literal('restore'),
      source_version_id: UuidSchema,
    })
    .strict(),
])

const ModelVersionLineageSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('known'),
      parent_version_id: UuidSchema.nullable(),
      root_version_id: UuidSchema,
    })
    .strict(),
  z.object({ kind: z.literal('unknown') }).strict(),
])

const ModelVersionMutationReceiptV1ObjectSchema = z
  .object({
    schema: z.literal('model_version_mutation_receipt.v1'),
    scenario_id: UuidSchema,
    mutation_id: UuidSchema,
    version_id: UuidSchema,
    sequence: z.number().int().min(1),
    graph: GraphV3Schema,
    full_hash: Sha256Schema,
    hash_algorithm: NonEmptyStringSchema,
    identity_projection_version: NonEmptyStringSchema,
    identity_normaliser_version: NonEmptyStringSchema,
    graph_schema_version: NonEmptyStringSchema,
    analysis_affecting_hash: Sha256Schema,
    actor: ModelVersionActorSchema,
    creation: ModelVersionCreationSchema,
    source_turn_id: NonEmptyStringSchema.nullable(),
    lineage: ModelVersionLineageSchema,
    undo_version_id: UuidSchema.nullable(),
    event_id: NonEmptyStringSchema,
  })
  .strict()

export const ModelVersionMutationReceiptV1Schema =
  ModelVersionMutationReceiptV1ObjectSchema.superRefine((data, ctx) => {
    if (
      data.lineage.kind === 'known' &&
      data.lineage.parent_version_id === data.version_id
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['lineage', 'parent_version_id'],
        message: 'a model version cannot be its own parent',
      })
    }
    if (
      data.creation.kind === 'restore' &&
      data.creation.source_version_id === data.version_id
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['creation', 'source_version_id'],
        message: 'a restored model version cannot source itself',
      })
    }
    if (data.undo_version_id === data.version_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['undo_version_id'],
        message: 'a model version cannot be its own undo version',
      })
    }
  })

export type ModelVersionMutationReceiptV1 = z.infer<
  typeof ModelVersionMutationReceiptV1Schema
>
