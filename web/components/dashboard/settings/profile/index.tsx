"use client"

import ProfileCard from "@/components/dashboard/settings/profile/profile-card"
import SandboxesPanel from "@/components/dashboard/settings/profile/sandbox-panel"
import { SandboxWithLiked, User } from "@/lib/types"
import { useMemo } from "react"

export default function ProfilePage({
  publicSandboxes,
  privateSandboxes,
  profileOwner,
  loggedInUser,
}: {
  publicSandboxes: SandboxWithLiked[]
  privateSandboxes: SandboxWithLiked[]
  profileOwner: User
  loggedInUser: User | null
}) {
  const isOwnProfile = profileOwner.id === loggedInUser?.id

  const sandboxes = useMemo(() => {
    const allSandboxes = isOwnProfile
      ? [...publicSandboxes, ...privateSandboxes]
      : publicSandboxes

    return allSandboxes
  }, [isOwnProfile, publicSandboxes, privateSandboxes])

  return (
    <>
      <div className="container mx-auto p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <ProfileCard
            name={profileOwner.name}
            username={profileOwner.username}
            avatarUrl={profileOwner.avatarUrl}
            sandboxes={sandboxes}
            joinedDate={new Date(profileOwner.createdAt)}
            generations={isOwnProfile ? loggedInUser.generations : undefined}
            tier={profileOwner.tier}
            bio={profileOwner.bio}
            personalWebsite={profileOwner.personalWebsite}
            socialLinks={profileOwner.links}
          />
        </div>
        <div className="md:col-span-2">
          <SandboxesPanel
            {...{
              publicSandboxes,
              privateSandboxes,
              isOwnProfile,
            }}
          />
        </div>
      </div>
    </>
  )
}
