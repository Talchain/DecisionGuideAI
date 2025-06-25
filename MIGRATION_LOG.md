# Organization Migration Log

## Migration Strategy

This document outlines the migration strategy for integrating the new organization model into the existing data structure.

### Key Decisions

1. **Default Organization Creation**: For each user who owns teams or decisions, we create a single default organization named "My Organization".
2. **Team Assignment**: All existing teams are assigned to the organization owned by their creator.
3. **Decision Assignment**: All existing decisions are assigned to the organization owned by their creator.
4. **Criteria Sets Assignment**: Criteria sets are assigned to the organization of their associated team (if any) or to the organization of their creator.
5. **Decision Analysis Assignment**: Analysis records are assigned to the same organization as their associated decision.
6. **Invitation Assignment**: Invitations are assigned to the organization of their associated team (if any) or to the organization of the inviter.

## Migration Files

The migration is split into three main SQL files:

1. `create_default_organizations.sql`: Creates a default organization for each user who owns teams or decisions.
2. `backfill_teams_organization_id.sql`: Updates all existing teams to link to their creator's organization.
3. `backfill_core_data_organization_team_ids.sql`: Updates decisions, criteria_sets, decision_analysis, and invitations to link to the correct organization.

## Validation

After each migration step, validation queries from `validation_queries.sql` should be run to ensure:

- All users who own teams or decisions have an organization
- All teams have a valid organization_id
- All decisions have a valid organization_id
- All criteria_sets have a valid organization_id
- All decision_analysis records have a valid organization_id
- All invitations have a valid organization_id
- Organization IDs are consistent across related records

## Rollback Plan

If any issues are encountered during the migration, the `rollback_organization_migration.sql` file contains SQL statements to revert all changes made during the migration.

## Unmappable Data

During the migration, any records that cannot be mapped to an organization will be logged with a WARNING message. These records should be reviewed manually after the migration.

Potential unmappable data includes:
- Teams whose creator no longer exists in the system
- Decisions whose creator no longer exists in the system
- Criteria sets whose creator and associated team (if any) no longer exist
- Decision analysis records whose associated decision no longer exists
- Invitations whose associated team and inviter no longer exist

## Post-Migration Tasks

After the migration is complete, the following tasks should be performed:

1. Review any unmappable data and decide on a course of action
2. Update application code to handle the new organization model
3. Update RLS policies to enforce organization-based access control
4. Test the application thoroughly to ensure all functionality works with the new data structure

## Migration Log

| Date | Step | Status | Notes |
|------|------|--------|-------|
| | Create default organizations | Not started | |
| | Backfill teams | Not started | |
| | Backfill core data | Not started | |
| | Validation | Not started | |
| | RLS policy updates | Not started | |