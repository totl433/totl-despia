/**
 * Sign up form component
 */
import { useState } from 'react';
import {
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  validateDisplayName,
} from '../../lib/userProfile';
import { signUpWithPassword } from './useSupabaseAuth';
import AuthLoading from './AuthLoading';

interface SignUpFormProps {
  onSwitchToSignIn: () => void;
  onSuccess: () => void;
  onEmailConfirmationNeeded: (email: string) => void;
}

export default function SignUpForm({
  onSwitchToSignIn,
  onSuccess,
  onEmailConfirmationNeeded,
}: SignUpFormProps) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const nameError = validateDisplayName(displayName);
    if (nameError) {
      setError(nameError);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);

    try {
      const data = await signUpWithPassword(email, password, displayName);

      if (data.user && !data.session) {
        onEmailConfirmationNeeded(email);
      } else {
        onSuccess();
      }
    } catch (err: any) {
      const message = err?.message || 'Something went wrong';
      setError(message);
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return <AuthLoading />;
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="min-h-screen flex flex-col bg-white px-6 pt-5 w-full max-w-[1024px] mx-auto">
        <h1 className="text-[40px] font-normal text-[#1C8376] leading-[1.2] tracking-tight mt-12 mb-10">
          Sign up
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value.slice(0, USERNAME_MAX_LENGTH))}
              placeholder="Display name"
              className="w-full px-4 py-3 border border-slate-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-[#1C8376] focus:border-transparent"
              required
              minLength={USERNAME_MIN_LENGTH}
              maxLength={USERNAME_MAX_LENGTH}
              autoComplete="name"
            />
            <p className="mt-1.5 text-sm text-slate-500">
              {USERNAME_MIN_LENGTH}–{USERNAME_MAX_LENGTH} characters
            </p>
          </div>

          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full px-4 py-3 border border-slate-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-[#1C8376] focus:border-transparent"
              required
              autoComplete="email"
            />
          </div>

          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-4 py-3 border border-slate-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-[#1C8376] focus:border-transparent"
              required
              autoComplete="new-password"
              minLength={6}
            />
          </div>

          <div>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm Password"
              className="w-full px-4 py-3 border border-slate-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-[#1C8376] focus:border-transparent"
              required
              autoComplete="new-password"
              minLength={6}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            className="w-full py-3 bg-[#1C8376] text-white font-semibold rounded-full"
          >
            Sign up
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-slate-500">
            Already have an account?{' '}
            <button type="button" onClick={onSwitchToSignIn} className="text-[#1C8376]">
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
