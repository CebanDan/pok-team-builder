import { z } from "zod";

const statSchema = z.object({
  hp: z.number().int().min(0).max(252),
  atk: z.number().int().min(0).max(252),
  def: z.number().int().min(0).max(252),
  spa: z.number().int().min(0).max(252),
  spd: z.number().int().min(0).max(252),
  spe: z.number().int().min(0).max(252),
});

const ivSchema = z.object({
  hp: z.number().int().min(0).max(31),
  atk: z.number().int().min(0).max(31),
  def: z.number().int().min(0).max(31),
  spa: z.number().int().min(0).max(31),
  spd: z.number().int().min(0).max(31),
  spe: z.number().int().min(0).max(31),
});

export const teamMemberSchema = z
  .object({
    id: z.string().min(1),
    species: z.string().max(100),
    form: z.string().max(100),
    ability: z.string().max(100),
    item: z.string().max(100),
    level: z.number().int().min(1).max(100),
    nature: z.string().max(50),
    gender: z.enum(["M", "F", "N"]),
    evs: statSchema,
    ivs: ivSchema,
    moves: z.array(z.string().max(100)).length(4),
  })
  .refine(
    (member) => Object.values(member.evs).reduce((sum, value) => sum + value, 0) <= 510,
    "EV total cannot exceed 510.",
  );

export const teamDataSchema = z.object({
  members: z.array(teamMemberSchema).max(6),
});

export const createTeamSchema = z.object({
  name: z.string().min(1).max(100),
  format: z.enum(["ou", "uu", "vgc", "custom"]),
  maxSize: z.number().int().min(1).max(6),
  data: teamDataSchema,
});

export const updateTeamSchema = createTeamSchema;

export const authSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(128),
});
