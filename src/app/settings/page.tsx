import type { Metadata } from "next";
import { AccountSettings } from "@/components/profile/account-settings";

export const metadata: Metadata = { title: "설정" };

export default function SettingsPage() {
  return <AccountSettings />;
}
