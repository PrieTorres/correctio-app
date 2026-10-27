import { useQuery } from '@tanstack/react-query';
import { useServices } from '@/app/services';
import { useCurrentUser } from '@/features/auth';
import type { PublicLookup } from '@/types/domain';

export const publicLookupKeys = {
  byCode: (code: string) => ['public-lookup', code] as const,
};

/**
 * Resolves a printed code into the least the rule allows.
 *
 * The reader has no account, so this goes through the public repository and
 * never the teacher's. Retries are off: an unknown code is an answer, not a
 * failure to retry, and retrying a 429 would only spend more of the limit.
 * Nothing is cached: a grade released a minute ago must show on the next scan,
 * and the page is public, so nothing of it stays behind.
 *
 * While the lookup still reads this browser's data, which belongs to whoever is
 * signed in here, it waits for the session to be restored: asked earlier, it
 * searched nobody's data and called a real code invalid.
 *
 * TODO(#148): stop waiting for the session once the lookup reads from the API.
 */
export function usePublicLookup(code: string | undefined) {
  const { publicLookup } = useServices();
  const session = useCurrentUser();

  return useQuery<PublicLookup>({
    queryKey: publicLookupKeys.byCode(code ?? ''),
    enabled: code !== undefined && !session.isPending,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    queryFn: () => publicLookup.findByCode(code ?? ''),
  });
}
