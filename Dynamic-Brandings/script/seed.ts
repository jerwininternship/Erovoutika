import "dotenv/config";
import { db } from "../server/db";
import { users, subjects, schedules, enrollments, attendance } from "../shared/schema";

const firstNames = ["Juan", "Maria", "Jose", "Ana", "Carlos", "Sofia", "Miguel", "Isabella", "Luis", "Camila", "Antonio", "Valentina", "Diego", "Gabriela", "Pedro", "Lucia", "Ricardo", "Elena", "Andres", "Carmen"];
const lastNames = ["Santos", "Reyes", "Cruz", "Garcia", "Martinez", "Rodriguez", "Lopez", "Gonzalez", "Hernandez", "Perez", "Torres", "Flores", "Rivera", "Ramos", "Morales", "Castro", "Diaz", "Vargas", "Mendoza", "Jimenez"];

const subjectData = [
  { name: "Introduction to Programming", code: "CS101", description: "Learn the basics of programming with Python" },
  { name: "Data Structures", code: "CS201", description: "Study fundamental data structures and algorithms" },
  { name: "Web Development", code: "CS301", description: "Build modern web applications with HTML, CSS, and JavaScript" },
  { name: "Database Systems", code: "CS401", description: "Design and manage relational databases" },
  { name: "Computer Networks", code: "CS501", description: "Understand network protocols and architecture" },
  { name: "Operating Systems", code: "CS601", description: "Learn about OS concepts and system programming" },
];

const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;
const rooms = ["Room 101", "Room 102", "Room 201", "Room 202", "Lab 1", "Lab 2", "Auditorium A", "Auditorium B"];
const timeSlots = [
  { start: "08:00", end: "09:30" },
  { start: "09:45", end: "11:15" },
  { start: "11:30", end: "13:00" },
  { start: "14:00", end: "15:30" },
  { start: "15:45", end: "17:15" },
];

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

async function seed() {
  console.log("🌱 Starting database seed...");

  // Clear existing data in reverse order of dependencies
  console.log("🗑️  Clearing existing data...");
  await db.delete(attendance);
  await db.delete(enrollments);
  await db.delete(schedules);
  await db.delete(subjects);
  await db.delete(users);

  // Create admin
  console.log("👤 Creating admin user...");
  const [admin] = await db.insert(users).values({
    username: "admin",
    email: "admin@school.edu",
    password: "admin123",
    fullName: "System Administrator",
    role: "superadmin",
  }).returning();
  console.log(`   Created admin: ${admin.username}`);

  // Create teacher
  console.log("👨‍🏫 Creating teacher user...");
  const [teacher] = await db.insert(users).values({
    username: "teacher1",
    email: "teacher@school.edu",
    password: "teacher123",
    fullName: "Prof. Roberto Dela Cruz",
    role: "teacher",
  }).returning();
  console.log(`   Created teacher: ${teacher.username}`);

  // Create 20 students
  console.log("🎓 Creating 20 student users...");
  const studentUsers = [];
  for (let i = 1; i <= 20; i++) {
    const firstName = firstNames[i - 1];
    const lastName = randomElement(lastNames);
    const studentId = `2024${String(i).padStart(4, "0")}`;
    
    const [student] = await db.insert(users).values({
      username: studentId,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@student.school.edu`,
      password: "student123",
      fullName: `${firstName} ${lastName}`,
      role: "student",
    }).returning();
    studentUsers.push(student);
    console.log(`   Created student: ${student.username} - ${student.fullName}`);
  }

  // Create subjects assigned to the teacher
  console.log("📚 Creating subjects...");
  const createdSubjects = [];
  for (const subj of subjectData) {
    const [subject] = await db.insert(subjects).values({
      name: subj.name,
      code: subj.code,
      description: subj.description,
      teacherId: teacher.id,
    }).returning();
    createdSubjects.push(subject);
    console.log(`   Created subject: ${subject.code} - ${subject.name}`);
  }

  // Create random schedules for each subject (1-2 schedules per subject)
  console.log("📅 Creating schedules...");
  for (const subject of createdSubjects) {
    const numSchedules = Math.random() > 0.5 ? 2 : 1;
    const usedDays = new Set<string>();
    
    for (let i = 0; i < numSchedules; i++) {
      let day: typeof daysOfWeek[number];
      do {
        day = randomElement([...daysOfWeek]);
      } while (usedDays.has(day));
      usedDays.add(day);
      
      const timeSlot = randomElement(timeSlots);
      const room = randomElement(rooms);
      
      await db.insert(schedules).values({
        subjectId: subject.id,
        dayOfWeek: day,
        startTime: timeSlot.start,
        endTime: timeSlot.end,
        room: room,
      });
      console.log(`   Schedule: ${subject.code} on ${day} ${timeSlot.start}-${timeSlot.end} at ${room}`);
    }
  }

  // Enroll students to random subjects (each student gets 3-5 subjects)
  console.log("📝 Enrolling students to subjects...");
  const studentEnrollments: Map<number, number[]> = new Map();
  
  for (const student of studentUsers) {
    const numSubjects = 3 + Math.floor(Math.random() * 3); // 3-5 subjects
    const shuffled = [...createdSubjects].sort(() => Math.random() - 0.5);
    const enrolledSubjects = shuffled.slice(0, numSubjects);
    
    studentEnrollments.set(student.id, enrolledSubjects.map(s => s.id));
    
    for (const subject of enrolledSubjects) {
      await db.insert(enrollments).values({
        studentId: student.id,
        subjectId: subject.id,
      });
    }
    console.log(`   Enrolled ${student.fullName} to ${numSubjects} subjects`);
  }

  // Create random attendance records (past 30 days)
  console.log("✅ Creating attendance records...");
  const statuses = ["present", "late", "absent", "excused"] as const;
  const statusWeights = [0.7, 0.15, 0.1, 0.05]; // 70% present, 15% late, 10% absent, 5% excused
  
  function weightedRandomStatus(): typeof statuses[number] {
    const rand = Math.random();
    let cumulative = 0;
    for (let i = 0; i < statuses.length; i++) {
      cumulative += statusWeights[i];
      if (rand < cumulative) return statuses[i];
    }
    return "present";
  }

  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  let attendanceCount = 0;

  for (const student of studentUsers) {
    const enrolledSubjectIds = studentEnrollments.get(student.id) || [];
    
    for (const subjectId of enrolledSubjectIds) {
      // Generate 5-10 attendance records per subject
      const numRecords = 5 + Math.floor(Math.random() * 6);
      const usedDates = new Set<string>();
      
      for (let i = 0; i < numRecords; i++) {
        const date = randomDate(thirtyDaysAgo, today);
        const dateStr = date.toISOString().split("T")[0];
        
        // Skip if we already have a record for this date
        if (usedDates.has(dateStr)) continue;
        usedDates.add(dateStr);
        
        const status = weightedRandomStatus();
        const remarks = status === "absent" ? "No show" : 
                       status === "late" ? "Arrived late" :
                       status === "excused" ? "Medical excuse" : null;
        
        await db.insert(attendance).values({
          studentId: student.id,
          subjectId: subjectId,
          date: dateStr,
          status: status,
          remarks: remarks,
        });
        attendanceCount++;
      }
    }
  }
  console.log(`   Created ${attendanceCount} attendance records`);

  console.log("\n✨ Database seeding complete!");
  console.log("\n📋 Login credentials:");
  console.log("   Admin:   admin / admin123");
  console.log("   Teacher: teacher1 / teacher123");
  console.log("   Students: 20240001-20240020 / student123");
  
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
