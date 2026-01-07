/**
 * Sign in form component
 */
import { useState } from'react';
import { signInWithPassword } from'./useSupabaseAuth';
import AuthLoading from'./AuthLoading';

interface SignInFormProps {
 onSwitchToSignUp: () => void;
 onSwitchToReset: () => void;
 onSuccess: () => void;
}

export default function SignInForm({
 onSwitchToSignUp,
 onSwitchToReset,
 onSuccess,
}: SignInFormProps) {
 const [email, setEmail] = useState('');
 const [password, setPassword] = useState('');
 const [error, setError] = useState<string | null>(null);
 const [isLoading, setIsLoading] = useState(false);

 async function handleSubmit(e: React.FormEvent) {
 e.preventDefault();
 setError(null);
 setIsLoading(true);
 
 try {
 await signInWithPassword(email, password);
 onSuccess();
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
 <h1 className="text-4xl font-semibold text-[#1C8376] leading-[1.2] tracking-tight mt-12 mb-10">Sign in</h1>
 
 <form onSubmit={handleSubmit} className="space-y-4">
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
 autoComplete="current-password"
 />
 </div>
 
 {error && (
 <p className="text-sm text-red-600">{error}</p>)}
 
 <button
 type="submit"
 className="w-full py-3 bg-[#1C8376] text-white font-semibold rounded-full"
 >
 Sign in
 </button>
 </form>
 
 <div className="mt-6 text-center space-y-2">
 <p className="text-sm text-slate-500">
 Forgot password?{''}
     <button 
     type="button"
     onClick={onSwitchToReset}
     className="text-[#1C8376]"
     >
     Reset
     </button>
 </p>
 <p className="text-sm text-slate-500">
 New to Totl?{''}
     <button 
     type="button"
     onClick={onSwitchToSignUp}
     className="text-[#1C8376]"
     >
     Sign up
     </button>
 </p>
 </div>
 </div>);
}
