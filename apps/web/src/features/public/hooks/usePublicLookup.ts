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
 * Where the lookup reads this browser's data, as in the demo, that data belongs
 * to whoever is signed in here, so it waits for the session to be restored:
 * asked earlier, it searched nobody's data and called a real code invalid. On
 * the API it asks at once, since a student has no session to wait for.
 */
export function usePublicLookup(code: string | undefined) {
  const { publicLookup } = useServices();
  const session = useCurrentUser();

  return useQuery<PublicLookup>({
    queryKey: publicLookupKeys.byCode(code ?? ''),
    enabled: code !== undefined && !(publicLookup.readsThisBrowser === true && session.isPending),
    retry: false,
    staleTime: 0,
    gcTime: 0,
    queryFn: () => publicLookup.findByCode(code ?? ''),
  });
}
