import type { Express } from "express";
import type { Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import passport from "passport";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup authentication routes and middleware
  setupAuth(app);

  // === Authentication Routes ===
  app.post(api.auth.login.path, (req, res, next) => {
    passport.authenticate("local", (err: any, user: any) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      req.logIn(user, (err) => {
        if (err) return next(err);
        // Don't send password in response
        const { password, ...safeUser } = user;
        return res.json(safeUser);
      });
    })(req, res, next);
  });

  app.post(api.auth.logout.path, (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get(api.auth.me.path, (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = req.user as any;
    const { password, ...safeUser } = user;
    res.json(safeUser);
  });

  // === User Management ===
  app.get(api.users.list.path, async (req, res) => {
    // Only superadmin or teacher should see list? Or strict role check
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const role = req.query.role as "student" | "teacher" | "superadmin" | undefined;
    const users = await storage.getUsersByRole(role);
    res.json(users);
  });

  app.post(api.users.create.path, async (req, res) => {
    // Ideally protected
    try {
      const userData = api.users.create.input.parse(req.body);
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      const user = await storage.createUser(userData);
      res.status(201).json(user);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json(err.errors);
      } else {
        throw err;
      }
    }
  });

  // Check if username exists
  app.get('/api/users/check-username', async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const username = req.query.username as string;
    if (!username) {
      return res.status(400).json({ message: "Username is required" });
    }
    const existingUser = await storage.getUserByUsername(username);
    res.json({ exists: !!existingUser });
  });

  app.put(api.users.update.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const id = parseInt(req.params.id);
    const updates = api.users.update.input.parse(req.body);

    // If updating username, check if it already exists
    if (updates.username) {
      const existingUser = await storage.getUserByUsername(updates.username);
      if (existingUser && existingUser.id !== id) {
        return res.status(400).json({ message: "Username already exists" });
      }
    }

    const updated = await storage.updateUser(id, updates);
    if (!updated) return res.status(404).json({ message: "User not found" });
    res.json(updated);
  });

  app.delete(api.users.delete.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const id = parseInt(req.params.id);
    await storage.deleteUser(id);
    res.sendStatus(204);
  });

  // === Subjects ===
  app.get(api.subjects.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;

    if (user.role === "student") {
      const subjects = await storage.getSubjectsByStudent(user.id);
      return res.json(subjects);
    } else if (user.role === "teacher") {
      const subjects = await storage.getSubjectsByTeacher(user.id);
      return res.json(subjects);
    }

    const subjects = await storage.getAllSubjects();
    res.json(subjects);
  });

  app.post(api.subjects.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const subjectData = api.subjects.create.input.parse(req.body);
    const subject = await storage.createSubject(subjectData);
    res.status(201).json(subject);
  });

  app.get('/api/teacher/stats', async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    console.log('Teacher stats request for user:', user.id, user.role);
    if (user.role !== 'teacher') return res.sendStatus(403);
    const totalStudents = await storage.getTotalEnrolledStudentsByTeacher(user.id);
    console.log('Total students found:', totalStudents);
    res.json({ totalStudents });
  });

  app.post(api.subjects.enroll.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const subjectId = parseInt(req.params.id);
    const { studentId } = req.body;
    const enrollment = await storage.enrollStudent(studentId, subjectId);
    res.json(enrollment);
  });

  app.get(api.subjects.students.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const subjectId = parseInt(req.params.id);
    const students = await storage.getSubjectStudents(subjectId);
    res.json(students);
  });

  app.delete('/api/subjects/:id', async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const subjectId = parseInt(req.params.id);
      console.log('Deleting subject:', subjectId);
      await storage.deleteSubject(subjectId);
      console.log('Subject deleted successfully:', subjectId);
      res.sendStatus(204);
    } catch (error) {
      console.error('Error deleting subject:', error);
      res.status(500).json({ error: 'Failed to delete subject' });
    }
  });

  // === Attendance ===
  app.get(api.attendance.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;

    // For students, force filter by their own ID unless they are admin/teacher viewing specific data
    let studentId = req.query.studentId ? parseInt(req.query.studentId as string) : undefined;
    if (user.role === "student") {
      studentId = user.id;
    }

    const subjectId = req.query.subjectId ? parseInt(req.query.subjectId as string) : undefined;
    const date = req.query.date as string | undefined;

    const records = await storage.getAttendance(studentId, subjectId, date);
    res.json(records);
  });

  app.post(api.attendance.mark.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const data = api.attendance.mark.input.parse(req.body);
    const record = await storage.markAttendance(data);
    res.status(201).json(record);
  });

  // Get attendance records for teacher's subjects
  app.get('/api/attendance/teacher', async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    if (user.role !== "teacher" && user.role !== "superadmin") {
      return res.status(403).json({ message: "Only teachers can access this endpoint" });
    }
    try {
      const records = await storage.getAttendanceByTeacher(user.id);
      res.json(records);
    } catch (error) {
      console.error('Error fetching teacher attendance:', error);
      res.status(500).json({ error: 'Failed to fetch attendance records' });
    }
  });

  // === QR Code ===
  app.post(api.qr.generate.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const subjectId = parseInt(req.params.id);
    const { code } = req.body;
    const qr = await storage.createQrCode({ subjectId, code, active: true });
    res.status(201).json(qr);
  });

  // Student scans QR code to record attendance
  app.post('/api/attendance/scan', async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;

    if (user.role !== 'student') {
      return res.status(403).json({ message: "Only students can scan QR codes" });
    }

    const { qrCode, subjectId: providedSubjectId } = req.body;

    // For demo purposes, if no actual QR code is provided, use the providedSubjectId
    // In production, we would validate the actual QR code
    let subjectId: number;
    let isLate = false;

    if (qrCode && !qrCode.startsWith('SCAN_')) {
      // Try to validate actual QR code
      const result = await storage.validateAndConsumeQrCode(qrCode);
      if (!result) {
        return res.status(400).json({ message: "Invalid or expired QR code" });
      }
      subjectId = result.subjectId;
      isLate = result.isLate;
    } else if (providedSubjectId) {
      // Demo mode - use provided subject ID
      subjectId = providedSubjectId;
    } else {
      return res.status(400).json({ message: "QR code or subject ID required" });
    }

    // Check if student is enrolled in this subject
    const students = await storage.getSubjectStudents(subjectId);
    const isEnrolled = students.some(s => s.id === user.id);

    if (!isEnrolled) {
      return res.status(403).json({ message: "You are not enrolled in this subject" });
    }

    // Check if already marked attendance today for this subject
    const today = new Date().toISOString().split('T')[0];
    const existingRecords = await storage.getAttendance(user.id, subjectId, today);

    if (existingRecords.length > 0) {
      return res.status(400).json({
        message: "Attendance already recorded for today",
        status: existingRecords[0].status
      });
    }

    // Record attendance
    const status = isLate ? 'late' : 'present';
    const record = await storage.markAttendance({
      studentId: user.id,
      subjectId,
      date: today,
      status,
      remarks: isLate ? 'Arrived late' : 'On time'
    });

    res.status(201).json({
      message: `Attendance recorded as ${status}`,
      status,
      record
    });
  });

  // === Schedules ===
  app.get(api.schedules.listByTeacher.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    if (user.role !== "teacher") {
      return res.status(403).json({ message: "Only teachers can access this endpoint" });
    }
    const schedules = await storage.getSchedulesByTeacher(user.id);
    res.json(schedules);
  });

  app.get(api.schedules.listBySubject.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const subjectId = parseInt(req.params.id);
    const schedules = await storage.getSchedulesBySubject(subjectId);
    res.json(schedules);
  });

  app.post(api.schedules.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const scheduleData = api.schedules.create.input.parse(req.body);
      const schedule = await storage.createSchedule(scheduleData);
      res.status(201).json(schedule);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json(err.errors);
      } else {
        throw err;
      }
    }
  });

  app.delete(api.schedules.delete.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const id = parseInt(req.params.id);
    await storage.deleteSchedule(id);
    res.sendStatus(204);
  });

  // Seed Data
  await seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  const users = await storage.getUsersByRole();
  if (users.length === 0) {
    // Create Superadmin
    await storage.createUser({
      username: "admin",
      password: "password", // In real app, hash this
      fullName: "System Administrator",
      role: "superadmin"
    });

    // Create Teacher
    const teacher = await storage.createUser({
      username: "teacher",
      password: "password",
      fullName: "Dr. Jose Rizal",
      role: "teacher"
    });

    // Create Student
    const student = await storage.createUser({
      username: "student",
      password: "password",
      fullName: "Juan Dela Cruz",
      role: "student"
    });

    // Create Subject
    const subject = await storage.createSubject({
      name: "Software Engineering",
      code: "SE101",
      teacherId: teacher.id,
      description: "Introduction to Software Engineering"
    });

    // Create Schedules for the subject
    await storage.createSchedule({
      subjectId: subject.id,
      dayOfWeek: "Monday",
      startTime: "09:00",
      endTime: "10:30",
      room: "Q3212"
    });

    await storage.createSchedule({
      subjectId: subject.id,
      dayOfWeek: "Wednesday",
      startTime: "09:00",
      endTime: "10:30",
      room: "Q3212"
    });

    await storage.createSchedule({
      subjectId: subject.id,
      dayOfWeek: "Friday",
      startTime: "09:00",
      endTime: "10:30",
      room: "Q3212"
    });

    // Enroll Student
    await storage.enrollStudent(student.id, subject.id);

    // Mark Attendance
    await storage.markAttendance({
      studentId: student.id,
      subjectId: subject.id,
      status: "present",
      date: new Date().toISOString().split('T')[0],
      remarks: "On time"
    });
  }

  // Seed schedules for existing subjects if they don't have any
  await seedSchedulesForExistingSubjects();

  // Seed students for existing subjects
  await seedStudentsForSubjects();
}

