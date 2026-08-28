import { useState } from 'react';
import { saveUsername } from '../../lib/userProfile';
import AuthLoading from './AuthLoading';

export default function ChooseUsername({
  userId,
  onComplete,
}: {
  userId: string;
  onComplete: () => void;
}) {
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await saveUsername(userId, displayName);
      onComplete();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setIsLoading(false);
    }
  }

  if (isLoading) return <AuthLoading />;

  return (
    <div className="min-h-screen bg-white">
      <div className="min-h-screen flex flex-col bg-white px-6 pt-5 w-full max-w-[1024px] mx-auto">
        <h1 className="text-[40px] font-normal text-[#1C8376] leading-[1.2] tracking-tight mt-12 mb-4">
          Choose your username
        </h1>
        <p className="text-slate-600 mb-10">
          This is how you appear on leaderboards and in mini leagues. You need one before you can play.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Display name"
            className="w-full px-4 py-3 border border-slate-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-[#1C8376] focus:border-transparent"
            required
            autoComplete="username"
          />
          {error ? <div className="text-sm text-red-600">{error}</div> : null}
          <button
            type="submit"
            className="w-full py-3 rounded-lg bg-[#1C8376] text-white text-base font-medium"
          >
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}
