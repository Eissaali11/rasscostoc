import { relations } from "drizzle-orm";
import { regions } from "./catalog.schema";
import { users } from "./organization.schema";
import { inventoryItems, transactions } from "./inventory.schema";

export const regionsRelations = relations(regions, ({ many }) => ({
  users: many(users),
  inventoryItems: many(inventoryItems),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  region: one(regions, {
    fields: [users.regionId],
    references: [regions.id],
  }),
  transactions: many(transactions),
}));

export const inventoryItemsRelations = relations(inventoryItems, ({ one, many }) => ({
  region: one(regions, {
    fields: [inventoryItems.regionId],
    references: [regions.id],
  }),
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  item: one(inventoryItems, {
    fields: [transactions.itemId],
    references: [inventoryItems.id],
  }),
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
}));
