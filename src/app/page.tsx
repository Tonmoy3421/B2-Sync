import { redirect } from "next/navigation";

export default function Home() {
  // The middleware sends signed-out visitors to /login.
  redirect("/dashboard");
}
