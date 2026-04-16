import * as z from "zod";

export const searchSchema = z.object({
  keyword: z
    .string()
    .max(50, "Từ khóa tìm kiếm quá dài")
    .optional()
    .or(z.literal("")),
});

export type SearchFormValues = z.infer<typeof searchSchema>;
