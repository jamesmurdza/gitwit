"use client"

import Avatar from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { github } from "@/hooks/github"
import { GithubUser } from "@/lib/actions"
import { cn, createPopupTracker } from "@/lib/utils"
import { useQueryClient } from "@tanstack/react-query"
import {
  GitBranch,
  GithubIcon,
  Loader2,
  MoreVertical,
  PackagePlus,
  RefreshCw,
} from "lucide-react"
import * as React from "react"
import { toast } from "sonner"

const REDIRECT_URI = "/loading"

export function GitHubSync({
  sandboxId,
  userId,
}: {
  sandboxId: string
  userId: string
}) {
  const [commitMessage, setCommitMessage] = React.useState("")
  const queryClient = useQueryClient()
  const {
    mutate: handleGithubLogin,
    isPending: isLoggingIn,
    reset: resetGithubLogin,
  } = github.login.useMutation({
    onSuccess: () => {
      return queryClient.invalidateQueries(
        github.githubUser.getOptions({
          userId,
        })
      )
    },
  })
  const { mutate: getAuthUrl, isPending: isGettingAuthUrl } =
    github.gethAuthUrl.useMutation({
      onSuccess({ auth_url }) {
        const tracker = createPopupTracker()

        return new Promise<{ code: string }>((resolve, reject) => {
          tracker.openPopup(auth_url, {
            onUrlChange(newUrl) {
              if (newUrl.includes(REDIRECT_URI)) {
                const urlParams = new URLSearchParams(new URL(newUrl).search)
                const code = urlParams.get("code")
                tracker.closePopup()

                if (code) {
                  resolve({ code })
                } else {
                  reject(new Error("No code received"))
                }
              }
            },
            onClose() {
              reject(new Error("Authentication window closed"))
            },
          })
        })
          .then(({ code }) => {
            handleGithubLogin({ code, userId })
          })
          .catch((error) => {
            console.error("Error during authentication:", error)
            toast.error("Authentication failed. Please try again.")
          })
      },
    })
  const { data: githubUser } = github.githubUser.useQuery({
    variables: {
      userId,
    },
  })
  const { data: repoStatus } = github.repoStatus.useQuery({
    variables: {
      projectId: sandboxId,
    },
  })
  const { mutate: syncToGithub, isPending: isSyncingToGithub } =
    github.createCommit.useMutation({
      onSuccess() {
        setCommitMessage("")
        toast.success("Commit created successfully")
      },
    })
  const { mutate: deleteRepo, isPending: isDeletingRepo } =
    github.removeRepo.useMutation({
      onSuccess() {
        return queryClient
          .invalidateQueries(
            github.repoStatus.getOptions({
              projectId: sandboxId,
            })
          )
          .then(() => {
            setCommitMessage("")
            toast.success("Repository deleted successfully")
          })
      },
    })
  const hasRepo = repoStatus
    ? repoStatus.existsInDB && repoStatus.existsInGitHub
    : false
  const { mutate: handleCreateRepo, isPending: isCreatingRepo } =
    github.createRepo.useMutation({
      onSuccess() {
        return queryClient
          .invalidateQueries(
            github.repoStatus.getOptions({
              projectId: sandboxId,
            })
          )
          .then(() => {
            toast.success("Repository created successfully")
          })
      },
    })

  const content = React.useMemo(() => {
    if (!githubUser) {
      return (
        <>
          <p className="text-xs">
            your project with GitHub™️ to keep your code safe, secure, and
            easily accessible from anywhere.
          </p>

          <Button
            variant="secondary"
            size="xs"
            className="mt-4 w-full font-normal"
            onClick={() => getAuthUrl()}
            disabled={isGettingAuthUrl || isLoggingIn}
          >
            {isLoggingIn ? (
              <Loader2 className="animate-spin mr-2 size-3" />
            ) : (
              <GithubIcon className="size-3 mr-2" />
            )}
            Connect to GitHub
          </Button>
        </>
      )
    } else {
      if (hasRepo) {
        return (
          <>
            <p className="text-xs">
              Connect your project to GitHub to ensure your code is secure,
              backed up, and accessible from any location.
            </p>
            <div className="flex items-center justify-between bg-muted/50 px-2 py-1 rounded-sm">
              <div className="flex items-center gap-2">
                <GithubUserButton userId={userId} {...githubUser} />
                <div>
                  <a
                    href={`${githubUser.html_url}/${repoStatus?.repo?.name}`}
                    className="text-xs font-medium hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {repoStatus?.repo?.name}
                  </a>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <GitBranch className="size-2.5" />
                    <span className="text-[0.65rem]">main</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="smIcon" className="size-6">
                      <MoreVertical className="size-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="">
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault()
                        deleteRepo({
                          projectId: sandboxId,
                        })
                      }}
                    >
                      {isDeletingRepo && (
                        <Loader2 className="animate-spin mr-2 size-3" />
                      )}
                      Delete Repository
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <div className="flex flex-col gap-2 mt-2">
              <Textarea
                placeholder="Add a commit message here..."
                className="!text-xs ring-inset"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
              />
              <Button
                variant="secondary"
                size="xs"
                className="w-full font-normal"
                onClick={() =>
                  syncToGithub({
                    projectId: sandboxId,
                    message: commitMessage,
                  })
                }
              >
                {isSyncingToGithub ? (
                  <Loader2 className="animate-spin mr-2 size-3" />
                ) : (
                  <RefreshCw className="size-3 mr-2" />
                )}
                Sync code
              </Button>
            </div>
          </>
        )
      } else {
        return (
          <>
            <p className="text-xs">
              your don't have a Github repository linked to this sandbox yet.
              You can create one to sync your code with GitHub.
            </p>
            <div className="flex gap-1 mt-4">
              <GithubUserButton userId={userId} {...githubUser} rounded="sm" />
              <Button
                variant="secondary"
                size="xs"
                className="w-full font-normal"
                onClick={() => {
                  handleCreateRepo({
                    projectId: sandboxId,
                  })
                }}
                disabled={isCreatingRepo}
              >
                {isCreatingRepo ? (
                  <Loader2 className="animate-spin mr-2 size-3" />
                ) : (
                  <PackagePlus className="size-3 mr-2" />
                )}
                Create Repo
              </Button>
            </div>
          </>
        )
      }
    }
  }, [
    githubUser,
    isLoggingIn,
    hasRepo,
    isCreatingRepo,
    commitMessage,
    isSyncingToGithub,
    isDeletingRepo,
    handleGithubLogin,
    repoStatus,
    handleCreateRepo,
    syncToGithub,
    deleteRepo,
    getAuthUrl,
  ])

  React.useEffect(() => {
    if (githubUser) {
      resetGithubLogin()
    }
  }, [githubUser, resetGithubLogin])

  return (
    <ScrollArea className="flex-grow overflow-auto px-2 pt-0 pb-4 relative">
      <div className="flex flex-col gap-3 w-full pt-2">
        <div className="flex items-center justify-between w-full">
          <h2 className="font-medium">Sync to GitHub</h2>
        </div>
        {content}
      </div>
    </ScrollArea>
  )
}

