/**
 * Sign up form component
 */
import { useState } from 'react';
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
 const [step, setStep] = useState<1 | 2>(1);
 const [firstName, setFirstName] = useState('');
 const [lastName, setLastName] = useState('');
 const [displayName, setDisplayName] = useState('');
 const [email, setEmail] = useState('');
 const [password, setPassword] = useState('');
 const [confirmPassword, setConfirmPassword] = useState('');
 const [displayNameError, setDisplayNameError] = useState<string | null>(null);
 const [error, setError] = useState<string | null>(null);
 const [isLoading, setIsLoading] = useState(false);

 async function handleSubmit(e: React.FormEvent) {
 e.preventDefault();
 setError(null);
 setDisplayNameError(null);

 const trimmedFirstName = firstName.trim();
 const trimmedLastName = lastName.trim();
 const trimmedDisplayName = displayName.trim();

 if (!trimmedFirstName || !trimmedLastName) {
 setError('Please enter your first and last name.');
 setStep(1);
 return;
 }

 if (trimmedDisplayName.length < 3 || trimmedDisplayName.length > 15) {
 setDisplayNameError('Display name must be between 3 and 15 characters.');
 return;
 }
 
 // Validate passwords match
 if (password !== confirmPassword) {
 setError('Passwords do not match');
 return;
 }
 
 // Validate password length
 if (password.length < 6) {
 setError('Password must be at least 6 characters');
 return;
 }
 
 setIsLoading(true);
 
 try {
 const data = await signUpWithPassword(
 email,
 password,
 trimmedDisplayName,
 trimmedFirstName,
 trimmedLastName
 );
 
 // Check if email confirmation is needed
 if (data.user && !data.session) {
 // Email confirmation required
 onEmailConfirmationNeeded(email);
 } else {
 onSuccess();
 }
 } catch (err: any) {
 const message = err?.message ||'Something went wrong';
 setError(message);
 setIsLoading(false);
 }
 }
 
 // Show loading screen during auth
 if (isLoading) {
 return <AuthLoading />;
 }

 return (
 <div className="min-h-screen flex flex-col bg-white px-6 pt-5">
 <h1 className="text-4xl font-normal text-[#1C8376] leading-[1.2] tracking-tight mt-12 mb-10">Sign up</h1>
 
<form onSubmit={handleSubmit} className="space-y-4">
{step === 1 ? (
<>
<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
<div>
<input
type="text"
value={firstName}
onChange={(e) => setFirstName(e.target.value)}
placeholder="First name"
className="w-full px-4 py-3 border border-slate-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-[#1C8376] focus:border-transparent"
required
autoComplete="given-name"
/>
</div>
<div>
<input
type="text"
value={lastName}
onChange={(e) => setLastName(e.target.value)}
placeholder="Last name"
className="w-full px-4 py-3 border border-slate-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-[#1C8376] focus:border-transparent"
required
autoComplete="family-name"
/>
</div>
</div>

{error && (
<p className="text-sm text-red-600">{error}</p>)}

<button
type="button"
onClick={() => {
 const trimmedFirstName = firstName.trim();
 const trimmedLastName = lastName.trim();
 if (!trimmedFirstName || !trimmedLastName) {
 setError('Please enter your first and last name.');
 return;
 }
 setError(null);
 setStep(2);
}}
className="w-full py-3 bg-[#1C8376] text-white font-semibold rounded-full"
>
Continue
</button>
</>
) : (
<>
 <div>
 <input
 type="text"
 value={displayName}
 onChange={(e) => setDisplayName(e.target.value)}
 placeholder="Display name"
 className="w-full px-4 py-3 border border-slate-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-[#1C8376] focus:border-transparent"
 required
 autoComplete="nickname"
 />
 </div>

{displayNameError && (
<p className="mt-2 text-sm text-red-600">{displayNameError}</p>)}
 
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
 
 {error && (
 <p className="text-sm text-red-600">{error}</p>)}
 
 <div className="flex gap-3">
 <button
 type="button"
 onClick={() => {
 setError(null);
 setDisplayNameError(null);
 setStep(1);
 }}
 className="w-1/3 py-3 border border-slate-300 text-slate-700 font-semibold rounded-full"
 >
 Back
 </button>
 <button
 type="submit"
 className="w-2/3 py-3 bg-[#1C8376] text-white font-semibold rounded-full"
 >
 Sign up
 </button>
 </div>
 </>
)}
 </form>
 
 <div className="mt-6 text-center">
 <p className="text-sm text-slate-500">
 Already have an account?{' '}
 <button 
 type="button"
 onClick={onSwitchToSignIn}
 className="text-[#1C8376]"
 >
 Sign in
 </button>
 </p>
 </div>
 </div>);
}
