import { z } from 'zod';
import { insertUserSchema, insertSubjectSchema, insertAttendanceSchema, insertQrCodeSchema, insertScheduleSchema, users, subjects, attendance, enrollments, schedules } from './schema';

// ============================================
// SHARED ERROR SCHEMAS
// ============================================
export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
};

// ============================================
// API CONTRACT
// ============================================
export const api = {
  auth: {
    login: {
      method: 'POST' as const,
      path: '/api/login',
      input: z.object({
        username: z.string(),
        password: z.string(),
        role: z.enum(["student", "teacher", "superadmin"]).optional(),
      }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    logout: {
      method: 'POST' as const,
      path: '/api/logout',
      responses: {
        200: z.object({ message: z.string() }),
      },
    },
    me: {
      method: 'GET' as const,
      path: '/api/user',
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
  },
  users: {
    list: {
      method: 'GET' as const,
      path: '/api/users',
      input: z.object({
        role: z.enum(["student", "teacher", "superadmin"]).optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof users.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/users',
      input: insertUserSchema,
      responses: {
        201: z.custom<typeof users.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/users/:id',
      input: insertUserSchema.partial(),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/users/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  subjects: {
    list: {
      method: 'GET' as const,
      path: '/api/subjects',
      responses: {
        200: z.array(z.custom<typeof subjects.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/subjects/:id',
      responses: {
        200: z.custom<typeof subjects.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/subjects',
      input: insertSubjectSchema,
      responses: {
        201: z.custom<typeof subjects.$inferSelect>(),
      },
    },
    enroll: {
      method: 'POST' as const,
      path: '/api/subjects/:id/enroll',
      input: z.object({ studentId: z.number() }),
      responses: {
        200: z.custom<typeof enrollments.$inferSelect>(),
      },
    },
    students: {
      method: 'GET' as const,
      path: '/api/subjects/:id/students',
      responses: {
        200: z.array(z.custom<typeof users.$inferSelect>()),
      },
    }
  },
  attendance: {
    list: {
      method: 'GET' as const,
      path: '/api/attendance',
      input: z.object({
        subjectId: z.coerce.number().optional(),
        studentId: z.coerce.number().optional(),
        date: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof attendance.$inferSelect & { studentName?: string, subjectName?: string }>()),
      },
    },
    mark: {
      method: 'POST' as const,
      path: '/api/attendance',
      input: insertAttendanceSchema,
      responses: {
        201: z.custom<typeof attendance.$inferSelect>(),
      },
    },
  },
  qr: {
    generate: {
      method: 'POST' as const,
      path: '/api/subjects/:id/qr',
      input: z.object({ code: z.string() }),
      responses: {
        201: z.custom<typeof insertQrCodeSchema>(),
      },
    }
  },
  schedules: {
    list: {
      method: 'GET' as const,
      path: '/api/schedules',
      responses: {
        200: z.array(z.custom<typeof schedules.$inferSelect>()),
      },
    },
    listByTeacher: {
      method: 'GET' as const,
      path: '/api/schedules/teacher',
      responses: {
        200: z.array(z.custom<typeof schedules.$inferSelect & { subjectName: string; subjectCode: string }>()),
      },
    },
    listBySubject: {
      method: 'GET' as const,
      path: '/api/subjects/:id/schedules',
      responses: {
        200: z.array(z.custom<typeof schedules.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/schedules',
      input: insertScheduleSchema,
      responses: {
        201: z.custom<typeof schedules.$inferSelect>(),
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/schedules/:id',
      responses: {
        204: z.void(),
      },
    },
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
