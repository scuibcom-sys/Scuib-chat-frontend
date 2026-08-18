import { MemberProfileView } from "@/components/profile/MemberProfileView";
import { readMemberPreviewFromSearchParams } from "@/utils/memberProfileRoute";

export const metadata = {
  title: "Member Profile - Scuib Chat",
};

function toUrlSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") {
      params.set(key, value);
      continue;
    }

    if (Array.isArray(value) && value[0]) {
      params.set(key, value[0]);
    }
  }

  return params;
}

export default async function MemberProfilePage(props: {
  params: Promise<{ memberId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { memberId } = await props.params;
  const rawSearchParams = await props.searchParams;
  const member = readMemberPreviewFromSearchParams(
    memberId,
    toUrlSearchParams(rawSearchParams),
  );

  return <MemberProfileView member={member} />;
}
