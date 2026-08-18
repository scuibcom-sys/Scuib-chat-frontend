import { Suspense } from "react";
import { ProfileDisplayView } from "@/components/profile/ProfileDisplayView";

export const metadata = {
  title: "Profile - Scuib Chat",
};

export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfileDisplayView />
    </Suspense>
  );
}
