export function extractSignupVerificationParams(input: {
  search: string;
  hash: string;
  origin: string;
  returnTo?: string | null;
}): { tokenHash: string; email: string } | null {
  const urlParams = new URLSearchParams(input.search);
  const hashParams = new URLSearchParams(input.hash.replace(/^#/, ''));
  const nestedUrl = input.returnTo ? new URL(input.returnTo, input.origin) : null;
  const sources = [
    urlParams,
    hashParams,
    nestedUrl?.searchParams,
    nestedUrl ? new URLSearchParams(nestedUrl.hash.replace(/^#/, '')) : null,
  ].filter((params): params is URLSearchParams => params !== null);

  const signupSource = sources.find(
    params => params.get('type') === 'signup' || !!params.get('token_hash')
  );
  if (!signupSource) return null;

  return {
    tokenHash: signupSource.get('token_hash') || '',
    email: signupSource.get('email') || '',
  };
}