interface GithubUserButtonProps extends GithubUser {
  rounded?: "full" | "sm"
  userId: string
}

function GithubUserButton({
  rounded,
  userId,
  ...githubUser
}: GithubUserButtonProps) {
  const queryClient = useQueryClient()
  const { mutate: handleGithubLogout, isPending: isLoggingOut } =
    github.logout.useMutation({
      onSuccess: () => {
        return queryClient.invalidateQueries(
          github.githubUser.getOptions({ userId })
        )
      },
    })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="smIcon" className="size-6">
          <Avatar
            className={cn("size-6", rounded === "sm" && "rounded-sm")}
            name={githubUser.name}
            avatarUrl={githubUser.avatar_url}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" side="bottom" align="start">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Avatar
              className="size-6"
              name={githubUser.name}
              avatarUrl={githubUser.avatar_url}
            />
            <div className="grid flex-1 text-left text-sm leading-tight ml-2">
              <span className="truncate font-semibold text-xs">
                {githubUser.name}
              </span>
              <span className="truncate text-[0.6rem]">
                @{githubUser.login}
              </span>
            </div>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                  handleGithubLogout({
                    userId,
                  })
                }}
              >
                {isLoggingOut && (
                  <Loader2 className="animate-spin mr-2 h-4 w-4" />
                )}
                Logout
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={githubUser.html_url} target="_blank" rel="noreferrer">
                  View profile
                </a>
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
