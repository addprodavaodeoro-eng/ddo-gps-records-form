import { pgTable, serial, text, timestamp, doublePrecision, integer, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table (supporting both username/password and Google Auth with Firebase)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').unique(),
  passwordHash: text('password_hash'),
  email: text('email'),
  role: text('role').notNull(), // 'Super Admin', 'Admin', 'Staff'
  mustChangePassword: boolean('must_change_password').default(false).notNull(),
  isApproved: boolean('is_approved').default(true).notNull(),
  firebaseUid: text('firebase_uid').unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Locales table
export const locales = pgTable('locales', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Family Heads table
export const familyHeads = pgTable('family_heads', {
  id: serial('id').primaryKey(),
  fullName: text('full_name').notNull(),
  cellNumber: text('cell_number').notNull(),
  localeId: integer('locale_id').references(() => locales.id, { onDelete: 'cascade' }).notNull(),
  genderRole: text('gender_role'), // 'MOTHER' or 'FATHER'
  familySize: integer('family_size').default(1),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Staff table
export const staff = pgTable('staff', {
  id: serial('id').primaryKey(),
  staffName: text('staff_name').notNull(),
  position: text('position').notNull(),
  cellphoneNumber: text('cellphone_number').notNull(),
  assignedLocaleId: integer('assigned_locale_id').references(() => locales.id, { onDelete: 'cascade' }).notNull(),
  status: text('status').notNull(), // 'Active', 'Inactive'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Members (DDRMS Submissions) table
export const members = pgTable('members', {
  id: serial('id').primaryKey(),
  fullName: text('full_name').notNull(),
  cellphoneNumber: text('cellphone_number').notNull(),
  localeId: integer('locale_id').references(() => locales.id, { onDelete: 'cascade' }).notNull(),
  familyHeadId: integer('family_head_id').references(() => familyHeads.id, { onDelete: 'set null' }),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  address: text('address'),
  riskLevel: text('risk_level').notNull(), // 'Low Risk', 'Medium Risk', 'High Risk'
  submittedAt: timestamp('submitted_at').defaultNow().notNull(),
});

// Risk Assessments table
export const riskAssessments = pgTable('risk_assessments', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id').references(() => members.id, { onDelete: 'cascade' }).notNull(),
  riskLevel: text('risk_level').notNull(),
  hazardSource: text('hazard_source').notNull(),
  assessedAt: timestamp('assessed_at').defaultNow().notNull(),
});

// GPS Locations table (to store location tracking details)
export const gpsLocations = pgTable('gps_locations', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id').references(() => members.id, { onDelete: 'cascade' }).notNull(),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  accuracy: doublePrecision('accuracy'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

// Activity Logs table
export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  details: text('details').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

// Notifications table
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  type: text('type').notNull(), // 'info', 'warning', 'success', 'error'
  title: text('title').notNull(),
  message: text('message').notNull(),
  status: text('status').notNull(), // 'read', 'unread'
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

// Relations definitions
export const usersRelations = relations(users, ({ many }) => ({
  logs: many(activityLogs),
}));

export const localesRelations = relations(locales, ({ many }) => ({
  familyHeads: many(familyHeads),
  staff: many(staff),
  members: many(members),
}));

export const familyHeadsRelations = relations(familyHeads, ({ one, many }) => ({
  locale: one(locales, {
    fields: [familyHeads.localeId],
    references: [locales.id],
  }),
  members: many(members),
}));

export const staffRelations = relations(staff, ({ one }) => ({
  assignedLocale: one(locales, {
    fields: [staff.assignedLocaleId],
    references: [locales.id],
  }),
}));

export const membersRelations = relations(members, ({ one, many }) => ({
  locale: one(locales, {
    fields: [members.localeId],
    references: [locales.id],
  }),
  familyHead: one(familyHeads, {
    fields: [members.familyHeadId],
    references: [familyHeads.id],
  }),
  riskAssessments: many(riskAssessments),
  gpsLocations: many(gpsLocations),
}));
