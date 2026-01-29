import { pgTable, text, serial, integer, boolean, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// === TABLE DEFINITIONS ===

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role", { enum: ["student", "teacher", "superadmin"] }).notNull(),
  profilePicture: text("profile_picture"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const subjects = pgTable("subjects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  teacherId: integer("teacher_id").references(() => users.id),
  description: text("description"),
});

export const enrollments = pgTable("enrollments", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").references(() => users.id).notNull(),
  subjectId: integer("subject_id").references(() => subjects.id).notNull(),
  enrolledAt: timestamp("enrolled_at").defaultNow(),
});

export const attendance = pgTable("attendance", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").references(() => users.id).notNull(),
  subjectId: integer("subject_id").references(() => subjects.id).notNull(),
  date: date("date").notNull(),
  status: text("status", { enum: ["present", "late", "absent", "excused"] }).notNull(),
  timeIn: timestamp("time_in").defaultNow(),
  remarks: text("remarks"),
});

export const qrCodes = pgTable("qr_codes", {
  id: serial("id").primaryKey(),
  subjectId: integer("subject_id").references(() => subjects.id).notNull(),
  code: text("code").notNull(),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const schedules = pgTable("schedules", {
  id: serial("id").primaryKey(),
  subjectId: integer("subject_id").references(() => subjects.id).notNull(),
  dayOfWeek: text("day_of_week", { enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] }).notNull(),
  startTime: text("start_time").notNull(), // Format: "HH:mm" e.g., "09:00"
  endTime: text("end_time").notNull(), // Format: "HH:mm" e.g., "10:30"
  room: text("room").notNull(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// === RELATIONS ===

export const usersRelations = relations(users, ({ many }) => ({
  subjectsTaught: many(subjects, { relationName: "teacherSubjects" }),
  enrollments: many(enrollments),
  attendanceRecords: many(attendance),
}));

export const subjectsRelations = relations(subjects, ({ one, many }) => ({
  teacher: one(users, {
    fields: [subjects.teacherId],
    references: [users.id],
    relationName: "teacherSubjects",
  }),
  enrollments: many(enrollments),
  attendanceRecords: many(attendance),
  qrCodes: many(qrCodes),
  schedules: many(schedules),
}));

export const schedulesRelations = relations(schedules, ({ one }) => ({
  subject: one(subjects, {
    fields: [schedules.subjectId],
    references: [subjects.id],
  }),
}));

export const enrollmentsRelations = relations(enrollments, ({ one }) => ({
  student: one(users, {
    fields: [enrollments.studentId],
    references: [users.id],
  }),
  subject: one(subjects, {
    fields: [enrollments.subjectId],
    references: [subjects.id],
  }),
}));

export const attendanceRelations = relations(attendance, ({ one }) => ({
  student: one(users, {
    fields: [attendance.studentId],
    references: [users.id],
  }),
  subject: one(subjects, {
    fields: [attendance.subjectId],
    references: [subjects.id],
  }),
}));

// === BASE SCHEMAS ===

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertSubjectSchema = createInsertSchema(subjects).omit({ id: true });
export const insertEnrollmentSchema = createInsertSchema(enrollments).omit({ id: true, enrolledAt: true });
export const insertAttendanceSchema = createInsertSchema(attendance).omit({ id: true, timeIn: true });
export const insertQrCodeSchema = createInsertSchema(qrCodes).omit({ id: true, createdAt: true });
export const insertScheduleSchema = createInsertSchema(schedules).omit({ id: true });

// === EXPLICIT API CONTRACT TYPES ===

// Base types
export type User = typeof users.$inferSelect;
export type Subject = typeof subjects.$inferSelect;
export type Enrollment = typeof enrollments.$inferSelect;
export type Attendance = typeof attendance.$inferSelect;
export type QrCode = typeof qrCodes.$inferSelect;
export type Schedule = typeof schedules.$inferSelect;
export type InsertSchedule = z.infer<typeof insertScheduleSchema>;

// Request types
export type LoginRequest = {
  identifier: string; // email or username
  password: string;
  role: "student" | "teacher" | "superadmin";
};

export type CreateUserRequest = z.infer<typeof insertUserSchema>;
export type UpdateUserRequest = Partial<CreateUserRequest>;

export type CreateSubjectRequest = z.infer<typeof insertSubjectSchema>;
export type UpdateSubjectRequest = Partial<CreateSubjectRequest>;

export type MarkAttendanceRequest = {
  subjectId: number;
  studentId: number;
  status: "present" | "late" | "absent" | "excused";
  remarks?: string;
  date: string;
};

// Response types
export type AuthResponse = User;
export type SubjectWithDetails = Subject & { studentCount?: number };