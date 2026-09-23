import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const liflowState = sqliteTable('liflow_state', {
  userId: text('user_id').primaryKey(),
  data: text('data').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const coreEntities = sqliteTable('core_entities', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  type: text('type').notNull(),
  payload: text('payload').notNull(),
  revision: integer('revision').notNull().default(1),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  updatedBy: text('updated_by').notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
}, (table) => [
  index('idx_core_entities_user_type').on(table.userId, table.type),
  index('idx_core_entities_user_deleted').on(table.userId, table.deletedAt),
]);
