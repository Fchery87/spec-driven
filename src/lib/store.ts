import { create } from 'zustand'

/**
 * Project Store - Manages project list and current project state
 */
export interface ProjectState {
  projects: Array<{
    slug: string
    name: string
    current_phase: string
    stack_choice?: string
    stack_approved: boolean
    created_at: string
  }>
  currentProjectSlug: string | null
  loading: boolean
  error: string | null

  // Actions
  setProjects: (projects: ProjectState['projects']) => void
  setCurrentProject: (slug: string | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  addProject: (project: ProjectState['projects'][0]) => void
  updateProject: (slug: string, updates: Partial<ProjectState['projects'][0]>) => void
  removeProject: (slug: string) => void
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  currentProjectSlug: null,
  loading: false,
  error: null,

  setProjects: (projects) => set({ projects }),
  setCurrentProject: (slug) => set({ currentProjectSlug: slug }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  addProject: (project) => set((state) => ({
    projects: [project, ...state.projects]
  })),
  updateProject: (slug, updates) => set((state) => ({
    projects: state.projects.map((p) =>
      p.slug === slug ? { ...p, ...updates } : p
    )
  })),
  removeProject: (slug) => set((state) => ({
    projects: state.projects.filter((p) => p.slug !== slug)
  }))
}))

/**
 * User Store - Manages authentication state
 */
export interface UserState {
  user: {
    id: string
    email: string
    name?: string
    image?: string
  } | null
  isAuthenticated: boolean
  loading: boolean
  error: string | null

  // Actions
  setUser: (user: UserState['user']) => void
  setAuthenticated: (authenticated: boolean) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  logout: () => void
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  isAuthenticated: false,
  loading: false,
  error: null,

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setAuthenticated: (authenticated) => set({ isAuthenticated: authenticated }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  logout: () => set({ user: null, isAuthenticated: false })
}))

/**
 * UI Store - Manages UI state (modals, notifications, etc)
 */
export interface UIState {
  notifications: Array<{
    id: string
    type: 'success' | 'error' | 'info' | 'warning'
    message: string
    duration?: number
  }>
  modals: {
    deleteProject: boolean
    confirmAction: boolean
  }
  confirmAction: {
    title: string
    message: string
    onConfirm: () => void
    onCancel?: () => void
  } | null

  // Actions
  addNotification: (notification: Omit<UIState['notifications'][0], 'id'>) => void
  removeNotification: (id: string) => void
  clearNotifications: () => void
  openModal: (modal: keyof UIState['modals']) => void
  closeModal: (modal: keyof UIState['modals']) => void
  setConfirmAction: (action: UIState['confirmAction']) => void
}

export const useUIStore = create<UIState>((set) => ({
  notifications: [],
  modals: {
    deleteProject: false,
    confirmAction: false
  },
  confirmAction: null,

  addNotification: (notification) => set((state) => ({
    notifications: [
      ...state.notifications,
      {
        ...notification,
        id: Math.random().toString(36).substr(2, 9)
      }
    ]
  })),
  removeNotification: (id) => set((state) => ({
    notifications: state.notifications.filter((n) => n.id !== id)
  })),
  clearNotifications: () => set({ notifications: [] }),
  openModal: (modal) => set((state) => ({
    modals: { ...state.modals, [modal]: true }
  })),
  closeModal: (modal) => set((state) => ({
    modals: { ...state.modals, [modal]: false }
  })),
  setConfirmAction: (action) => set({ confirmAction: action })
}))