async function seedSchedulesForExistingSubjects() {
  // Get all subjects
  const allSubjects = await storage.getAllSubjects();

  for (const subject of allSubjects) {
    // Check if subject already has schedules
    const existingSchedules = await storage.getSchedulesBySubject(subject.id);

    if (existingSchedules.length === 0) {
      // Add sample schedules based on subject code pattern
      if (subject.code === "SE101") {
        // Software Engineering: Mon, Wed, Fri 9:00-10:30 AM
        await storage.createSchedule({ subjectId: subject.id, dayOfWeek: "Monday", startTime: "09:00", endTime: "10:30", room: "Q3212" });
        await storage.createSchedule({ subjectId: subject.id, dayOfWeek: "Wednesday", startTime: "09:00", endTime: "10:30", room: "Q3212" });
        await storage.createSchedule({ subjectId: subject.id, dayOfWeek: "Friday", startTime: "09:00", endTime: "10:30", room: "Q3212" });
      } else if (subject.id === 2) {
        // Second subject: Mon, Tue 11:00-12:30 PM
        await storage.createSchedule({ subjectId: subject.id, dayOfWeek: "Monday", startTime: "11:00", endTime: "12:30", room: "Q3212" });
        await storage.createSchedule({ subjectId: subject.id, dayOfWeek: "Tuesday", startTime: "11:00", endTime: "12:30", room: "Q3212" });
      } else if (subject.id === 3) {
        // Third subject: Wed 1:00-2:30 PM, Fri 11:00-12:30 PM
        await storage.createSchedule({ subjectId: subject.id, dayOfWeek: "Wednesday", startTime: "13:00", endTime: "14:30", room: "Q3212" });
        await storage.createSchedule({ subjectId: subject.id, dayOfWeek: "Friday", startTime: "11:00", endTime: "12:30", room: "Q5212" });
      } else {
        // Default schedule for any other subject: TTh 2:00-3:30 PM
        await storage.createSchedule({ subjectId: subject.id, dayOfWeek: "Tuesday", startTime: "14:00", endTime: "15:30", room: "Q4212" });
        await storage.createSchedule({ subjectId: subject.id, dayOfWeek: "Thursday", startTime: "14:00", endTime: "15:30", room: "Q4212" });
      }
    }
  }
}

