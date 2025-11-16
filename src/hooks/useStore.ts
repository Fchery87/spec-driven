'use client'

import { useProjectStore, useUserStore, useUIStore } from '@/lib/store'

/**
 * Custom hook that combines all stores for easier access
 * Usage: const { projects, user, notifications } = useStore()
 */
export function useStore() {
  const projects = useProjectStore((state) => state.projects)
  const currentProjectSlug = useProjectStore((state) => state.currentProjectSlug)
  const projectsLoading = useProjectStore((state) => state.loading)
  const projectsError = useProjectStore((state) => state.error)
  const setProjects = useProjectStore((state) => state.setProjects)
  const setCurrentProject = useProjectStore((state) => state.setCurrentProject)
  const updateProject = useProjectStore((state) => state.updateProject)
  const removeProject = useProjectStore((state) => state.removeProject)

  const user = useUserStore((state) => state.user)
  const isAuthenticated = useUserStore((state) => state.isAuthenticated)
  const userLoading = useUserStore((state) => state.loading)
  const setUser = useUserStore((state) => state.setUser)
  const logout = useUserStore((state) => state.logout)

  const notifications = useUIStore((state) => state.notifications)
  const modals = useUIStore((state) => state.modals)
  const addNotification = useUIStore((state) => state.addNotification)
  const removeNotification = useUIStore((state) => state.removeNotification)
  const openModal = useUIStore((state) => state.openModal)
  const closeModal = useUIStore((state) => state.closeModal)
  const setConfirmAction = useUIStore((state) => state.setConfirmAction)

  return {
    // Projects
    projects,
    currentProjectSlug,
    projectsLoading,
    projectsError,
    setProjects,
    setCurrentProject,
    updateProject,
    removeProject,

    // User
    user,
    isAuthenticated,
    userLoading,
    setUser,
    logout,

    // UI
    notifications,
    modals,
    addNotification,
    removeNotification,
    openModal,
    closeModal,
    setConfirmAction
  }
}
