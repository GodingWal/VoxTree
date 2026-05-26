import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ChildrenClient } from "./children-client";

export const metadata = {
  title: "Manage Readers | VoxTree",
  description: "Add and manage child reader profiles in your family tree.",
};

export default async function ChildrenPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch children profiles from database
  let dbChildren: any[] = [];
  let simulatedMode = false;
  try {
    const { data, error } = await supabase
      .from("family_children")
      .select("*")
      .eq("user_id", user.id)
      .order("name", { ascending: true });
    
    if (error) {
      simulatedMode = true;
    } else if (data) {
      dbChildren = data;
    }
  } catch (err) {
    simulatedMode = true;
  }

  return (
    <ChildrenClient dbChildren={dbChildren} userId={user.id} dbSimulated={simulatedMode} />
  );
}
