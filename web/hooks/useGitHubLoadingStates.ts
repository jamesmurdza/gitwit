import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"

const MUTATION_KEYS = {
  isGettingAuthUrl: "gethAuthUrl",
  isLoggingIn: "login",
  isSyncingToGithub: "createCommit",
  isCreatingRepo: "createRepo",
  isDeletingRepo: "removeRepo",
  isPulling: "pullFromGithub",
  isResolvingConflicts: "resolveConflicts",
  isLoggingOut: "logout",
} as const

type LoadingStates = Record<keyof typeof MUTATION_KEYS, boolean>

const DEFAULT_STATES: LoadingStates = Object.fromEntries(
  Object.keys(MUTATION_KEYS).map((key) => [key, false])
) as LoadingStates

export function useGitHubLoadingStates() {
  const queryClient = useQueryClient()
  const [loadingStates, setLoadingStates] = useState(DEFAULT_STATES)

  const latestStatesRef = useRef(loadingStates)

  useEffect(() => {
    const updateLoadingStates = () => {
      const mutations = queryClient.getMutationCache().getAll()

      const newStates = Object.fromEntries(
        Object.entries(MUTATION_KEYS).map(([stateKey, mutationKey]) => [
          stateKey,
          mutations.some(
            (m) =>
              m.options.mutationKey?.[0] === "github" &&
              m.options.mutationKey?.[1] === mutationKey &&
              m.state.status === "pending"
          ),
        ])
      ) as LoadingStates

      // Only update if states actually changed
      const hasChanged = Object.keys(newStates).some(
        (key) =>
          newStates[key as keyof typeof newStates] !==
          latestStatesRef.current[key as keyof typeof latestStatesRef.current]
      )

      if (hasChanged) {
        latestStatesRef.current = newStates
        setLoadingStates(newStates)
      }
    }

    // Initial update
    updateLoadingStates()

    // Subscribe to mutation cache changes
    const unsubscribe = queryClient.getMutationCache().subscribe(() => {
      updateLoadingStates()
    })

    return unsubscribe
  }, [queryClient])

  return loadingStates
}
