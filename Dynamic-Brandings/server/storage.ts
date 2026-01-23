import { db } from "./db";
import { 
  users, subjects, enrollments, attendance, qrCodes, schedules,
  type User, type InsertUser, 
  type Subject, type InsertSubject,
  type Attendance, type InsertAttendance,
  type Enrollment, type InsertEnrollment,
  type QrCode, type InsertQrCode,
  type Schedule, type InsertSchedule
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByIdentifier(identifier: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUsersByRole(role?: "student" | "teacher" | "superadmin"): Promise<User[]>;
  updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<void>;

  // Subjects
  createSubject(subject: InsertSubject): Promise<Subject>;
  getSubject(id: number): Promise<Subject | undefined>;
  getAllSubjects(): Promise<Subject[]>;
  getSubjectsByTeacher(teacherId: number): Promise<Subject[]>;
  getSubjectsByStudent(studentId: number): Promise<Subject[]>;
  deleteSubject(id: number): Promise<void>;
  
  // Enrollments
  enrollStudent(studentId: number, subjectId: number): Promise<Enrollment>;
  getSubjectStudents(subjectId: number): Promise<User[]>;
  getTotalEnrolledStudentsByTeacher(teacherId: number): Promise<number>;

  // Attendance
  markAttendance(record: InsertAttendance): Promise<Attendance>;
  getAttendance(studentId?: number, subjectId?: number, date?: string): Promise<(Attendance & { studentName: string, subjectName: string })[]>;
  getAttendanceByTeacher(teacherId: number): Promise<(Attendance & { studentName: string, subjectName: string })[]>;

  // QR Codes
  createQrCode(qr: InsertQrCode): Promise<QrCode>;
  getActiveQrCode(subjectId: number): Promise<QrCode | undefined>;
  validateAndConsumeQrCode(code: string): Promise<{ subjectId: number; isLate: boolean } | null>;
  deactivateQrCode(subjectId: number): Promise<void>;
  updateQrCodeLateMode(subjectId: number, isLate: boolean): Promise<void>;

  // Schedules
  createSchedule(schedule: InsertSchedule): Promise<Schedule>;
  getSchedulesBySubject(subjectId: number): Promise<Schedule[]>;
  getSchedulesByTeacher(teacherId: number): Promise<(Schedule & { subjectName: string; subjectCode: string })[]>;
  deleteSchedule(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByIdentifier(identifier: string): Promise<User | undefined> {
    // Try to find user by email first, then by username
    let user = await this.getUserByEmail(identifier);
    if (!user) {
      user = await this.getUserByUsername(identifier);
    }
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getUsersByRole(role?: "student" | "teacher" | "superadmin"): Promise<User[]> {
    if (role) {
      return db.select().from(users).where(eq(users.role, role));
    }
    return db.select().from(users);
  }

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined> {
    const [updated] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return updated;
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async createSubject(subject: InsertSubject): Promise<Subject> {
    const [newSubject] = await db.insert(subjects).values(subject).returning();
    return newSubject;
  }

  async getSubject(id: number): Promise<Subject | undefined> {
    const [subject] = await db.select().from(subjects).where(eq(subjects.id, id));
    return subject;
  }

  async getAllSubjects(): Promise<Subject[]> {
    return db.select().from(subjects);
  }

  async deleteSubject(id: number): Promise<void> {
    // Delete related schedules and enrollments first
    await db.delete(schedules).where(eq(schedules.subjectId, id));
    await db.delete(enrollments).where(eq(enrollments.subjectId, id));
    await db.delete(subjects).where(eq(subjects.id, id));
  }

  async getSubjectsByTeacher(teacherId: number): Promise<Subject[]> {
    return db.select().from(subjects).where(eq(subjects.teacherId, teacherId));
  }

  async getSubjectsByStudent(studentId: number): Promise<Subject[]> {
    const result = await db.select({
      subject: subjects
    })
    .from(enrollments)
    .innerJoin(subjects, eq(enrollments.subjectId, subjects.id))
    .where(eq(enrollments.studentId, studentId));
    
    return result.map(r => r.subject);
  }

  async enrollStudent(studentId: number, subjectId: number): Promise<Enrollment> {
    const [enrollment] = await db.insert(enrollments).values({ studentId, subjectId }).returning();
    return enrollment;
  }

  async getSubjectStudents(subjectId: number): Promise<User[]> {
    const result = await db.select({
      user: users
    })
    .from(enrollments)
    .innerJoin(users, eq(enrollments.studentId, users.id))
    .where(eq(enrollments.subjectId, subjectId));
    
    return result.map(r => r.user);
  }

  async getTotalEnrolledStudentsByTeacher(teacherId: number): Promise<number> {
    // Get all subjects taught by this teacher
    const teacherSubjects = await db.select().from(subjects).where(eq(subjects.teacherId, teacherId));
    console.log('Teacher subjects:', teacherSubjects.length, teacherSubjects.map(s => s.id));
    
    // Get unique students enrolled across all those subjects
    const subjectIds = teacherSubjects.map(s => s.id);
    if (subjectIds.length === 0) return 0;
    
    const result = await db.selectDistinct({ studentId: enrollments.studentId })
      .from(enrollments)
      .innerJoin(subjects, eq(enrollments.subjectId, subjects.id))
      .where(eq(subjects.teacherId, teacherId));
    
    console.log('Enrolled students result:', result);
    return result.length;
  }

  async markAttendance(record: InsertAttendance): Promise<Attendance> {
    const [att] = await db.insert(attendance).values(record).returning();
    return att;
  }

  async getAttendance(studentId?: number, subjectId?: number, date?: string): Promise<(Attendance & { studentName: string, subjectName: string })[]> {
    let query = db.select({
      id: attendance.id,
      studentId: attendance.studentId,
      subjectId: attendance.subjectId,
      date: attendance.date,
      status: attendance.status,
      timeIn: attendance.timeIn,
      remarks: attendance.remarks,
      studentName: users.fullName,
      subjectName: subjects.name
    })
    .from(attendance)
    .innerJoin(users, eq(attendance.studentId, users.id))
    .innerJoin(subjects, eq(attendance.subjectId, subjects.id));

    const conditions = [];
    if (studentId) conditions.push(eq(attendance.studentId, studentId));
    if (subjectId) conditions.push(eq(attendance.subjectId, subjectId));
    if (date) conditions.push(eq(attendance.date, date));

    if (conditions.length > 0) {
      // @ts-ignore
      return query.where(and(...conditions)).orderBy(desc(attendance.date));
    }
    
    return query.orderBy(desc(attendance.date));
  }

  async getAttendanceByTeacher(teacherId: number): Promise<(Attendance & { studentName: string, subjectName: string })[]> {
    return db.select({
      id: attendance.id,
      studentId: attendance.studentId,
      subjectId: attendance.subjectId,
      date: attendance.date,
      status: attendance.status,
      timeIn: attendance.timeIn,
      remarks: attendance.remarks,
      studentName: users.fullName,
      subjectName: subjects.name
    })
    .from(attendance)
    .innerJoin(users, eq(attendance.studentId, users.id))
    .innerJoin(subjects, eq(attendance.subjectId, subjects.id))
    .where(eq(subjects.teacherId, teacherId))
    .orderBy(desc(attendance.date));
  }

  async createQrCode(qr: InsertQrCode): Promise<QrCode> {
    const [code] = await db.insert(qrCodes).values(qr).returning();
    return code;
  }

  async getActiveQrCode(subjectId: number): Promise<QrCode | undefined> {
    const [qr] = await db.select()
      .from(qrCodes)
      .where(and(eq(qrCodes.subjectId, subjectId), eq(qrCodes.active, true)))
      .orderBy(desc(qrCodes.createdAt))
      .limit(1);
    return qr;
  }

  async validateAndConsumeQrCode(code: string): Promise<{ subjectId: number; isLate: boolean } | null> {
    // Find active QR code with this code
    const [qr] = await db.select()
      .from(qrCodes)
      .where(and(eq(qrCodes.code, code), eq(qrCodes.active, true)))
      .limit(1);
    
    if (!qr) return null;
    
    // Deactivate this QR code (single use)
    await db.update(qrCodes).set({ active: false }).where(eq(qrCodes.id, qr.id));
    
    // Check if code contains late marker (format: SUBJ_TIMESTAMP_LATE or SUBJ_TIMESTAMP)
    const isLate = code.includes('_LATE');
    
    return { subjectId: qr.subjectId, isLate };
  }

  async deactivateQrCode(subjectId: number): Promise<void> {
    await db.update(qrCodes)
      .set({ active: false })
      .where(and(eq(qrCodes.subjectId, subjectId), eq(qrCodes.active, true)));
  }

  async updateQrCodeLateMode(subjectId: number, isLate: boolean): Promise<void> {
    // Update the active QR code's late mode (in practice, we might store this differently)
    // For now, this is a placeholder - the late mode is determined by code format
  }

  async createSchedule(schedule: InsertSchedule): Promise<Schedule> {
    const [newSchedule] = await db.insert(schedules).values(schedule).returning();
    return newSchedule;
  }

  async getSchedulesBySubject(subjectId: number): Promise<Schedule[]> {
    return db.select().from(schedules).where(eq(schedules.subjectId, subjectId));
  }

  async getSchedulesByTeacher(teacherId: number): Promise<(Schedule & { subjectName: string; subjectCode: string })[]> {
    const result = await db.select({
      id: schedules.id,
      subjectId: schedules.subjectId,
      dayOfWeek: schedules.dayOfWeek,
      startTime: schedules.startTime,
      endTime: schedules.endTime,
      room: schedules.room,
      subjectName: subjects.name,
      subjectCode: subjects.code,
    })
    .from(schedules)
    .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
    .where(eq(subjects.teacherId, teacherId));
    
    return result;
  }

  async deleteSchedule(id: number): Promise<void> {
    await db.delete(schedules).where(eq(schedules.id, id));
  }
}

export const storage = new DatabaseStorage();
