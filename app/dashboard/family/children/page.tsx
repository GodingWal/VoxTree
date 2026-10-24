import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { familyChildren } from "@/lib/db/schema";
import { toSnakeRows } from "@/lib/db/to-snake";
import { getCurrentUserId } from "@/lib/auth/session";
import { ChildrenClient } from "./children-client";
import { isSimulationEnabled } from "@/lib/features";

export const metadata = {
  title: "Manage Readers | VoxTree",
  description: "Add and manage child reader profiles in your family tree.",
};

export default async function ChildrenPage() {
  const userId = await getCurrentUserId();

  if (!userId) {
    redirect("/login");
  }

  // Fetch children profiles from database (RLS owner policy: user_id = uid)
  let dbChildren: any[] = [];
  let simulatedMode = false;
  try {
    const data = await db
      .select()
      .from(familyChildren)
      .where(eq(familyChildren.userId, userId))
      .orderBy(asc(familyChildren.name));
    dbChildren = toSnakeRows(data);
  } catch (err) {
    if (!isSimulationEnabled()) throw err;
    simulatedMode = true;
  }

  return (
    <ChildrenClient dbChildren={dbChildren} userId={userId} dbSimulated={simulatedMode} />
  );
}
