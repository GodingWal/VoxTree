import { ResetPasswordForm } from "./reset-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; email?: string }>;
}) {
  const { token = "", email = "" } = await searchParams;
  return <ResetPasswordForm email={email} token={token} />;
}
