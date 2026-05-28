export type UserRole = "student" | "teacher";

export type SessionProfile = {
  id: string;
  role: UserRole;
  loginName: string;
  displayName: string;
};

export type ProfileRow = {
  id: string;
  role: UserRole;
  login_name: string;
  display_name: string;
};
