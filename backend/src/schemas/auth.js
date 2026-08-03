const { z } = require('zod');

const registerSchema = z.object({
  name: z.string().trim().min(1, 'name is required'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'email is required')
    .email('email must be a valid email address'),
  password: z.string().min(6, 'password must be at least 6 characters'),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, 'email is required'),
  password: z.string().min(1, 'password is required'),
});

module.exports = { registerSchema, loginSchema };
