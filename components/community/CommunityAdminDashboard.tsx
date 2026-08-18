"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import type { CommunityRecord } from "@/types/community";
import { Modal } from "@/components/ui/Modal";
import { LogoIcon } from "@/utils/icons";
import {
  createGroup,
  deleteGroup,
  editGroup,
  fetchGroupMemberCount,
  fetchGroupMembers,
  type GroupMutationResult,
  removeGroupMember,
  updateGroupStatus,
  type ApiGroupMemberRecord,
} from "@/utils/scuibAdminApi";
import {
  DEFAULT_GROUP_ACCENT_CHOICES,
  extractApiErrorMessage,
  fetchGroups,
  isElevatedRole,
  toCommunityRecord,
} from "@/utils/scuibApi";

const COMMUNITY_ICONS = [
  "🔥",
  "🚀",
  "💻",
  "🎨",
  "📱",
  "⚡",
];

type CommunityModalMode = "create" | "edit";
const COMMUNITY_COLOR_CHOICES = [...DEFAULT_GROUP_ACCENT_CHOICES];
void COMMUNITY_ICONS;

type LastCreatedGroupMeta = {
  id: string;
  name: string;
};

export function CommunityAdminDashboard({
  initialModalOpen = false,
}: {
  initialModalOpen?: boolean;
}) {
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const tokenType = useAuthStore((state) => state.tokenType);
  const setTokens = useAuthStore((state) => state.setTokens);
  const refreshCurrentUser = useAuthStore((state) => state.refreshCurrentUser);
  const isAdmin = (user?.isAdmin ?? false) || isElevatedRole(user?.role);
  // const isAdmin = true;

  const [communities, setCommunities] = useState<CommunityRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(initialModalOpen);
  const [communityModalMode, setCommunityModalMode] =
    useState<CommunityModalMode>("create");
  const [editingCommunityId, setEditingCommunityId] = useState<string | null>(
    null,
  );
  const [communityName, setCommunityName] = useState("");
  const [communityDescription, setCommunityDescription] = useState("");
  const [selectedColor, setSelectedColor] = useState<string>(
    COMMUNITY_COLOR_CHOICES[0],
  );
  const [createError, setCreateError] = useState<string | null>(null);
  const [isSavingCommunity, setIsSavingCommunity] = useState(false);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [deletingCommunityId, setDeletingCommunityId] = useState<string | null>(
    null,
  );
  const [membersCommunity, setMembersCommunity] = useState<CommunityRecord | null>(
    null,
  );
  const [groupMembers, setGroupMembers] = useState<ApiGroupMemberRecord[]>([]);
  const [isMembersLoading, setIsMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [pendingMembersCommunityId, setPendingMembersCommunityId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [lastCreatedGroup, setLastCreatedGroup] =
    useState<LastCreatedGroupMeta | null>(null);
  const [pendingCreatedGroupResult, setPendingCreatedGroupResult] =
    useState<GroupMutationResult | null>(null);

  const placeholderRows = useMemo(() => Array.from({ length: 6 }), []);
  const adminBadgeCount = communities.length;

  useEffect(() => {
    if (!accessToken) return;
    void refreshCurrentUser();
  }, [accessToken, refreshCurrentUser]);

  useEffect(() => {
    let isActive = true;

    const loadCommunities = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const liveGroups = await fetchGroups(
          accessToken
            ? {
                accessToken,
                refreshToken,
                tokenType,
              }
            : null,
          (tokens) => {
            setTokens(tokens.accessToken, tokens.refreshToken, tokens.tokenType);
          },
        );
        if (!isActive) return;

        const nextCommunities = accessToken
          ? await Promise.all(
              liveGroups.map(async (group, index) => {
                try {
                  const memberCount = await fetchGroupMemberCount(
                    group.id,
                    {
                      accessToken,
                      refreshToken,
                      tokenType,
                    },
                    (tokens) => {
                      setTokens(
                        tokens.accessToken,
                        tokens.refreshToken,
                        tokens.tokenType,
                      );
                    },
                  );

                  return toCommunityRecord(
                    {
                      ...group,
                      memberCount,
                    },
                    index,
                  );
                } catch {
                  return toCommunityRecord(group, index);
                }
              }),
            )
          : liveGroups.map((group, index) => toCommunityRecord(group, index));

        if (!isActive) return;
        setCommunities(nextCommunities);

        if (pendingCreatedGroupResult && !pendingCreatedGroupResult.id) {
          const matchingCommunities = nextCommunities.filter(
            (community) =>
              pendingCreatedGroupResult.name &&
              community.name.trim().toLowerCase() ===
                pendingCreatedGroupResult.name.trim().toLowerCase(),
          );

          if (matchingCommunities.length === 1) {
            setLastCreatedGroup({
              id: matchingCommunities[0].id,
              name: matchingCommunities[0].name,
            });
            setPendingCreatedGroupResult(null);
          }
        }
      } catch (error) {
        if (!isActive) return;

        setCommunities([]);
        setLoadError(
          extractApiErrorMessage(
            error,
            "Unable to load communities from the live API.",
          ),
        );
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void loadCommunities();

    return () => {
      isActive = false;
    };
  }, [
    accessToken,
    pendingCreatedGroupResult,
    refreshToken,
    reloadKey,
    setTokens,
    tokenType,
  ]);

  const resetCommunityForm = () => {
    setCommunityName("");
    setCommunityDescription("");
    setSelectedColor(COMMUNITY_COLOR_CHOICES[0]);
    setCreateError(null);
    setEditingCommunityId(null);
    setCommunityModalMode("create");
  };

  const updateCommunityLocally = (
    communityId: string,
    updater: (community: CommunityRecord) => CommunityRecord,
  ) => {
    setCommunities((currentCommunities) =>
      currentCommunities.map((community) =>
        community.id === communityId ? updater(community) : community,
      ),
    );

    setMembersCommunity((currentCommunity) =>
      currentCommunity && currentCommunity.id === communityId
        ? updater(currentCommunity)
        : currentCommunity,
    );
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    resetCommunityForm();
  };

  const openCreateModal = () => {
    resetCommunityForm();
    setShowCreateModal(true);
  };

  const openEditModal = (community: CommunityRecord) => {
    setCommunityModalMode("edit");
    setEditingCommunityId(community.id);
    setCommunityName(community.name);
    setCommunityDescription(community.description);
    setSelectedColor(community.accent);
    setCreateError(null);
    setShowCreateModal(true);
  };

  const handleCreateOrEditCommunity = async () => {
    const trimmedName = communityName.trim();
    const trimmedDescription = communityDescription.trim();
    const trimmedColor = selectedColor.trim();

    if (!trimmedName) {
      setCreateError("Community name is required.");
      return;
    }

    if (!trimmedColor) {
      setCreateError("Community color is required.");
      return;
    }

    if (!accessToken) {
      setCreateError("Please sign in as an admin before changing communities.");
      return;
    }

    setCreateError(null);
    setIsSavingCommunity(true);

    try {
      const authTokens = {
        accessToken,
        refreshToken,
        tokenType,
      };

      if (communityModalMode === "edit" && editingCommunityId) {
        await editGroup(
          editingCommunityId,
          authTokens,
          {
            name: trimmedName,
            description: trimmedDescription,
            color: trimmedColor,
          },
          (nextTokens) => {
            setTokens(
              nextTokens.accessToken,
              nextTokens.refreshToken,
              nextTokens.tokenType,
            );
          },
        );
        updateCommunityLocally(editingCommunityId, (community) => ({
          ...community,
          name: trimmedName,
          description: trimmedDescription,
          accent: trimmedColor,
        }));
        setActionNotice(`Updated "${trimmedName}" successfully.`);
      } else {
        const createdGroup = await createGroup(
          authTokens,
          {
            name: trimmedName,
            description: trimmedDescription,
            color: trimmedColor,
          },
          (nextTokens) => {
            setTokens(
              nextTokens.accessToken,
              nextTokens.refreshToken,
              nextTokens.tokenType,
            );
          },
        );

        if (createdGroup.id) {
          setLastCreatedGroup({
            id: createdGroup.id,
            name: createdGroup.name ?? trimmedName,
          });
          setPendingCreatedGroupResult(null);
          setActionNotice(
            `Created "${trimmedName}" successfully. Group ID: ${createdGroup.id}`,
          );
        } else {
          setPendingCreatedGroupResult(createdGroup);
          setActionNotice(
            `Created "${trimmedName}" successfully. Refreshing the list to resolve the group ID...`,
          );
        }
        setReloadKey((currentValue) => currentValue + 1);
      }

      setLoadError(null);
      closeCreateModal();
    } catch (error) {
      setCreateError(
        extractApiErrorMessage(
          error,
          communityModalMode === "edit"
            ? "Unable to update this community right now."
            : "Unable to create this community right now.",
        ),
      );
    } finally {
      setIsSavingCommunity(false);
    }
  };

  const handleToggleCommunityStatus = async (community: CommunityRecord) => {
    if (!accessToken || pendingStatusId || deletingCommunityId) return;

    const nextStatus = community.status === "active" ? "paused" : "active";
    setPendingStatusId(community.id);

    try {
      await updateGroupStatus(
        community.id,
        nextStatus,
        {
          accessToken,
          refreshToken,
          tokenType,
        },
        (nextTokens) => {
          setTokens(
            nextTokens.accessToken,
            nextTokens.refreshToken,
            nextTokens.tokenType,
          );
        },
      );

      setActionNotice(
        `${nextStatus === "paused" ? "Paused" : "Resumed"} "${community.name}" successfully.`,
      );
      setLoadError(null);
      setReloadKey((currentValue) => currentValue + 1);
    } catch (error) {
      setLoadError(
        extractApiErrorMessage(
          error,
          `Unable to ${nextStatus === "paused" ? "pause" : "resume"} this community right now.`,
        ),
      );
    } finally {
      setPendingStatusId(null);
    }
  };

  const handleDeleteCommunity = async (community: CommunityRecord) => {
    if (!accessToken || pendingStatusId || deletingCommunityId) return;

    setDeletingCommunityId(community.id);

    try {
      await deleteGroup(
        community.id,
        {
          accessToken,
          refreshToken,
          tokenType,
        },
        (nextTokens) => {
          setTokens(
            nextTokens.accessToken,
            nextTokens.refreshToken,
            nextTokens.tokenType,
          );
        },
      );

      setActionNotice(`Deleted "${community.name}" successfully.`);
      setLoadError(null);
      setReloadKey((currentValue) => currentValue + 1);
    } catch (error) {
      setLoadError(
        extractApiErrorMessage(
          error,
          "Unable to delete this community right now.",
        ),
      );
    } finally {
      setDeletingCommunityId(null);
    }
  };

  const closeMembersModal = () => {
    setMembersCommunity(null);
    setGroupMembers([]);
    setMembersError(null);
    setRemovingMemberId(null);
  };

  const handleOpenMembersModal = async (community: CommunityRecord) => {
    if (!accessToken) {
      setLoadError("Please sign in as an admin before viewing community members.");
      return;
    }

    setMembersCommunity(community);
    setGroupMembers([]);
    setMembersError(null);
    setIsMembersLoading(true);
    setPendingMembersCommunityId(community.id);

    try {
      const members = await fetchGroupMembers(
        community.id,
        {
          accessToken,
          refreshToken,
          tokenType,
        },
        (nextTokens) => {
          setTokens(
            nextTokens.accessToken,
            nextTokens.refreshToken,
            nextTokens.tokenType,
          );
        },
      );

      setGroupMembers(members);
    } catch (error) {
      setMembersError(
        extractApiErrorMessage(
          error,
          "Unable to load members for this community right now.",
        ),
      );
    } finally {
      setIsMembersLoading(false);
      setPendingMembersCommunityId(null);
    }
  };

  const handleRemoveMember = async (member: ApiGroupMemberRecord) => {
    if (!membersCommunity || !accessToken || removingMemberId) return;

    setRemovingMemberId(member.id);
    setMembersError(null);

    try {
      await removeGroupMember(
        membersCommunity.id,
        member.id,
        {
          accessToken,
          refreshToken,
          tokenType,
        },
        (nextTokens) => {
          setTokens(
            nextTokens.accessToken,
            nextTokens.refreshToken,
            nextTokens.tokenType,
          );
        },
      );

      setGroupMembers((currentMembers) =>
        currentMembers.filter((currentMember) => currentMember.id !== member.id),
      );
      setActionNotice(`Removed ${member.name} from "${membersCommunity.name}".`);
      setReloadKey((currentValue) => currentValue + 1);
    } catch (error) {
      setMembersError(
        extractApiErrorMessage(
          error,
          "Unable to remove this member right now.",
        ),
      );
    } finally {
      setRemovingMemberId(null);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-[#4F3422] p-2 md:hidden">
        <div className="mx-auto flex min-h-[calc(100vh-16px)] max-w-sm flex-col items-center justify-center bg-[#F7F2EE] px-8 text-center text-[#4F3422]">
          <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-white text-[#7E5134]">
            <LogoIcon className="h-12 w-12" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-[-0.03em]">
            Desktop and tablet only
          </h1>
          <p className="mt-4 text-base leading-7 text-[#7E6E66]">
            The admin dashboard is currently designed for larger screens based
            on the provided reference.
          </p>
        </div>
      </div>

      <div className="hidden min-h-screen bg-[#4F3422] p-2 md:block">
        <div className="flex min-h-[calc(100vh-16px)] overflow-hidden bg-[#F7F2EE] shadow-[0_24px_80px_rgba(43,24,14,0.34)]">
          <aside className="relative w-[96px] shrink-0 bg-[#4F3422]">
            <div className="absolute left-1/2 top-4 flex h-[68px] w-[68px] -translate-x-1/2 items-center justify-center rounded-full bg-white text-[#7E5134]">
              <LogoIcon className="h-10 w-10" />
            </div>

            <div className="absolute left-1/2 top-[274px] flex h-[66px] w-[66px] -translate-x-1/2 items-center justify-center rounded-full bg-[#9C6845]">
              <Image
                src="/admin_icon.svg"
                alt="Admin communities"
                width={31}
                height={31}
              />
              <span className="absolute -right-1 -top-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-[#FF8B23] px-1 text-[14px] font-extrabold text-white">
                {adminBadgeCount}
              </span>
            </div>

            <div className="absolute bottom-4 left-1/2 flex h-[58px] w-[58px] -translate-x-1/2 items-center justify-center overflow-hidden rounded-full shadow-[0_10px_20px_rgba(0,0,0,0.16)]">
              <SelfPortraitAvatar />
            </div>
          </aside>

          <main className="flex-1 bg-[#F7F2EE] px-7 py-8 lg:px-7">
            {!isAdmin ? (
              <div className="flex min-h-[calc(100vh-80px)] items-center justify-center">
                <div className="w-full max-w-[720px] bg-white px-10 py-12 text-center">
                  <h1 className="text-[34px] font-extrabold leading-none tracking-[-0.03em] text-[#4F3422]">
                    Admin access only
                  </h1>
                  <p className="mt-5 text-[18px] leading-8 text-[#7E6E66]">
                    This page is reserved for admin accounts. Normal users can
                    keep using the main dashboard, while admins can create,
                    pause, edit, and remove communities from here.
                  </p>
                  <Link
                    href="/dashboard"
                    className="mt-8 inline-flex rounded-full bg-[#4F3422] px-7 py-4 text-[15px] font-extrabold uppercase tracking-[0.14em] text-white transition-colors hover:bg-[#442B1C]"
                  >
                    Back to Dashboard
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-8">
                  <div>
                    <div className="flex items-center gap-4 text-[#4F3422]">
                      <Image
                        src="/group_header_icon.svg"
                        alt=""
                        width={28}
                        height={28}
                        aria-hidden="true"
                      />
                      <h1 className="text-[31px] font-extrabold leading-none tracking-[-0.04em]">
                        Communities
                      </h1>
                    </div>
                    <p className="mt-5 text-[11px] font-extrabold uppercase tracking-[0.24em] text-[#4F3422]">
                      Only admins can create or modify communities
                    </p>
                  </div>

                  <button
                    onClick={openCreateModal}
                    className="rounded-[14px] bg-[#4F3422] px-9 py-5 text-[17px] font-extrabold text-white transition-colors hover:bg-[#442B1C]"
                  >
                    Create Community
                  </button>
                </div>

                {loadError ? (
                  <div className="mt-6 bg-[#FFF0EA] px-6 py-4 text-[15px] leading-7 text-[#A4501A]">
                    {loadError}
                  </div>
                ) : null}

                {actionNotice ? (
                  <div className="mt-6 bg-white px-6 py-4 text-[15px] leading-7 text-[#7E5946]">
                    {actionNotice}
                  </div>
                ) : null}

                {lastCreatedGroup ? (
                  <div className="mt-6 bg-[#FFF7F0] px-6 py-5 text-[#4F3422] shadow-[0_10px_24px_rgba(79,52,34,0.06)]">
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-[#8F654B]">
                      Last Created Group
                    </p>
                    <p className="mt-3 text-[22px] font-extrabold leading-none tracking-[-0.03em]">
                      {lastCreatedGroup.name}
                    </p>
                    <p className="mt-3 text-[14px] font-semibold uppercase tracking-[0.08em] text-[#8F654B]">
                      Group ID
                    </p>
                    <p className="mt-2 break-all text-[18px] font-extrabold leading-7">
                      {lastCreatedGroup.id}
                    </p>
                    <p className="mt-3 text-[14px] leading-6 text-[#7E6E66]">
                      Use this ID for your quick admin test flow: pause, resume,
                      list members, and delete.
                    </p>
                  </div>
                ) : null}

                <div className="mt-8 overflow-hidden bg-white">
                  <div className="grid grid-cols-[1.25fr_1fr_1fr_1fr_2fr_1.15fr] px-6 py-4">
                    {["COMMUNITY", "NUMBERS", "POST", "STATUS", "DESCRIPTION", "ACTIONS"].map(
                      (header) => (
                        <div
                          key={header}
                          className="text-[14px] font-extrabold uppercase tracking-[0.02em] text-[#3D4348]"
                        >
                          {header}
                        </div>
                      ),
                    )}
                  </div>

                  {isLoading ? (
                    placeholderRows.map((_, index) => (
                      <CommunitySkeletonRow key={`community-skeleton-${index}`} />
                    ))
                  ) : communities.length === 0 ? (
                    <div className="px-6 py-10 text-[16px] leading-7 text-[#7E6E66]">
                      The backend is connected, but it has not returned any
                      communities yet.
                    </div>
                  ) : (
                    communities.map((community) => (
                      <CommunityRow
                        key={community.id}
                        community={community}
                        isLoadingMembers={pendingMembersCommunityId === community.id}
                        isUpdatingStatus={pendingStatusId === community.id}
                        isDeleting={deletingCommunityId === community.id}
                        onViewMembers={() => handleOpenMembersModal(community)}
                        onEdit={() => openEditModal(community)}
                        onToggleStatus={() => handleToggleCommunityStatus(community)}
                        onDelete={() => void handleDeleteCommunity(community)}
                      />
                    ))
                  )}
                </div>
              </>
            )}
          </main>
        </div>
      </div>

      <Modal
        isOpen={isAdmin && showCreateModal}
        onClose={closeCreateModal}
        overlayClassName="bg-black/40"
        className="max-w-[510px] rounded-[42px] bg-white px-6 py-5"
      >
        <div className="rounded-[34px] px-2 pb-2 pt-1">
          <h2 className="text-center text-[25px] font-extrabold leading-none tracking-[-0.03em] text-[#4F3422]">
            {communityModalMode === "edit"
              ? "Edit Community"
              : "Create New Community"}
          </h2>

          <div className="mt-8 space-y-5">
            <label className="block">
              <span className="mb-3 block text-[15px] font-medium text-[#6D6A68]">
                Community Name
              </span>
              <input
                value={communityName}
                onChange={(event) => {
                  setCommunityName(event.target.value);
                  setCreateError(null);
                }}
                className="h-[42px] w-full rounded-[13px] border border-[#8C664B] px-4 text-[16px] text-[#4F3422] outline-none transition-colors focus:border-[#4F3422]"
              />
            </label>

            <label className="block">
              <span className="mb-3 block text-[15px] font-medium text-[#6D6A68]">
                Community Description(Option)
              </span>
              <input
                value={communityDescription}
                onChange={(event) => {
                  setCommunityDescription(event.target.value);
                  setCreateError(null);
                }}
                className="h-[42px] w-full rounded-[13px] border border-[#8C664B] px-4 text-[16px] text-[#4F3422] outline-none transition-colors focus:border-[#4F3422]"
              />
            </label>

            <div>
              <p className="mb-4 text-[15px] font-medium text-[#6D6A68]">
                Choose Color
              </p>
              <div className="flex items-center gap-4">
                {COMMUNITY_COLOR_CHOICES.map((color) => {
                  const isSelected = selectedColor === color;

                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => {
                        setSelectedColor(color);
                        setCreateError(null);
                      }}
                      className={`h-11 w-11 rounded-full border transition-transform ${
                        isSelected ? "scale-110" : ""
                      }`}
                      style={{
                        backgroundColor: color,
                        borderColor: isSelected ? "#4F3422" : "transparent",
                        boxShadow: isSelected
                          ? "0 0 0 3px rgba(79, 52, 34, 0.12)"
                          : undefined,
                      }}
                      aria-label={`Select community color ${color}`}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {createError ? (
            <p className="mt-6 rounded-[18px] bg-[#FFF2EA] px-4 py-3 text-[15px] leading-6 text-[#A4501A]">
              {createError}
            </p>
          ) : null}

          <div className="mt-11 flex items-center justify-center gap-3">
            <button
              onClick={handleCreateOrEditCommunity}
              disabled={isSavingCommunity}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#4F3422] px-8 py-3 text-[16px] font-extrabold text-white transition-colors hover:bg-[#442B1C] disabled:opacity-60"
            >
              {isSavingCommunity ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              {isSavingCommunity
                ? communityModalMode === "edit"
                  ? "Saving..."
                  : "Creating..."
                : communityModalMode === "edit"
                  ? "Save changes"
                  : "Create community"}
            </button>
            <button
              onClick={closeCreateModal}
              className="rounded-full border border-[#8C664B] bg-white px-7 py-3 text-[16px] font-extrabold text-[#4F3422]"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isAdmin && Boolean(membersCommunity)}
        onClose={closeMembersModal}
        overlayClassName="bg-black/40"
        className="max-w-[720px] bg-white px-6 py-5"
      >
        <div className="px-2 pb-2 pt-1">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[25px] font-extrabold leading-none tracking-[-0.03em] text-[#4F3422]">
                {membersCommunity?.name ?? "Community members"}
              </h2>
              <p className="mt-3 text-[15px] leading-6 text-[#6D6A68]">
                Manage the members currently inside this community.
              </p>
            </div>
            <button
              type="button"
              onClick={closeMembersModal}
              className="rounded-full border border-[#D8C4B7] px-4 py-2 text-[14px] font-extrabold text-[#4F3422]"
            >
              Close
            </button>
          </div>

          {membersError ? (
            <div className="mt-6 bg-[#FFF2EA] px-4 py-3 text-[15px] leading-6 text-[#A4501A]">
              {membersError}
            </div>
          ) : null}

          <div className="mt-6 max-h-[420px] overflow-y-auto">
            {isMembersLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={`member-skeleton-${index}`}
                    className="flex items-center justify-between bg-[#F8F3EE] px-4 py-4"
                  >
                    <div className="space-y-2">
                      <div className="h-4 w-44 rounded-full bg-[#ECE2DA]" />
                      <div className="h-3 w-28 rounded-full bg-[#ECE2DA]" />
                    </div>
                    <div className="h-9 w-20 rounded-full bg-[#ECE2DA]" />
                  </div>
                ))}
              </div>
            ) : groupMembers.length === 0 ? (
              <div className="bg-[#F8F3EE] px-5 py-6 text-[15px] leading-7 text-[#7E6E66]">
                No members were returned for this community yet.
              </div>
            ) : (
              <div className="space-y-3">
                {groupMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between gap-4 bg-[#F8F3EE] px-4 py-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[16px] font-extrabold text-[#3F4347]">
                        {member.name}
                      </p>
                      <p className="mt-1 truncate text-[14px] text-[#7E6E66]">
                        {member.email ?? member.role ?? "Community member"}
                      </p>
                      {member.bio ? (
                        <p className="mt-2 line-clamp-2 text-[14px] leading-6 text-[#7E6E66]">
                          {member.bio}
                        </p>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveMember(member)}
                      disabled={removingMemberId === member.id}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#FFE0DA] px-4 py-2 text-[14px] font-extrabold text-[#F84C3C] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {removingMemberId === member.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : null}
                      {removingMemberId === member.id ? "Removing..." : "Remove"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}

function CommunityRow({
  community,
  isLoadingMembers,
  isUpdatingStatus,
  isDeleting,
  onViewMembers,
  onEdit,
  onToggleStatus,
  onDelete,
}: {
  community: CommunityRecord;
  isLoadingMembers: boolean;
  isUpdatingStatus: boolean;
  isDeleting: boolean;
  onViewMembers: () => void;
  onEdit: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="grid min-h-[76px] grid-cols-[1.25fr_1fr_1fr_1fr_2fr_1.15fr] items-center border-l-[6px] px-6 py-5"
      style={{ borderLeftColor: community.accent }}
    >
      <div className="pr-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="h-4 w-4 shrink-0 rounded-full border border-black/5"
            style={{ backgroundColor: community.accent }}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p
              className="truncate text-[17px] font-medium leading-none"
              style={{ color: community.accent }}
            >
              {community.name}
            </p>
            <p className="mt-2 text-[8px] font-medium uppercase tracking-[0.08em] text-[#A29D98]">
              {community.createdLabel}
            </p>
          </div>
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={onViewMembers}
          disabled={isLoadingMembers}
          className="inline-flex items-center gap-2 text-[16px] font-medium text-[#3F4347] underline-offset-4 hover:underline disabled:opacity-60"
        >
          {isLoadingMembers ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {community.members}
        </button>
      </div>

      <div className="text-[16px] font-medium text-[#3F4347]">
        {community.posts}
      </div>

      <div>
        <span
          className={`rounded-full px-3 py-1 text-[14px] font-extrabold ${
            community.status === "active"
              ? "bg-[#D7F8F0] text-[#08B79E]"
              : "bg-[#FFF0D8] text-[#E88A22]"
          }`}
        >
          {community.status === "active" ? "Active" : "Paused"}
        </span>
      </div>

      <div className="truncate pr-6 text-[16px] font-medium text-[#3F4347]">
        {community.description}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ActionPill tone="edit" onClick={onEdit} disabled={isUpdatingStatus || isDeleting}>
          Edit
        </ActionPill>
        <ActionPill
          tone="pause"
          onClick={onToggleStatus}
          disabled={isUpdatingStatus || isDeleting}
          isLoading={isUpdatingStatus}
        >
          {isUpdatingStatus
            ? community.status === "active"
              ? "Pausing"
              : "Resuming"
            : community.status === "active"
              ? "Pause"
              : "Resume"}
        </ActionPill>
        <ActionPill
          tone="delete"
          onClick={onDelete}
          disabled={isUpdatingStatus || isDeleting}
          isLoading={isDeleting}
        >
          {isDeleting ? "Deleting" : "Delete"}
        </ActionPill>
      </div>
    </div>
  );
}

function CommunitySkeletonRow() {
  return (
    <div className="grid min-h-[76px] grid-cols-[1.25fr_1fr_1fr_1fr_2fr_1.15fr] items-center px-6 py-5">
      <div className="space-y-2">
        <div className="h-5 w-28 rounded-full bg-[#F3EEE9]" />
        <div className="h-2 w-16 rounded-full bg-[#F3EEE9]" />
      </div>
      <div className="h-5 w-16 rounded-full bg-[#F3EEE9]" />
      <div className="h-5 w-16 rounded-full bg-[#F3EEE9]" />
      <div className="h-8 w-14 rounded-full bg-[#F3EEE9]" />
      <div className="h-5 w-full max-w-[260px] rounded-full bg-[#F3EEE9]" />
      <div className="flex gap-2">
        <div className="h-7 w-10 rounded-[7px] bg-[#F3EEE9]" />
        <div className="h-7 w-12 rounded-[7px] bg-[#F3EEE9]" />
        <div className="h-7 w-12 rounded-[7px] bg-[#F3EEE9]" />
      </div>
    </div>
  );
}

function ActionPill({
  children,
  tone,
  onClick,
  disabled = false,
  isLoading = false,
}: {
  children: string;
  tone: "edit" | "pause" | "delete";
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
}) {
  const toneClasses =
    tone === "edit"
      ? "bg-[#E4D4FF] text-[#6B48F5]"
      : tone === "pause"
        ? "bg-[#FFE9C7] text-[#F08B1B]"
        : "bg-[#FFE0DA] text-[#F84C3C]";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-[7px] px-3 py-1.5 text-[14px] font-extrabold ${toneClasses} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

function SelfPortraitAvatar() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full">
      <rect width="100" height="100" rx="50" fill="#E9D3B3" />
      <path
        d="M18 94c5-24 20-36 32-36h4c12 0 28 12 31 36H18Z"
        fill="#F7F0E7"
      />
      <path d="M38 57c7 5 17 5 24 0l-3 15H41l-3-15Z" fill="#B87350" />
      <ellipse cx="50" cy="40" rx="18" ry="20" fill="#B87350" />
      <path
        d="M30 38c0-18 13-29 28-29 12 0 24 8 28 21-12-3-20-3-28-1-8 1-16 5-28 9Z"
        fill="#2D201A"
      />
      <path
        d="M29 40c4 16 15 29 21 29 11 0 22-13 25-29-5 5-10 7-23 7-9 0-18-3-23-7Z"
        fill="#B87350"
      />
    </svg>
  );
}