async function seedStudentsForSubjects() {
  // Check if we already have enough students
  const existingStudents = await storage.getUsersByRole("student");

  if (existingStudents.length < 10) {
    // Filipino student names
    const studentNames = [
      { first: "Maria", last: "Santos" },
      { first: "Jose", last: "Garcia" },
      { first: "Ana", last: "Reyes" },
      { first: "Pedro", last: "Cruz" },
      { first: "Rosa", last: "Mendoza" },
      { first: "Carlos", last: "Torres" },
      { first: "Elena", last: "Ramos" },
      { first: "Miguel", last: "Flores" },
      { first: "Lucia", last: "Bautista" },
      { first: "Antonio", last: "Villanueva" },
      { first: "Carmen", last: "Aquino" },
      { first: "Rafael", last: "Pascual" },
      { first: "Isabel", last: "Fernandez" },
      { first: "Francisco", last: "De Leon" },
      { first: "Teresa", last: "Gonzales" },
    ];

    const createdStudents: number[] = [];

    for (let i = 0; i < studentNames.length; i++) {
      const name = studentNames[i];
      const username = `student${i + 2}`; // student2, student3, etc.

      // Check if student already exists
      const existing = await storage.getUserByUsername(username);
      if (!existing) {
        const student = await storage.createUser({
          username,
          password: "password",
          fullName: `${name.first} ${name.last}`,
          role: "student"
        });
        createdStudents.push(student.id);
      }
    }

    // Get all students again
    const allStudents = await storage.getUsersByRole("student");
    const allSubjects = await storage.getAllSubjects();

    // Enroll students in subjects (randomize enrollment)
    for (const subject of allSubjects) {
      const existingEnrollments = await storage.getSubjectStudents(subject.id);

      if (existingEnrollments.length < 5) {
        // Enroll 8-12 random students per subject
        const shuffledStudents = [...allStudents].sort(() => Math.random() - 0.5);
        const studentsToEnroll = shuffledStudents.slice(0, Math.floor(Math.random() * 5) + 8);

        for (const student of studentsToEnroll) {
          // Check if already enrolled
          const isEnrolled = existingEnrollments.some(e => e.id === student.id);
          if (!isEnrolled) {
            try {
              await storage.enrollStudent(student.id, subject.id);
            } catch (e) {
              // Ignore duplicate enrollment errors
            }
          }
        }
      }
    }
  }
}
