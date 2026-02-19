import { createJSONStorage, persist } from "zustand/middleware"
import { createStore, StateCreator as ZStateCreator } from "zustand/vanilla"
import { ChatSlice, createChatSlice } from "./slices/chat"
import { createEditorSlice, EditorSlice } from "./slices/editor"

type Slices = EditorSlice & ChatSlice
export type StateCreator<T> = ZStateCreator<Slices, [], [], T>

/** Debounce helper for localStorage writes during streaming */
function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>
  return ((...args: any[]) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }) as T
}

const debouncedSetItem = debounce(
  (name: string, value: string) => localStorage.setItem(name, value),
  1000,
)

const createAppStore = () =>
  createStore<Slices>()(
    persist(
      (...a) => ({
        ...createEditorSlice(...a),
        ...createChatSlice(...a),
      }),
      {
        name: "gitwit-app-storage",
        storage: createJSONStorage(() => ({
          getItem: (name) => localStorage.getItem(name),
          setItem: debouncedSetItem,
          removeItem: (name) => localStorage.removeItem(name),
        })),
        partialize: (state) => ({
          threads: state.threads,
          activeThreadId: state.activeThreadId,
        }),
        onRehydrateStorage: () => (state) => {
          state?.setHasHydrated(true)
        },
      },
    ),
  )

export { createAppStore, type Slices }
