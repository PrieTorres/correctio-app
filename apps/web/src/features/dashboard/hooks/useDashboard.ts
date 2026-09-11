import { useQuery, type QueryKey } from '@tanstack/react-query'
import { useServices } from '@/app/services'

export const dashboardKeys = {
  recentActivity: ['dashboard', 'recentActivity'] as const satisfies QueryKey,
}

export function useRecentActivity() {
  const { repositories } = useServices()

  return useQuery({
    queryKey: dashboardKeys.recentActivity,
    queryFn: () => repositories.activity.listRecent(),
  })
}
