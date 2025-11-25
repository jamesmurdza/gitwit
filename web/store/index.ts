import { createJSONStorage, persist } from "zustand/middleware"
import { createStore, StateCreator as ZStateCreator } from "zustand/vanilla"
import { ChatSlice, createChatSlice } from "./slices/chat"
import { createEditorSlice, EditorSlice } from "./slices/editor"

type Slices = EditorSlice & ChatSlice
export type StateCreator<T> = ZStateCreator<Slices, [], [], T>

const createAppStore = () =>
  createStore<Slices>()(
    persist(
      (...a) => ({
        ...createEditorSlice(...a),
        ...createChatSlice(...a),
      }),
      {
        name: "gitwit-app-storage",
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          threads: state.threads,
          activeThreadId: state.activeThreadId,
        }),
        onRehydrateStorage: () => (state) => {
          state?.setHasHydrated(true)
        },
      }
    )
  )

export { createAppStore, type Slices }
