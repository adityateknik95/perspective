import { LoginForm } from "./login-form";

interface LoginPageProps {
  searchParams: { next?: string; error?: string };
}

export const metadata = { title: "Sign in" };

export default function LoginPage({ searchParams }: LoginPageProps) {
  return <LoginForm next={searchParams.next} oauthError={searchParams.error} />;
}
